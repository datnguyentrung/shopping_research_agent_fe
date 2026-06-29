import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";

import { NotebookPen, Search } from "lucide-react";
import { useRecommendSSE } from "../../../hooks/useRecommendSSE";
import { apiConfig } from "../../../services/api";
import { fireTryOnRequest } from "../../../services/virtualTryOnService";
import type { CapturedData } from "../../../types";
import type { ProductCategory } from "../../../types/recommendation.types";
import type { TryOnHistoryItem } from "../../../types/vto.types";
import {
  toOrigin,
  toWebSocketBaseUrl,
  urlToFile,
} from "../../../utils/vto.utils";
import ConfirmModal from "../../ConfirmModal";
import type { VtoStatus, VtoWsMessage } from "../vto.types";
import AiStylistNote from "./AiStylistNote";
import CustomerPanel from "./CustomerPanel";
import FrameHeader from "./FrameHeader";
import ModeSidebar from "./ModeSidebar";
import "./MoreProductView.scss";
import RightPanel from "./RightPanel/index";

const filterItems = [
  { id: "Upper-body", label: "Áo", active: true, Icon: ShirtIcon },
  { id: "Lower-body", label: "Quần", active: false, Icon: PantsIcon },
  { id: "Other", label: "Khác", active: false, Icon: FullBodyIcon },
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
  const [mode, setMode] = useState<"cart" | "tryon" | "color">("tryon");

  // console.log("Mode:", mode);

  // Ảnh nguồn dùng để đổi màu (snapshot ảnh đang thử đồ lúc nhấn "Đổi màu").
  const [recolorSourceUrl, setRecolorSourceUrl] = useState<string | null>(null);

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
  const [activeImageUrl, setActiveImageUrl] = useState(item.imageUrl);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [tryOnStatus, setTryOnStatus] = useState<VtoStatus>("idle");
  const [tryOnProgress, setTryOnProgress] = useState(0);
  const [tryOnError, setTryOnError] = useState<string | null>(null);
  const [activeMarketingMessage, setActiveMarketingMessage] = useState<
    string | null
  >(null);
  const [pendingMarketingMessage, setPendingMarketingMessage] = useState<
    string | null
  >(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  // ── Hook SSE với streaming products realtime ──
  const {
    isLoading,
    progress,
    result,
    streamingProducts,
    error,
    startRecommend,
    reset,
  } = useRecommendSSE();

  // console.log("Recommendation Result:", result);

  // Ref để auto-scroll sản phẩm mới nhất vào viewport
  const gridRef = useRef<HTMLDivElement>(null);
  const tryOnWsRef = useRef<WebSocket | null>(null);
  const tryOnProgressTimerRef = useRef<number | null>(null);

  // Auto-scroll khi có sản phẩm mới stream vào
  useEffect(() => {
    if (streamingProducts.length > 0 && gridRef.current) {
      const el = gridRef.current;
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  }, [streamingProducts.length]);

  useEffect(() => {
    setActiveImageUrl(item.imageUrl);
    setPendingImageUrl(null);
    setTryOnStatus("idle");
    setTryOnProgress(0);
    setTryOnError(null);
    setActiveMarketingMessage(null);
    setPendingMarketingMessage(null);
    tryOnWsRef.current?.close();
    tryOnWsRef.current = null;
    if (tryOnProgressTimerRef.current) {
      window.clearInterval(tryOnProgressTimerRef.current);
      tryOnProgressTimerRef.current = null;
    }
  }, [item]);

  useEffect(() => {
    return () => {
      tryOnWsRef.current?.close();
      if (tryOnProgressTimerRef.current) {
        window.clearInterval(tryOnProgressTimerRef.current);
      }
    };
  }, []);

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
    () =>
      pendingMarketingMessage?.trim() ??
      activeMarketingMessage?.trim() ??
      result?.reasonRecommend?.trim() ??
      "",
    [pendingMarketingMessage, activeMarketingMessage, result],
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

    const activeCategory =
      productCategory ?? recommendationResponses[0]?.productCategory ?? null;

    if (!activeCategory) {
      return [];
    }

    const matchedWithProducts = recommendationResponses.find(
      (rec) =>
        rec.productCategory === activeCategory && rec.products.length > 0,
    );

    if (matchedWithProducts) {
      return matchedWithProducts.products;
    }

    return (
      recommendationResponses.find(
        (rec) => rec.productCategory === activeCategory,
      )?.products ?? []
    );
  }, [recommendationResponses, productCategory]);

  const resolvedProductSelected = useMemo(() => {
    if (listRecommend.length === 0) {
      return null;
    }

    return productSelected ?? listRecommend[0] ?? null;
  }, [productSelected, listRecommend]);

  const isTryOnProcessing =
    tryOnStatus === "validating" ||
    tryOnStatus === "uploading" ||
    tryOnStatus === "pending";
  const hasPendingPreview = Boolean(pendingImageUrl);
  const displayImageUrl = pendingImageUrl ?? activeImageUrl;

  const startTryOnProgress = () => {
    setTryOnProgress(8);
    if (tryOnProgressTimerRef.current) {
      window.clearInterval(tryOnProgressTimerRef.current);
    }

    tryOnProgressTimerRef.current = window.setInterval(() => {
      setTryOnProgress((prev) => {
        if (prev >= 92) return prev;
        const next = prev + Math.max(1, Math.round((92 - prev) / 12));
        return Math.min(next, 92);
      });
    }, 350);
  };

  const stopTryOnProgress = (finalValue?: number) => {
    if (tryOnProgressTimerRef.current) {
      window.clearInterval(tryOnProgressTimerRef.current);
    }
    tryOnProgressTimerRef.current = null;
    if (typeof finalValue === "number") {
      setTryOnProgress(finalValue);
    }
  };

  const handleCancelTryOn = () => {
    tryOnWsRef.current?.close();
    tryOnWsRef.current = null;
    stopTryOnProgress(0);
    setTryOnStatus("idle");
    setTryOnError(null);
    setPendingImageUrl(null);
    setPendingMarketingMessage(null);
  };

  const handleAcceptTryOn = () => {
    if (!pendingImageUrl) {
      return;
    }

    setActiveImageUrl(pendingImageUrl);
    setPendingImageUrl(null);
    if (pendingMarketingMessage) {
      setActiveMarketingMessage(pendingMarketingMessage);
      setPendingMarketingMessage(null);
    }
    setTryOnStatus("idle");
    setTryOnError(null);
    setTryOnProgress(0);
  };

  // ── Đổi màu (recolor) ──
  // Mở phiên đổi màu: snapshot ảnh đang hiển thị làm nguồn, chuyển RightPanel sang color mode.
  const handleStartRecolor = () => {
    const source = displayImageUrl || item.imageUrl;
    if (!source) return;
    setRecolorSourceUrl(source);
    setMode("color");
  };

  // Sau khi lưu ảnh đổi màu: thay ảnh chính, vẫn ở recolor để đổi tiếp nếu muốn.
  const handleSaveRecolor = (dataUrl: string) => {
    setActiveImageUrl(dataUrl);
  };

  // Thoát phiên đổi màu: quay về chế độ thử đồ.
  const handleCloseRecolor = () => {
    setRecolorSourceUrl(null);
    setMode("tryon");
  };

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

  const handleVTOAction = async () => {
    if (!resolvedProductSelected || isTryOnProcessing || hasPendingPreview) {
      return;
    }

    const productImageUrl = resolvedProductSelected.mainImage ?? "";
    const productUrl = resolvedProductSelected.productUrl ?? "";
    const productName = resolvedProductSelected.name ?? "";

    if (!productImageUrl || !productUrl || !productName) {
      setTryOnError("Thiếu thông tin sản phẩm để thử đồ.");
      return;
    }

    const personSourceUrl = activeImageUrl || item.imageUrl;
    if (!personSourceUrl) {
      setTryOnError("Thiếu ảnh người mẫu để thử đồ.");
      return;
    }

    addProduct(resolvedProductSelected);
    setTryOnError(null);
    setPendingImageUrl(null);
    setTryOnStatus("uploading");
    startTryOnProgress();

    try {
      const personFile = await urlToFile(personSourceUrl, "tryon-person.png");
      const json = await fireTryOnRequest(
        personFile,
        productImageUrl,
        productUrl,
        productName,
        resolvedProductSelected.priceCurrent,
      );

      const requestId =
        json?.request_id ??
        json?.requestId ??
        json?.id ??
        json?.data?.request_id;

      if (!requestId) {
        throw new Error("Missing request_id");
      }

      setTryOnStatus("pending");

      const wsBase = toWebSocketBaseUrl(toOrigin(apiConfig.baseUrl));
      const ws = new WebSocket(`${wsBase}/ws/vto/${requestId}`);
      tryOnWsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as VtoWsMessage;
          if (message.error) {
            setTryOnStatus("error");
            stopTryOnProgress();
            setTryOnError(String(message.error));
            ws.close();
            return;
          }

          if (message.status === "completed" && message.result_url) {
            setTryOnStatus("completed");
            stopTryOnProgress(100);
            setPendingImageUrl(message.result_url);
            if (message.marketing_message) {
              setPendingMarketingMessage(message.marketing_message);
            }
            ws.close();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setTryOnStatus("error");
        stopTryOnProgress();
        setTryOnError("Kết nối may đo bị lỗi. Vui lòng thử lại.");
      };

      ws.onclose = () => {
        tryOnWsRef.current = null;
      };
    } catch (err) {
      setTryOnStatus("error");
      stopTryOnProgress();
      setTryOnError(
        err instanceof Error ? err.message : "Đã có lỗi xảy ra khi thử đồ.",
      );
    }
  };

  const hasRecommendations = recommendationResponses.length > 0;

  // console.log("hasRecommendations:", hasRecommendations);

  const isCompactLayout = mode === "tryon" && !hasRecommendations && !isLoading;

  let tryOnProcessingText = "Bụt đang chuẩn bị...";
  if (tryOnStatus === "validating")
    tryOnProcessingText = "Đang kiểm tra vóc dáng...";
  if (tryOnStatus === "uploading")
    tryOnProcessingText = "Đang tải ảnh lên hệ thống...";
  if (tryOnStatus === "pending")
    tryOnProcessingText = "Bụt đang cân chỉnh trang phục...";

  const handleCloseRequest = () => {
    if (result) {
      setIsCloseConfirmOpen(true);
      return;
    }

    onClose?.();
  };

  const handleConfirmClose = () => {
    handleCancelTryOn();
    reset();
    setProductCategory(null);
    setProductSelected(null);
    setIsCloseConfirmOpen(false);
    onClose?.();
  };

  return (
    <div className="mpv-frame">
      <FrameHeader
        onBack={onBack}
        onClose={handleCloseRequest}
        BackIcon={BackIcon}
        CloseIcon={CloseIcon}
      />

      <div
        className="more-product-view"
        data-layout={isCompactLayout ? "compact" : "full"}
        data-center={hasRecommendations ? "on" : "off"}
      >
        <CustomerPanel
          item={item}
          imageUrl={displayImageUrl}
          isProcessing={isTryOnProcessing}
          progress={tryOnProgress}
          processingText={tryOnProcessingText}
          hasPendingPreview={hasPendingPreview}
          tryOnError={tryOnError}
          onCancelTryOn={handleCancelTryOn}
          onAcceptTryOn={handleAcceptTryOn}
          onStartRecolor={handleStartRecolor}
          UploadIcon={UploadIcon}
        />

        {hasRecommendations && (
          <AiStylistNote
            isTyping={isTyping}
            isLoading={
              isLoading || (isTryOnProcessing && !pendingMarketingMessage)
            }
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
          isTryOnLoading={isTryOnProcessing}
          progress={progress}
          streamingProducts={streamingProducts}
          error={error}
          listRecommend={listRecommend}
          productSelected={resolvedProductSelected}
          onSelectProduct={setProductSelected}
          onGetRecommendations={handleGetRecommendations}
          onTryOn={handleVTOAction}
          onModeChange={setMode}
          resolvedCartCount={resolvedCartCount}
          productShoppings={productShoppings}
          onRemoveProduct={removeProduct}
          gridRef={gridRef}
          emptyDescription={item.description}
          recolorSourceUrl={recolorSourceUrl}
          onSaveRecolor={handleSaveRecolor}
          onCloseRecolor={handleCloseRecolor}
          SparkleIcon={SparkleIcon}
          SpinnerIcon={SpinnerIcon}
          SearchIcon={Search}
          NotebookPenIcon={NotebookPen}
          TrashIcon={TrashIcon}
        />

        {mode !== "color" && (
          <ModeSidebar
            mode={mode}
            resolvedCartCount={resolvedCartCount}
            showFilters={recommendationResponses.length > 0}
            productCategory={productCategory}
            onSelectMode={setMode}
            onSelectCategory={(category) => {
              const nextCategory = category as ProductCategory;
              if (nextCategory !== productCategory) {
                setProductSelected(null);
              }
              setProductCategory(nextCategory);
            }}
            filterItems={filterItems}
            SparkleIcon={SparkleIcon}
            CartIcon={CartIcon}
          />
        )}
      </div>

      <ConfirmModal
        open={isCloseConfirmOpen}
        title="Đóng bảng gợi ý?"
        description="Nếu đóng bây giờ, dữ liệu gợi ý vừa tìm sẽ không được lưu."
        cancelText="Hủy"
        confirmText="Đóng"
        showSuccessToastOnConfirm={false}
        showErrorToastOnFail={false}
        onCancel={() => setIsCloseConfirmOpen(false)}
        onConfirm={handleConfirmClose}
      />
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
