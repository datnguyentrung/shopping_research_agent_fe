export interface TryOnHistoryItem {
  id: string;
  productPath: string; // Chú ý: Backend chưa lưu product_name vào Database!
  productName: string; // Chú ý: Backend chưa lưu product_name vào Database!
  productImageUrl: string; // Chú ý: Backend đang trả về product_image_url
  productPrice: number; // Chú ý: Backend đang trả về product_price
  imageUrl: string; // Chú ý: Backend đang trả về imageUrl
  error?: string; // Chú ý: Backend đang trả về createdAt
  status: "pending" | "completed" | "rejected";
  createdAt: string | Date; // Chú ý: Backend đang trả về createdAt
  updatedAt: string | Date; // Chú ý: Backend đang trả về createdAt
  description?: string; // Mô tả thêm về lần thử đồ, có thể là lỗi nếu có error hoặc thông tin bổ sung
}
