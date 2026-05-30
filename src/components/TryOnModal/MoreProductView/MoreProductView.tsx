import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";

import { NotebookPen, Search } from "lucide-react";
import { useRecommendSSE } from "../../../hooks/useRecommendSSE";
import type { CapturedData } from "../../../types";
import type { ProductCategory } from "../../../types/recommendation.types";
import type { TryOnHistoryItem } from "../../../types/vto.types";
import "./MoreProductView.scss";

const filterItems = [
  { id: "Upper-body", label: "Áo", active: true, Icon: ShirtIcon },
  { id: "Lower-body", label: "Quần", active: false, Icon: PantsIcon },
  { id: "Full-body", label: "Toàn thân", active: false, Icon: FullBodyIcon },
];

const aiKeywordHints = ["athletic", "tự do", "năng động", "trẻ trung"];

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  console.log("Mode:", mode);

  const [productCategory, setProductCategory] =
    useState<ProductCategory | null>(null);
  const [productSelected, setProductSelected] = useState<CapturedData | null>(
    null,
  );
  const [extraProducts, setExtraProducts] = useState<CapturedData[]>([]);
  const [hiddenBaseId, setHiddenBaseId] = useState<string | number | null>(
    null,
  );
  const [typedReason, setTypedReason] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  // ── Hook SSE với streaming products realtime ──
  const {
    isLoading,
    progress,
    result,
    streamingProducts,
    error,
    startRecommend,
  } = useRecommendSSE();

  // console.log("Recommendation Result:", result);

  // Ref để auto-scroll sản phẩm mới nhất vào viewport
  const gridRef = useRef<HTMLDivElement>(null);

  // Auto-scroll khi có sản phẩm mới stream vào
  useEffect(() => {
    if (streamingProducts.length > 0 && gridRef.current) {
      const el = gridRef.current;
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  }, [streamingProducts.length]);

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

  const reasonText = useMemo(
    () => result?.reasonRecommend?.trim() ?? "",
    [result],
  );
  const shouldTypeReason = !isLoading && reasonText.length > 0;

  const keywordRegexSource = useMemo(
    () => aiKeywordHints.map(escapeRegex).join("|"),
    [],
  );
  const keywordSplitRegex = useMemo(
    () => new RegExp(`(${keywordRegexSource})`, "gi"),
    [keywordRegexSource],
  );
  const keywordMatchRegex = useMemo(
    () => new RegExp(`^(${keywordRegexSource})$`, "i"),
    [keywordRegexSource],
  );

  useEffect(() => {
    let index = 0;
    let canceled = false;
    let timerId: number | null = null;
    let rafId: number | null = null;

    const clearTimers = () => {
      if (timerId != null) {
        window.clearTimeout(timerId);
      }
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
    };

    const tick = () => {
      if (canceled) {
        return;
      }

      const step = Math.max(1, Math.round(Math.random() * 3));
      index = Math.min(reasonText.length, index + step);
      setTypedReason(reasonText.slice(0, index));

      if (index < reasonText.length) {
        const delay = 26 + Math.random() * 60;
        timerId = window.setTimeout(tick, delay);
      } else {
        setIsTyping(false);
      }
    };

    if (!shouldTypeReason) {
      clearTimers();
      rafId = window.requestAnimationFrame(() => {
        setTypedReason("");
        setIsTyping(false);
      });

      return () => {
        canceled = true;
        clearTimers();
      };
    }

    rafId = window.requestAnimationFrame(() => {
      setTypedReason("");
      setIsTyping(true);
      tick();
    });

    return () => {
      canceled = true;
      clearTimers();
    };
  }, [reasonText, shouldTypeReason]);

  const renderHighlightedReason = (text: string) => {
    if (!text) {
      return null;
    }

    const sentences = text.match(/[^.]+\.?/g) ?? [];

    return sentences
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence, index, array) => (
        <span key={`reason-line-${index}`}>
          <span className="mpv-ai-line">
            <span className="mpv-ai-line-icon" aria-hidden="true">
              <SparkleIcon />
            </span>
            <span>
              {sentence.split(keywordSplitRegex).map((part, partIndex) =>
                keywordMatchRegex.test(part) ? (
                  <span className="mpv-keyword" key={`kw-${index}-${partIndex}`}>
                    {part}
                  </span>
                ) : (
                  part
                ),
              )}
            </span>
          </span>
          {index < array.length - 1 ? <br /> : null}
        </span>
      ));
  };

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
    startRecommend({
      personImageUrl: item.imageUrl,
      productImageUrl: item.productImageUrl,
      productName: item.productName,
    }).then((recommendResult) => {
      // Sau khi stream xong, nếu có kết quả thì chọn category mặc định
      if (recommendResult) {
        const initialCategory =
          recommendResult.personalizedRecommendationResponses?.[0]
            ?.productCategory ?? null;
        setProductCategory(initialCategory);
        setProductSelected(
          recommendResult.personalizedRecommendationResponses?.filter(
            (res) => res.productCategory === initialCategory,
          )?.[0]?.products?.[0] ?? null,
        );
        setMode("tryon");
      }
    });
  };

  const recommendationResponses = useMemo(
    () => result?.personalizedRecommendationResponses ?? [],
    [result],
  );

  const listRecommend = useMemo(() => {
    if (recommendationResponses.length === 0) {
      return [];
    }
    return (
      recommendationResponses.filter(
        (rec) => rec.productCategory === productCategory,
      )?.[0]?.products ?? []
    );
  }, [recommendationResponses, productCategory]);

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

  const hasRecommendations = recommendationResponses.length > 0;

  console.log("hasRecommendations:", hasRecommendations);

  const isCompactLayout = mode === "tryon" && !hasRecommendations && !isLoading;

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
        data-center={hasRecommendations ? "on" : "off"}
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
              Thêm sản phẩm
            </button>
            <button className="mpv-outline-btn" type="button">
              <span className="mpv-btn-icon" aria-hidden="true">
                <SaveIcon />
              </span>
              Lưu ảnh
            </button>
          </div>
        </section>

        {/* ─── Center: AI Stylist Note ─── */}
        {hasRecommendations && (
          <section className="mpv-zone mpv-center" aria-label="AI Stylist Note">
            <div className="mpv-card mpv-ai-note" data-typing={isTyping}>
              <div className="mpv-ai-header">
                <span
                  className="mpv-ai-icon"
                  data-animate={isTyping}
                  aria-hidden="true"
                >
                  <SparkleIcon />
                </span>
                <div className="mpv-ai-heading">
                  <span className="mpv-ai-title">AI Stylist Note</span>
                  <span className="mpv-ai-subtitle">Khuyên dùng</span>
                </div>
              </div>

              <div className="mpv-ai-body" aria-live="polite">
                <span className="mpv-ai-kicker">AI Stylist Insight</span>
                {isLoading ? (
                  <p className="mpv-ai-text mpv-ai-text--muted">
                    AI đang phân tích để đưa ra lời khuyên phù hợp...
                  </p>
                ) : reasonText ? (
                  <p className="mpv-ai-text">
                    {typedReason.length === 0 && isTyping
                      ? "AI đang soạn ghi chú..."
                      : renderHighlightedReason(typedReason || reasonText)}
                    {isTyping && (
                      <span className="mpv-typing-caret" aria-hidden="true" />
                    )}
                  </p>
                ) : (
                  <p className="mpv-ai-text mpv-ai-text--muted">
                    AI sẽ ghi chú sau khi có sản phẩm phù hợp.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── Right: Progress / Streaming products / Final results ─── */}
        <section className="mpv-zone mpv-right" aria-label="Sản phẩm chính">
          <div className="mpv-right-actions">
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
                disabled={isLoading}
                data-loading={isLoading}
              >
                {isLoading ? (
                  <span className="mpv-btn-icon" aria-hidden="true">
                    <SpinnerIcon />
                  </span>
                ) : (
                  <span className="mpv-btn-icon" aria-hidden="true">
                    <Search />
                  </span>
                )}
                {isLoading ? "Đang tìm..." : "Tìm sản phẩm phù hợp"}
              </button>
            )}

            <button
              className="mpv-secondary-btn"
              type="button"
              onClick={() => setMode("cart")}
            >
              <span className="mpv-btn-icon" aria-hidden="true">
                <NotebookPen />
              </span>
              Tùy chỉnh phong cách
            </button>
          </div>
          {mode === "cart" ? (
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

          {recommendationResponses.length > 0 && (
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

function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      {...props}
      className="mpv-spinner-icon"
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

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
