import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

import "./TryOnModal.scss";

import type { TryOnHistoryItem } from "@/types/vto.types";
import EditorView from "./EditorView";
import HistoryView from "./HistoryView";
import MoreProductView from "./MoreProductView";

interface TryOnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productImageUrl: string;
  productUrl: string;
  productName?: string;
  defaultView?: "history" | "new_try_on";
}

export default function TryOnModal({
  open,
  onOpenChange,
  productImageUrl,
  productUrl,
  productName = "Sản phẩm đang chọn",
  defaultView = "new_try_on",
}: TryOnModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <TryOnModalContent
          key="tryon-modal"
          open={open}
          onOpenChange={onOpenChange}
          productImageUrl={productImageUrl}
          productUrl={productUrl}
          productName={productName}
          defaultView={defaultView}
        />
      )}
    </AnimatePresence>
  );
}

function TryOnModalContent({
  open,
  onOpenChange,
  productImageUrl,
  productUrl,
  productName = "Sản phẩm đang chọn",
  defaultView = "new_try_on",
}: TryOnModalProps) {
  const [currentView, setCurrentView] = useState<
    "history" | "new_try_on" | "more_product"
  >(defaultView);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<TryOnHistoryItem | null>(null);

  const handleProcessingChange = useCallback((processing: boolean) => {
    setIsProcessing(processing);
  }, []);

  const handleClose = useCallback(() => {
    if (isProcessing) return;
    onOpenChange(false);
  }, [isProcessing, onOpenChange]);

  return (
    <div className="tryon-modal-shell">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="tryon-modal-shell__backdrop"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="tryon-modal-shell__container"
      >
        {!isProcessing && currentView !== "more_product" && (
          <button
            onClick={handleClose}
            className="tryon-modal-shell__close-btn"
          >
            <X className="tryon-modal-shell__close-icon" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {currentView === "history" && (
            <HistoryView
              key="history-view"
              open={open}
              onOpenMoreProductView={(item) => {
                setSelectedHistoryItem(item);
                setCurrentView("more_product");
              }}
            />
          )}
          {currentView === "new_try_on" && (
            <EditorView
              key="tryon-view"
              open={open}
              productImageUrl={productImageUrl}
              productUrl={productUrl}
              productName={productName}
              showBackButton={defaultView === "history"}
              onNavigateToHistory={() => setCurrentView("history")}
              onProcessingChange={handleProcessingChange}
            />
          )}
          {currentView === "more_product" && selectedHistoryItem && (
            <MoreProductView
              key="more-product-view"
              open={open}
              item={selectedHistoryItem}
              onBack={() => {
                setSelectedHistoryItem(null);
                setCurrentView("history");
              }}
              onClose={handleClose}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
