import {
  AlertCircle,
  Info,
  Loader2,
  Shirt,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { apiConfig } from "@/services/api";
import { fireTryOnRequest } from "@/services/virtualTryOnService";
import { compressImage, validatePose } from "@/utils/validatePose";
import {
  dataUrlToBlob,
  toOrigin,
  toWebSocketBaseUrl,
  urlToFile,
} from "@/utils/vto.utils";
import { showSuccessToast } from "../../ui/toast";

import type { PersonSource, VtoStatus, VtoWsMessage } from "../vto.types";
import { LOCALSTORAGE_KEY, PRESET_MODELS } from "../vto.types";

import "./EditorView.scss";

interface EditorViewProps {
  productImageUrl: string;
  productUrl: string;
  productName: string;
  productPrice?: number;
  showBackButton: boolean;
  onNavigateToHistory: () => void;
  onProcessingChange: (isProcessing: boolean) => void;
  open: boolean;
}

export default function EditorView({
  productImageUrl,
  productUrl,
  productName,
  productPrice,
  showBackButton,
  onNavigateToHistory,
  onProcessingChange,
  open,
}: EditorViewProps) {
  const [activeTab, setActiveTab] = useState<"preset" | "upload">("preset");
  const [selected, setSelected] = useState<PersonSource | null>(null);
  const [savedUserPhoto, setSavedUserPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<VtoStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [marketingMessage, setMarketingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Đồng bộ processing state với orchestrator
  useEffect(() => {
    const processing =
      status === "validating" || status === "uploading" || status === "pending";
    onProcessingChange(processing);
  }, [status, onProcessingChange]);

  // Khởi tạo / reset khi mở modal
  useEffect(() => {
    if (!open) return;

    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    setSavedUserPhoto(stored);

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
    setMarketingMessage(null);
    setError(null);
  }, [open]);

  // Dọn dẹp WebSocket khi unmount
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
    try {
      setError(null);
      const dataUrl = await compressImage(file);
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

  const handleStart = async () => {
    if (!selected) return;
    if (status === "completed" && resultUrl) return;

    setError(null);
    setResultUrl(null);
    setMarketingMessage(null);

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
        productPrice,
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
            setMarketingMessage(null);
            ws.close();
            return;
          }

          if (message.marketing_message) {
            setMarketingMessage(message.marketing_message);
          }

          if (message.status === "completed" && message.result_url) {
            setStatus("completed");
            stopProgress(100);
            setResultUrl(message.result_url);
            setMarketingMessage(message.marketing_message ?? null);
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
        setMarketingMessage(null);
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch (e) {
      setStatus("error");
      stopProgress();
      setError(e instanceof Error ? e.message : "Đã có lỗi xảy ra");
      setMarketingMessage(null);
    }
  };

  const isProcessing =
    status === "validating" || status === "uploading" || status === "pending";
  const resultReady = status === "completed" && resultUrl !== null;
  const isButtonDisabled =
    !selected || isProcessing || (status === "completed" && resultUrl !== null);
  const showMarketingMessage = resultReady && Boolean(marketingMessage);

  let processingText = "Bụt đang chuẩn bị...";
  if (status === "validating") processingText = "Đang kiểm tra vóc dáng...";
  if (status === "uploading") processingText = "Đang tải ảnh lên hệ thống...";
  if (status === "pending") processingText = "Bụt đang cân chỉnh trang phục...";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="tryon-modal tryon-modal--editor"
    >
      {showBackButton && (
        <button onClick={onNavigateToHistory} className="tryon-modal__back-btn">
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
                        Để kết quả tốt nhất: Ảnh rõ nét, đủ ánh sáng, chụp thẳng
                        toàn thân, không bị che khuất.
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
              <p className="tryon-modal__idle-title">Chưa có kết quả</p>
              <p className="tryon-modal__idle-desc">
                Hãy chọn người mẫu và sản phẩm, sau đó nhấn "Bắt Đầu Thử Đồ" để
                xem điều kỳ diệu.
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
                Vui lòng giữ tab này mở trong lúc Bụt thực hiện phép thuật...
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

              {showMarketingMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="tryon-modal__result-message"
                >
                  <Sparkles className="tryon-modal__result-message-icon" />
                  <p className="tryon-modal__result-message-text">
                    {marketingMessage}
                  </p>
                </motion.div>
              )}

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
  );
}
