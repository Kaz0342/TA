import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { deviceControlService, type DeviceCommandData } from '../services/deviceControlService';
import { useToastStore } from '../stores/toastStore';

export default function HarvestPauseWidget() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  // Poll device status every 5 seconds
  const { data: deviceStatus, isLoading } = useQuery<DeviceCommandData>({
    queryKey: ['deviceCommandStatus'],
    queryFn: () => deviceControlService.getStatus(),
    refetchInterval: 5000,
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Local live countdown ticker
  useEffect(() => {
    if (deviceStatus?.is_paused && deviceStatus?.remaining_seconds) {
      setRemainingSeconds(deviceStatus.remaining_seconds);
    } else {
      setRemainingSeconds(0);
    }
  }, [deviceStatus]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          queryClient.invalidateQueries({ queryKey: ['deviceCommandStatus'] });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSeconds, queryClient]);

  // Pause Mutation
  const pauseMutation = useMutation({
    mutationFn: ({ duration, reason }: { duration: number; reason: string }) =>
      deviceControlService.pause(duration, reason),
    onSuccess: (data) => {
      queryClient.setQueryData(['deviceCommandStatus'], data);
      addToast(
        `Mode Panen aktif selama ${Math.round(data.duration_seconds / 60)} menit. Misting & Blower OFF.`,
        'info'
      );
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal mengaktifkan mode panen';
      addToast(msg, 'error');
    },
  });

  // Resume Mutation
  const resumeMutation = useMutation({
    mutationFn: () => deviceControlService.resume(),
    onSuccess: (data) => {
      queryClient.setQueryData(['deviceCommandStatus'], data);
      addToast('Mode Otomasi diaktifkan kembali. Sensor & aktuator normal.', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal meresume otomasi';
      addToast(msg, 'error');
    },
  });

  const formatRemainingTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${hours}j ${minutes}m ${seconds}d`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isPaused = deviceStatus?.is_paused ?? false;

  return (
    <div
      className={`rounded-3xl border p-5 transition-all shadow-sm ${
        isPaused
          ? 'bg-amber-50/70 dark:bg-[#231d10] border-amber-300 dark:border-amber-700/80 shadow-amber-500/10'
          : 'bg-white dark:bg-[#142219] border-[#d6e9df] dark:border-[#1e382b]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
              isPaused
                ? 'bg-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse'
                : 'bg-emerald-100 dark:bg-[#182c20] text-emerald-700 dark:text-[#86efac]'
            }`}
          >
            {isPaused ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
              {isPaused ? 'Mode Panen Aktif (Otomasi Jeda)' : 'Kontrol Mode Panen'}
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isPaused
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {isPaused ? 'Aktuator Mati' : 'Otomasi Normal'}
              </span>
            </h3>
            <p className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4]">
              {isPaused
                ? 'Misting & Blower dinonaktifkan sementara agar petani tidak basah kuyup & aliran udara terjaga.'
                : 'Jeda otomasi saat petani panen atau inspeksi kumbung.'}
            </p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#526a5e] dark:text-[#a3c9b4]">
          {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
        </div>
      </div>

      {isPaused ? (
        /* PAUSED STATE UI */
        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/80 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700">
              <Clock className="w-4 h-4 text-amber-700 dark:text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="font-mono text-sm font-extrabold text-amber-900 dark:text-amber-200">
                Sisa Waktu: {formatRemainingTime(remainingSeconds)}
              </span>
            </div>
            {deviceStatus?.reason && (
              <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium hidden md:inline">
                Alasan: <strong>{deviceStatus.reason}</strong>
              </span>
            )}
          </div>

          <button
            onClick={() => resumeMutation.mutate()}
            disabled={resumeMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{resumeMutation.isPending ? 'Mengaktifkan...' : 'Selesai Panen (Nyalakan Otomasi)'}</span>
          </button>
        </div>
      ) : (
        /* IDLE / NORMAL AUTO STATE UI */
        <div className="mt-3 pt-3 border-t border-[#edf5f0] dark:border-[#1e382b] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#526a5e] dark:text-[#a3c9b4]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Pilih durasi jeda panen:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => pauseMutation.mutate({ duration: 1800, reason: 'Panen Rutin 30m' })}
              disabled={pauseMutation.isPending}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#edf5f0] dark:bg-[#182c20] hover:bg-[#d6e9df] dark:hover:bg-[#1f3a2b] text-[#244b37] dark:text-[#86efac] border border-[#d6e9df] dark:border-[#2b503d] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              30 Menit
            </button>
            <button
              onClick={() => pauseMutation.mutate({ duration: 3600, reason: 'Panen Penuh 60m' })}
              disabled={pauseMutation.isPending}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#edf5f0] dark:bg-[#182c20] hover:bg-[#d6e9df] dark:hover:bg-[#1f3a2b] text-[#244b37] dark:text-[#86efac] border border-[#d6e9df] dark:border-[#2b503d] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              60 Menit
            </button>
            <button
              onClick={() => pauseMutation.mutate({ duration: 7200, reason: 'Inspeksi & Panen Besar 120m' })}
              disabled={pauseMutation.isPending}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#edf5f0] dark:bg-[#182c20] hover:bg-[#d6e9df] dark:hover:bg-[#1f3a2b] text-[#244b37] dark:text-[#86efac] border border-[#d6e9df] dark:border-[#2b503d] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              120 Menit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
