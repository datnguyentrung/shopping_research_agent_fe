import type { CapturedData } from "./product.types";

export type Role = "user" | "assistant" | "system";

export interface A2UISessionInitData{
  sessionId: string;
  title?: string;
  createdAt?: string;
}

// --- 1. DATA CHO FORM KHẢO SÁT (Questionnaire) ---
export interface A2UIQuestionnaireData {
  name: string;
  statusText?: string;
  allowMultiple: boolean;
  options: Array<{
    id: string;
    label: string;
  }>;
}

// --- 2. DATA CHO THẺ SẢN PHẨM TƯƠNG TÁC (Interactive Product) ---
export interface A2UIProductData {
  product: CapturedData; // Tái sử dụng CapturedData ông đã có
  reasonsToReject?: string[]; // Ví dụ: ["Giá", "Thương hiệu", "Tính năng"]
}

// --- 3. DATA CHO THANH TIẾN TRÌNH (Processing Status) ---
export interface A2UIProcessingData {
  statusText: string;
  progressPercent?: number;
}

// --- 4. DATA CHO SẢN PHẨM ĐƠN LẺ STREAM TỪ QUEUE ---
export interface A2UISingleProductData {
  category: string | null;
  product: CapturedData;
}

// --- 5. TẠO DISCIMINATED UNION CHO A2UI PAYLOAD ---
// Kỹ thuật này giúp TS hiểu: Nếu type là 'a2ui_questionnaire' thì data BẮT BUỘC phải là A2UIQuestionnaireData
export type A2UIPayload =
  | { type: "a2ui_session_init"; data: A2UISessionInitData }
  | { type: "a2ui_questionnaire"; data: A2UIQuestionnaireData }
  | { type: "a2ui_interactive_product"; data: A2UIProductData }
  | { type: "a2ui_processing_status"; data: A2UIProcessingData }
  | { type: "a2ui_single_product_received"; data: A2UISingleProductData }
  | { type: "a2ui_done"; data: Record<string, never> }; // Thông báo kết thúc chuỗi A2UI
