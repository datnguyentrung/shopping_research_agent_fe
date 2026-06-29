// hooks/useSessions.ts
import { deleteSession, fetchSessions } from "@/services/sessionService";
import type { GetSessionsParams } from "@/types";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

export const useSessions = (params: Omit<GetSessionsParams, "userId">) => {
  return useInfiniteQuery({
    // Đưa toàn bộ params còn lại (limit, search, sort...) vào queryKey
    // để cache chuẩn xác và tự refetch khi các giá trị này thay đổi
    queryKey: ["sessions", params],

    queryFn: ({ pageParam }) =>
      fetchSessions({
        ...params,
        offset: pageParam as number,
      }),

    initialPageParam: 0,

    getNextPageParam: (lastPage) =>
      lastPage.has_next ? lastPage.offset + lastPage.limit : undefined,

    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,

    // Đã xóa enabled: !!params.userId
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
};
