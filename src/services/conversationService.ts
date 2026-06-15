import type {
  ConversationResponse,
  GetConversationsParams,
  PageResponse,
} from "@/types";
import axiosInstance from "./axiosInstance";

export const fetchConversations = async (
  params: GetConversationsParams,
): Promise<PageResponse<ConversationResponse[]>> => {
  // Bỏ try/catch đi, hãy để React Query tự bắt lỗi (catch) và xử lý state error!
  const response = await axiosInstance.get("/conversations", { params });
  return response.data;
};

export const deleteConversation = async (conversationId: string): Promise<void> => {
  await axiosInstance.delete(`/conversations/${conversationId}`);
}
