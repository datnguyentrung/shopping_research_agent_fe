import TryOnModal from "@/components/TryOnModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteSession, useSessions } from "@/hooks/useSessions";
import {
  EllipsisVertical,
  Gift,
  LoaderCircle,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Shirt,
  Sparkles,
  SquarePen,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionResponse } from "../../types/session.types";
import { formatTimeHM } from "../../utils/format";
// import { getGuestChats } from "../../utils/guestChatStorage";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "boneyard-js/react";
import ConfirmModal from "../ConfirmModal";
import { MiniActionPopover } from "../ui/mini-action-popover";
import { showComingSoonActionToast } from "../ui/mini-action-popover.toast";
import "./Sidebar.scss";

const MIN_WIDTH = 268;
const COLLAPSED_WIDTH = 64;

function getMaxWidth() {
  return Math.floor(window.innerWidth / 4);
}

type SidebarProps = {
  user: ReturnType<typeof useAuth>["user"];
  isLoginLoading: boolean;
  loginWithGoogle: ReturnType<typeof useAuth>["loginWithGoogle"];
  logout: ReturnType<typeof useAuth>["logout"];
};

export default function Sidebar({
  user,
  isLoginLoading,
  loginWithGoogle,
  logout,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [customWidth, setCustomWidth] = useState<number>(MIN_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [isTryOnOpen, setIsTryOnOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const deleteMutation = useDeleteSession();
  const queryClient = useQueryClient();

  const openLogoutModal = useCallback(() => setIsLogoutModalOpen(true), []);

  // Đặt cursor: wait trên body khi đang đăng nhập
  useEffect(() => {
    if (isLoginLoading) {
      document.body.classList.add("is-login-loading");
    } else {
      document.body.classList.remove("is-login-loading");
    }
    return () => document.body.classList.remove("is-login-loading");
  }, [isLoginLoading]);

  const cancelLogout = useCallback(() => {
    setIsLogoutPending(false);
    setIsLogoutModalOpen(false);
  }, []);

  const confirmLogout = useCallback(async () => {
    if (isLogoutPending) return;
    setIsLogoutPending(true);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 900));
      logout();
      queryClient.clear();
      setIsLogoutModalOpen(false);
    } finally {
      setIsLogoutPending(false);
    }
  }, [isLogoutPending, logout, queryClient]);

  const navigate = useNavigate();
  const { sessionId: activeChat } = useParams<{ sessionId: string }>();

  // Guest: đọc chat từ localStorage + lắng nghe custom event
  // const [guestChats, setGuestChats] = useState<ConversationResponse[]>(() =>
  //   getGuestChats(),
  // );

  // const handleGuestChatUpdate = useCallback(() => {
  //   setGuestChats(getGuestChats());
  // }, []);

  // useEffect(() => {
  //   window.addEventListener("guest_chat_updated", handleGuestChatUpdate);
  //   return () =>
  //     window.removeEventListener("guest_chat_updated", handleGuestChatUpdate);
  // }, [handleGuestChatUpdate]);

  // Auth: infinite query phân trang
  const {
    data: infiniteData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useSessions({
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

  // Gộp dữ liệu theo trạng thái xác thực
  const chatHistory = useMemo<SessionResponse[]>(() => {
    if (user) {
      return infiniteData?.pages.flatMap((page) => page.items).flat() ?? [];
    }
    // return guestChats;
    return [];
  }, [user, infiniteData /*guestChats*/]);

  // Lấy chữ cái đầu của tên để hiển thị khi không có avatar
  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleNewChat = () => {
    window.location.href = "/";
  };

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleteMutation.isPending) return;
    await deleteMutation.mutateAsync(deleteTarget);
    // Nếu đang xem đoạn chat bị xóa → về trang chat mới
    if (activeChat === deleteTarget) {
      navigate("/");
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation, activeChat, navigate]);

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
    <>
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
        {/* ── Header ── */}
        <div
          className={`chat-sidebar__header ${isCollapsed ? "is-collapsed" : ""}`}
        >
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="chat-sidebar__logo"
              title="Mở rộng sidebar"
            >
              <Sparkles className="chat-sidebar__logo-icon" />
              <PanelLeftOpen className="chat-sidebar__expand-icon" />
            </button>
          ) : (
            <>
              <button
                onClick={handleNewChat}
                className="chat-sidebar__logo"
                title="Chat mới"
              >
                <Sparkles className="chat-sidebar__logo-icon" />
              </button>
              <button
                onClick={() => setIsCollapsed(true)}
                className="chat-sidebar__toggle"
                title="Thu gọn sidebar"
              >
                <PanelLeftClose className="chat-sidebar__toggle-icon" />
              </button>
            </>
          )}
        </div>

        {/* ── Main Functions (expanded) ── */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="chat-sidebar__functions"
            >
              <nav className="chat-sidebar__menu">
                <button
                  className="chat-sidebar__menu-item chat-sidebar__menu-item--new-chat"
                  onClick={handleNewChat}
                >
                  <SquarePen className="chat-sidebar__new-chat-icon" />
                  <span>Đoạn chat mới</span>
                </button>
                <button className="chat-sidebar__menu-item">
                  <Search className="chat-sidebar__menu-item-icon" />
                  <span>Tìm kiếm đoạn chat</span>
                </button>
                <button
                  className="chat-sidebar__menu-item"
                  onClick={() => setIsTryOnOpen(true)}
                >
                  <Shirt className="chat-sidebar__menu-item-icon" />
                  <span>Kho thử đồ</span>
                </button>
                <button className="chat-sidebar__menu-item">
                  <MoreHorizontal className="chat-sidebar__menu-item-icon" />
                  <span>Thêm</span>
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Chat History ── */}
        <div className="chat-sidebar__history">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="chat-sidebar__history-expanded"
              >
                <div className="chat-sidebar__history-title">Gần đây</div>

                {isConversationListLoading ? (
                  <div className="chat-sidebar__loading-state">
                    <LoaderCircle className="chat-sidebar__loading-spinner" />
                  </div>
                ) : (
                  <div className="chat-sidebar__history-list">
                    {chatHistory
                      .sort(
                        (a, b) =>
                          new Date(b.updateTime).getTime() -
                          new Date(a.updateTime).getTime(),
                      )
                      .map((chat: SessionResponse) => (
                        <div
                          key={chat.id}
                          onClick={() => navigate(`/app/${chat.id}`)}
                          className={`chat-sidebar__chat-item ${
                            activeChat === chat.id
                              ? "chat-sidebar__chat-item--active"
                              : ""
                          }`}
                          style={{ cursor: "pointer" }}
                        >
                          <MessageSquare className="chat-sidebar__chat-item-icon" />
                          <span className="chat-sidebar__chat-item-title">
                            {chat.title}
                          </span>
                          <span className="chat-sidebar__chat-item-time">
                            {formatTimeHM(chat.createTime)}
                          </span>

                          <div onClick={(e) => e.stopPropagation()}>
                            <MiniActionPopover
                              triggerClassName={
                                "chat-sidebar__chat-item-action"
                              }
                              contentClassName={
                                "chat-sidebar__chat-item-popover"
                              }
                              actions={[
                                { id: "info", label: "Thông tin" },
                                { id: "delete", label: "Xóa đoạn chat" },
                              ]}
                              onActionSelect={(action) => {
                                switch (action) {
                                  case "info":
                                    showComingSoonActionToast(
                                      "Thông tin",
                                      "info",
                                    );
                                    break;
                                  case "delete":
                                    setDeleteTarget(chat.id);
                                    break;
                                  default:
                                    break;
                                }
                              }}
                            >
                              <div className="chat-sidebar__rounded-btn">
                                <EllipsisVertical size={16} />
                              </div>
                            </MiniActionPopover>
                          </div>
                        </div>
                      ))}

                    {/* Sentinel cho infinite scroll (authenticated) */}
                    {user && <div ref={sentinelRef} />}
                    {isFetchingNextPage && (
                      <div className="chat-sidebar__loading-more">
                        <LoaderCircle className="chat-sidebar__loading-spinner" />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="chat-sidebar__history-collapsed"
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

        {/* ── User Profile (sticky bottom) ── */}
        <div className="chat-sidebar__user-section">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="user-expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="chat-sidebar__user-expanded"
              >
                {user ? (
                  <>
                    <div className="chat-sidebar__user-card">
                      <Avatar className="chat-sidebar__avatar">
                        <AvatarImage
                          src={user.user_metadata?.avatar_url}
                          alt={user.user_metadata?.full_name}
                        />
                        <AvatarFallback className="chat-sidebar__avatar-fallback">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="chat-sidebar__user-info">
                        <span className="chat-sidebar__user-name">
                          {user.user_metadata?.full_name ?? "User"}
                        </span>
                        <span className="chat-sidebar__user-plan">Free</span>
                      </div>
                      <button
                        className="chat-sidebar__logout-btn"
                        onClick={openLogoutModal}
                        title="Đăng xuất"
                      >
                        <LogOut className="chat-sidebar__logout-icon" />
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      className="chat-sidebar__offer-btn"
                    >
                      <Gift className="chat-sidebar__offer-icon" />
                      <span>Nhận ưu đãi</span>
                    </Button>
                  </>
                ) : (
                  <Skeleton
                    name="google-login-btn"
                    loading={isLoginLoading}
                    animate="shimmer"
                    color="#e5e7eb"
                    fixture={
                      <Button
                        variant="outline"
                        className="chat-sidebar__login-btn"
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
                    }
                    fallback={
                      <div className="chat-sidebar__login-skeleton">
                        <LoaderCircle className="chat-sidebar__loading-spinner" />
                        <span>Đang chuyển hướng...</span>
                      </div>
                    }
                  >
                    <Button
                      variant="outline"
                      className="chat-sidebar__login-btn"
                      onClick={loginWithGoogle}
                      disabled={isLoginLoading}
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
                  </Skeleton>
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
                onClick={!user && !isLoginLoading ? loginWithGoogle : undefined}
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
                ) : isLoginLoading ? (
                  <LoaderCircle className="chat-sidebar__loading-spinner" />
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

      {/* ── TryOn Modal (Kho thử đồ) ── */}
      <TryOnModal
        open={isTryOnOpen}
        onOpenChange={setIsTryOnOpen}
        productImageUrl=""
        productUrl=""
        defaultView="history"
      />

      <ConfirmModal
        open={isLogoutModalOpen}
        title="Bạn có chắc muốn đăng xuất?"
        description="Bạn sẽ kết thúc phiên đăng nhập hiện tại. Bạn có thể đăng nhập lại bất kỳ lúc nào."
        cancelText="Hủy"
        confirmText="Có, đăng xuất"
        loadingText="Đang đăng xuất..."
        isLoading={isLogoutPending}
        linkGoToAfterConfirm={"/login"}
        successToastMessage="Đăng xuất thành công"
        errorToastMessage="Đăng xuất thất bại. Vui lòng thử lại."
        onCancel={cancelLogout}
        onConfirm={confirmLogout}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Bạn muốn xoá cuộc trò chuyện?"
        description="Thao tác này sẽ xoá các câu lệnh, câu trả lời và ý kiến phản hồi khỏi Hoạt động của bạn trên Các ứng dụng Bụt, cũng như mọi nội dung bạn đã tạo."
        cancelText="Hủy"
        confirmText="Xóa"
        loadingText="Đang xóa..."
        isLoading={deleteMutation.isPending}
        successToastMessage="Đã xóa đoạn chat"
        errorToastMessage="Xóa đoạn chat thất bại. Vui lòng thử lại."
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </>
  );
}
