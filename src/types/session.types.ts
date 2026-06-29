interface Time {
  createTime: string | Date;
  updateTime: string | Date;
}

export interface SessionResponse extends Time {
  id: string;
  userId: string;
  title: string;
}

export interface GetSessionsParams {
  limit?: number; // Trống -> Backend tự map thành 10
  offset?: number; // Trống -> Backend tự map thành 0
  sort_dir?: "asc" | "desc"; // Trống -> Backend tự map thành "desc"
  search?: string; // Trống -> Backend tự map thành None
}
