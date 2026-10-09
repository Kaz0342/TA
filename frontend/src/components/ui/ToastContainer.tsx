import { useState, useEffect, useRef, useCallback } from 'react';
import { useToastStore } from '../../stores/toastStore';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const [isHovered, setIsHovered] = useState(false);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Trigger animasi exit mulus (slide ke kanan + fade out 350ms), baru unmount dari state
  const triggerDismiss = useCallback((id: string) => {
    setExitingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setTimeout(() => {
      removeToast(id);
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  }, [removeToast]);

  // Kelola timer auto-dismiss (5 detik), pause otomatis jika user sedang hover kursor
  useEffect(() => {
    if (isHovered) {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      return;
    }

    toasts.forEach((toast) => {
      if (!timersRef.current.has(toast.id) && !exitingIds.has(toast.id)) {
        const elapsed = Date.now() - toast.createdAt;
        const remaining = Math.max(800, (toast.duration || 5000) - elapsed);

        const timer = setTimeout(() => {
          triggerDismiss(toast.id);
        }, remaining);

        timersRef.current.set(toast.id, timer);
      }
    });

    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [toasts, isHovered, exitingIds, triggerDismiss]);

  if (toasts.length === 0) return null;

  // Toast terbaru selalu berada di lapisan terdepan (index 0)
  const reversedToasts = [...toasts].reverse();
  const visibleToasts = reversedToasts.slice(0, 5);

  const iconBadges = {
    success: (
      <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
      </div>
    ),
    error: (
      <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/60 flex items-center justify-center shrink-0">
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 stroke-[2.2]" />
      </div>
    ),
    warning: (
      <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
      </div>
    ),
    info: (
      <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/60 flex items-center justify-center shrink-0">
        <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 stroke-[2.2]" />
      </div>
    ),
  };

  const typeBorders = {
    success: 'border-emerald-200 dark:border-emerald-800/60',
    error: 'border-rose-200 dark:border-rose-800/60',
    warning: 'border-amber-200 dark:border-amber-800/60',
    info: 'border-sky-200 dark:border-sky-800/60',
  };

  return (
    <div
      className="fixed top-16 sm:top-5 left-3.5 right-3.5 sm:left-auto sm:right-6 sm:w-[380px] z-[99999] select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        // Di mobile/touch: tap pada tumpukan untuk toggle expand/collapse jika ada lebih dari 1 notif
        if (visibleToasts.length > 1) {
          setIsHovered((prev) => !prev);
        }
      }}
      style={{
        pointerEvents: isHovered ? 'auto' : 'none',
      }}
    >
      <div
        className="relative w-full"
        style={{
          height: isHovered ? `${Math.max(66, (visibleToasts.length - 1) * 72 + 70)}px` : '70px',
          transition: 'height 650ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {visibleToasts.map((toast, index) => {
          const isExiting = exitingIds.has(toast.id);

          // Stacking Physics di Pojok Kanan Atas:
          // index 0: Front card (teratas)
          // index 1: Layer 1 mengintip ke bawah (+10px)
          // index 2: Layer 2 mengintip lebih ke bawah (+20px)
          // Saat Hover: Mengembang ke bawah (+index * 72px)
          const translateY = isHovered
            ? index * 72
            : index * 10;

          const scale = isHovered
            ? 1
            : index === 0
            ? 1
            : index === 1
            ? 0.95
            : index === 2
            ? 0.90
            : 0.85;

          const opacity = isExiting
            ? 0
            : isHovered
            ? 1
            : index === 0
            ? 1
            : index === 1
            ? 0.94
            : index === 2
            ? 0.82
            : 0;

          // Animasi keluar saat dismiss: slide mulus ke kanan (+50px) & scale mengecil
          const translateX = isExiting ? 50 : 0;
          const zIndex = 50 - index;

          return (
            <div
              key={toast.id}
              style={{
                transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${isExiting ? scale * 0.9 : scale})`,
                transformOrigin: 'top center',
                zIndex,
                opacity,
                transition: isExiting
                  ? 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 350ms ease, scale 400ms ease'
                  : 'transform 650ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), scale 650ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform, opacity',
              }}
              className={`absolute top-0 left-0 right-0 pointer-events-auto ${
                index > 2 && !isHovered ? 'pointer-events-none' : ''
              }`}
            >
              <div className={`bg-white/95 dark:bg-[#142219]/95 text-[#192e22] dark:text-[#e4efe8] border ${typeBorders[toast.type]} rounded-2xl p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-md flex items-center justify-between gap-3`}>
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 shrink-0">
                    {iconBadges[toast.type]}
                  </div>

                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-[12px] font-bold text-[#192e22] dark:text-[#f4faf6] leading-tight truncate">
                      {toast.title}
                    </p>
                    <p className="text-[11px] text-[#486356] dark:text-[#a3c9b4] leading-snug mt-0.5 line-clamp-2 font-medium">
                      {toast.message}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerDismiss(toast.id);
                  }}
                  className="shrink-0 p-1 rounded-lg text-[#759183] hover:text-[#192e22] dark:text-[#a3c9b4] dark:hover:text-white hover:bg-[#edf5f0] dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Tutup notifikasi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ToastContainer;
