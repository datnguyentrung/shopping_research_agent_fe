import type { CapturedData } from './product.types';

export type ProductCategory = "UPPER_BODY" | "LOWER_BODY" | "DRESS";

export interface PersonalizedRecommendationResponse {
  product_category: ProductCategory;
  products: CapturedData[]; // Sử dụng lại CapturedData ông đã có, đảm bảo tính nhất quán với phần còn lại của codebase
}
