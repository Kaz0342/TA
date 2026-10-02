import { useState } from 'react';
import { X, Info, Box, Leaf, TrendingUp, Calendar, Sparkles, AlertTriangle, CheckCircle2, PowerOff, Loader2, Trash2 } from 'lucide-react';
import { slotService, type SlotData } from '../services/slotService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '../stores/toastStore';

interface SlotDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: SlotData | null;
  onRecordCull?: (slot: SlotData) => void;
}

export default function SlotDetailModal({ isOpen, onClose, slot, onRecordCull }: SlotDetailModalProps) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const [isClosingCycle, setIsClosingCycle] = useState(false);
  const [closeReason, setCloseReason] = useState('EXHAUSTED');

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!slot?.assignment?.id) return;
      return await slotService.completeAssignment(slot.assignment.id, {
        reason: closeReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['baglogs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast(`Siklus slot ${slot?.slot_code} berhasil diselesaikan. Slot kini telah kosong!`, 'success');
      setIsClosingCycle(false);
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal menyelesaikan siklus slot.';
      addToast(msg, 'error');
    },
  });

  if (!isOpen || !slot) return null;

  const handleClose = () => {
    setIsClosingCycle(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#142219] w-full max-w-sm rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#edf5f0] dark:border-[#1e382b] flex items-center justify-between bg-[#fbfdfc] dark:bg-[#0c140e]">
          <div>
            <h2 className="text-lg font-extrabold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
              <Box className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Detail Slot {slot.slot_code}
            </h2>
            <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
              Informasi baglog pada koordinat rak
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {!slot.is_occupied || !slot.assignment ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Box className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Slot Kosong</h4>
                <p className="text-xs text-slate-500 mt-1">Belum ada baglog yang dialokasikan ke slot ini.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Status Badge */}
              {slot.assignment.badge && (
                <div className="p-3 bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${slot.assignment.badge.dot || 'bg-emerald-500'}`}></span>
                    <span className="text-sm font-bold text-[#192e22] dark:text-[#e4efe8]">
                      {slot.assignment.badge.label.replace('● ', '')}
                    </span>
                  </div>
                  <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] ml-4">
                    {slot.assignment.badge.description}
                  </p>
                </div>
              )}

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-[10px] font-bold text-emerald-800/70 dark:text-emerald-400/70 uppercase flex items-center gap-1">
                    <Box className="w-3 h-3" /> Batch Aktif
                  </span>
                  <p className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300 mt-1 truncate">
                    {slot.active_batch?.batch_code || '-'}
                  </p>
                </div>

                <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <span className="text-[10px] font-bold text-blue-800/70 dark:text-blue-400/70 uppercase flex items-center gap-1">
                    <Info className="w-3 h-3" /> Umur Baglog
                  </span>
                  <p className="text-sm font-extrabold text-blue-800 dark:text-blue-300 mt-1">
                    {Math.floor(Number(slot.assignment.badge?.age_days) || 0)} Hari
                  </p>
                </div>

                <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <span className="text-[10px] font-bold text-amber-800/70 dark:text-amber-400/70 uppercase flex items-center gap-1">
                    <Leaf className="w-3 h-3" /> Sisa Aktif
                  </span>
                  <p className="text-sm font-extrabold text-amber-800 dark:text-amber-300 mt-1">
                    {slot.assignment.active_capacity} <span className="text-[10px] font-normal text-amber-800/70 dark:text-amber-300/70">/ {slot.assignment.initial_quantity}</span>
                  </p>
                </div>

                <div className="p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                  <span className="text-[10px] font-bold text-purple-800/70 dark:text-purple-400/70 uppercase flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Hasil Panen
                  </span>
                  <p className="text-sm font-extrabold text-purple-800 dark:text-purple-300 mt-1">
                    {slot.assignment.total_harvest_kg || 0} Kg
                  </p>
                </div>
              </div>

              {/* Info Tambahan & Siklus Jamur Kuping */}
              <div className="p-3 bg-[#f7faf8] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#526a5e] dark:text-[#a3c9b4]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Masuk Kumbung
                  </span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">
                    {slot.assignment.assigned_at || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#526a5e] dark:text-[#a3c9b4]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Kematangan Awal
                  </span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">
                    {slot.assignment.initial_mycelium_stage === 'LEVEL_1'
                      ? 'Level 1 (<40%)'
                      : slot.assignment.initial_mycelium_stage === 'LEVEL_3'
                      ? 'Level 3 (Full >80%)'
                      : 'Level 2 (40–80%)'}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#edf5f0] dark:border-[#1e382b] flex items-center justify-between">
                  <span className="text-[11px] text-[#759183] dark:text-[#6b8a78]">
                    Sisa Siklus ({Math.max(0, 120 - (Number(slot.assignment.badge?.age_days) || 0))} hari tersisa)
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Target 120 Hari
                  </span>
                </div>
              </div>

              {/* Tombol Aksi Akhir Hidup / Tutup Siklus & Catat Rusak */}
              {!isClosingCycle ? (
                <div className="pt-1 flex items-center gap-2">
                  {onRecordCull && slot.assignment?.active_capacity > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onRecordCull(slot);
                        onClose();
                      }}
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Catat Rusak
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsClosingCycle(true)}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    Tutup Siklus
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                        Konfirmasi Tutup Siklus Slot {slot.slot_code}?
                      </p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                        {slot.assignment.active_capacity > 0
                          ? `Sisa ${slot.assignment.active_capacity} baglog aktif akan otomatis dialirkan ke mutasi afkir HABIS_PRODUKSI.`
                          : 'Slot akan ditandai COMPLETED dan langsung siap dialokasi ulang.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-rose-900 dark:text-rose-200 mb-1">
                      Alasan Penutupan
                    </label>
                    <select
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#142219] border border-rose-300 dark:border-rose-800 rounded-xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] outline-none"
                    >
                      <option value="EXHAUSTED">Habis Masa Produksi (Alami)</option>
                      <option value="CONTAMINATED">Terkontaminasi Hama / Jamur</option>
                      <option value="MANUAL">Pengosongan Manual (Sortir / Rotasi)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={completeMutation.isPending}
                      onClick={() => setIsClosingCycle(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={completeMutation.isPending}
                      onClick={() => completeMutation.mutate()}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {completeMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ya, Selesaikan Siklus</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
