import type { ComponentType, SVGProps } from "react";
import { useEffect, useRef, useState } from "react";

import { Palette } from "lucide-react";
import type { TryOnHistoryItem } from "../../../../types/vto.types";
import { formatVnd } from "../../../../utils/formatters";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";
import "./CustomerPanel.scss";

interface CustomerPanelProps {
  item: TryOnHistoryItem;
  imageUrl: string;
  isProcessing: boolean;
  progress: number;
  processingText: string;
  hasPendingPreview: boolean;
  tryOnError: string | null;
  onCancelTryOn: () => void;
  onAcceptTryOn: () => void;
  onStartRecolor: () => void;
  UploadIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function CustomerPanel({
  item,
  imageUrl,
  isProcessing,
  progress,
  processingText,
  hasPendingPreview,
  tryOnError,
  onCancelTryOn,
  onAcceptTryOn,
  onStartRecolor,
  UploadIcon,
}: CustomerPanelProps) {
  const showTryOnActions = isProcessing || hasPendingPreview;
  const disableAccept = isProcessing || !hasPendingPreview;

  // Quản lý popover hover cho nút "Sản phẩm gốc".
  // Radix Popover mặc định mở khi click nên cần điều khiển open bằng tay,
  // cộng thêm delay đóng ngắn để di chuột từ nút sang popover không bị tắt.
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const cancelHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleShowPopover = () => {
    cancelHide();
    setProductPopoverOpen(true);
  };

  const handleHidePopover = () => {
    cancelHide();
    hideTimerRef.current = window.setTimeout(
      () => setProductPopoverOpen(false),
      120,
    );
  };

  useEffect(() => {
    return () => cancelHide();
  }, []);

  const hasPrice =
    typeof item.productPrice === "number" && item.productPrice > 0;

  // Chỉ hiển thị 1/4 số ký tự của productName trên nút cho gọn,
  // phần còn lại xem trong popover khi hover.
  const productNameShort = (() => {
    const name = item.productName ?? "";
    if (name.length <= 4) return name;
    const limit = Math.ceil(name.length / 4);
    return `${name.slice(0, limit)}…`;
  })();

  // console.log(
  //   "CustomerPanel render với props:",
  //   {
  //     imageUrl,
  //     isProcessing,
  //     progress,
  //     processingText,
  //     hasPendingPreview,
  //     tryOnError,
  //   }
  // )

  return (
    <section className="mpv-zone mpv-left" aria-label="Khu vực khách hàng">
      <div className="mpv-card mpv-customer-photo">
        <img src={imageUrl} alt="Kết quả thử đồ" loading="lazy" />

        {isProcessing && (
          <div className="mpv-photo-overlay" aria-live="polite">
            <div className="mpv-photo-progress">
              <span className="mpv-photo-progress-title">{processingText}</span>
              <div className="mpv-photo-progress-track">
                <div
                  className="mpv-photo-progress-bar"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              <span className="mpv-photo-progress-value">{progress}%</span>
            </div>
          </div>
        )}

        {tryOnError && !isProcessing ? (
          <div className="mpv-photo-error" role="alert">
            {tryOnError}
          </div>
        ) : null}
      </div>

      <div className="mpv-action-row" aria-label="Hành động ảnh">
        {showTryOnActions ? (
          <>
            <button
              className="mpv-secondary-btn"
              type="button"
              onClick={onCancelTryOn}
              data-loading={isProcessing}
            >
              {isProcessing && (
                <span className="mpv-btn-spinner" aria-hidden="true" />
              )}
              Hủy
            </button>
            <button
              className="mpv-primary-btn"
              type="button"
              disabled={disableAccept}
              onClick={onAcceptTryOn}
              data-loading={isProcessing}
            >
              {isProcessing && (
                <span className="mpv-btn-spinner" aria-hidden="true" />
              )}
              Dùng ảnh này
            </button>
          </>
        ) : (
          <>
            <Popover
              open={productPopoverOpen}
              onOpenChange={setProductPopoverOpen}
            >
              <PopoverTrigger asChild>
                <button
                  className="mpv-outline-btn mpv-product-btn"
                  type="button"
                  onMouseEnter={handleShowPopover}
                  onMouseLeave={handleHidePopover}
                  onFocus={handleShowPopover}
                  onBlur={handleHidePopover}
                  aria-label={`Xem chi tiết sản phẩm gốc: ${item.productName}`}
                >
                  <span className="mpv-btn-icon" aria-hidden="true">
                    <UploadIcon />
                  </span>
                  <span className="mpv-product-btn-text">
                    Sản phẩm gốc: {productNameShort}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="mpv-product-popover"
                align="start"
                sideOffset={4}
                onMouseEnter={cancelHide}
                onMouseLeave={handleHidePopover}
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                {item.productImageUrl ? (
                  <img
                    className="mpv-product-popover-img"
                    src={item.productImageUrl}
                    alt={item.productName}
                    loading="lazy"
                  />
                ) : null}
                <div className="mpv-product-popover-body">
                  <span className="mpv-product-popover-label">
                    Sản phẩm gốc
                  </span>
                  <h4 className="mpv-product-popover-name">
                    {item.productName}
                  </h4>
                  {hasPrice ? (
                    <span className="mpv-product-popover-price">
                      {formatVnd(item.productPrice)}
                    </span>
                  ) : null}
                  {item.description ? (
                    <p className="mpv-product-popover-desc">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
            <button
              className="mpv-outline-btn"
              type="button"
              onClick={onStartRecolor}
            >
              <Palette size={20} />
              Đổi màu
            </button>
          </>
        )}
      </div>
    </section>
  );
}
