import type { A2UIPayload } from "@/types/a2ui.types";
import type { CapturedData } from "@/types/product.types";
import A2UIInteractiveProduct, {
  type ProductFeedbackPayload,
} from "../A2UIInteractiveProduct";
import A2UIQuestionnaire from "../A2UIQuestionnaire";
import A2UIQuestionnaireBatch from "../A2UIQuestionnaireBatch/A2UIQuestionnaireBatch";
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

  if (a2uiPayload.type === "a2ui_questionnaire_batch") {
    return (
      <A2UIQuestionnaireBatch
        questions={a2uiPayload.data.questions}
        onSubmitAll={(answers) =>
          onSendHiddenMessage("SUBMIT_ALL_SURVEY", answers)
        }
      />
    );
  }

  if (a2uiPayload.type === "a2ui_questionnaire") {
    const rawOptions = a2uiPayload.data.options || [];
    const normalizedOptions = rawOptions.map((opt: string | { id: string; label: string }) => {
      if (typeof opt === "string") {
        return { id: opt, label: opt };
      }
      return opt;
    });

    return (
      <A2UIQuestionnaire
        title={a2uiPayload.data.name}
        options={normalizedOptions}
        allowMultiple={!!a2uiPayload.data.allowMultiple}
        onSubmit={(selectedIds) =>
          onSendHiddenMessage("SUBMIT_CATEGORY", selectedIds)
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
