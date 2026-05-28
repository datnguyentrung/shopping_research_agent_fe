export interface TryOnHistoryItem {
  id: string;
  productPath: string; // Chú ý: Backend chưa lưu product_name vào Database!
  imageUrl: string; // Chú ý: Backend đang trả về imageUrl
  error?: string; // Chú ý: Backend đang trả về createdAt
  status: "pending" | "completed" | "rejected";
  createdAt: string | Date; // Chú ý: Backend đang trả về createdAt
  updatedAt: string | Date; // Chú ý: Backend đang trả về createdAt
}
