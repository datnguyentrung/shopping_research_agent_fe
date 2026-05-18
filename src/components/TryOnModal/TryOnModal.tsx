import {
  AlertCircle,
  Clock,
  ImageOff,
  Info,
  Loader2,
  Shirt,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { showSuccessToast } from "../ui/toast";
import "./TryOnModal.scss";

import { apiConfig } from "@/services/api";
import {
  fetchTryOnHistory,
  fireTryOnRequest,
} from "@/services/virtualTryOnService";
import type { TryOnHistoryItem } from "@/types/vto.types";
import { compressImage, validatePose } from "@/utils/validatePose";
import { formatDateDMY } from "../../utils/format";

const PRESET_MODELS = [
  {
    id: "m1",
    src: "/vto-personas/dat1.jpg",
    label: "Mẫu Á Châu",
  },
  {
    id: "m2",
    src: "/vto-personas/dat2.jpg",
    label: "Mẫu Châu Âu",
  },
  {
    id: "m3",
    src: "/vto-personas/dat3.jpg",
    label: "Mẫu Da Màu",
  },
];

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

// --- Helper Functions ---
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

// function readFileAsDataUrl(file: File): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = () => resolve(String(reader.result));
//     reader.onerror = () => reject(new Error("Failed to read file"));
//     reader.readAsDataURL(file);
//   });
// }

// --- Component ---
interface TryOnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productImageUrl: string;
  productUrl: string;
  productName?: string;
  defaultView?: "history" | "new_try_on";
}

export default function TryOnModal({
  open,
  onOpenChange,
  productImageUrl,
  productUrl,
  productName = "Sản phẩm đang chọn",
  defaultView = "new_try_on",
}: TryOnModalProps) {
  // Xác định chế độ hiển thị: lịch sử hay thử đồ mới
  const [currentView, setCurrentView] = useState<"history" | "new_try_on">(
    defaultView,
  );

  // State quản lý tab (thay vì string đơn thuần, giờ gắn với logic user/persona)
  const [activeTab, setActiveTab] = useState<"preset" | "upload">("preset");

  // Các state từ file Logic
  const [selected, setSelected] = useState<PersonSource | null>(null);
  const [savedUserPhoto, setSavedUserPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<VtoStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History state
  const [historyItems, setHistoryItems] = useState<TryOnHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Khởi tạo Modal
  useEffect(() => {
    if (!open) return;

    // Đặt chế độ xem dựa trên prop
    setCurrentView(defaultView);

    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    setSavedUserPhoto(stored);

    // Default selection
    if (stored) {
      setSelected({ kind: "user", src: stored, label: "Ảnh đã lưu" });
      setActiveTab("upload");
    } else {
      setSelected({
        kind: "persona",
        src: PRESET_MODELS[0].src,
        label: PRESET_MODELS[0].label,
      });
      setActiveTab("preset");
    }

    setStatus("idle");
    setProgress(0);
    setResultUrl(null);
    setError(null);
  }, [open, defaultView]);

  // Dọn dẹp Websocket khi unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (progressTimerRef.current)
        window.clearInterval(progressTimerRef.current);
    };
  }, []);

  // Fetch lịch sử thử đồ khi mở modal ở chế độ history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await fetchTryOnHistory();
      console.log("Fetched try-on history:", data);
      setHistoryItems(data);
    } catch (err) {
      console.error(err);
      setHistoryError("Không thể tải lịch sử thử đồ. Vui lòng thử lại.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && currentView === "history") {
      void loadHistory();
    }
  }, [open, currentView, loadHistory]);

  // Logic Process Bar ảo trong lúc đợi Socket
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

  // Logic Upload Ảnh
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleUserFile = async (file: File) => {
    try {
      setError(null);
      // Nén ảnh trước khi lưu thay vì dùng readFileAsDataUrl
      const dataUrl = await compressImage(file);

      // Lưu thoải mái không lo QuotaExceededError
      localStorage.setItem(LOCALSTORAGE_KEY, dataUrl);
      setSavedUserPhoto(dataUrl);
      setSelected({ kind: "user", src: dataUrl, label: "Ảnh của bạn" });
      setActiveTab("upload");
    } catch (err) {
      console.error(err);
      setError("Không thể xử lý ảnh. Vui lòng tải ảnh khác nhẹ hơn.");
    }
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

  // Nút Bắt Đầu
  const handleStart = async () => {
    if (!selected) return;
    // Nếu đã có kết quả hoàn chỉnh thì chặn không cho bắt đầu lại
    if (status === "completed" && resultUrl) return;

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
      const json = await fireTryOnRequest(
        personFile,
        productImageUrl,
        productUrl,
        productName,
      );

      const requestId =
        json?.request_id ??
        json?.requestId ??
        json?.id ??
        json?.data?.request_id;

      if (!requestId) {
        throw new Error("Missing request_id");
      }

      setStatus("pending");

      const wsBase = toWebSocketBaseUrl(toOrigin(apiConfig.baseUrl));
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
            showSuccessToast("Thử đồ thành công — kết quả đã sẵn sàng");
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

  // Trạng thái Render
  const isProcessing =
    status === "validating" || status === "uploading" || status === "pending";
  const resultReady = status === "completed" && resultUrl !== null;
  const isButtonDisabled =
    !selected || isProcessing || (status === "completed" && resultUrl !== null);

  let processingText = "Bụt đang chuẩn bị...";
  if (status === "validating") processingText = "Đang kiểm tra vóc dáng...";
  if (status === "uploading") processingText = "Đang tải ảnh lên hệ thống...";
  if (status === "pending") processingText = "Bụt đang cân chỉnh trang phục...";

  return (
    <AnimatePresence>
      {open && (
        <div className="tryon-modal-shell">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isProcessing && onOpenChange(false)}
            className="tryon-modal-shell__backdrop"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="tryon-modal-shell__container"
          >
            {!isProcessing && (
              <button
                onClick={() => onOpenChange(false)}
                className="tryon-modal-shell__close-btn"
              >
                <X className="tryon-modal-shell__close-icon" />
              </button>
            )}

            <AnimatePresence mode="wait">
              {currentView === "history" && (
                <motion.div
                  key="history-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="tryon-modal tryon-modal--history"
                >
                  <div className="tryon-modal__header tryon-modal__header--history">
                    <div className="tryon-modal__header-row">
                      <div className="tryon-modal__title-row">
                        <div className="tryon-modal__history-icon">
                          <Shirt className="tryon-modal__history-icon-svg" />
                        </div>
                        <div>
                          <h2 className="tryon-modal__title">Kho thử đồ</h2>
                          <p className="tryon-modal__desc tryon-modal__desc--compact">
                            Những lần thử đồ gần đây của bạn
                          </p>
                        </div>
                      </div>
                      {/* <button
                        onClick={() => setCurrentView("new_try_on")}
                        className="tryon-modal__primary-btn"
                      >
                        <Plus className="tryon-modal__primary-btn-icon" />
                        Thử đồ mới
                      </button> */}
                    </div>
                  </div>

                  <div className="tryon-modal__body tryon-modal__body--history">
                    {/* Loading skeleton */}
                    {historyLoading && (
                      <div className="tryon-modal__history-grid">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`skel-${i}`}
                            className="tryon-modal__history-skeleton"
                          >
                            <div className="tryon-modal__history-skeleton-img" />
                            <div className="tryon-modal__history-skeleton-meta">
                              <div className="tryon-modal__history-skeleton-line tryon-modal__history-skeleton-line--title" />
                              <div className="tryon-modal__history-skeleton-line tryon-modal__history-skeleton-line--time" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error */}
                    {!historyLoading && historyError && (
                      <div className="tryon-modal__history-empty">
                        <ImageOff className="tryon-modal__history-empty-icon" />
                        <p className="tryon-modal__history-empty-title">
                          Không thể tải lịch sử
                        </p>
                        <p className="tryon-modal__history-empty-desc">
                          {historyError}
                        </p>
                        <button
                          onClick={() => void loadHistory()}
                          className="tryon-modal__secondary-btn"
                          type="button"
                        >
                          Thử lại
                        </button>
                      </div>
                    )}

                    {/* Empty state */}
                    {!historyLoading &&
                      !historyError &&
                      historyItems.length === 0 && (
                        <div className="tryon-modal__history-empty">
                          <Shirt className="tryon-modal__history-empty-icon" />
                          <p className="tryon-modal__history-empty-title">
                            Chưa có lịch sử thử đồ
                          </p>
                          <p className="tryon-modal__history-empty-desc">
                            Hãy thử đồ để xem kết quả tại đây.
                          </p>
                          {/* <button
                            onClick={() => setCurrentView("new_try_on")}
                            className="tryon-modal__primary-btn"
                            type="button"
                          >
                            <Plus className="tryon-modal__primary-btn-icon" />
                            Thử đồ mới
                          </button> */}
                        </div>
                      )}

                    {/* History list */}
                    {!historyLoading &&
                      !historyError &&
                      historyItems.length > 0 && (
                        <div
                          className="tryon-modal__history-grid"
                          role="list"
                          aria-label="Lịch sử thử đồ"
                        >
                          {historyItems.map((item, index) => {
                            const isCompleted =
                              item.status === "completed" && item.resultBase64;
                            const imgSrc = isCompleted ? item.resultBase64 : "";

                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="tryon-modal__history-card"
                                role="listitem"
                              >
                                <div className="tryon-modal__history-card-media">
                                  {isCompleted ? (
                                    <img
                                      src={imgSrc}
                                      alt="Kết quả thử đồ"
                                      className="tryon-modal__history-card-img"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="tryon-modal__history-card-placeholder">
                                      <ImageOff className="tryon-modal__history-card-placeholder-icon" />
                                      <span className="tryon-modal__history-card-placeholder-text">
                                        {item.status === "pending"
                                          ? "Đang xử lý…"
                                          : "Không có ảnh"}
                                      </span>
                                    </div>
                                  )}
                                  <div className="tryon-modal__history-card-overlay" />
                                  <div className="tryon-modal__history-card-badge">
                                    <Sparkles className="tryon-modal__history-card-badge-icon" />
                                    <span className="tryon-modal__tiny-text">
                                      Bụt AI
                                    </span>
                                  </div>
                                  {item.status === "completed" && (
                                    <div className="tryon-modal__history-card-status tryon-modal__history-card-status--completed">
                                      Hoàn thành
                                    </div>
                                  )}
                                  {item.status === "pending" && (
                                    <div className="tryon-modal__history-card-status tryon-modal__history-card-status--pending">
                                      Đang xử lý…
                                    </div>
                                  )}
                                  {item.status === "rejected" && (
                                    <div className="tryon-modal__history-card-status tryon-modal__history-card-status--rejected">
                                      Bị từ chối
                                    </div>
                                  )}
                                </div>
                                <div className="tryon-modal__history-card-meta">
                                  <p className="tryon-modal__history-card-title tryon-modal__line-clamp-1">
                                    {item.productPath ? (
                                      <a
                                        href={item.productPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        // Kế thừa màu chữ của thẻ p và thêm hiệu ứng gạch chân (tuỳ chọn)
                                        style={{
                                          color: "inherit",
                                          textDecoration: "underline",
                                        }}
                                        // Ngăn không cho sự kiện click lan ra ngoài (nếu thẻ div ngoài cùng có onClick)
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Link sản phẩm
                                      </a>
                                    ) : (
                                      "Sản phẩm"
                                    )}
                                  </p>
                                  <div className="tryon-modal__history-card-time">
                                    <Clock className="tryon-modal__history-card-time-icon" />
                                    <span className="tryon-modal__history-card-time-text">
                                      {formatDateDMY(item.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                </motion.div>
              )}

              {currentView === "new_try_on" && (
                <motion.div
                  key="tryon-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="tryon-modal tryon-modal--editor"
                >
                  {defaultView === "history" && (
                    <button
                      onClick={() => setCurrentView("history")}
                      className="tryon-modal__back-btn"
                    >
                      <Shirt className="tryon-modal__back-btn-icon" />
                      Kho thử đồ
                    </button>
                  )}

                  <div className="tryon-modal__panel tryon-modal__panel--left">
                    <div className="tryon-modal__panel-header">
                      <div className="tryon-modal__title-row">
                        <div className="tryon-modal__section-icon">
                          <Sparkles className="tryon-modal__section-icon-svg" />
                        </div>
                        <h2 className="tryon-modal__title">Thử đồ với Bụt</h2>
                      </div>
                      <p className="tryon-modal__desc tryon-modal__desc--indented">
                        Trải nghiệm ướm thử trang phục chân thực.
                      </p>
                    </div>

                    <div className="tryon-modal__panel-body">
                      <section className="tryon-modal__section">
                        <h3 className="tryon-modal__section-title">
                          <span className="tryon-modal__step-badge">1</span>
                          Chọn Người Mẫu
                        </h3>

                        <div className="tryon-modal__tabs">
                          <motion.div
                            layoutId="activeTab"
                            className="tryon-modal__tabs-active"
                            initial={false}
                            animate={{ x: activeTab === "preset" ? 0 : "100%" }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 30,
                            }}
                          />
                          <button
                            onClick={() => {
                              setActiveTab("preset");
                              setSelected({
                                kind: "persona",
                                src: PRESET_MODELS[0].src,
                                label: PRESET_MODELS[0].label,
                              });
                              setError(null);
                            }}
                            className={`tryon-modal__tab ${activeTab === "preset" ? "tryon-modal__tab--active" : ""}`}
                          >
                            Ảnh Mẫu Có Sẵn
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab("upload");
                              if (savedUserPhoto) {
                                setSelected({
                                  kind: "user",
                                  src: savedUserPhoto,
                                  label: "Ảnh của bạn",
                                });
                              }
                              setError(null);
                            }}
                            className={`tryon-modal__tab ${activeTab === "upload" ? "tryon-modal__tab--active" : ""}`}
                          >
                            Tải Ảnh Của Bạn
                          </button>
                        </div>

                        <div className="tryon-modal__tab-content">
                          <AnimatePresence mode="wait">
                            {activeTab === "preset" ? (
                              <motion.div
                                key="preset"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="tryon-modal__persona-grid"
                              >
                                {PRESET_MODELS.map((model) => (
                                  <button
                                    key={model.id}
                                    onClick={() => {
                                      setSelected({
                                        kind: "persona",
                                        src: model.src,
                                        label: model.label,
                                      });
                                      setError(null);
                                    }}
                                    className={`tryon-modal__persona ${selected?.kind === "persona" && selected.src === model.src ? "tryon-modal__persona--selected" : ""}`}
                                  >
                                    <img
                                      src={model.src}
                                      alt={model.label}
                                      className="tryon-modal__persona-img"
                                    />
                                    <div className="tryon-modal__persona-label-wrap">
                                      <span className="tryon-modal__persona-label">
                                        {model.label}
                                      </span>
                                    </div>
                                    {selected?.kind === "persona" &&
                                      selected.src === model.src && (
                                        <div className="tryon-modal__persona-check">
                                          <svg
                                            className="tryon-modal__persona-check-icon"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={3}
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        </div>
                                      )}
                                  </button>
                                ))}
                              </motion.div>
                            ) : (
                              <motion.div
                                key="upload"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="tryon-modal__upload"
                              >
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="tryon-modal__file-input"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handleUserFile(file);
                                  }}
                                />

                                {savedUserPhoto ? (
                                  <div className="tryon-modal__user-preview">
                                    <div className="tryon-modal__user-preview-img-wrap">
                                      <img
                                        src={savedUserPhoto}
                                        alt="User"
                                        className="tryon-modal__user-preview-img"
                                      />
                                    </div>
                                    <div className="tryon-modal__user-preview-info">
                                      <h4 className="tryon-modal__user-preview-label">
                                        Ảnh của bạn
                                      </h4>
                                      <span className="tryon-modal__user-preview-badge">
                                        Đã lưu
                                      </span>
                                      <button
                                        onClick={handleUploadClick}
                                        className="tryon-modal__upload-link"
                                      >
                                        <UploadCloud className="tryon-modal__upload-link-icon" />
                                        Tải ảnh khác
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onClick={handleUploadClick}
                                    className="tryon-modal__upload-dropzone"
                                  >
                                    <div className="tryon-modal__upload-dropzone-icon-wrap">
                                      <UploadCloud className="tryon-modal__upload-dropzone-icon" />
                                    </div>
                                    <h4 className="tryon-modal__upload-dropzone-title">
                                      Kéo thả hoặc Click
                                    </h4>
                                    <p className="tryon-modal__upload-dropzone-desc">
                                      để tải ảnh vóc dáng của bạn lên
                                    </p>
                                    <button className="tryon-modal__secondary-btn">
                                      Tải ảnh lên
                                    </button>
                                  </div>
                                )}

                                <div className="tryon-modal__hint">
                                  <Info className="tryon-modal__hint-icon" />
                                  <p className="tryon-modal__hint-text">
                                    Để kết quả tốt nhất: Ảnh rõ nét, đủ ánh
                                    sáng, chụp thẳng toàn thân, không bị che
                                    khuất.
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </section>

                      <section className="tryon-modal__section">
                        <h3 className="tryon-modal__section-title">
                          <span className="tryon-modal__step-badge">2</span>
                          Sản Phẩm
                        </h3>
                        <div className="tryon-modal__product-card">
                          <div className="tryon-modal__product-card-image-wrap">
                            <img
                              src={productImageUrl}
                              alt="Product"
                              className="tryon-modal__product-card-image"
                            />
                          </div>
                          <div className="tryon-modal__product-card-info">
                            <h4 className="tryon-modal__product-card-title tryon-modal__line-clamp-1">
                              {productName}
                            </h4>
                            <p className="tryon-modal__product-card-desc">
                              Sẽ được tự động cân chỉnh vừa vặn với người mẫu
                            </p>
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="tryon-modal__actions">
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="tryon-modal__error"
                        >
                          <AlertCircle className="tryon-modal__error-icon" />
                          <p className="tryon-modal__error-text">{error}</p>
                        </motion.div>
                      )}

                      <button
                        onClick={handleStart}
                        disabled={isButtonDisabled}
                        className={`tryon-modal__start-btn ${isButtonDisabled ? "tryon-modal__start-btn--disabled" : "tryon-modal__start-btn--active"}`}
                      >
                        <Sparkles
                          className={`tryon-modal__start-btn-icon ${isButtonDisabled ? "tryon-modal__start-btn-icon--disabled" : "tryon-modal__start-btn-icon--active"}`}
                        />
                        {isProcessing
                          ? "Đang xử lý..."
                          : resultReady
                            ? "Hoàn thành"
                            : "Bắt Đầu Thử Đồ"}
                      </button>
                    </div>
                  </div>

                  <div className="tryon-modal__panel tryon-modal__panel--right">
                    <div className="tryon-modal__pattern" />

                    <AnimatePresence mode="wait">
                      {!isProcessing && !resultReady && (
                        <motion.div
                          key="idle"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="tryon-modal__idle"
                        >
                          <div className="tryon-modal__idle-icon-wrap">
                            <Sparkles className="tryon-modal__idle-icon" />
                          </div>
                          <p className="tryon-modal__idle-title">
                            Chưa có kết quả
                          </p>
                          <p className="tryon-modal__idle-desc">
                            Hãy chọn người mẫu và sản phẩm, sau đó nhấn "Bắt Đầu
                            Thử Đồ" để xem điều kỳ diệu.
                          </p>
                        </motion.div>
                      )}

                      {isProcessing && (
                        <motion.div
                          key="processing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="tryon-modal__processing"
                        >
                          <div className="tryon-modal__processing-spinner-wrap">
                            <div className="tryon-modal__processing-glow" />
                            <Loader2 className="tryon-modal__processing-spinner" />
                            <div className="tryon-modal__processing-spinner-label-wrap">
                              <span className="tryon-modal__processing-spinner-label">
                                {progress}%
                              </span>
                            </div>
                          </div>

                          <h4 className="tryon-modal__processing-title">
                            {processingText}
                          </h4>

                          <div className="tryon-modal__progress">
                            <motion.div
                              className="tryon-modal__progress-bar"
                              initial={{ width: "0%" }}
                              animate={{ width: `${progress}%` }}
                              transition={{ ease: "linear" }}
                            />
                          </div>
                          <p className="tryon-modal__processing-note">
                            Vui lòng giữ tab này mở trong lúc Bụt thực hiện phép
                            thuật...
                          </p>
                        </motion.div>
                      )}

                      {resultReady && resultUrl && (
                        <motion.div
                          key="result"
                          initial={{ opacity: 0, filter: "blur(10px)" }}
                          animate={{ opacity: 1, filter: "blur(0px)" }}
                          transition={{ duration: 0.8 }}
                          className="tryon-modal__result"
                        >
                          <img
                            src={resultUrl}
                            alt="Kết quả thử đồ"
                            className="tryon-modal__result-img"
                          />

                          <div className="tryon-modal__result-badge">
                            <Sparkles className="tryon-modal__result-badge-icon" />
                            <span className="tryon-modal__result-badge-text">
                              Tạo bởi Bụt AI
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
