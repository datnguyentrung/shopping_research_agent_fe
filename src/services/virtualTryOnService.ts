import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { ChatStreamChunk } from "../types";
import type { TryOnHistoryItem } from "../types/vto.types";
import { apiConfig } from "./api";
import axiosInstance, { getAuthHeaders } from "./axiosInstance";

// TRONG virtualTryOnService.ts
export const fireTryOnRequest = async (
  personFile: File,
  productImageUrl: string,
  productUrl: string,
  productName: string,
  productPrice?: number,
) => {
  console.log("Đang gửi yêu cầu try-on với dữ liệu:", {
    personFile,
    productImageUrl,
    productUrl,
    productName,
    productPrice,
  });

  const form = new FormData();
  form.append("person_image_file", personFile); // Đảm bảo tên biến ở đây KHỚP VỚI FASTAPI nha
  form.append("product_file_path", productImageUrl);
  form.append("product_url", productUrl);
  form.append("product_name", productName);
  if (productPrice !== undefined) {
    form.append("product_price", productPrice.toString());
  }

  // Không cần truyền thêm header gì cả, Interceptor sẽ nhận ra FormData và xử lý
  const response = await axiosInstance.post("/fire", form);
  return response.data;
};

export const fetchTryOnHistory = async (): Promise<TryOnHistoryItem[]> => {
  const response = await axiosInstance.get("/vto-history");
  return response.data;
};

// Định nghĩa kiểu dữ liệu chunk nếu cần (tương tự như ChatStreamChunk)
export interface RecommendStreamCallbacks {
  onChunk: (chunk: ChatStreamChunk) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export const streamRecommend = async (
  formData: FormData,
  callbacks: RecommendStreamCallbacks,
): Promise<void> => {
  const ctrl = new AbortController();
  const authHeaders = await getAuthHeaders();

  await fetchEventSource(`${apiConfig.baseUrl}/recommend`, {
    method: "POST",
    headers: {
      ...authHeaders,
      // Lưu ý: Không để "Content-Type": "application/json" khi dùng FormData
      // fetchEventSource sẽ tự động đặt multipart/form-data khi bạn truyền body là FormData
    },
    body: formData,
    signal: ctrl.signal,
    onmessage(event) {
      if (!event.data || event.data === "[DONE]") {
        callbacks.onDone();
        return;
      }
      try {
        const data = JSON.parse(event.data);
        // Xử lý các loại chunk mà BE gửi về
        callbacks.onChunk(data);
      } catch (err) {
        console.error("Lỗi parse SSE:", err);
      }
    },
    onerror(err) {
      callbacks.onError(err instanceof Error ? err.message : "SSE error");
      throw err; // Dừng stream nếu có lỗi nghiêm trọng
    },
  });
};
