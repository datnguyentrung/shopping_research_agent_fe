import { LogOut, Menu, MessageSquare, Plus, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import "./Sidebar.scss";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeChat, setActiveChat] = useState(1);
  const { user, loginWithGoogle, logout } = useAuth();

  const chatHistory = [
    {
      id: 1,
      title: "React hooks explained",
      time: "Just now",
      category: "Today",
    },
    {
      id: 2,
      title: "Web scraping with Python",
      time: "2h ago",
      category: "Today",
    },
    {
      id: 3,
      title: "React component optimization",
      time: "Yesterday",
      category: "Yesterday",
    },
    {
      id: 4,
      title: "Database schema design",
      time: "2 days ago",
      category: "Previous 7 Days",
    },
    {
      id: 5,
      title: "API authentication best practices",
      time: "3 days ago",
      category: "Previous 7 Days",
    },
    {
      id: 6,
      title: "CSS Grid layout examples",
      time: "1 week ago",
      category: "Previous 7 Days",
    },
  ];

  const grouped = chatHistory.reduce(
    (acc, chat) => {
      if (!acc[chat.category]) acc[chat.category] = [];
      acc[chat.category].push(chat);
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

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? "64px" : "268px" }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="chat-sidebar"
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
              {Object.entries(grouped).map(([category, chats]) => (
                <div key={category} className="chat-sidebar__section">
                  <div className="chat-sidebar__section-title">{category}</div>
                  <div className="chat-sidebar__section-items">
                    {chats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => setActiveChat(chat.id)}
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
                            {chat.time}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
              <button className="chat-sidebar__collapsed-action">
                <Plus className="chat-sidebar__collapsed-action-icon" />
              </button>
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat.id)}
                  className={`chat-sidebar__collapsed-item ${
                    activeChat === chat.id
                      ? "chat-sidebar__collapsed-item--active"
                      : "chat-sidebar__collapsed-item--idle"
                  }`}
                >
                  <MessageSquare className="chat-sidebar__collapsed-item-icon" />
                </button>
              ))}
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
                  <svg className="chat-sidebar__google-icon" viewBox="0 0 24 24">
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
              title={user ? user.user_metadata?.full_name ?? "User" : "Đăng nhập"}
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
                <svg className="chat-sidebar__google-icon-sm" viewBox="0 0 24 24">
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
    </motion.aside>
  );
}
