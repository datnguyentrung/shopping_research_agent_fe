import type {
  A2UIPayload,
  A2UIProcessingData,
  A2UIProductData,
  A2UIQuestionnaireBatchData,
  A2UIQuestionnaireData,
  A2UISessionInitData,
} from "@/types/a2ui.types";
import type { CapturedData } from "@/types/product.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter(
    (item): item is string => typeof item === "string",
  );
  return normalized.length ? normalized : undefined;
};

const normalizeQuestionnaireData = (
  data: unknown,
): A2UIQuestionnaireData | null => {
  if (
    !isRecord(data) ||
    (typeof data.title !== "string" && typeof data.name !== "string") ||
    !Array.isArray(data.options)
  ) {
    return null;
  }

  // FIX: Chấp nhận option là chuỗi string hoặc object
  const options = data.options
    .map((item) => {
      if (typeof item === "string") {
        return { id: item, label: item }; // Fallback nếu BE trả string array
      }
      if (isRecord(item)) {
        const id =
          typeof item.id === "string" || typeof item.id === "number"
            ? String(item.id)
            : null;
        const labelRaw = item.label ?? item.text ?? item.name;
        const label = typeof labelRaw === "string" ? labelRaw : null;
        if (id && label) return { id, label };
      }
      return null;
    })
    .filter((item): item is { id: string; label: string } => item !== null);

  if (!options.length) {
    return null;
  }

  const allowMultipleRaw = data.allowMultiple ?? data.allow_multiple;

  return {
    name: (data.name as string) ?? (data.title as string),
    statusText:
      typeof data.statusText === "string" ? data.statusText : undefined,
    allowMultiple: allowMultipleRaw === true,
    options,
  };
};

const normalizeProductData = (data: unknown): A2UIProductData | null => {
  if (!isRecord(data) || !isRecord(data.product)) {
    return null;
  }

  const { product } = data;

  if (
    typeof product.platform !== "string" ||
    (typeof product.productId !== "string" &&
      typeof product.productId !== "number") ||
    typeof product.name !== "string" ||
    typeof product.priceCurrent !== "number" ||
    typeof product.currency !== "string" ||
    typeof product.mainImage !== "string" ||
    typeof product.ratingStar !== "number" ||
    typeof product.ratingCount !== "number" ||
    !isRecord(product.shop) ||
    typeof product.shop.shopId !== "string" ||
    typeof product.shop.shopName !== "string"
  ) {
    return null;
  }

  const reasonsRaw = data.reasonsToReject ?? data.reasons_to_reject;

  return {
    product: product as unknown as CapturedData,
    reasonsToReject: toStringArray(reasonsRaw),
  };
};

const normalizeQuestionnaireBatchData = (
  data: unknown,
): A2UIQuestionnaireBatchData | null => {
  if (!isRecord(data) || !Array.isArray(data.questions)) {
    return null;
  }

  const questions = data.questions
    .map((q: unknown) => {
      if (!isRecord(q)) return null;
      const id = q.id ?? q.attribute_id ?? q.name;
      const name = typeof q.name === "string" ? q.name : null;
      if (id == null || name === null) return null;

      const rawOptions = q.options ?? [];
      const options: string[] = Array.isArray(rawOptions)
        ? rawOptions.map((opt) => String(opt))
        : [];

      return { id, name, options };
    })
    .filter(Boolean) as A2UIQuestionnaireBatchData["questions"];

  return questions.length > 0 ? { questions } : null;
};

const normalizeProcessingData = (data: unknown): A2UIProcessingData | null => {
  if (!isRecord(data)) {
    return null;
  }

  const statusTextRaw = data.statusText ?? data.status_text;
  if (typeof statusTextRaw !== "string") {
    return null;
  }

  const progressRaw = data.progressPercent ?? data.progress_percent;

  return {
    statusText: statusTextRaw,
    progressPercent: typeof progressRaw === "number" ? progressRaw : undefined,
  };
};

export const normalizeA2UIPayload = (payload: unknown): A2UIPayload | null => {
  if (!isRecord(payload) || typeof payload.type !== "string") {
    return null;
  }

  switch (payload.type) {
    case "a2ui_questionnaire": {
      const data = normalizeQuestionnaireData(payload.data);
      return data ? { type: payload.type, data } : null;
    }

    case "a2ui_questionnaire_batch": {
      const data = normalizeQuestionnaireBatchData(payload.data);
      return data ? { type: payload.type, data } : null;
    }

    case "a2ui_interactive_product": {
      const data = normalizeProductData(payload.data);
      return data ? { type: payload.type, data } : null;
    }

    case "a2ui_processing_status": {
      const data = normalizeProcessingData(payload.data);
      return data ? { type: payload.type, data } : null;
    }

    case "a2ui_session_init": {
      return {type:payload.type, data: payload.data as A2UISessionInitData}
    }

    case "a2ui_done": {
      return { type: "a2ui_done", data: {} };
    }

    default:
      return null;
  }
};
