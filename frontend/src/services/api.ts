import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  // Jika VITE_API_URL diarahkan ke cloud publik HTTPS (misal Vercel / Railway), gunakan URL tersebut
  if (envUrl && envUrl.startsWith('https://')) {
    return envUrl;
  }
  // Pada lingkungan lokal (baik diakses via localhost laptop maupun IP LAN dari HP),
  // gunakan path relatif '/api' agar otomatis di-reverse-proxy oleh Vite (port 5173) ke port 8000.
  // Ini mencegah request gantung akibat Windows Defender Firewall memblokir port 8000 dari HP.
  return '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
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
