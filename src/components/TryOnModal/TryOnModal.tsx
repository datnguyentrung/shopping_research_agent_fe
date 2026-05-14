import { apiConfig } from "@/services/api";
import { validatePose } from "@/utils/validatePose";
import { Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import "./TryOnModal.scss";

type VtoStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "pending"
  | "completed"
  | "error";

type PersonSource =
  | { kind: "persona"; src: string; label: string }
  | { kind: "user"; src: string; label: string };

type VtoWsMessage = {
  status?: string;
  result_url?: string;
  error?: string | null;
};

const LOCALSTORAGE_KEY = "but_user_photo";

function toOrigin(baseUrl: string) {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl.replace(/\/$/, "");
  }
}

function toWebSocketBaseUrl(httpBaseUrl: string) {
  try {
    const url = new URL(httpBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return httpBaseUrl.replace(/^https?:/, (m) =>
      m === "https:" ? "wss:" : "ws:",
    );
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(meta);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

async function urlToFile(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch image");
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

interface TryOnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productImageUrl: string;
  productName?: string;
}

export default function TryOnModal({
  open,
  onOpenChange,
  productImageUrl,
  productName,
}: TryOnModalProps) {
  const personas = useMemo(
    () => [
      {
        id: "m-slim",
        label: "Nam - gọn",
        src: "/vto-personas/dat1.jpg",
      },
      {
        id: "m-wide",
        label: "Nam - to",
        src: "/vto-personas/dat2.jpg",
      },
      {
        id: "f-slim",
        label: "Nữ - gọn",
        src: "/vto-personas/dat3.jpg",
      },
    ],
    [],
  );

  const [tab, setTab] = useState<"persona" | "user">("persona");
  const [selected, setSelected] = useState<PersonSource | null>(null);
  const [savedUserPhoto, setSavedUserPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<VtoStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    setSavedUserPhoto(stored);

    // Default selection: prefer saved user photo, else persona #1
    if (stored) {
      setSelected({ kind: "user", src: stored, label: "Ảnh đã lưu" });
      setTab("user");
    } else {
      setSelected({
        kind: "persona",
        src: personas[0].src,
        label: personas[0].label,
      });
      setTab("persona");
    }
    setStatus("idle");
    setProgress(0);
    setResultUrl(null);
    setError(null);
  }, [open, personas]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (progressTimerRef.current)
        window.clearInterval(progressTimerRef.current);
    };
  }, []);

  const startFakeProgress = () => {
    setProgress(8);
    if (progressTimerRef.current)
      window.clearInterval(progressTimerRef.current);

    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        const next = prev + Math.max(1, Math.round((92 - prev) / 12));
        return Math.min(next, 92);
      });
    }, 350);
  };

  const stopProgress = (finalValue?: number) => {
    if (progressTimerRef.current)
      window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
    if (typeof finalValue === "number") setProgress(finalValue);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleUserFile = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    localStorage.setItem(LOCALSTORAGE_KEY, dataUrl);
    setSavedUserPhoto(dataUrl);
    setSelected({ kind: "user", src: dataUrl, label: "Ảnh của bạn" });
    setTab("user");
    setError(null);
  };

  const getPersonFile = async (source: PersonSource): Promise<File> => {
    if (source.kind === "persona") {
      return urlToFile(source.src, "persona.png");
    }

    const blob = dataUrlToBlob(source.src);
    const ext = blob.type.includes("jpeg") ? "jpg" : "png";
    return new File([blob], `but-user.${ext}`, {
      type: blob.type || "image/png",
    });
  };

  const handleVTO = async () => {
    if (!selected) return;

    setError(null);
    setResultUrl(null);

    try {
      if (selected.kind === "user") {
        setStatus("validating");
        const ok = await validatePose(selected.src);
        if (!ok) {
          setStatus("idle");
          setError(
            "Bụt không thấy rõ dáng bạn, hãy chọn ảnh đứng thẳng và rõ người nhé!",
          );
          return;
        }
      }

      setStatus("uploading");
      startFakeProgress();

      const personFile = await getPersonFile(selected);
      const form = new FormData();
      form.append("person_image_file", personFile);
      form.append("product_file_path", productImageUrl);

      const backendOrigin = toOrigin(apiConfig.baseUrl);
      const response = await fetch(`${backendOrigin}/fire`, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.json();
      const requestId =
        json?.request_id ??
        json?.requestId ??
        json?.id ??
        json?.data?.request_id;

      if (!requestId) {
        throw new Error("Missing request_id");
      }

      setStatus("pending");

      const wsBase = toWebSocketBaseUrl(backendOrigin);
      const ws = new WebSocket(`${wsBase}/ws/vto/${requestId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as VtoWsMessage;
          if (message.error) {
            setStatus("error");
            stopProgress();
            setError(String(message.error));
            ws.close();
            return;
          }

          if (message.status === "completed" && message.result_url) {
            setStatus("completed");
            stopProgress(100);
            setResultUrl(message.result_url);
            ws.close();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setStatus("error");
        stopProgress();
        setError("Kết nối may đo bị lỗi. Vui lòng thử lại.");
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch (e) {
      setStatus("error");
      stopProgress();
      setError(e instanceof Error ? e.message : "Đã có lỗi xảy ra");
    }
  };

  const isBusy =
    status === "validating" || status === "uploading" || status === "pending";
  const canStart = Boolean(selected) && !isBusy;

  const showLoading =
    status === "pending" || status === "uploading" || status === "validating";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tryon-modal">
        <div className="tryon-modal__header">
          <div className="tryon-modal__title-row">
            <span className="tryon-modal__sparkle">
              <Sparkles className="tryon-modal__sparkle-icon" />
            </span>
            <h2 className="tryon-modal__title">✨ Thử đồ với Bụt</h2>
          </div>
          <p className="tryon-modal__desc">
            Chọn ảnh mẫu hoặc ảnh của bạn, rồi để Bụt may đo.
          </p>
        </div>

        <div className="tryon-modal__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "persona"}
            className={`tryon-modal__tab ${
              tab === "persona" ? "tryon-modal__tab--active" : ""
            }`}
            onClick={() => setTab("persona")}
          >
            Ảnh mẫu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "user"}
            className={`tryon-modal__tab ${
              tab === "user" ? "tryon-modal__tab--active" : ""
            }`}
            onClick={() => setTab("user")}
          >
            Ảnh của bạn
          </button>
        </div>

        <div className="tryon-modal__body">
          {tab === "persona" && (
            <div role="tabpanel">
              <div className="tryon-modal__persona-grid">
                {personas.map((p) => {
                  const isSelected =
                    selected?.kind === "persona" && selected.src === p.src;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`tryon-modal__persona ${
                        isSelected ? "tryon-modal__persona--selected" : ""
                      }`}
                      onClick={() => {
                        setSelected({
                          kind: "persona",
                          src: p.src,
                          label: p.label,
                        });
                        setError(null);
                      }}
                    >
                      <img
                        className="tryon-modal__persona-img"
                        src={p.src}
                        alt={p.label}
                      />
                      <div className="tryon-modal__persona-label">
                        {p.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "user" && (
            <div role="tabpanel">
              <div className="tryon-modal__upload">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="tryon-modal__file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUserFile(file);
                  }}
                />

                <button
                  type="button"
                  className="tryon-modal__btn tryon-modal__btn--outline"
                  onClick={handleUploadClick}
                  disabled={isBusy}
                >
                  <Upload className="tryon-modal__btn-icon" />
                  Tải ảnh mới
                </button>

                {savedUserPhoto && (
                  <button
                    type="button"
                    className="tryon-modal__btn tryon-modal__btn--secondary"
                    onClick={() => {
                      setSelected({
                        kind: "user",
                        src: savedUserPhoto,
                        label: "Ảnh đã lưu",
                      });
                      setError(null);
                    }}
                    disabled={isBusy}
                  >
                    Dùng ảnh đã lưu
                  </button>
                )}
              </div>

              {savedUserPhoto && (
                <div className={'tryon-modal__user-preview'}>
                  <img
                    className={'tryon-modal__user-preview-img'}
                    src={savedUserPhoto}
                    alt={'Ảnh của bạn'}
                  />
                  <div className={'tryon-modal__user-preview-info'}>
                    <span className={'tryon-modal__user-preview-label'}>
                      Ảnh của bạn
                    </span>
                    <span className={'tryon-modal__user-preview-status'}>
                      Sẽ được dùng để thử đồ
                    </span>
                    <span className={'tryon-modal__user-preview-badge'}>
                      Đã lưu
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {showLoading && (
            <div className="tryon-modal__loading" aria-live="polite">
              <div className="tryon-modal__loading-top">
                <p className="tryon-modal__loading-title">Bụt đang may đo...</p>
                <span className="tryon-modal__loading-status">{status}</span>
              </div>

              <div
                className="tryon-modal__progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <div
                  className="tryon-modal__progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {!showLoading && (
            <div className="tryon-modal__preview-row">
              <div className="tryon-modal__preview-card">
                <div className="tryon-modal__preview-title">Sản phẩm</div>
                <img
                  className="tryon-modal__preview-img"
                  src={productImageUrl}
                  alt={productName ?? "Sản phẩm"}
                />
              </div>

              <div
                className={`tryon-modal__preview-card${resultUrl ? " tryon-modal__preview-card--result" : ""}`}
              >
                <div className="tryon-modal__preview-title">Kết quả</div>
                <img
                  className="tryon-modal__preview-img"
                  src={resultUrl ?? productImageUrl}
                  alt="Kết quả VTO"
                />
              </div>
            </div>
          )}

          {error && <div className="tryon-modal__error">{error}</div>}
        </div>

        <div className="tryon-modal__footer">
          <button
            type="button"
            className="tryon-modal__btn tryon-modal__btn--outline"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </button>
          <button
            type="button"
            className="tryon-modal__btn tryon-modal__btn--primary"
            onClick={handleVTO}
            disabled={!canStart}
          >
            ✨ Thử ngay
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
