import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // <-- THÊM DÒNG NÀY
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
import { ChatProvider } from "./store/ChatContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Tắt mặc định việc tự gọi lại API khi chuyển tab
      retry: 1, // Chỉ thử gọi lại API 1 lần nếu lỗi
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* 2. BỌC QueryClientProvider Ở NGOÀI CÙNG VÀ TRUYỀN client VÀO */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
