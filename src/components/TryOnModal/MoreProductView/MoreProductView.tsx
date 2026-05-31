import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";

import { NotebookPen, Search } from "lucide-react";
import { useRecommendSSE } from "../../../hooks/useRecommendSSE";
import type { CapturedData } from "../../../types";
import type { ProductCategory } from "../../../types/recommendation.types";
import type { TryOnHistoryItem } from "../../../types/vto.types";
import AiStylistNote from "./AiStylistNote";
import CustomerPanel from "./CustomerPanel";
import FrameHeader from "./FrameHeader";
import ModeSidebar from "./ModeSidebar";
import "./MoreProductView.scss";
import RightPanel from "./RightPanel/index";

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
                  <span
                    className="mpv-keyword"
                    key={`kw-${index}-${partIndex}`}
                  >
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
      <FrameHeader
        onBack={onBack}
        onClose={onClose}
        BackIcon={BackIcon}
        CloseIcon={CloseIcon}
      />

      <div
        className="more-product-view"
        data-layout={isCompactLayout ? "compact" : "full"}
        data-center={hasRecommendations ? "on" : "off"}
      >
        <CustomerPanel
          imageUrl={item.imageUrl}
          UploadIcon={UploadIcon}
          CartIcon={CartIcon}
          SaveIcon={SaveIcon}
        />

        {hasRecommendations && (
          <AiStylistNote
            isTyping={isTyping}
            isLoading={isLoading}
            reasonText={reasonText}
            typedReason={typedReason}
            renderHighlightedReason={renderHighlightedReason}
            SparkleIcon={SparkleIcon}
          />
        )}

        <RightPanel
          mode={mode}
          hasRecommendations={hasRecommendations}
          isLoading={isLoading}
          progress={progress}
          streamingProducts={streamingProducts}
          error={error}
          listRecommend={listRecommend}
          productSelected={productSelected}
          onSelectProduct={setProductSelected}
          onGetRecommendations={handleGetRecommendations}
          onTryOn={handleVTOAction}
          onModeChange={setMode}
          resolvedCartCount={resolvedCartCount}
          productShoppings={productShoppings}
          onRemoveProduct={removeProduct}
          gridRef={gridRef}
          emptyDescription={item.description}
          SparkleIcon={SparkleIcon}
          SpinnerIcon={SpinnerIcon}
          SearchIcon={Search}
          NotebookPenIcon={NotebookPen}
          TrashIcon={TrashIcon}
        />

        <ModeSidebar
          mode={mode}
          resolvedCartCount={resolvedCartCount}
          showFilters={recommendationResponses.length > 0}
          productCategory={productCategory}
          onSelectMode={setMode}
          onSelectCategory={(category) =>
            setProductCategory(category as ProductCategory)
          }
          filterItems={filterItems}
          SparkleIcon={SparkleIcon}
          CartIcon={CartIcon}
        />
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
