import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // Jika dibuka dari HP lewat IP LAN (bukan localhost), sesuaikan host backend agar tidak request ke localhost HP
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return envUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
    }
    return envUrl;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor to attach Bearer token
api.interceptors.request.use(
  (config) => {
    // Baca token langsung dari Zustand (FE-W1 Fix)
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Panggil logout dari store untuk memicu re-render dan redirect (FE-W2 Fix)
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
