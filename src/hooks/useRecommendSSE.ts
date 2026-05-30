import { useCallback, useRef, useState } from "react";
import type { CapturedData } from "../types/product.types";
import type { PersonalizedRecommendationResult } from "../types/recommendation.types";

interface RecommendParams {
  personImageUrl: string;
  productImageUrl?: string;
  productName?: string;
}

interface ProcessingStatus {
  statusText: string;
  progressPercent: number;
}

interface StreamingProduct {
  category: string | null;
  product: CapturedData;
}

interface UseRecommendSSEReturn {
  isLoading: boolean;
  progress: ProcessingStatus | null;
  result: PersonalizedRecommendationResult | null;
  streamingProducts: StreamingProduct[];
  error: string | null;
  startRecommend: (
    params: RecommendParams,
  ) => Promise<PersonalizedRecommendationResult | null>;
  reset: () => void;
}

export const useRecommendSSE = (): UseRecommendSSEReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProcessingStatus | null>(null);
  const [result, setResult] = useState<PersonalizedRecommendationResult | null>(
    null,
  );
  const [streamingProducts, setStreamingProducts] = useState<
    StreamingProduct[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setProgress(null);
    setResult(null);
    setStreamingProducts([]);
    setError(null);
  }, []);

  // Hàm xử lý từng dòng dữ liệu SSE tách biệt để tái sử dụng
  const processLine = useCallback(
    (
      line: string,
      currentResult: PersonalizedRecommendationResult | null,
    ): PersonalizedRecommendationResult | null => {
      if (!line.startsWith("data:")) return currentResult;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") return currentResult;

      try {
        const chunk = JSON.parse(raw);

        if (chunk.type === "error") {
          setError(chunk.error ?? "Có lỗi xảy ra.");
          return null;
        }

        if (chunk.type === "a2ui") {
          const a2ui = chunk.a2ui as { type: string; data: unknown };

          if (a2ui.type === "a2ui_processing_status") {
            const data = a2ui.data as ProcessingStatus;
            setProgress({
              statusText: data.statusText,
              progressPercent: data.progressPercent,
            });
          }

          if (a2ui.type === "a2ui_single_product_received") {
            const data = a2ui.data as {
              category: string | null;
              product: CapturedData;
            };
            setStreamingProducts((prev) => [
              ...prev,
              {
                category: data.category,
                product: data.product,
              },
            ]);
          }

          if (a2ui.type === "a2ui_outfit_recommendation") {
            const data = a2ui.data as PersonalizedRecommendationResult;
            setResult(data);
            return data; // Cập nhật finalResult cục bộ
          }
        }
      } catch {
        // Bỏ qua dòng lỗi định dạng JSON
      }
      return currentResult;
    },
    [],
  );

  const startRecommend = useCallback(
    async (
      params: RecommendParams,
    ): Promise<PersonalizedRecommendationResult | null> => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      setProgress(null);
      setResult(null);
      setStreamingProducts([]);
      setError(null);

      const formData = new FormData();
      formData.append("person_image_url", params.personImageUrl);
      if (params.productImageUrl)
        formData.append("product_image_url", params.productImageUrl);
      if (params.productName)
        formData.append("product_name", params.productName);

      let finalResult: PersonalizedRecommendationResult | null = null;

      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
        const token = localStorage.getItem("access_token");

        const response = await fetch(`${apiBase}/recommend`, {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            finalResult = processLine(line, finalResult);
          }
        }

        // 🔥 SỬA LỖI LỌT BUFFER: Xử lý nốt phần dư cuối cùng nếu có
        if (buffer.trim()) {
          finalResult = processLine(buffer, finalResult);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError")
          return null;
        setError(
          err instanceof Error ? err.message : "Không thể kết nối đến máy chủ.",
        );
      } finally {
        setIsLoading(false);
      }

      return finalResult;
    },
    [processLine],
  );

  return {
    isLoading,
    progress,
    result,
    streamingProducts,
    error,
    startRecommend,
    reset,
  };
};
