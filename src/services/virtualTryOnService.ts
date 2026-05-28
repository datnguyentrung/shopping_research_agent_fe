import type { PersonalizedRecommendationResponse } from "../types/recommendation.types";
import type { TryOnHistoryItem } from "../types/vto.types";
import axiosInstance from "./axiosInstance";

// TRONG virtualTryOnService.ts
export const fireTryOnRequest = async (
  personFile: File,
  productImageUrl: string,
  productUrl: string,
  productName: string,
) => {
  const form = new FormData();
  form.append("person_image_file", personFile); // Đảm bảo tên biến ở đây KHỚP VỚI FASTAPI nha
  form.append("product_file_path", productImageUrl);
  form.append("product_url", productUrl);
  form.append("product_name", productName);

  // Không cần truyền thêm header gì cả, Interceptor sẽ nhận ra FormData và xử lý
  const response = await axiosInstance.post("/fire", form);
  return response.data;
};

export const fetchTryOnHistory = async (): Promise<TryOnHistoryItem[]> => {
  const response = await axiosInstance.get("/vto-history");
  return response.data;
};

export const recommendPersonalizedProducts = async (
  personImage: string,
  productImageUrl?: string,
  productName?: string,
): Promise<PersonalizedRecommendationResponse[]> => {
  const form = new FormData();
  form.append("person_image_url", personImage);
  if (productImageUrl) {
    form.append("product_image_url", productImageUrl);
  }
  if (productName) {
    form.append("product_name", productName);
  }

  const response = await axiosInstance.post("/recommend", form);
  return response.data;
};
