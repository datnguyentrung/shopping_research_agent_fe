import type { A2UIPayload } from "@/types/a2ui.types";
import type { CapturedData } from "@/types/product.types";
import A2UIInteractiveProduct, {
  type ProductFeedbackPayload,
} from "../A2UIInteractiveProduct";
import A2UIQuestionnaire from "../A2UIQuestionnaire";
import ProcessingStatus from "../ProcessingStatus";
import "./A2UIRenderer.scss";

interface A2UIRendererProps {
  a2uiPayload: A2UIPayload | null;
  seenProducts?: CapturedData[];
  onSendHiddenMessage: (action: string, payload: unknown) => Promise<void>;
  isLoading?: boolean;
}

export default function A2UIRenderer({
  a2uiPayload,
  seenProducts = [],
  onSendHiddenMessage,
  isLoading,
}: A2UIRendererProps) {
  const latestSeenProducts = seenProducts.length
    ? [seenProducts[seenProducts.length - 1]]
    : [];

  if (!a2uiPayload) {
    // No payload but has accumulated products — show carousel in loading state
    if (latestSeenProducts.length > 0) {
      return (
        <A2UIInteractiveProduct
          seenProducts={latestSeenProducts}
          currentProduct={null}
          reasonsToReject={[]}
          onFeedback={(feedback: ProductFeedbackPayload) =>
            onSendHiddenMessage("PRODUCT_FEEDBACK", feedback)
          }
          isLoading={isLoading ?? false}
        />
      );
    }
    return null;
  }

  if (a2uiPayload.type === "a2ui_done") {
    return <div className="a2ui-renderer__done">✓ Đã hoàn tất phân tích</div>;
  }

  if (a2uiPayload.type === "a2ui_processing_status") {
    return (
      <ProcessingStatus
        text={a2uiPayload.data.statusText}
        percent={a2uiPayload.data.progressPercent}
      />
    );
  }

  if (a2uiPayload.type === "a2ui_questionnaire") {
    return (
      <A2UIQuestionnaire
        title={a2uiPayload.data.title}
        options={a2uiPayload.data.options}
        allowMultiple={a2uiPayload.data.allowMultiple}
        onSubmit={(selectedIds) =>
          onSendHiddenMessage("SUBMIT_SURVEY", selectedIds)
        }
        onSkip={() => onSendHiddenMessage("SKIP_SURVEY", {})}
      />
    );
  }

  if (a2uiPayload.type === "a2ui_interactive_product") {
    return (
      <A2UIInteractiveProduct
        seenProducts={latestSeenProducts}
        currentProduct={a2uiPayload.data.product}
        reasonsToReject={a2uiPayload.data.reasonsToReject}
        onFeedback={(feedback: ProductFeedbackPayload) =>
          onSendHiddenMessage("PRODUCT_FEEDBACK", feedback)
        }
        isLoading={isLoading ?? false}
      />
    );
  }

  return null;
}
