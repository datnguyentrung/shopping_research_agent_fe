// hooks/useConversations.ts
import { deleteConversation, fetchConversations } from "@services/conversationService";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GetConversationsParams } from '@/types';

export const useConversations = (params: GetConversationsParams) => {
  return useInfiniteQuery({
    queryKey: ["conversations", params.user_id],

    queryFn: ({ pageParam }) =>
      fetchConversations({
        ...params,
        offset: pageParam as number,
      }),

    initialPageParam: 0,

    getNextPageParam: (lastPage) =>
      lastPage.has_next ? lastPage.offset + lastPage.limit : undefined,

    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,

    enabled: !!params.user_id,
  });
};

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};
