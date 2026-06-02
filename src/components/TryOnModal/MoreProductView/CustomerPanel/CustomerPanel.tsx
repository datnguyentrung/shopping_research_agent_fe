import type { ComponentType, SVGProps } from "react";

import "./CustomerPanel.scss";

interface CustomerPanelProps {
  imageUrl: string;
  isProcessing: boolean;
  progress: number;
  processingText: string;
  hasPendingPreview: boolean;
  tryOnError: string | null;
  onCancelTryOn: () => void;
  onAcceptTryOn: () => void;
  UploadIcon: ComponentType<SVGProps<SVGSVGElement>>;
  CartIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function CustomerPanel({
  imageUrl,
  isProcessing,
  progress,
  processingText,
  hasPendingPreview,
  tryOnError,
  onCancelTryOn,
  onAcceptTryOn,
  UploadIcon,
  CartIcon,
}: CustomerPanelProps) {
  const showTryOnActions = isProcessing || hasPendingPreview;
  const disableAccept = isProcessing || !hasPendingPreview;

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
            <button className="mpv-outline-btn" type="button">
              <span className="mpv-btn-icon" aria-hidden="true">
                <UploadIcon />
              </span>
              Tải lên
            </button>
            <button className="mpv-outline-btn" type="button">
              <span className="mpv-btn-icon" aria-hidden="true">
                <CartIcon />
              </span>
              Chọn làm sản phẩm gốc
            </button>
          </>
        )}
      </div>
    </section>
  );
}
