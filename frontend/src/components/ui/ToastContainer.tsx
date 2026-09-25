import { useToastStore, type Toast } from '../../stores/toastStore';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

const ToastItem = ({ toast }: { toast: Toast }) => {
  const removeToast = useToastStore((state) => state.removeToast);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-600" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    info: <Info className="w-5 h-5 text-sky-600" />,
  };

  const colors = {
    success: 'bg-white dark:bg-[#142219] border border-emerald-200 dark:border-emerald-800/60 text-slate-800 dark:text-[#e4efe8] shadow-lg',
    error: 'bg-white dark:bg-[#142219] border border-rose-200 dark:border-rose-800/60 text-slate-800 dark:text-[#e4efe8] shadow-lg',
    warning: 'bg-white dark:bg-[#142219] border border-amber-200 dark:border-amber-800/60 text-slate-800 dark:text-[#e4efe8] shadow-lg',
    info: 'bg-white dark:bg-[#142219] border border-sky-200 dark:border-sky-800/60 text-slate-800 dark:text-[#e4efe8] shadow-lg',
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-2xl animate-in slide-in-from-right fade-in duration-200 w-full sm:w-auto max-w-sm",
        colors[toast.type]
      )}
    >
      <div className="shrink-0">{icons[toast.type]}</div>
      <p className="font-semibold text-xs text-slate-800 dark:text-[#e4efe8] flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg transition-all cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

};

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-4 pointer-events-none w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
