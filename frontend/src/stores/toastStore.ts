import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Berhasil Disimpan',
  error: 'Terjadi Kesalahan',
  warning: 'Peringatan Sistem',
  info: 'Pemberitahuan',
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', title, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const resolvedTitle = title || DEFAULT_TITLES[type];

    set((state) => ({
      // Simpan maksimal 5 toast terbaru untuk performa deck animasi yang super ringan
      toasts: [
        ...state.toasts.slice(-4),
        { id, message, type, title: resolvedTitle, duration, createdAt: Date.now() },
      ],
    }));
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));
