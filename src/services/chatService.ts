import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { ChatRequest, ChatStreamChunk } from "../types/chat.types";
import { apiConfig } from "./api";
import axiosInstance, { getAuthHeaders } from "./axiosInstance"; // Dùng chung ở đây

export interface StreamCallbacks {
  onChunk: (chunk: ChatStreamChunk) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

// 🌟 GIỮ LẠI fetchEventSource cho luồng chat streaming
export const streamChat = async (
  payload: ChatRequest,
  callbacks: StreamCallbacks,
): Promise<void> => {
  const ctrl = new AbortController();
  const authHeaders = await getAuthHeaders(); // Lấy token đồng bộ từ cấu hình chung

  await fetchEventSource(`${apiConfig.baseUrl}/chat`, {
    method: "POST",
    openWhenHidden: true,
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: ctrl.signal,
    onmessage(event) {
      if (!event.data) return;
      if (event.data === "[DONE]") {
        callbacks.onDone();
        return;
      }
      try {
        const data = JSON.parse(event.data) as Partial<ChatStreamChunk>;
        if (!data.type) {
          callbacks.onChunk({ type: "message", content: event.data });
          return;
        }
        if (data.type === "done") {
          callbacks.onDone();
          return;
        }
        if (data.type === "error") {
          callbacks.onError(data.error ?? "Unknown SSE error");
          return;
        }
        callbacks.onChunk(data as ChatStreamChunk);
      } catch {
        callbacks.onChunk({ type: "message", content: event.data });
      }
    },
    onclose() {
      callbacks.onDone();
    },
    onerror(err) {
      callbacks.onError(
        err instanceof Error ? err.message : "SSE connection error",
      );
      throw err;
    },
  });
};

// 🌟 CHUYỂN lịch sử chat sang dùng axiosInstance
export const fetchChatHistory = async (sessionId: string) => {
  // Không cần try/catch thủ công nữa nếu interceptor của bạn đã log lỗi global tốt
  const response = await axiosInstance.get(`/chat/history/${sessionId}`);
  return response.data;
};
