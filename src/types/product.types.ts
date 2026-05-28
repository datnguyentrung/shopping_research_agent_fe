// Định nghĩa kiểu dữ liệu cho sản phẩm và các thông tin liên quan
export interface TierVariation {
  name: string;
  options: string[];
}

// Thông tin về shop bán sản phẩm
export interface ShopInfo {
  shopId: string;
  shopName: string;
  shopLocation?: string | null;
}

// Dữ liệu sản phẩm được trích xuất từ các nền tảng thương mại điện tử
export interface CapturedData {
  platform?: string;
  productId?: string | number;
  productUrl?: string;
  name?: string;

  // Giá hiện tại và giá gốc (nếu có) để hiển thị thông tin giảm giá
  priceCurrent?: number;
  priceOriginal?: number;
  currency?: string;

  // URL hình ảnh chính của sản phẩm
  mainImage?: string;

  // Đánh giá trung bình và số lượng đánh giá để hiển thị thông tin đánh giá
  ratingStar?: number;
  ratingCount?: number;
  soldCount?: number;

  // Thông tin về shop bán sản phẩm
  shop?: ShopInfo;

  // Các biến thể của sản phẩm (nếu có), ví dụ: màu sắc, kích thước, v.v.
  tierVariations?: TierVariation[];
}

// Danh sách sản phẩm được trích xuất, có thể chứa nhiều sản phẩm từ các nền tảng khác nhau
export interface ProductList {
  products: CapturedData[];
}
