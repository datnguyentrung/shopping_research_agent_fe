import { useMemo, useState, type SVGProps } from "react";

import { Search } from "lucide-react";
import { recommendPersonalizedProducts } from "../../../services/virtualTryOnService";
import type { CapturedData } from "../../../types";
import type {
  PersonalizedRecommendationResponse,
  ProductCategory,
} from "../../../types/recommendation.types";
import type { TryOnHistoryItem } from "../../../types/vto.types";
import "./MoreProductView.scss";

const filterItems = [
  { id: "Upper-body", label: "Áo", active: true, Icon: ShirtIcon },
  { id: "Lower-body", label: "Quần", active: false, Icon: PantsIcon },
  { id: "Full-body", label: "Toàn thân", active: false, Icon: FullBodyIcon },
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
  const [productCategory, setProductCategory] =
    useState<ProductCategory | null>(null);
  const [productSelected, setProductSelected] = useState<CapturedData | null>(
    null,
  );
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

  const handleGetRecommendations = () => {
    // Gọi API lấy sản phẩm gợi ý dựa trên item hiện tại
    recommendPersonalizedProducts(
      item.imageUrl,
      item.productImageUrl,
      item.productName,
    )
      .then((products) => {
        const initialCategory = products?.[0]?.productCategory ?? null;

        setRecommendProducts(products);
        setProductCategory(initialCategory);
        setProductSelected(
          products
            ? (products.filter(
                (res) => res.productCategory === initialCategory,
              )?.[0]?.products?.[0] ?? null)
            : null,
        );
        setMode("tryon");
      })
      .catch((error) => {
        console.error("Lỗi khi lấy sản phẩm gợi ý:", error);
      });
  };

  const listRecommend = useMemo(() => {
    if (recommendProducts.length === 0) {
      return [];
    }
    return (
      recommendProducts.filter(
        (rec) => rec.productCategory === productCategory,
      )?.[0]?.products ?? []
    );
  }, [recommendProducts, productCategory]);

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

  const handleVTOAction = () => {
    if (!productSelected) {
      return;
    }
    addProduct(productSelected); // Giả sử sản phẩm được chọn sẽ được thêm vào list
    // Xử lý hành động thử đồ với productSelected
    console.log("Thử đồ với sản phẩm:", productSelected);
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
          {hasRecommendations ? (
            <button
              className="mpv-primary-btn"
              type="button"
              onClick={handleVTOAction}
            >
              <span className="mpv-btn-icon" aria-hidden="true">
                <SparkleIcon />
              </span>
              Thử đồ
            </button>
          ) : (
            <button
              className="mpv-primary-btn"
              type="button"
              onClick={handleGetRecommendations}
            >
              <span className="mpv-btn-icon" aria-hidden="true">
                <Search />
              </span>
              Tìm sản phẩm phù hợp
            </button>
          )}

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
                    src={productSelected?.mainImage}
                    alt={productSelected?.name}
                    width={720}
                    height={900}
                    loading="eager"
                    fetchPriority="high"
                  />
                  <div className="mpv-product-title">
                    {productSelected?.name}
                  </div>
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
                      onClick={() => setProductSelected(product)}
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
            ) : (
              <div className="mpv-card mpv-empty-panel" aria-live="polite">
                <div className="mpv-empty-title">
                  Bạn phù hợp với sản phẩm như thế nào ?
                </div>
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
                            removeProduct(product.productId);
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
              {filterItems.map((filter) => {
                const isActive = filter.id === productCategory;

                return (
                  <div className="mpv-filter-item" key={filter.id}>
                    <button
                      className="mpv-filter-btn"
                      type="button"
                      data-active={isActive}
                      aria-pressed={isActive}
                      aria-label={`Danh mục ${filter.label}`}
                      onClick={() =>
                        setProductCategory(filter.id as ProductCategory)
                      }
                    >
                      <filter.Icon
                        className="mpv-filter-icon"
                        aria-hidden="true"
                      />
                    </button>
                    <span className="mpv-filter-label">{filter.label}</span>
                  </div>
                );
              })}
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

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...props}
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
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
