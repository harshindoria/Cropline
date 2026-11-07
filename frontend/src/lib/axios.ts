import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cropline_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const SESSION_EXPIRED_EVENT = "cropline:session-expired";

// The backend says the saved token is no longer valid (expired, or the account is gone).
// AuthContext listens for this and logs the user out. Other 401s, like a wrong OTP, are left alone.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error?.config?.headers?.Authorization);
    if (
      typeof window !== "undefined" &&
      sentToken &&
      error?.response?.status === 401 &&
      error.response.data?.code === "SESSION_INVALID"
    ) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;
