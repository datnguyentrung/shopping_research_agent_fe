import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";

import { Check, Loader2, Palette, RotateCcw, Save } from "lucide-react";
import { segmentClothing } from "../../../../services/mlService";
import { saveRecoloredImage } from "../../../../services/recolorService";
import {
  hexToHsl,
  imageToImageData,
  recolorImageData,
} from "../../../../utils/color.utils";
import { urlToFile } from "../../../../utils/vto.utils";
import "./ColorPanel.scss";

type Step = "select" | "processing" | "palette";

type Region = {
  id: "shirt" | "pants" | "both";
  label: string;
  prompts: string[];
};

const REGIONS: Region[] = [
  { id: "shirt", label: "Áo", prompts: ["shirt"] },
  {
    id: "pants",
    label: "Quần",
    prompts: ["trousers", "short", "pants"],
  },
  {
    id: "both",
    label: "Cả quần & áo",
    prompts: ["shirt", "trousers", "short", "pants"],
  },
];

// Bảng màu gợi ý (hex). Chọn màu → tính Hue để recolor.
const PALETTE = [
  "#e11d2a", // 0: Đỏ
  "#f97316", // 1: Cam
  "#FFC107", // 2: Vàng (Đã sửa: Vàng tươi và rõ nét hơn)
  "#22c55e", // 3: Xanh lá
  "#2563eb", // 4: Xanh dương đậm
  "#38BDF8", // 5: Xanh dương nhẹ (Đã sửa: Chuẩn màu sky blue, sáng và trong hơn)
  "#8b5cf6", // 6: Tím
  "#ec4899", // 7: Hồng
  "#C4A484", // 8: Nâu nhẹ (Đã sửa: Rõ sắc nâu nhạt/tan, không bị lợt thành màu be)
  "#8b5e3c", // 9: Nâu đậm (Giữ nguyên để có chiều sâu nếu cần)
  "#9ca3af", // 10: Xám
  "#000000", // 11: Đen (Đen tuyền tuyệt đối, thay cho màu xám đậm cũ)
];

// Ánh xạ label BE trả về (shirt/trousers/short/pants) sang tên tiếng Việt.
const LABEL_DISPLAY: Record<string, string> = {
  shirt: "Áo",
  trousers: "Quần",
  short: "Quần",
  pants: "Quần",
};

interface ColorPanelProps {
  sourceImageUrl: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
  SparkleIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function ColorPanel({
  sourceImageUrl,
  onSave,
  onClose,
  SparkleIcon,
}: ColorPanelProps) {
  const [step, setStep] = useState<Step>("select");
  const [progress, setProgress] = useState(0);
  const [processingText, setProcessingText] = useState(
    "Đang tách vùng trang phục…",
  );
  const [error, setError] = useState<string | null>(null);

  // masks[label] = data URL PNG RGBA nền trong suốt
  const [masks, setMasks] = useState<Record<string, string>>({});
  // Màu đã chọn cho mỗi label (hex)
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>(
    {},
  );
  // Label đang chọn để gán màu (Áo / Quần …)
  const labels = useMemo(() => Object.keys(masks), [masks]);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cache pixel gốc của mỗi mask (chỉ đọc 1 lần để tránh re-segment).
  const maskBaseRef = useRef<Record<string, ImageData>>({});
  // Offscreen canvas đã recolor cho mỗi label — chỉ tính lại khi đổi màu.
  const recoloredCanvasRef = useRef<Record<string, HTMLCanvasElement>>({});
  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  const dimsRef = useRef<{ w: number; h: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  // Progress giả lập trong lúc chờ BE segment.
  const progressTimerRef = useRef<number | null>(null);
  const startFakeProgress = useCallback(() => {
    setProgress(8);
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }
    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        const next = prev + Math.max(1, Math.round((92 - prev) / 12));
        return Math.min(next, 92);
      });
    }, 350);
  }, []);
  const stopFakeProgress = useCallback((finalValue?: number) => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }
    progressTimerRef.current = null;
    if (typeof finalValue === "number") {
      setProgress(finalValue);
    }
  }, []);

  // Nạp ảnh nguồn + cache ImageData gốc cho từng mask khi vào bước palette.
  useEffect(() => {
    if (step !== "palette" || labels.length === 0) return;

    let canceled = false;

    const load = async () => {
      try {
        const sourceImg = await loadImage(sourceImageUrl);
        if (canceled) return;

        const w = sourceImg.naturalWidth;
        const h = sourceImg.naturalHeight;
        dimsRef.current = { w, h };
        sourceImgRef.current = sourceImg;

        // Cache pixel gốc của từng mask (chỉ đọc 1 lần).
        const base: Record<string, ImageData> = {};
        for (const label of labels) {
          const maskImg = await loadImage(masks[label]);
          if (canceled) return;
          base[label] = imageToImageData(maskImg, w, h);
        }
        maskBaseRef.current = base;
        render();
      } catch {
        if (!canceled) {
          setError("Không tải được ảnh để đổi màu. Vui lòng thử lại.");
        }
      }
    };

    void load();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, labels.length]);

  // Vẽ canvas chính: ảnh nguồn + overlay các mask đã recolor.
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const dims = dimsRef.current;
    const sourceImg = sourceImgRef.current;
    if (!canvas || !dims || !sourceImg) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = dims;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImg, 0, 0, w, h);

    // Overlay từng vùng đã chọn màu (source-over: chỉ pixel alpha>0 hiện lên).
    for (const label of labels) {
      const recolored = recoloredCanvasRef.current[label];
      if (recolored) {
        ctx.drawImage(recolored, 0, 0, w, h);
      }
    }
  }, [labels]);

  // Tính lại offscreen canvas recolor cho 1 label (chỉ label đổi màu mới tính lại).
  const recomputeRecolored = useCallback((label: string, hex: string) => {
    const base = maskBaseRef.current[label];
    const dims = dimsRef.current;
    if (!base || !dims) return;

    // Bản sao pixel gốc → tô lại Hue mới, không đè lên cache gốc.
    const copy = new ImageData(
      new Uint8ClampedArray(base.data),
      base.width,
      base.height,
    );
    const { h, s } = hexToHsl(hex);
    recolorImageData(copy, h, { targetSat: s });

    const off = document.createElement("canvas");
    off.width = dims.w;
    off.height = dims.h;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(copy, 0, 0);
    recoloredCanvasRef.current[label] = off;
  }, []);

  // Gom nhiều lần chọn vào 1 frame để tránh vẽ thừa.
  const scheduleRender = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      render();
    });
  }, [render]);

  // Chọn vùng ở bước 1 → gọi segment.
  const handleSelectRegion = useCallback(
    async (region: Region) => {
      setError(null);
      setStep("processing");
      setProcessingText("Đang tách vùng trang phục…");
      startFakeProgress();

      try {
        const file = await urlToFile(sourceImageUrl, "recolor-source.png");
        const result = await segmentClothing(file, region.prompts);

        if (Object.keys(result.masks).length === 0) {
          throw new Error(
            result.notFound.length > 0
              ? `Không tìm thấy "${region.label}" trên ảnh.`
              : "Không tách được vùng trang phục.",
          );
        }

        stopFakeProgress(100);
        // Reset cache recolor khi sang vùng mới.
        recoloredCanvasRef.current = {};
        maskBaseRef.current = {};
        setMasks(result.masks);
        setSelectedColors({});
        setActiveLabel(Object.keys(result.masks)[0] ?? null);
        setStep("palette");
      } catch (err) {
        stopFakeProgress(0);
        setError(
          err instanceof Error ? err.message : "Lỗi khi tách vùng trang phục.",
        );
        setStep("select");
      }
    },
    [sourceImageUrl, startFakeProgress, stopFakeProgress],
  );

  // Chọn màu ở bước 3 → gán cho label đang active, recolor realtime.
  const handlePickColor = useCallback(
    (hex: string) => {
      if (!activeLabel) return;
      setSelectedColors((prev) => ({ ...prev, [activeLabel]: hex }));
      recomputeRecolored(activeLabel, hex);
      scheduleRender();
    },
    [activeLabel, recomputeRecolored, scheduleRender],
  );

  // Lưu ảnh: xuất data URL, gọi API (mock) rồi báo lên parent để thay ảnh chính.
  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || isSaving) return;

    setIsSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await saveRecoloredImage(dataUrl);
      setHasSaved(true);
      onSave(dataUrl);
    } catch {
      setError("Không lưu được ảnh. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onSave]);

  // Hoàn tác màu của label đang active (quay về ảnh gốc vùng đó).
  const handleResetRegion = useCallback(() => {
    if (!activeLabel) return;
    setSelectedColors((prev) => {
      const next = { ...prev };
      delete next[activeLabel];
      return next;
    });
    delete recoloredCanvasRef.current[activeLabel];
    scheduleRender();
  }, [activeLabel, scheduleRender]);

  // Dọn timer / raf khi unmount.
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="mpv-color" aria-label="Đổi màu trang phục">
      {step === "select" && (
        <div className="mpv-color-step mpv-color-step--select">
          <div className="mpv-color-head">
            <span className="mpv-color-head-icon" aria-hidden="true">
              <Palette size={18} />
            </span>
            <div className="mpv-color-head-text">
              <span className="mpv-color-title">Đổi màu trang phục</span>
              <span className="mpv-color-subtitle">
                Chọn vùng bạn muốn đổi màu
              </span>
            </div>
          </div>

          {error && (
            <div className="mpv-color-error" role="alert">
              {error}
            </div>
          )}

          <div className="mpv-color-region-list">
            {REGIONS.map((region) => (
              <button
                key={region.id}
                className="mpv-color-region-btn"
                type="button"
                onClick={() => handleSelectRegion(region)}
              >
                <span className="mpv-color-region-label">{region.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="mpv-color-step mpv-color-step--processing">
          <div className="mpv-progress-card">
            <div className="mpv-progress-header">
              <Loader2 className="mpv-color-spin" size={18} />
              <p className="mpv-progress-text">{processingText}</p>
              <span className="mpv-progress-percent">{progress}%</span>
            </div>
            <div className="mpv-progress-track">
              <div
                className="mpv-progress-bar"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {step === "palette" && (
        <div className="mpv-color-step mpv-color-step--palette">
          <canvas
            ref={canvasRef}
            className="mpv-color-canvas"
            aria-label="Xem trước đổi màu"
          />

          {labels.length > 1 && (
            <div className="mpv-color-tabs" role="tablist">
              {labels.map((label) => (
                <button
                  key={label}
                  className="mpv-color-tab"
                  type="button"
                  role="tab"
                  aria-selected={activeLabel === label}
                  data-active={activeLabel === label}
                  onClick={() => setActiveLabel(label)}
                >
                  {LABEL_DISPLAY[label] ?? label}
                </button>
              ))}
            </div>
          )}

          <div className="mpv-color-palette">
            {PALETTE.map((hex) => {
              const selected = activeLabel
                ? selectedColors[activeLabel] === hex
                : false;
              return (
                <button
                  key={hex}
                  className="mpv-color-swatch"
                  type="button"
                  style={{ background: hex }}
                  data-selected={selected}
                  aria-label={`Chọn màu ${hex}`}
                  aria-pressed={selected}
                  onClick={() => handlePickColor(hex)}
                >
                  {selected && (
                    <Check size={14} className="mpv-color-swatch-check" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mpv-color-actions">
            <button
              className="mpv-secondary-btn"
              type="button"
              onClick={handleResetRegion}
              disabled={!activeLabel}
            >
              <RotateCcw size={14} />
              Hoàn tác vùng
            </button>
            <button
              className="mpv-primary-btn"
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              data-loading={isSaving}
            >
              {isSaving ? (
                <Loader2 size={14} className="mpv-color-spin" />
              ) : (
                <Save size={14} />
              )}
              {hasSaved ? "Lưu lại" : "Lưu ảnh"}
            </button>
            <button
              className="mpv-secondary-btn"
              type="button"
              onClick={onClose}
            >
              <SparkleIcon width={14} height={14} />
              {hasSaved ? "Hoàn tất" : "Hủy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Nạp ảnh (hỗ trợ CORS để sau này có thể đọc pixel). Trả về HTMLImageElement.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Không tải được ảnh: ${src}`));
    img.src = src;
  });
}
