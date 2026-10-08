import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Layers, Plus, Trash2, AlertCircle } from 'lucide-react';
import { slotService, type RackData } from '../services/slotService';
import { useToastStore } from '../stores/toastStore';
import { ModalPortal } from './ui';

interface AddRackModalProps {
  isOpen: boolean;
  onClose: () => void;
  racks: RackData[];
  onRackAdded: (newRow: string) => void;
  onRackDeleted?: (deletedRow: string) => void;
}

export default function AddRackModal({
  isOpen,
  onClose,
  racks,
  onRackAdded,
  onRackDeleted,
}: AddRackModalProps) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  // Cari huruf alfabet berikutnya yang belum terpakai (A-Z)
  const existingLetters = racks.map((r) => r.row.toUpperCase());
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const nextSuggestedLetter = alphabet.find((char) => !existingLetters.includes(char)) || 'D';

  const [rowLetter, setRowLetter] = useState<string>(nextSuggestedLetter);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [deletingRow, setDeletingRow] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRowLetter(nextSuggestedLetter);
      setErrorMsg('');
      setDeletingRow(null);
    }
  }, [isOpen, nextSuggestedLetter]);

  // Mutation: Tambah Rak
  const addRackMutation = useMutation({
    mutationFn: async () => {
      const letter = rowLetter.trim().toUpperCase();
      if (!letter || letter.length !== 1 || !/^[A-Z]$/.test(letter)) {
        throw new Error('Kode rak harus berupa 1 karakter abjad kapital (A-Z).');
      }
      if (existingLetters.includes(letter)) {
        throw new Error(`Rak ${letter} sudah ada di dalam sistem.`);
      }
      return slotService.addRack(letter);
    },
    onSuccess: (res) => {
      const createdRow = res?.data?.row || rowLetter.trim().toUpperCase();
      queryClient.invalidateQueries({ queryKey: ['racks'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast(`Rak ${createdRow} (100 slot baru) berhasil ditambahkan!`, 'success');
      onRackAdded(createdRow);
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Gagal menambahkan rak baru.';
      setErrorMsg(msg);
      addToast(msg, 'error');
    },
  });

  // Mutation: Hapus Rak Kosong
  const deleteRackMutation = useMutation({
    mutationFn: async (row: string) => {
      return slotService.deleteRack(row);
    },
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: ['racks'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast(`Rak ${row} beserta 100 slot berhasil dihapus.`, 'success');
      if (onRackDeleted) {
        onRackDeleted(row);
      }
      setDeletingRow(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Gagal menghapus rak.';
      addToast(msg, 'error');
      setDeletingRow(null);
    },
  });

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          className="relative w-full max-w-lg bg-white dark:bg-[#15231b] rounded-3xl shadow-2xl border border-[#d6e9df] dark:border-[#213e2e] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[#e5efe9] dark:border-[#1e382b] bg-[#fbfdfc] dark:bg-[#111c15]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 rounded-xl">
                <Layers className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Kelola Rak Kumbung
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tambah rak baru dengan spesifikasi standar (10 Bay × 10 Tier)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Input Form Tambah Rak */}
            <div className="p-4 rounded-2xl bg-[#f4faf6] dark:bg-[#182c22] border border-[#d6e9df] dark:border-[#244b37] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <span>Nama / Kode Rak Baru</span>
                </label>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  Rekomendasi: Rak {nextSuggestedLetter}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={1}
                    value={rowLetter}
                    onChange={(e) => {
                      setRowLetter(e.target.value.toUpperCase());
                      setErrorMsg('');
                    }}
                    placeholder="Contoh: D"
                    className="w-full uppercase font-mono text-center text-lg font-bold py-2 bg-white dark:bg-[#121f18] border border-[#c4e0d2] dark:border-[#2d553e] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    Rak
                  </span>
                </div>

                <button
                  type="button"
                  disabled={addRackMutation.isPending || !rowLetter.trim()}
                  onClick={() => addRackMutation.mutate()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>{addRackMutation.isPending ? 'Menambahkan...' : 'Buat Rak'}</span>
                </button>
              </div>

              {/* Rincian Dimensi Standard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#d8ece1] dark:border-[#234533] text-[11px]">
                <div className="bg-white/80 dark:bg-[#111c15]/60 p-2 rounded-lg border border-[#e2efe8] dark:border-[#1e382b]">
                  <span className="text-gray-400 block text-[10px]">Seksi (Bay)</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">10 Kolom</span>
                </div>
                <div className="bg-white/80 dark:bg-[#111c15]/60 p-2 rounded-lg border border-[#e2efe8] dark:border-[#1e382b]">
                  <span className="text-gray-400 block text-[10px]">Tingkat (Tier)</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">10 Susun</span>
                </div>
                <div className="bg-white/80 dark:bg-[#111c15]/60 p-2 rounded-lg border border-[#e2efe8] dark:border-[#1e382b]">
                  <span className="text-gray-400 block text-[10px]">Total Slot</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">100 Slot</span>
                </div>
                <div className="bg-white/80 dark:bg-[#111c15]/60 p-2 rounded-lg border border-[#e2efe8] dark:border-[#1e382b]">
                  <span className="text-gray-400 block text-[10px]">Kapasitas Baru</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">+1.000 Baglog</span>
                </div>
              </div>
            </div>

            {/* Daftar Rak Saat Ini */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Daftar Rak Terdaftar ({racks.length} Rak)
                </h4>
                <span className="text-[11px] text-gray-400">
                  Total Kapasitas: {(racks.reduce((acc, r) => acc + (r.total_capacity || 1000), 0)).toLocaleString('id-ID')} Baglog
                </span>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800/80 border border-gray-100 dark:border-gray-800/80 rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-black/20">
                {racks.map((r) => {
                  const isDeletable = r.occupied_slots === 0;
                  const isDeletingThis = deletingRow === r.row;

                  return (
                    <div
                      key={r.row}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center font-mono">
                          {r.row}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <span>Rak {r.row}</span>
                            <span className="text-[10px] font-normal text-gray-400">
                              ({r.total_slots} slot)
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {r.occupied_slots} Terisi
                            </span>
                            <span>•</span>
                            <span>{r.empty_slots} Kosong</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isDeletable ? (
                          isDeletingThis ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                Hapus Rak {r.row}?
                              </span>
                              <button
                                type="button"
                                disabled={deleteRackMutation.isPending}
                                onClick={() => deleteRackMutation.mutate(r.row)}
                                className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingRow(null)}
                                className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[10px] cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingRow(r.row)}
                              title={`Hapus Rak ${r.row} (hanya bisa jika slot kosong)`}
                              className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                            Aktif Digunakan
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end p-4 border-t border-[#e5efe9] dark:border-[#1e382b] bg-[#fbfdfc] dark:bg-[#111c15]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
