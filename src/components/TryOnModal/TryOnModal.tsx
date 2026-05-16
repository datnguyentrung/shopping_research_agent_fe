import {
  AlertCircle,
  Info,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Thay đổi import apiConfig và validatePose tùy thuộc vào đường dẫn dự án của bạn
import { apiConfig } from "@/services/api";
import { validatePose } from "@/utils/validatePose";

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// --- Component ---
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
  productName = "Sản phẩm đang chọn",
}: TryOnModalProps) {
  // State quản lý tab (thay vì string đơn thuần, giờ gắn với logic user/persona)
  const [activeTab, setActiveTab] = useState<"preset" | "upload">("preset");

  // Các state từ file Logic
  const [selected, setSelected] = useState<PersonSource | null>(null);
  const [savedUserPhoto, setSavedUserPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<VtoStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Khởi tạo Modal
  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  // Dọn dẹp Websocket khi unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (progressTimerRef.current)
        window.clearInterval(progressTimerRef.current);
    };
  }, []);

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
    const dataUrl = await readFileAsDataUrl(file);
    localStorage.setItem(LOCALSTORAGE_KEY, dataUrl);
    setSavedUserPhoto(dataUrl);
    setSelected({ kind: "user", src: dataUrl, label: "Ảnh của bạn" });
    setActiveTab("upload");
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

  // Nút Bắt Đầu
  const handleStart = async () => {
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
      form.append("product_name", productName);

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

  // Trạng thái Render
  const isProcessing =
    status === "validating" || status === "uploading" || status === "pending";
  const resultReady = status === "completed" && resultUrl !== null;
  const isButtonDisabled = !selected || isProcessing;

  let processingText = "Bụt đang chuẩn bị...";
  if (status === "validating") processingText = "Đang kiểm tra vóc dáng...";
  if (status === "uploading") processingText = "Đang tải ảnh lên hệ thống...";
  if (status === "pending") processingText = "Bụt đang cân chỉnh trang phục...";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isProcessing && onOpenChange(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-6xl h-[85vh] max-h-[800px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row z-10"
          >
            {/* Close Button */}
            {!isProcessing && (
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-4 right-4 z-20 p-2 bg-white/80 backdrop-blur rounded-full text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 shadow-sm transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Left Panel: Configuration */}
            <div className="w-full lg:w-[45%] h-[40vh] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-neutral-200 bg-neutral-50 overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="p-6 pb-4 border-b border-neutral-200 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-neutral-800">
                    Thử đồ với Bụt
                  </h2>
                </div>
                <p className="text-sm text-neutral-500 mt-1 ml-11">
                  Trải nghiệm ướm thử trang phục chân thực.
                </p>
              </div>

              <div className="p-6 flex-1 flex flex-col gap-8">
                {/* Section 1: Model Selection */}
                <section>
                  <h3 className="text-base font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">
                      1
                    </span>
                    Chọn Người Mẫu
                  </h3>

                  {/* Segmented Control */}
                  <div className="flex p-1 bg-neutral-200/60 rounded-xl mb-4 relative">
                    <button
                      onClick={() => {
                        setActiveTab("preset");
                        // Tự động select mẫu đầu tiên nếu chuyển qua tab này
                        setSelected({
                          kind: "persona",
                          src: PRESET_MODELS[0].src,
                          label: PRESET_MODELS[0].label,
                        });
                        setError(null);
                      }}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg z-10 transition-colors ${activeTab === "preset" ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}
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
                      className={`flex-1 py-2 text-sm font-medium rounded-lg z-10 transition-colors ${activeTab === "upload" ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}
                    >
                      Tải Ảnh Của Bạn
                    </button>
                    {/* Active Background Indicator */}
                    <motion.div
                      layoutId="activeTab"
                      className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm"
                      initial={false}
                      animate={{ x: activeTab === "preset" ? 0 : "100%" }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  </div>

                  {/* Tab Content */}
                  <div className="min-h-[160px]">
                    <AnimatePresence mode="wait">
                      {activeTab === "preset" ? (
                        <motion.div
                          key="preset"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
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
                              className={`relative aspect-[3/4] rounded-xl overflow-hidden group border-2 transition-all ${
                                selected?.kind === "persona" &&
                                selected.src === model.src
                                  ? "border-indigo-600 shadow-md ring-2 ring-indigo-200"
                                  : "border-transparent hover:border-neutral-300"
                              }`}
                            >
                              <img
                                src={model.src}
                                alt={model.label}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                <span className="text-white text-xs font-medium">
                                  {model.label}
                                </span>
                              </div>
                              {selected?.kind === "persona" &&
                                selected.src === model.src && (
                                  <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-0.5">
                                    <svg
                                      className="w-3 h-3 text-white"
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
                          className="w-full"
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleUserFile(file);
                            }}
                          />

                          {savedUserPhoto ? (
                            <div className="flex gap-4 p-4 border border-indigo-100 bg-indigo-50/50 rounded-xl items-center">
                              <div className="w-20 h-24 rounded-lg overflow-hidden border border-neutral-200 shrink-0">
                                <img
                                  src={savedUserPhoto}
                                  alt="User"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-neutral-800 mb-1">
                                  Ảnh của bạn
                                </h4>
                                <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium mb-3">
                                  Đã lưu
                                </span>
                                <button
                                  onClick={handleUploadClick}
                                  className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1.5 transition-colors"
                                >
                                  <UploadCloud className="w-4 h-4" /> Tải ảnh
                                  khác
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={handleUploadClick}
                              className="border-2 border-dashed border-neutral-300 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-white hover:bg-neutral-50 transition-colors cursor-pointer group"
                            >
                              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <UploadCloud className="w-6 h-6 text-indigo-500" />
                              </div>
                              <h4 className="font-medium text-neutral-800 mb-1">
                                Kéo thả hoặc Click
                              </h4>
                              <p className="text-sm text-neutral-500 mb-4">
                                để tải ảnh vóc dáng của bạn lên
                              </p>
                              <button className="px-4 py-2 bg-white border border-neutral-200 shadow-sm rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors">
                                Tải ảnh lên
                              </button>
                            </div>
                          )}

                          <div className="mt-3 flex items-start gap-2 text-xs text-neutral-500 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p>
                              Để kết quả tốt nhất: Ảnh rõ nét, đủ ánh sáng, chụp
                              thẳng toàn thân, không bị che khuất.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                {/* Section 2: Product */}
                <section>
                  <h3 className="text-base font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">
                      2
                    </span>
                    Sản Phẩm
                  </h3>
                  <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-neutral-200 shadow-sm">
                    <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0 bg-neutral-100">
                      <img
                        src={productImageUrl}
                        alt="Product"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-neutral-800 text-sm line-clamp-1">
                        {productName}
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Sẽ được tự động cân chỉnh vừa vặn với người mẫu
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Action Area & Errors */}
              <div className="p-6 border-t border-neutral-200 bg-white sticky bottom-0">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 flex items-start gap-2 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </motion.div>
                )}

                <button
                  onClick={handleStart}
                  disabled={isButtonDisabled}
                  className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    isButtonDisabled
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-purple-700 transform hover:-translate-y-0.5"
                  }`}
                >
                  <Sparkles
                    className={`w-5 h-5 ${isButtonDisabled ? "opacity-50" : "animate-pulse"}`}
                  />
                  {isProcessing ? "Đang xử lý..." : "Bắt Đầu Thử Đồ"}
                </button>
              </div>
            </div>

            {/* Right Panel: Output */}
            <div className="w-full lg:w-[55%] h-[45vh] lg:h-full bg-neutral-100 relative overflow-hidden flex items-center justify-center">
              {/* Grid Background Pattern */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPgoJCTxwYXRoIGQ9Ik0wIDI0SDBWMHhoMXYyNHptMjQgMEgyM1YwaDF2MjR6IiBmaWxsPSJyZ2JhKDAsIDAsIDAsIDAuMDMpIi8+CgkJPHBhdGggZD0iTTI0IDFWMGgtMjR2MWgyNHptMCAyM3YtMWgtMjR2MWgyNHoiIGZpbGw9InJnYmEoMCwgMCwgMCwgMC4wMykiLz4KCTwvc3ZnPg==')] opacity-50 pointer-events-none" />

              <AnimatePresence mode="wait">
                {/* 1. Idle State */}
                {!isProcessing && !resultReady && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center text-neutral-400 p-8 text-center max-w-sm z-10"
                  >
                    <div className="w-24 h-24 mb-6 rounded-full bg-neutral-200/50 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-neutral-300" />
                    </div>
                    <p className="text-lg font-medium text-neutral-500 mb-2">
                      Chưa có kết quả
                    </p>
                    <p className="text-sm">
                      Hãy chọn người mẫu và sản phẩm, sau đó nhấn "Bắt Đầu Thử
                      Đồ" để xem điều kỳ diệu.
                    </p>
                  </motion.div>
                )}

                {/* 2. Processing State */}
                {isProcessing && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center z-10 w-full max-w-md px-8"
                  >
                    <div className="relative mb-8">
                      {/* Outer glow/pulse */}
                      <div className="absolute inset-0 rounded-full bg-indigo-400 blur-xl opacity-30 animate-pulse" />
                      <Loader2 className="w-16 h-16 text-indigo-600 animate-spin relative z-10" />
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <span className="text-xs font-bold text-indigo-700">
                          {progress}%
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xl font-bold text-neutral-800 mb-2">
                      {processingText}
                    </h4>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden mt-4">
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        initial={{ width: "0%" }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>
                    <p className="text-sm text-neutral-500 mt-4 text-center animate-pulse">
                      Vui lòng giữ tab này mở trong lúc Bụt thực hiện phép
                      thuật...
                    </p>
                  </motion.div>
                )}

                {/* 3. Result State */}
                {resultReady && resultUrl && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-4 sm:inset-8 z-10 flex items-center justify-center"
                  >
                    {/* Object-contain ensures full image is visible, scale down automatically if large */}
                    <img
                      src={resultUrl}
                      alt="Kết quả thử đồ"
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />

                    <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border border-white/20">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      <span className="text-xs font-medium text-neutral-800">
                        Tạo bởi Bụt AI
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
