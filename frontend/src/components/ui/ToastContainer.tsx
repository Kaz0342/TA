import { useToastStore, type Toast } from '../../stores/toastStore';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

const ToastItem = ({ toast }: { toast: Toast }) => {
  const removeToast = useToastStore((state) => state.removeToast);

  const icons = {
    success: <CheckCircle className="w-6 h-6 stroke-[3]" />,
    error: <AlertCircle className="w-6 h-6 stroke-[3]" />,
    warning: <AlertTriangle className="w-6 h-6 stroke-[3]" />,
    info: <Info className="w-6 h-6 stroke-[3]" />,
  };

  const colors = {
    success: 'bg-[#28e085] text-black border-4 border-black',
    error: 'bg-red-500 text-black border-4 border-black',
    warning: 'bg-yellow-400 text-black border-4 border-black',
    info: 'bg-[#60a5fa] text-black border-4 border-black',
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-right fade-in duration-300 w-full sm:w-auto max-w-sm",
        colors[toast.type]
      )}
    >
      <div className="shrink-0">{icons[toast.type]}</div>
      <p className="font-black flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-1 hover:bg-white/20 active:scale-95 transition-all"
      >
        <X className="w-5 h-5 stroke-[3]" />
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
