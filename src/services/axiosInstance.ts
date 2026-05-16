import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios from "axios";
import axiosRetry from "axios-retry";
import { apiConfig } from "./api";
import { supabase } from "./supabase";

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const API_BASE_URL = apiConfig.baseUrl || "http://localhost:8000";
console.log("🔧 API_BASE_URL:", API_BASE_URL);

// --- HÀM LẤY HEADERS DÙNG CHUNG ---
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Dùng getSession() Supabase sẽ tự cố gắng refresh token ngầm nếu phát hiện hết hạn
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
};

// --- CÁC BIẾN TOÀN CỤC CHO CƠ CHẾ REFRESH TOKEN ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Xử lý các request đang phải xếp hàng chờ refresh token
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};
// --------------------------------------------------

/**
 * Cấu hình tự động gọi lại API (Retry) khi gặp lỗi mạng hoặc lỗi server
 */
function setupRetry(instance: AxiosInstance): AxiosInstance {
  axiosRetry(instance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error: AxiosError) => {
      const status = error.response?.status;
      // Chỉ retry nếu là lỗi mạng, lỗi rate limit (429) hoặc lỗi server (5xx)
      if (axiosRetry.isNetworkError(error)) {
        return true;
      }
      return status === 429 || (status !== undefined && status >= 500);
    },
    onRetry: (
      retryCount: number,
      error: AxiosError,
      requestConfig: AxiosRequestConfig,
    ) => {
      console.log(
        `🔁 Retry #${retryCount} ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`,
        { status: error.response?.status, message: error.message },
      );
    },
  });
  return instance;
}

/**
 * Cấu hình Interceptors để nhúng Token và xử lý lỗi Global
 */
function setupInterceptors(instance: AxiosInstance): AxiosInstance {
  // 1. REQUEST INTERCEPTOR: Bắt trước khi gửi request đi
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const headers = await getAuthHeaders();

      for (const [key, value] of Object.entries(headers)) {
        config.headers.set(key, value);
      }

      // 🌟 LOG REQUEST: In ra request đang được gọi
      console.log(
        `🚀 [REQ] ${config.method?.toUpperCase()} ${config.baseURL || ""}${config.url || ""}`,
      );

      return config;
    },
    (error: AxiosError) => {
      console.error("❌ [REQ ERROR]:", error);
      return Promise.reject(error);
    },
  );

  // 2. RESPONSE INTERCEPTOR: Bắt khi server trả kết quả về
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // 🌟 LOG SUCCESS: In ra kết quả thành công
      console.log(
        `✅ [RES] ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`,
      );
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };
      const status = error.response?.status;

      // 🌟 LOG LỖI TỔNG QUÁT: In ra lỗi cụ thể nếu request thất bại
      console.error(
        `❌ [RES ERROR] ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url} - Status: ${status}`,
      );

      // === BẮT ĐẦU LUỒNG REFRESH TOKEN TỰ ĐỘNG ===
      if (status === 401 && originalRequest && !originalRequest._retry) {
        // 1. Nếu đang có một request khác gọi refresh rồi, các request 401 tiếp theo phải xếp hàng
        if (isRefreshing) {
          return new Promise(function (resolve, reject) {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.set("Authorization", `Bearer ${token}`);
              return instance(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        // 2. Đánh dấu request này đang đi lấy token mới
        originalRequest._retry = true;
        isRefreshing = true;

        try {
          console.log("🔄 Đang thử lấy lại token mới (Refresh Token)...");
          // 3. Ép Supabase lấy lại Session mới (Refresh Token)
          const { data, error: refreshError } =
            await supabase.auth.refreshSession();

          if (refreshError || !data.session) {
            throw refreshError || new Error("Không lấy được session mới");
          }

          const newAccessToken = data.session.access_token;
          console.log("✅ Lấy Token mới thành công!");

          // 4. Thả cho các request đang xếp hàng chạy tiếp với token mới
          processQueue(null, newAccessToken);

          // 5. Chạy lại chính cái request vừa bị chết (401) lúc nãy
          originalRequest.headers.set(
            "Authorization",
            `Bearer ${newAccessToken}`,
          );
          return instance(originalRequest);
        } catch (refreshErr) {
          // TRƯỜNG HỢP XẤU NHẤT: Refresh Token cũng hết hạn hoặc bị lỗi
          processQueue(refreshErr, null);

          console.log("🔒 Refresh Token hết hạn hoặc lỗi, đá văng về Login!");
          await supabase.auth.signOut(); // Đăng xuất khỏi Supabase
          window.location.href = "/login"; // Force redirect về trang đăng nhập

          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false; // Mở khóa luồng
        }
      }
      // === KẾT THÚC LUỒNG REFRESH TOKEN ===

      // Xử lý các lỗi khác để log ra console cho dễ debug
      switch (status) {
        case 403:
          console.log(
            "🚫 Forbidden - Bạn không có quyền truy cập tài nguyên này",
          );
          break;
        case 404:
          console.log(
            `🔍 Not Found - Không tìm thấy endpoint: ${originalRequest?.url}`,
          );
          break;
        case 500:
          console.log("🔥 Server Error - Lỗi nội bộ từ máy chủ");
          break;
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

// 🚀 Khởi tạo và export Axios Instance chính đã được trang bị đầy đủ chức năng
const axiosInstance = setupInterceptors(
  setupRetry(
    axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000, // Timeout an toàn (15 giây)
    }),
  ),
);

export default axiosInstance;
