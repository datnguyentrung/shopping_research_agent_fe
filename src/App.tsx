import { ChatInput, ChatWindow, Sidebar } from "@/components";
import { useChatSSE } from "@/hooks/useChatSSE";
import { useState } from "react";
import "./App.scss";

export default function App() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    sendHiddenMessage,
    resetChat,
  } = useChatSSE();
  const [newSearchTerm, setNewSearchTerm] = useState("");

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleSendHiddenMessage = async (action: string, payload: unknown) => {
    await sendHiddenMessage(action, payload);
    setNewSearchTerm(payload as string);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          newSearchTerm={newSearchTerm}
          onReset={resetChat}
          onSendHiddenMessage={handleSendHiddenMessage}
          error={error}
        />
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
