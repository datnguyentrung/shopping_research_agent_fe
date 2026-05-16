import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import {
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useNavigate, useParams } from "react-router-dom";
import type { ConversationResponse } from "../../types/conversation.types";
import { formatDateDMY, formatTimeHM } from "../../utils/format";
import { getGuestChats } from "../../utils/guestChatStorage";
import "./Sidebar.scss";

const MIN_WIDTH = 268;
const COLLAPSED_WIDTH = 64;

function getMaxWidth() {
  return Math.floor(window.innerWidth / 4);
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [customWidth, setCustomWidth] = useState<number>(MIN_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const { user, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const { sessionId: activeChat } = useParams<{ sessionId: string }>();

  // --- Guest: đọc chat từ localStorage + lắng nghe custom event ---
  const [guestChats, setGuestChats] = useState<ConversationResponse[]>(() =>
    getGuestChats(),
  );

  const handleGuestChatUpdate = useCallback(() => {
    setGuestChats(getGuestChats());
  }, []);

  useEffect(() => {
    window.addEventListener("guest_chat_updated", handleGuestChatUpdate);
    return () =>
      window.removeEventListener("guest_chat_updated", handleGuestChatUpdate);
  }, [handleGuestChatUpdate]);

  // --- Auth: infinite query phân trang ---
  const {
    data: infiniteData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useConversations({
    user_id: user?.id ?? "",
    limit: 10,
  });

  const isConversationListLoading = Boolean(user && isLoading);

  // Sentinel cho infinite scroll
  const { ref: sentinelRef, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // --- Gộp dữ liệu theo trạng thái xác thực ---
  const chatHistory = useMemo<ConversationResponse[]>(() => {
    if (user) {
      return infiniteData?.pages.flatMap((page) => page.items).flat() ?? [];
    }
    return guestChats;
  }, [user, infiniteData, guestChats]);

  const grouped = chatHistory.reduce(
    (acc, chat) => {
      const date = formatDateDMY(chat.createdAt);
      if (!acc[date]) acc[date] = [];
      acc[date].push(chat);
      return acc;
    },
    {} as Record<string, typeof chatHistory>,
  );

  // Lấy chữ cái đầu của tên để hiển thị khi không có avatar
  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleNewChat = () => navigate("/");

  // --- Drag-to-resize logic ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isCollapsed) return;
      e.preventDefault();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isCollapsed],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const maxWidth = getMaxWidth();
      const sidebarRect = (
        e.currentTarget as HTMLElement
      ).getBoundingClientRect();
      const newWidth = Math.round(e.clientX - sidebarRect.left);
      setCustomWidth(Math.max(MIN_WIDTH, Math.min(newWidth, maxWidth)));
    },
    [isDragging],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const sidebarWidth = isCollapsed ? COLLAPSED_WIDTH : customWidth;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={
        isDragging
          ? { type: "tween", duration: 0 }
          : { duration: 0.28, ease: [0.4, 0, 0.2, 1] }
      }
      className="chat-sidebar"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={isDragging ? { transition: "none" } : undefined}
    >
      {/* Header */}
      <div className="chat-sidebar__header">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="chat-sidebar__toggle"
          title="Toggle sidebar"
        >
          <Menu className="chat-sidebar__toggle-icon" />
        </button>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="chat-sidebar__new-chat"
              onClick={handleNewChat}
            >
              <Plus className="chat-sidebar__new-chat-icon" />
              <span>New Chat</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Search */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="chat-sidebar__search-wrap"
          >
            <div className="chat-sidebar__search-box">
              <Search className="chat-sidebar__search-icon" />
              <input
                type="text"
                placeholder="Search chats..."
                className="chat-sidebar__search-input"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat List */}
      <div className="chat-sidebar__list">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="chat-sidebar__list-expanded"
            >
              {isConversationListLoading ? (
                <div className="chat-sidebar__loading-state">
                  <LoaderCircle className="chat-sidebar__loading-spinner" />
                  <span className="chat-sidebar__loading-text">
                    Đang tải cuộc trò chuyện
                  </span>
                </div>
              ) : (
                Object.entries(grouped).map(([category, chats]) => (
                  <div key={category} className="chat-sidebar__section">
                    <div className="chat-sidebar__section-title">
                      {category}
                    </div>
                    <div className="chat-sidebar__section-items">
                      {chats.map((chat: ConversationResponse) => (
                        <button
                          key={chat.id}
                          onClick={() => navigate(`/app/${chat.id}`)}
                          className={`chat-sidebar__chat-item ${
                            activeChat === chat.id
                              ? "chat-sidebar__chat-item--active"
                              : "chat-sidebar__chat-item--idle"
                          }`}
                        >
                          <MessageSquare
                            className={`chat-sidebar__chat-icon ${
                              activeChat === chat.id
                                ? "chat-sidebar__chat-icon--active"
                                : "chat-sidebar__chat-icon--idle"
                            }`}
                          />
                          <div className="chat-sidebar__chat-meta">
                            <div
                              className={`chat-sidebar__chat-title ${
                                activeChat === chat.id
                                  ? "chat-sidebar__chat-title--active"
                                  : "chat-sidebar__chat-title--idle"
                              }`}
                            >
                              {chat.title}
                            </div>
                            <div className="chat-sidebar__chat-time">
                              {formatTimeHM(chat.createdAt)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* Invisible anchor cho infinite scroll (authenticated) */}
              {user && <div ref={sentinelRef} />}
              {isFetchingNextPage && (
                <div className="chat-sidebar__loading">Loading more...</div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="chat-sidebar__list-collapsed"
            >
              <button
                className="chat-sidebar__collapsed-action"
                onClick={handleNewChat}
              >
                <Plus className="chat-sidebar__collapsed-action-icon" />
              </button>
              {isConversationListLoading ? (
                <div className="chat-sidebar__collapsed-loading">
                  <LoaderCircle className="chat-sidebar__loading-spinner" />
                </div>
              ) : (
                chatHistory.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => navigate(`/app/${chat.id}`)}
                    className={`chat-sidebar__collapsed-item ${
                      activeChat === chat.id
                        ? "chat-sidebar__collapsed-item--active"
                        : "chat-sidebar__collapsed-item--idle"
                    }`}
                  >
                    <MessageSquare className="chat-sidebar__collapsed-item-icon" />
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Profile / Auth Section */}
      <div className="chat-sidebar__user-wrap">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="user-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="chat-sidebar__user-card"
            >
              {user ? (
                <>
                  {/* Đã đăng nhập: hiển thị avatar, tên và nút đăng xuất */}
                  <Avatar className="chat-sidebar__avatar">
                    <AvatarImage
                      src={user.user_metadata?.avatar_url}
                      alt={user.user_metadata?.full_name}
                    />
                    <AvatarFallback className="chat-sidebar__avatar-fallback">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="chat-sidebar__user-meta">
                    <div className="chat-sidebar__user-name">
                      {user.user_metadata?.full_name ?? "User"}
                    </div>
                    <div className="chat-sidebar__user-email">
                      {user.user_metadata?.email ?? ""}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="chat-sidebar__user-logout"
                    title="Đăng xuất"
                  >
                    <LogOut className="chat-sidebar__user-logout-icon" />
                  </button>
                </>
              ) : (
                /* Chưa đăng nhập: hiển thị nút đăng nhập Google */
                <Button
                  variant="outline"
                  className="chat-sidebar__login-btn"
                  onClick={loginWithGoogle}
                >
                  <svg
                    className="chat-sidebar__google-icon"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.button
              key="user-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="chat-sidebar__user-collapsed"
              title={
                user ? (user.user_metadata?.full_name ?? "User") : "Đăng nhập"
              }
              onClick={!user ? loginWithGoogle : undefined}
            >
              {user ? (
                <Avatar className="chat-sidebar__avatar">
                  <AvatarImage
                    src={user.user_metadata?.avatar_url}
                    alt={user.user_metadata?.full_name}
                  />
                  <AvatarFallback className="chat-sidebar__avatar-fallback">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <svg
                  className="chat-sidebar__google-icon-sm"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Resize handle — only visible when expanded */}
      {!isCollapsed && (
        <div
          className="chat-sidebar__resize-handle"
          onPointerDown={handlePointerDown}
        />
      )}
    </motion.aside>
  );
}
