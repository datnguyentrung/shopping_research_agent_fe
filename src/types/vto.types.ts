export interface TryOnHistoryItem {
  id: string;
  productPath: string; // Chú ý: Backend chưa lưu product_name vào Database!
  resultBase64: string; // Chú ý: Backend đang trả về resultBase64
  error?: string; // Chú ý: Backend đang trả về createdAt
  status: "pending" | "completed" | "rejected";
  createdAt: string | Date; // Chú ý: Backend đang trả về createdAt
  updatedAt: string | Date; // Chú ý: Backend đang trả về createdAt
}
