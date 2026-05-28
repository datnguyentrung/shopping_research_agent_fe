import type { CapturedData } from "./product.types";

export type ProductCategory = "Upper-body" | "Lower-body" | "Full-body";

export interface PersonalizedRecommendationResponse {
  productCategory: ProductCategory;
  products: CapturedData[]; // Sử dụng lại CapturedData ông đã có, đảm bảo tính nhất quán với phần còn lại của codebase
}
