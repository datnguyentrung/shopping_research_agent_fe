export interface PageResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_next: boolean;
}
