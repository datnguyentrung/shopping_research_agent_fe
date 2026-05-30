import type { CapturedData } from "./product.types";

export type ProductCategory = "Upper-body" | "Lower-body" | "Full-body";

export interface PersonalizedRecommendationResponse {
  productCategory: ProductCategory;
  products: CapturedData[]; // Sử dụng lại CapturedData ông đã có, đảm bảo tính nhất quán với phần còn lại của codebase
}

export interface PersonalizedRecommendationResult {
  reasonRecommend: string; // Lý do tại sao sản phẩm này được đề xuất, có thể là dựa trên sở thích của người dùng, lịch sử mua hàng, hoặc xu hướng thời trang hiện tại
  personalizedRecommendationResponses: PersonalizedRecommendationResponse[];
}
