import type { ComponentType, RefObject, SVGProps } from "react";

import type { CapturedData } from "../../../../types";
import ColorPanel from "../ColorPanel";
import "./RightPanel.scss";

type Mode = "cart" | "tryon" | "color";

type StreamingProduct = {
  product: CapturedData;
};

type ProgressState = {
  statusText?: string;
  progressPercent?: number | null;
} | null;

interface RightPanelProps {
  mode: Mode;
  hasRecommendations: boolean;
  isLoading: boolean;
  isTryOnLoading: boolean;
  progress: ProgressState;
  streamingProducts: StreamingProduct[];
  error: string | null;
  listRecommend: CapturedData[];
  productSelected: CapturedData | null;
  onSelectProduct: (product: CapturedData) => void;
  onGetRecommendations: () => void;
  onTryOn: () => void;
  onModeChange: (mode: Mode) => void;
  resolvedCartCount: number;
  productShoppings: CapturedData[];
  onRemoveProduct: (id: string | number) => void;
  gridRef: RefObject<HTMLDivElement | null>;
  emptyDescription?: string | null;
  // ── Chế độ đổi màu (recolor) ──
  recolorSourceUrl?: string | null;
  onSaveRecolor?: (dataUrl: string) => void;
  onCloseRecolor?: () => void;
  SparkleIcon: ComponentType<SVGProps<SVGSVGElement>>;
  SpinnerIcon: ComponentType<SVGProps<SVGSVGElement>>;
  SearchIcon: ComponentType<SVGProps<SVGSVGElement>>;
  NotebookPenIcon: ComponentType<SVGProps<SVGSVGElement>>;
  TrashIcon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function RightPanel({
  mode,
  hasRecommendations,
  isLoading,
  isTryOnLoading,
  progress,
  streamingProducts,
  error,
  listRecommend,
  productSelected,
  onSelectProduct,
  onGetRecommendations,
  onTryOn,
  onModeChange,
  resolvedCartCount,
  productShoppings,
  onRemoveProduct,
  gridRef,
  emptyDescription,
  recolorSourceUrl,
  onSaveRecolor,
  onCloseRecolor,
  SparkleIcon,
  SpinnerIcon,
  SearchIcon,
  NotebookPenIcon,
  TrashIcon,
}: RightPanelProps) {
  // Chế độ đổi màu: hiển thị ColorPanel thay cho actions + danh sách sản phẩm.
  if (mode === "color" && recolorSourceUrl) {
    return (
      <section className="mpv-zone mpv-right" aria-label="Đổi màu trang phục">
        <ColorPanel
          sourceImageUrl={recolorSourceUrl}
          onSave={onSaveRecolor ?? (() => {})}
          onClose={onCloseRecolor ?? (() => {})}
          SparkleIcon={SparkleIcon}
        />
      </section>
    );
  }

  return (
    <section className="mpv-zone mpv-right" aria-label="Sản phẩm chính">
      <div className="mpv-right-actions">
        {hasRecommendations ? (
          <button
            className="mpv-primary-btn"
            type="button"
            onClick={onTryOn}
            disabled={isTryOnLoading}
            data-loading={isTryOnLoading}
          >
            <span className="mpv-btn-icon" aria-hidden="true">
              <SparkleIcon />
            </span>
            {isTryOnLoading ? "Đang thử..." : "Thử đồ"}
          </button>
        ) : (
          <button
            className="mpv-primary-btn"
            type="button"
            onClick={onGetRecommendations}
            disabled={isLoading}
            data-loading={isLoading}
          >
            {isLoading ? (
              <span className="mpv-btn-icon" aria-hidden="true">
                <SpinnerIcon />
              </span>
            ) : (
              <span className="mpv-btn-icon" aria-hidden="true">
                <SearchIcon />
              </span>
            )}
            {isLoading ? "Đang tìm..." : "Tìm sản phẩm phù hợp"}
          </button>
        )}

        <button
          className="mpv-secondary-btn"
          type="button"
          onClick={() => onModeChange("cart")}
        >
          <span className="mpv-btn-icon" aria-hidden="true">
            <NotebookPenIcon />
          </span>
          Tùy chỉnh phong cách
        </button>
      </div>

      {mode === "cart" ? (
        <div className="mpv-cart" aria-label="Giỏ hàng">
          <div className="mpv-cart-header">
            <span className="mpv-cart-title">Giỏ hàng</span>
            <span className="mpv-cart-count">{resolvedCartCount} sản phẩm</span>
          </div>
          <div
            className="mpv-cart-list"
            role="list"
            aria-label="Danh sách giỏ hàng"
          >
            {productShoppings.map((product, index) => {
              const priceLabel =
                typeof product.priceCurrent === "number"
                  ? `${product.priceCurrent.toLocaleString("vi-VN")}đ`
                  : "—";
              const isRemovable = product.productId !== undefined;

              return (
                <article
                  className="mpv-card mpv-cart-item"
                  role="listitem"
                  key={product.productId ?? `${product.name}-${index}`}
                >
                  <div className="mpv-cart-thumb">
                    <img
                      src={product.mainImage ?? ""}
                      alt={product.name ?? "Sản phẩm"}
                      loading="lazy"
                    />
                  </div>
                  <div className="mpv-cart-info">
                    <a
                      href={product.productUrl ?? "#"}
                      className="mpv-cart-name"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {product.name ?? "Sản phẩm"}
                    </a>
                    <span className="mpv-cart-price">{priceLabel}</span>
                  </div>
                  <button
                    className="mpv-cart-remove"
                    type="button"
                    aria-label="Xóa sản phẩm"
                    aria-disabled={!isRemovable}
                    disabled={!isRemovable}
                    onClick={() => {
                      if (product.productId !== undefined) {
                        onRemoveProduct(product.productId);
                      }
                    }}
                  >
                    <TrashIcon aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      ) : hasRecommendations ? (
        <>
          <div className="mpv-card mpv-main-product">
            <img
              src={productSelected?.mainImage}
              alt={productSelected?.name}
              width={720}
              height={900}
              loading="eager"
              fetchPriority="high"
            />
            <div className="mpv-product-title">{productSelected?.name}</div>
          </div>

          <div
            className="mpv-product-grid"
            role="list"
            aria-label="Sản phẩm gợi ý"
          >
            {listRecommend.map((product) => (
              <article
                className="mpv-card mpv-product-card"
                role="listitem"
                key={product.productId}
                onClick={() => onSelectProduct(product)}
              >
                <div className="mpv-product-image">
                  <img
                    src={product.mainImage}
                    alt={product.name}
                    loading="lazy"
                  />
                </div>
                <div className="mpv-product-info">
                  <span className="mpv-product-name">{product.name}</span>
                  <span className="mpv-product-price">
                    {product.priceCurrent
                      ? `${product.priceCurrent.toLocaleString("vi-VN")}đ`
                      : "—"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : isLoading ? (
        <>
          {progress && (
            <div className="mpv-progress-card">
              <div className="mpv-progress-header">
                <div className="mpv-progress-spinner" />
                <p className="mpv-progress-text">{progress.statusText}</p>
                {progress.progressPercent != null && (
                  <span className="mpv-progress-percent">
                    {progress.progressPercent}%
                  </span>
                )}
              </div>
              <div className="mpv-progress-track">
                <div
                  className="mpv-progress-bar"
                  style={{
                    width: `${Math.max(0, Math.min(100, progress.progressPercent ?? 0))}%`,
                  }}
                >
                  <div className="mpv-progress-stripes" />
                  <div className="mpv-progress-shimmer" />
                </div>
              </div>
            </div>
          )}

          {streamingProducts.length > 0 && (
            <>
              <div className="mpv-streaming-header">
                <SparkleIcon />
                <span>Đã tìm thấy {streamingProducts.length} sản phẩm</span>
              </div>
              <div className="mpv-product-grid" ref={gridRef} role="list">
                {streamingProducts.map((sp, idx) => (
                  <article
                    className="mpv-card mpv-product-card mpv-product-card--streaming"
                    role="listitem"
                    key={sp.product.productId ?? `stream-${idx}`}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="mpv-product-image">
                      <img
                        src={sp.product.mainImage}
                        alt={sp.product.name}
                        loading="lazy"
                      />
                    </div>
                    <div className="mpv-product-info">
                      <span className="mpv-product-name">
                        {sp.product.name}
                      </span>
                      <span className="mpv-product-price">
                        {sp.product.priceCurrent
                          ? `${sp.product.priceCurrent.toLocaleString("vi-VN")}đ`
                          : "—"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="mpv-error-card" aria-live="assertive">
              <span>{error}</span>
            </div>
          )}
        </>
      ) : (
        <div className="mpv-card mpv-empty-panel" aria-live="polite">
          <div className="mpv-empty-title">
            Bạn phù hợp với sản phẩm như thế nào ?
          </div>
          <p className="mpv-empty-desc">
            {emptyDescription
              ?.replace(/\\n/g, "\n")
              .split("\n")
              .map((line, index) => (
                <span
                  key={index}
                  style={{ display: "block", marginBottom: "12px" }}
                >
                  🌟 {line}
                </span>
              ))}
          </p>
        </div>
      )}
    </section>
  );
}
