import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { cullService, type CreateCullPayload } from '../services/cullService';
import { useToastStore } from '../stores/toastStore';
import { ModalPortal } from './ui';

interface RecordCullModalProps {
  isOpen: boolean;
  onClose: () => void;
  batches: Array<{
    id: number;
    batch_code: string;
    quantity: number;
    status: string;
  }>;
  initialBatchId?: number | null;
  initialSlotCode?: string;
  maxQuantity?: number;
}

export default function RecordCullModal({
  isOpen,
  onClose,
  batches,
  initialBatchId,
  initialSlotCode = '',
  maxQuantity,
}: RecordCullModalProps) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const activeBatches = batches.filter((b) => b.status === 'active');

  const [batchId, setBatchId] = useState<number | ''>('');
  const [slotCode, setSlotCode] = useState<string>('');
  const [cullDate, setCullDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<CreateCullPayload['reason']>('TRICHODERMA');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialBatchId) {
        setBatchId(initialBatchId);
      } else if (activeBatches.length > 0) {
        setBatchId(activeBatches[0].id);
      } else {
        setBatchId('');
      }
      setSlotCode(initialSlotCode || '');
      setCullDate(new Date().toISOString().split('T')[0]);
      setQuantity('');
      setReason('TRICHODERMA');
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen, initialBatchId, initialSlotCode]);

  const mutation = useMutation({
    mutationFn: (payload: CreateCullPayload) => cullService.createCull(payload),
    onSuccess: (res) => {
      addToast(
        `Baglog rusak berhasil dicatat (${quantity} baglog). Sisa kapasitas aktif slot: ${res.slot_active_capacity_remaining}`,
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['baglogs'] });
      queryClient.invalidateQueries({ queryKey: ['baglogCulls'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal menyimpan pencatatan baglog rusak';
      setErrorMsg(msg);
      addToast(msg, 'error');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!batchId) {
      setErrorMsg('Pilih batch baglog terlebih dahulu');
      return;
    }
    const cleanSlot = slotCode.trim().toUpperCase();
    if (!cleanSlot) {
      setErrorMsg('Kode slot wajib diisi (contoh: A-01-01)');
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (!qtyNum || qtyNum <= 0) {
      setErrorMsg('Jumlah dibuang harus berupa angka lebih besar dari 0');
      return;
    }

    mutation.mutate({
      baglog_batch_id: Number(batchId),
      slot_code: cleanSlot,
      cull_date: cullDate,
      quantity: qtyNum,
      reason,
      notes: notes.trim() ? notes.trim() : undefined,
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#142219] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#edf5f0] dark:border-[#1e382b] flex items-center justify-between bg-rose-50/50 dark:bg-[#201515] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 flex items-center justify-center shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">
                Catat Baglog Rusak / Dibuang
              </h2>
              <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4]">
                Catatan kerusakan otomatis mengurangi sisa baglog di rak
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-[#e4efe8] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-[#2b1616] border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Batch Selector */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
              Batch Baglog <span className="text-rose-600">*</span>
            </label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
              required
            >
              <option value="">Pilih Batch Baglog...</option>
              {activeBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code} ({b.quantity} baglog)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Slot Code */}
            <div>
              <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                Kode Slot Kumbung <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={slotCode}
                onChange={(e) => setSlotCode(e.target.value.toUpperCase())}
                placeholder="Contoh: A-01-01"
                maxLength={10}
                className="w-full uppercase font-mono bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all placeholder:font-normal placeholder:normal-case"
                required
              />
              <span className="text-[10px] text-[#526a5e] dark:text-[#a3c9b4] mt-0.5 block">
                Format: [Baris A-C]-[Rak 01-10]-[Tingkat 01-10]
              </span>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                Jumlah Dibuang (Baglog) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={maxQuantity ? String(maxQuantity) : '20'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Contoh: 1"
                className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-semibold focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
                required
              />
              {maxQuantity !== undefined && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Sisa aktif di slot: <strong>{maxQuantity}</strong> baglog
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tanggal Afkir */}
            <div>
              <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                Tanggal Ditemukan Rusak <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={cullDate}
                onChange={(e) => setCullDate(e.target.value)}
                className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
                required
              />
            </div>

            {/* Alasan Afkir */}
            <div>
              <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                Alasan / Indikasi Rusak <span className="text-rose-600">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as CreateCullPayload['reason'])}
                className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-semibold focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
                required
              >
                <option value="TRICHODERMA">Jamur Hijau (Trichoderma)</option>
                <option value="BUSUK_BASAH">Busuk Basah (Bakteri)</option>
                <option value="HAMA">Hama (Ulat / Serangga)</option>
                <option value="KERING">Kering / Dehidrasi</option>
                <option value="HABIS_PRODUKSI">Habis Masa Produksi</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
              Catatan Observasi (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan tanda-tanda kontaminasi..."
              className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2 text-xs text-[#192e22] dark:text-[#e4efe8] focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#edf5f0] dark:border-[#1e382b] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-[#a3c9b4] hover:bg-slate-100 dark:hover:bg-[#182c20] rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? 'Menyimpan...' : 'Simpan Pencatatan Baglog Rusak'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
