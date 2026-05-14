import { ChatInput, ChatWindow, Sidebar } from "@/components";
import { useChatSSE } from "@/hooks/useChatSSE";
import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  Navigate,
} from "react-router-dom";
import "./App.scss";

// Component chứa logic chính của một phiên chat
function ChatSession() {
  const { sessionId } = useParams<{ sessionId: string }>(); // Bắt ID từ URL
  const navigate = useNavigate();
  const {
    messages,
    isLoading,
    error,
    loadHistory,
    sendMessage,
    sendHiddenMessage,
  } = useChatSSE(sessionId); // Truyền ID vào hook

  const [newSearchTerm, setNewSearchTerm] = useState("");

  // Khi URL thay đổi (có sessionId), tự động load lịch sử từ Backend
  useEffect(() => {
    if (sessionId) {
      loadHistory(sessionId);
    }
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
      <Sidebar />
      <div className="app-shell__main">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          newSearchTerm={newSearchTerm}
          onReset={handleResetChat}
          onSendHiddenMessage={handleSendHiddenMessage}
          error={error}
        />
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}

// Route Component để tạo phiên mới
function NewChatRedirect() {
  // Tạo ID mới và tự động redirect sang link /c/{id}
  const newId = crypto.randomUUID();
  return <Navigate to={`/c/${newId}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Khi người dùng vào trang chủ, tạo Session mới và chuyển hướng */}
      <Route path="/" element={<NewChatRedirect />} />

      {/* Bắt URL có dạng /c/xxx-yyy-zzz */}
      <Route path="/c/:sessionId" element={<ChatSession />} />
    </Routes>
  );
}
