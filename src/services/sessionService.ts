import type {
  SessionResponse,
  GetSessionsParams,
  PageResponse,
} from "@/types";
import axiosInstance from "./axiosInstance";

export const fetchSessions = async (
  params: GetSessionsParams,
): Promise<PageResponse<SessionResponse[]>> => {
  // Bỏ try/catch đi, hãy để React Query tự bắt lỗi (catch) và xử lý state error!
  const response = await axiosInstance.get("/sessions", { params });
  return response.data;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await axiosInstance.delete(`/sessions/${sessionId}`);
}
