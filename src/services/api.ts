const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const API_BACKEND_ML_URL =
  import.meta.env.VITE_API_BACKEND_ML_URL ?? "http://localhost:8001";

export const apiConfig = {
  baseUrl: API_BASE_URL,
  baseMlUrl: API_BACKEND_ML_URL,
};
