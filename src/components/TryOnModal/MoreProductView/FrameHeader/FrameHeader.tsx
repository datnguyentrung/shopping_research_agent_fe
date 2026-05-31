import type { ComponentType, SVGProps } from "react";

import "./FrameHeader.scss";

interface FrameHeaderProps {
  onBack?: () => void;
  onClose?: () => void;
  BackIcon: ComponentType<SVGProps<SVGSVGElement>>;
  CloseIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function FrameHeader({
  onBack,
  onClose,
  BackIcon,
  CloseIcon,
}: FrameHeaderProps) {
  return (
    <div className="mpv-frame-header">
      <button
        className="mpv-frame-btn mpv-frame-btn--back"
        type="button"
        onClick={() => onBack?.()}
        aria-label="Quay lại kho thử đồ"
      >
        <span className="mpv-frame-icon" aria-hidden="true">
          <BackIcon />
        </span>
        Quay lại
      </button>
      <button
        className="mpv-frame-btn mpv-frame-btn--icon"
        type="button"
        onClick={() => onClose?.()}
        aria-label="Đóng"
      >
        <span className="mpv-frame-icon" aria-hidden="true">
          <CloseIcon />
        </span>
      </button>
    </div>
  );
}
