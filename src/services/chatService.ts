import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { ChatRequest, ChatStreamChunk } from "../types/chat.types";
import { apiConfig } from "./api";
import { supabase } from "./supabase";

// Lấy headers mặc định, kèm JWT nếu người dùng đã đăng nhập
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
};

export interface StreamCallbacks {
  onChunk: (chunk: ChatStreamChunk) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export const streamChat = async (
  payload: ChatRequest,
  callbacks: StreamCallbacks,
): Promise<void> => {
  const ctrl = new AbortController();
  const headers = await getAuthHeaders();
  await fetchEventSource(`${apiConfig.baseUrl}/chat`, {
    method: "POST",
    // 👇 THÊM DÒNG NÀY ĐỂ TẮT TÍNH NĂNG TỰ NGẮT KHI CHUYỂN TAB
    openWhenHidden: true,
    headers,
    body: JSON.stringify(payload),
    signal: ctrl.signal,
    onmessage(event) {
      if (!event.data) {
        return;
      }

      if (event.data === "[DONE]") {
        callbacks.onDone();
        return;
      }

      try {
        const data = JSON.parse(event.data) as Partial<ChatStreamChunk>;

        console.log("Received SSE chunk:", data);

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

export const fetchChatHistory = async (sessionId: string) => {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${apiConfig.baseUrl}/chat/history/${sessionId}`,
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error("Không thể tải lịch sử trò chuyện");
  }

  return response.json();
};
