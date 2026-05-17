import { ChatWindow, Sidebar } from "@/components";
import { useChatSSE } from "@/hooks/useChatSSE";
import { useCallback, useEffect, useRef, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./App.scss";
import { useAuth } from './contexts/AuthContext';

// Component chứa logic chính của một phiên chat
function ChatSession() {
  const { sessionId } = useParams<{ sessionId: string }>(); // Bắt ID từ URL
  const navigate = useNavigate();
  const isLocalNavRef = useRef(false); // Ref để tránh load lại lịch sử khi vừa tạo mới phiên
  const { user, loginWithGoogle, logout } = useAuth();

  // Hàm này được gọi bởi hook khi Backend trả về session id mới
  const handleSessionCreated = useCallback(
    (newId: string) => {
      if (!sessionId) {
        isLocalNavRef.current = true;
        navigate(`/app/${newId}`, { replace: true });
      }
    },
    [navigate, sessionId],
  );
  const {
    messages,
    isLoading,
    isFetchingHistory,
    error,
    loadHistory,
    sendMessage,
    sendHiddenMessage,
  } = useChatSSE(sessionId, handleSessionCreated);

  const [newSearchTerm, setNewSearchTerm] = useState("");

  // Khi URL thay đổi (có sessionId), tự động load lịch sử từ Backend
  // Nếu có session ID từ URL và không phải do ta vừa đổi route nội bộ -> Fetch lịch sử
  useEffect(() => {
    if (sessionId && !isLocalNavRef.current) {
      loadHistory(sessionId);
    }
    isLocalNavRef.current = false; // reset
  }, [sessionId, loadHistory]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleSendHiddenMessage = async (action: string, payload: unknown) => {
    await sendHiddenMessage(action, payload);
    setNewSearchTerm(payload as string);
  };

  // Nút bấm Reset Chat giờ đây đơn giản là chuyển hướng về trang chủ
  const handleResetChat = () => {
    navigate("/");
  };

  return (
    <div className="app-shell">
      <Sidebar user={user} loginWithGoogle={loginWithGoogle} logout={logout} />
      <div className="app-shell__main">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          isFetchingHistory={isFetchingHistory}
          newSearchTerm={newSearchTerm}
          user={user}
          onReset={handleResetChat}
          onSendHiddenMessage={handleSendHiddenMessage}
          error={error}
          onQuickAction={handleSendMessage}
          onSend={handleSendMessage}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Trang chủ sẽ dùng chung ChatSession nhưng không có ID ban đầu */}
      <Route path="/" element={<ChatSession />} />

      {/* Bắt URL có dạng /app/xxx-yyy-zzz */}
      <Route path="/app/:sessionId" element={<ChatSession />} />
    </Routes>
  );
}
