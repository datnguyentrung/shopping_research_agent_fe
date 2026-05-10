import type { CapturedData } from "@/types/product.types";
import { useCallback, useMemo, useState } from "react";
import "./A2UIInteractiveProduct.scss";

export interface ProductFeedbackPayload {
  decision: "like" | "dislike";
  productId: string;
  reason?: string;
}

type FeedbackEntry = { decision: "like" | "dislike"; reason?: string };
type ProductCardMode = "choice" | "reasons" | "done";

interface A2UIInteractiveProductProps {
  seenProducts: CapturedData[];
  currentProduct: CapturedData | null;
  reasonsToReject?: string[];
  onFeedback: (feedback: ProductFeedbackPayload) => void;
  isLoading: boolean;
}

const toProductId = (value: string | number) => String(value);

const DEFAULT_REASONS = [
  "Giá",
  "Phong cách",
  "Thương hiệu",
  "Tính năng",
  "Lý do khác...",
];

const isOtherReason = (r: string) => /khác/i.test(r);

export default function A2UIInteractiveProduct({
  seenProducts,
  currentProduct,
  reasonsToReject = [],
  onFeedback,
  isLoading,
}: A2UIInteractiveProductProps) {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackEntry>>(
    {},
  );
  const [uiState, setUiState] = useState<{
    productId: string | null;
    activeCard: ProductCardMode;
    otherReason: string;
    isOtherSelected: boolean;
  }>({
    productId: null,
    activeCard: "choice",
    otherReason: "",
    isOtherSelected: false,
  });
  const visibleReasons = reasonsToReject.length
    ? reasonsToReject
    : DEFAULT_REASONS;

  const latestSeenProduct = useMemo(
    () => seenProducts[seenProducts.length - 1] ?? null,
    [seenProducts],
  );

  const displayedProduct = currentProduct ?? latestSeenProduct;
  const displayedProductId = displayedProduct
    ? toProductId(displayedProduct.productId)
    : null;
  const currentFeedback = displayedProductId
    ? feedbackMap[displayedProductId]
    : undefined;

  const isCurrentDone =
    currentFeedback?.decision === "like" ||
    currentFeedback?.decision === "dislike";

  const isUiStateForCurrentProduct = uiState.productId === displayedProductId;
  const activeCard: ProductCardMode = isUiStateForCurrentProduct
    ? uiState.activeCard
    : "choice";
  const otherReason = isUiStateForCurrentProduct ? uiState.otherReason : "";
  const isOtherSelected = isUiStateForCurrentProduct
    ? uiState.isOtherSelected
    : false;

  const updateUiState = useCallback(
    (patch: Partial<Omit<typeof uiState, "productId">>) => {
      setUiState((prev) => {
        const baseState =
          prev.productId === displayedProductId
            ? prev
            : {
                productId: displayedProductId,
                activeCard: "choice" as ProductCardMode,
                otherReason: "",
                isOtherSelected: false,
              };

        return {
          productId: displayedProductId,
          activeCard: patch.activeCard ?? baseState.activeCard,
          otherReason: patch.otherReason ?? baseState.otherReason,
          isOtherSelected: patch.isOtherSelected ?? baseState.isOtherSelected,
        };
      });
    },
    [displayedProductId],
  );

  const handleFeedback = useCallback(
    (feedback: ProductFeedbackPayload) => {
      onFeedback(feedback);
      setFeedbackMap((prev) => ({
        ...prev,
        [feedback.productId]: {
          decision: feedback.decision,
          reason: feedback.reason,
        },
      }));
    },
    [onFeedback],
  );

  const handleLike = () => {
    if (!displayedProductId) return;
    handleFeedback({ decision: "like", productId: displayedProductId });
    updateUiState({ activeCard: "done" });
  };

  const handleDislike = () => updateUiState({ activeCard: "reasons" });

  const handleReasonSelect = (reason: string) => {
    if (!displayedProductId) return;
    if (isOtherReason(reason)) {
      updateUiState({ isOtherSelected: true });
      return;
    }
    handleFeedback({
      decision: "dislike",
      productId: displayedProductId,
      reason,
    });
    updateUiState({ activeCard: "done" });
  };

  const handleSubmitOtherReason = () => {
    if (!displayedProductId || !otherReason.trim()) return;
    handleFeedback({
      decision: "dislike",
      productId: displayedProductId,
      reason: otherReason.trim(),
    });
    updateUiState({ activeCard: "done" });
  };

  const handleSkip = () => {
    if (!displayedProductId) return;
    handleFeedback({
      decision: "dislike",
      productId: displayedProductId,
      reason: "skip",
    });
    updateUiState({ activeCard: "done" });
  };

  if (!displayedProduct) return null;

  return (
    <div className="product-carousel">
      <ProductCard
        key={displayedProductId}
        product={displayedProduct}
        feedback={isCurrentDone ? (currentFeedback ?? null) : null}
        isActive={Boolean(currentProduct)}
        mode={activeCard}
        reasonsToReject={visibleReasons}
        onLike={handleLike}
        onDislike={handleDislike}
        onReasonSelect={handleReasonSelect}
        onSkip={handleSkip}
        isOtherSelected={isOtherSelected}
        otherReason={otherReason}
        onOtherReasonChange={(value) => updateUiState({ otherReason: value })}
        onSubmitOtherReason={handleSubmitOtherReason}
      />

      {isLoading && !isCurrentDone && !currentProduct && (
        <div className="product-carousel__placeholder">
          <div className="product-carousel__placeholder-inner" />
        </div>
      )}
    </div>
  );
}

/* ─── ProductCard ─── */

interface ProductCardProps {
  product: CapturedData;
  feedback: FeedbackEntry | null;
  isActive?: boolean;
  mode?: "choice" | "reasons" | "done";
  reasonsToReject?: string[];
  onLike?: () => void;
  onDislike?: () => void;
  onReasonSelect?: (reason: string) => void;
  onSkip?: () => void;
  isOtherSelected?: boolean;
  otherReason?: string;
  onOtherReasonChange?: (val: string) => void;
  onSubmitOtherReason?: () => void;
}

function ProductCard({
  product,
  feedback,
  isActive = false,
  mode = "done",
  reasonsToReject,
  onLike,
  onDislike,
  onReasonSelect,
  onSkip,
  isOtherSelected,
  otherReason,
  onOtherReasonChange,
  onSubmitOtherReason,
}: ProductCardProps) {
  const hasShopName = Boolean(product.shop?.shopName);
  const trimmedOther = otherReason?.trim() ?? "";
  const canSubmitOther = trimmedOther.length > 0;

  return (
    <div className="product-card">
      {/* Image */}
      <div className="product-card__image-wrap">
        <img
          src={product.mainImage}
          alt={product.name}
          className="product-card__image"
          loading="lazy"
        />
        <span className="product-card__platform">{product.platform}</span>
      </div>

      {/* Info */}
      <div className="product-card__info">
        <h4 className="product-card__name">{product.name}</h4>
        <p className="product-card__price">
          {product.priceCurrent.toLocaleString("vi-VN")} {product.currency}
        </p>
        {hasShopName && (
          <p className="product-card__shop">Shop: {product.shop.shopName}</p>
        )}
      </div>

      {/* Actions */}
      {isActive && !feedback ? (
        <div className="product-card__actions">
          {mode === "choice" && onDislike && onLike && (
            <>
              <button
                type="button"
                className="product-card__btn product-card__btn--reject"
                onClick={onDislike}
              >
                Không quan tâm
              </button>
              <button
                type="button"
                className="product-card__btn product-card__btn--like"
                onClick={onLike}
              >
                Thêm nội dung như thế này
              </button>
            </>
          )}

          {mode === "reasons" && onReasonSelect && onSkip && (
            <div className="product-card__feedback">
              <p className="product-card__question">Tại sao bạn không thích?</p>
              <div className="product-card__reasons">
                {reasonsToReject?.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className="product-card__btn product-card__btn--reason"
                    onClick={() => onReasonSelect(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              {isOtherSelected && (
                <div className="product-card__other-wrap">
                  <input
                    type="text"
                    className="product-card__other-input"
                    placeholder="Nhập lý do..."
                    value={otherReason ?? ""}
                    autoFocus
                    onChange={(e) => onOtherReasonChange?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSubmitOtherReason?.();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="product-card__btn product-card__btn--submit"
                    onClick={onSubmitOtherReason}
                    disabled={!canSubmitOther}
                  >
                    Gửi
                  </button>
                </div>
              )}
              <button
                type="button"
                className="product-card__btn product-card__btn--skip"
                onClick={onSkip}
              >
                Bỏ qua
              </button>
            </div>
          )}

          {mode === "done" && (
            <div className="product-card__done">Đã ghi nhận</div>
          )}
        </div>
      ) : null}

      {/* Done state for non-active / already feedbacked cards */}
      {feedback && !isActive && (
        <div className="product-card__done">
          {feedback.decision === "like" ? "Đã thêm vào danh sách" : "Đã bỏ qua"}
        </div>
      )}
    </div>
  );
}
