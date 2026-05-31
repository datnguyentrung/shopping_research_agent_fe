import type { ComponentType, SVGProps } from "react";

import "./CustomerPanel.scss";

interface CustomerPanelProps {
  imageUrl: string;
  UploadIcon: ComponentType<SVGProps<SVGSVGElement>>;
  CartIcon: ComponentType<SVGProps<SVGSVGElement>>;
  SaveIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function CustomerPanel({
  imageUrl,
  UploadIcon,
  CartIcon,
  SaveIcon,
}: CustomerPanelProps) {
  return (
    <section className="mpv-zone mpv-left" aria-label="Khu vực khách hàng">
      <div className="mpv-card mpv-customer-photo">
        <img src={imageUrl} alt="Kết quả thử đồ" loading="lazy" />
      </div>

      <div className="mpv-action-row" aria-label="Hành động ảnh">
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
        <button className="mpv-outline-btn" type="button">
          <span className="mpv-btn-icon" aria-hidden="true">
            <SaveIcon />
          </span>
          Lưu ảnh
        </button>
      </div>
    </section>
  );
}
