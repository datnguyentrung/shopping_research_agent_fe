interface Time {
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ConversationResponse extends Time {
  id: string;
  user_id: string;
  title: string;
}

export interface GetConversationsParams {
  user_id: string; // Bắt buộc truyền
  limit?: number; // Trống -> Backend tự map thành 10
  offset?: number; // Trống -> Backend tự map thành 0
  sort_by?: "updated_at" | "created_at"; // Trống -> Backend tự map thành "created_at"
  sort_dir?: "asc" | "desc"; // Trống -> Backend tự map thành "desc"
  search?: string; // Trống -> Backend tự map thành None
}
