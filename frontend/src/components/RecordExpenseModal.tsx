import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Banknote, AlertCircle } from 'lucide-react';
import { hppService, type CreateExpensePayload } from '../services/hppService';
import { useToastStore } from '../stores/toastStore';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RecordExpenseModal({
  isOpen,
  onClose,
  onSuccess,
}: RecordExpenseModalProps) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<CreateExpensePayload['category']>('LAINNYA');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setCategory('LAINNYA');
      setAmount('');
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: (payload: CreateExpensePayload) => hppService.createExpense(payload),
    onSuccess: (data) => {
      addToast(
        `Biaya operasional ${data.category} sebesar Rp ${Number(data.amount).toLocaleString('id-ID')} berhasil dicatat.`,
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['operationalExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['hppSummary'] });
      queryClient.invalidateQueries({ queryKey: ['batchHpp'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Gagal mencatat biaya operasional';
      setErrorMsg(msg);
      addToast(msg, 'error');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amtNum = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!amtNum || amtNum <= 0) {
      setErrorMsg('Nominal biaya operasional harus lebih dari Rp 0');
      return;
    }

    mutation.mutate({
      expense_date: expenseDate,
      category,
      amount: amtNum,
      notes: notes.trim() ? notes.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#142219] w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#edf5f0] dark:border-[#1e382b] flex items-center justify-between bg-[#edf5f0] dark:bg-[#182c20] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-[#1f3a2b] text-emerald-800 dark:text-[#86efac] flex items-center justify-center shadow-xs">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">
                Catat Biaya Operasional
              </h2>
              <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4]">
                Dialokasikan secara prorata ke perhitungan HPP batch aktif
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

          {/* Tanggal Biaya */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
              Tanggal Transaksi <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
              required
            />
          </div>

          {/* Kategori Biaya */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
              Kategori Pengeluaran <span className="text-rose-600">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CreateExpensePayload['category'])}
              className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
              required
            >
              <option value="NUTRISI">Nutrisi / Suplemen Jamur</option>
              <option value="LABOR">Tenaga Kerja / Upah Harian</option>
              <option value="PACKAGING">Kemasan & Plastik Packing</option>
              <option value="LAINNYA">Lain-lain / Pemeliharaan</option>
            </select>
          </div>

          {/* Nominal Rp */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
              Nominal Pengeluaran (Rp) <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#526a5e] dark:text-[#a3c9b4]">
                Rp
              </span>
              <input
                type="number"
                min="1000"
                step="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Contoh: 150000"
                className="w-full pl-11 bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
                required
              />
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
              Keterangan / Catatan (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pembayaran token listrik kumbung bulan September..."
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
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
