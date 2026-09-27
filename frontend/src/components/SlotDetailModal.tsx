import { X, Info, Box, Leaf, TrendingUp } from 'lucide-react';
import type { SlotData } from '../services/slotService';

interface SlotDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: SlotData | null;
}

export default function SlotDetailModal({ isOpen, onClose, slot }: SlotDetailModalProps) {
  if (!isOpen || !slot) return null;

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
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
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
              <div className="grid grid-cols-2 gap-3">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
