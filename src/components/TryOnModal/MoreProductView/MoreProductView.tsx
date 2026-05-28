import { useMemo, useState, type SVGProps } from "react";

import type { CapturedData } from "../../../types";
import type { PersonalizedRecommendationResponse } from "../../../types/recommendation.types";
import type { TryOnHistoryItem } from "../../../types/vto.types";
import "./MoreProductView.scss";

const productItems = [
  {
    id: "sp-01",
    name: "Áo sơ mi Linen",
    price: "1.250.000đ",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "sp-02",
    name: "Áo blazer phủ cát",
    price: "2.480.000đ",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "sp-03",
    name: "Quần tây đứng dáng",
    price: "1.380.000đ",
    image:
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "sp-04",
    name: "Bộ phối toàn thân",
    price: "3.120.000đ",
    image:
      "https://images.unsplash.com/photo-1463100099107-aa0980c362e6?auto=format&fit=crop&w=600&q=80",
  },
];

const filterItems = [
  { id: "ao", label: "Áo", active: true, Icon: ShirtIcon },
  { id: "quan", label: "Quần", active: false, Icon: PantsIcon },
  { id: "toan-than", label: "Toàn thân", active: false, Icon: FullBodyIcon },
];

interface MoreProductViewProps {
  open: boolean;
  item: TryOnHistoryItem;
  onBack?: () => void;
  onClose?: () => void;
  cartCount?: number;
}

export default function MoreProductView({
  item,
  onBack,
  onClose,
  cartCount,
}: MoreProductViewProps) {
  const [mode, setMode] = useState<"cart" | "tryon">("tryon");

  const [extraProducts, setExtraProducts] = useState<CapturedData[]>([]);
  const [hiddenBaseId, setHiddenBaseId] = useState<string | number | null>(
    null,
  );
  const [recommendProducts, setRecommendProducts] = useState<
    PersonalizedRecommendationResponse[]
  >([]);

  const baseProduct = useMemo<CapturedData | null>(() => {
    if (!item) {
      return null;
    }

    return {
      productId: item.id,
      productUrl: item.productPath,
      name: item.productName,
      mainImage: item.productImageUrl,
      priceCurrent: item.productPrice,
    };
  }, [item]);

  const productShoppings = useMemo(() => {
    const list: CapturedData[] = [];
    const seen = new Set<string | number>();

    if (baseProduct && hiddenBaseId !== baseProduct.productId) {
      list.push(baseProduct);
      if (baseProduct.productId !== undefined) {
        seen.add(baseProduct.productId);
      }
    }

    extraProducts.forEach((product) => {
      const productId = product.productId;
      if (productId === undefined || !seen.has(productId)) {
        list.push(product);
        if (productId !== undefined) {
          seen.add(productId);
        }
      }
    });

    return list;
  }, [baseProduct, extraProducts, hiddenBaseId]);

  const resolvedCartCount =
    typeof cartCount === "number" ? cartCount : productShoppings.length;

  // Ví dụ hàm thêm sản phẩm vào list (người dùng chủ động)
  const addProduct = (newProduct: CapturedData) => {
    setExtraProducts((prev) => {
      const newId = newProduct.productId;
      if (
        newId !== undefined &&
        prev.some((item) => item.productId === newId)
      ) {
        return prev;
      }

      return [...prev, newProduct];
    });
  };

  // Ví dụ hàm xóa sản phẩm khỏi list
  const removeProduct = (id: string | number) => {
    if (baseProduct?.productId === id) {
      setHiddenBaseId(id);
      return;
    }

    setExtraProducts((prev) => prev.filter((p) => p.productId !== id));
  };

  const hasRecommendations = recommendProducts.length > 0;
  const isCompactLayout = mode === "tryon" && !hasRecommendations;

  return (
    <div className="mpv-frame">
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

      <div
        className="more-product-view"
        data-layout={isCompactLayout ? "compact" : "full"}
      >
        {/* ─── Left: Customer photo + actions ─── */}
        <section className="mpv-zone mpv-left" aria-label="Khu vực khách hàng">
          <div className="mpv-card mpv-customer-photo">
            <img src={item.imageUrl} alt="Kết quả thử đồ" loading="lazy" />
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
              Thêm GH
            </button>
            <button className="mpv-outline-btn" type="button">
              <span className="mpv-btn-icon" aria-hidden="true">
                <SaveIcon />
              </span>
              Lưu ảnh
            </button>
          </div>
        </section>

        {/* ─── Center: Main actions ─── */}
        <section className="mpv-zone mpv-center" aria-label="Hành động chính">
          <button className="mpv-primary-btn" type="button">
            <span className="mpv-btn-icon" aria-hidden="true">
              <SparkleIcon />
            </span>
            Thử đồ
          </button>
          <button className="mpv-secondary-btn" type="button">
            <span className="mpv-btn-icon" aria-hidden="true">
              <CartIcon />
            </span>
            Giỏ hàng
          </button>
        </section>

        {/* ─── Right: Main product + product grid (vertical-only scroll) ─── */}
        <section className="mpv-zone mpv-right" aria-label="Sản phẩm chính">
          {mode === "tryon" ? (
            hasRecommendations ? (
              <>
                <div className="mpv-card mpv-main-product">
                  <img
                    src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80"
                    alt="Sản phẩm 2"
                    width={720}
                    height={900}
                    loading="eager"
                    fetchPriority="high"
                  />
                  <div className="mpv-product-title">Sản phẩm 2</div>
                </div>

                <div
                  className="mpv-product-grid"
                  role="list"
                  aria-label="Sản phẩm gợi ý"
                >
                  {productItems.map((product) => (
                    <article
                      className="mpv-card mpv-product-card"
                      role="listitem"
                      key={product.id}
                    >
                      <div className="mpv-product-image">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                        />
                      </div>
                      <div className="mpv-product-info">
                        <span className="mpv-product-name">{product.name}</span>
                        <span className="mpv-product-price">
                          {product.price}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="mpv-card mpv-empty-panel" aria-live="polite">
                <div className="mpv-empty-title">Mô tả lần thử đồ</div>
                <p className="mpv-empty-desc">
                  {item.description
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
            )
          ) : (
            <div className="mpv-cart" aria-label="Giỏ hàng">
              <div className="mpv-cart-header">
                <span className="mpv-cart-title">Giỏ hàng</span>
                <span className="mpv-cart-count">
                  {resolvedCartCount} sản phẩm
                </span>
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
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ─── Sidebar: Filter buttons stacked vertically ─── */}
        <aside
          className="mpv-zone mpv-sidebar"
          aria-label="Chế độ hiển thị và bộ lọc"
        >
          <div
            className="mpv-mode-switch"
            data-mode={mode}
            role="group"
            aria-label="Chế độ hiển thị"
          >
            <button
              className="mpv-mode-option"
              type="button"
              data-active={mode === "cart"}
              aria-pressed={mode === "cart"}
              onClick={() => setMode("cart")}
            >
              {mode === "cart" && (
                <span className="mpv-mode-icon" aria-hidden="true">
                  <SparkleIcon />
                </span>
              )}
              {mode === "tryon" && (
                <span className="mpv-mode-label">Giỏ hàng</span>
              )}
            </button>
            <button
              className="mpv-mode-option"
              type="button"
              data-active={mode === "tryon"}
              aria-pressed={mode === "tryon"}
              onClick={() => setMode("tryon")}
            >
              {mode === "tryon" && (
                <span className="mpv-mode-icon" aria-hidden="true">
                  <CartIcon />
                  {resolvedCartCount > 0 ? (
                    <span className="mpv-mode-badge" aria-hidden="true">
                      {resolvedCartCount}
                    </span>
                  ) : null}
                </span>
              )}
              {mode === "cart" && (
                <span className="mpv-mode-label">Thử đồ</span>
              )}
            </button>
            <span className="mpv-mode-indicator" aria-hidden="true" />
          </div>

          {recommendProducts.length > 0 && (
            <div className="mpv-filter-stack">
              {filterItems.map((filter) => (
                <div className="mpv-filter-item" key={filter.id}>
                  <button
                    className="mpv-filter-btn"
                    type="button"
                    data-active={filter.active}
                    aria-pressed={filter.active}
                    aria-label={`Danh mục ${filter.label}`}
                  >
                    <filter.Icon
                      className="mpv-filter-icon"
                      aria-hidden="true"
                    />
                  </button>
                  <span className="mpv-filter-label">{filter.label}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Inline SVG Icons ───

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3z" />
      <path d="M19 5l.8 2.2L22 8l-2.2.8L19 11l-.8-2.2L16 8l2.2-.8L19 5z" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <path d="M12 16V6" />
      <path d="M8 9l4-4 4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function CartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H7" />
    </svg>
  );
}

function SaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <path d="M5 4h12l2 2v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 4v6h8V4" />
      <path d="M8 17h8" />
    </svg>
  );
}

function ShirtIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <path d="M8 4l4 2 4-2 3 3-3 2v10H8V9L5 7l3-3z" />
    </svg>
  );
}

function PantsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <path d="M7 4h10l-1 16-4-2-4 2-1-16z" />
      <path d="M9 10h6" />
    </svg>
  );
}

function FullBodyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <circle cx="12" cy="6" r="3" />
      <path d="M8 22l2-7-2-3 4-2 4 2-2 3 2 7" />
    </svg>
  );
}

function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      {...props}
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      {...props}
    >
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}
