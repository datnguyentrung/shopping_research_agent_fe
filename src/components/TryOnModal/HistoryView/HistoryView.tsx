import { Clock, ImageOff, Shirt, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchTryOnHistory } from "@/services/virtualTryOnService";
import type { TryOnHistoryItem } from "@/types/vto.types";
import { formatDateDMY } from "@/utils/format";

import "./HistoryView.scss";

// Chuyển URL Supabase (object/public) sang bản thumbnail nhỏ hơn qua
// image transformation để giảm payload + chi phí decode/paint cho grid.
// Ví dụ: .../storage/v1/object/public/vto_results/.../x.png
//     -> .../storage/v1/render/image/public/vto_results/.../x.png?width=480
// Nếu URL không phải object/public thì trả về nguyên gốc (an toàn).
function getSupabaseThumb(url: string, width = 480): string {
  if (!url || !url.includes("/object/public/")) return url;
  const renderUrl = url.replace("/object/public/", "/render/image/public/");
  const sep = renderUrl.includes("?") ? "&" : "?";
  return `${renderUrl}${sep}width=${width}`;
}

// Ảnh card: ưu tiên thumbnail, nếu transform không khả dụng (400) thì
// onError tự quay về URL gốc để không bao giờ mất ảnh.
function HistoryCardImage({ src, alt }: { src: string; alt: string }) {
  const thumb = useMemo(() => getSupabaseThumb(src), [src]);
  const fallbacked = useRef(false);

  return (
    <img
      src={thumb}
      alt={alt}
      className="tryon-modal__history-card-img"
      loading="lazy"
      decoding="async"
      onError={(e) => {
        if (fallbacked.current || thumb === src) return;
        fallbacked.current = true;
        e.currentTarget.src = src; // fallback về ảnh gốc
      }}
    />
  );
}

interface HistoryViewProps {
  open: boolean;
  onOpenMoreProductView?: (item: TryOnHistoryItem) => void;
}

export default function HistoryView({
  open,
  onOpenMoreProductView,
}: HistoryViewProps) {
  const [historyItems, setHistoryItems] = useState<TryOnHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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
    if (open) void loadHistory();
  }, [open, loadHistory]);

  const sortedHistory = useMemo(() => {
    return [...historyItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [historyItems]);

  return (
    <motion.div
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
        </div>
      </div>

      <div className="tryon-modal__body tryon-modal__body--history">
        {/* Loading skeleton */}
        {historyLoading && (
          <div className="tryon-modal__history-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`skel-${i}`} className="tryon-modal__history-skeleton">
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
            <p className="tryon-modal__history-empty-desc">{historyError}</p>
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
        {!historyLoading && !historyError && historyItems.length === 0 && (
          <div className="tryon-modal__history-empty">
            <Shirt className="tryon-modal__history-empty-icon" />
            <p className="tryon-modal__history-empty-title">
              Chưa có lịch sử thử đồ
            </p>
            <p className="tryon-modal__history-empty-desc">
              Hãy thử đồ để xem kết quả tại đây.
            </p>
          </div>
        )}

        {/* History list */}
        {!historyLoading && !historyError && historyItems.length > 0 && (
          <div
            className="tryon-modal__history-grid"
            role="list"
            aria-label="Lịch sử thử đồ"
          >
            {sortedHistory.map((item, index) => {
              const isCompleted = item.status === "completed" && item.imageUrl;
              const imgSrc = isCompleted ? item.imageUrl : "";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.24) }}
                  className="tryon-modal__history-card"
                  role="listitem"
                >
                  <div className="tryon-modal__history-card-media">
                    {isCompleted ? (
                      <HistoryCardImage src={imgSrc} alt="Kết quả thử đồ" />
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
                    <div className="tryon-modal__history-card-actions">
                      <button
                        type="button"
                        className="tryon-modal__history-card-btn tryon-modal__history-card-btn--primary"
                      >
                        Xem ảnh
                      </button>
                      <button
                        type="button"
                        className="tryon-modal__history-card-btn tryon-modal__history-card-btn--ghost"
                        onClick={() => onOpenMoreProductView?.(item)}
                      >
                        Thử đồ
                      </button>
                    </div>
                    <div className="tryon-modal__history-card-badge">
                      <Sparkles className="tryon-modal__history-card-badge-icon" />
                      <span className="tryon-modal__tiny-text">Bụt AI</span>
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
                          style={{
                            color: "inherit",
                            textDecoration: "underline",
                          }}
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
  );
}
