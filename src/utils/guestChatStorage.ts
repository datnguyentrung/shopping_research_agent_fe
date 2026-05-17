// import type { ConversationResponse } from "@/types";

// const GUEST_CHAT_KEY = "guest_chat_histories";
// const GUEST_CHAT_EVENT = "guest_chat_updated";

// export const saveGuestChat = (chat: ConversationResponse): void => {
//   const existing = getGuestChats();
//   // Tránh trùng lặp nếu cùng sessionId
//   const filtered = existing.filter((c) => c.id !== chat.id);
//   filtered.unshift(chat);
//   localStorage.setItem(GUEST_CHAT_KEY, JSON.stringify(filtered));
//   window.dispatchEvent(new Event(GUEST_CHAT_EVENT));
// };

// export const getGuestChats = (): ConversationResponse[] => {
//   try {
//     const raw = localStorage.getItem(GUEST_CHAT_KEY);
//     return raw ? JSON.parse(raw) : [];
//   } catch {
//     return [];
//   }
// };
