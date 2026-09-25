# Panduan Komponen Frontend: QuickHarvestModal.tsx

Dokumen ini berisi kode dan panduan teknis untuk **QuickHarvestModal.tsx**. Komponen ini dirancang responsif (*mobile-friendly*) untuk mencatat hasil panen harian langsung dari dalam kumbung jamur menggunakan gaya desain **Harmonious Modern Sage Green & Dark Mode** tanpa menggunakan `alert()`, melainkan melalui *custom state feedback* dan sistem Toast global.

Komponen ini menyediakan fitur **Tombol Cepat (+0.5 kg, +1 kg, +5 kg)** agar pekerja kebun dapat memasukkan berat panen dengan cepat meski tangan dalam keadaan memakai sarung tangan kerja.

---

## 1. Kode Komponen (`frontend/src/components/QuickHarvestModal.tsx`)

```tsx
import React, { useState } from 'react';
import { X, Sprout, Loader2, Check, Plus } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';

interface ActiveBatchOption {
  id: number;
  batch_code: string;
  quantity: number;
}

interface QuickHarvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBatches: ActiveBatchOption[];
  onSubmit: (data: { baglog_batch_id: number; weight_kg: number; notes?: string }) => Promise<void>;
}

export default function QuickHarvestModal({
  isOpen,
  onClose,
  activeBatches = [],
  onSubmit,
}: QuickHarvestModalProps) {
  const [weight, setWeight] = useState<number>(0);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const { addToast } = useToastStore();

  if (!isOpen) return null;

  const handleWeightAdd = (amount: number) => {
    setWeight((prev) => parseFloat((prev + amount).toFixed(2)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (weight <= 0 || !selectedBatch) {
      addToast('Harap pilih batch dan masukkan berat panen yang valid!', 'error');
      return;
    }

    setStatus('loading');

    try {
      await onSubmit({
        baglog_batch_id: parseInt(selectedBatch, 10),
        weight_kg: weight,
        notes: notes || undefined,
      });

      setStatus('success');
      addToast('Hasil panen berhasil dicatat!', 'success');

      setTimeout(() => {
        setStatus('idle');
        setWeight(0);
        setNotes('');
        setSelectedBatch('');
        onClose();
      }, 1200);
    } catch (error) {
      setStatus('idle');
      addToast('Gagal menyimpan hasil panen. Periksa koneksi ke server!', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1a2e23] w-full max-w-md rounded-3xl border border-[#d6e9df] dark:border-[#2a4435] shadow-xl overflow-hidden flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between p-6 border-b border-[#f0f5f1] dark:border-[#253f30]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#e8f4ed] dark:bg-[#233d2e] text-[#244b37] dark:text-[#cee8dc]">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#192e22] dark:text-[#edf5f0]">Catat Panen Cepat</h2>
              <p className="text-xs text-[#759183]">Input hasil petik panen jamur harian</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'loading'}
            className="p-2 rounded-xl text-[#759183] hover:bg-[#f0f5f1] dark:hover:bg-[#233d2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulir Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Pilih Batch Baglog */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#cee8dc] uppercase tracking-wider mb-2">
              Batch Baglog Asal
            </label>
            <select
              required
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-4 py-3 bg-[#f8faf8] dark:bg-[#15241c] border border-[#dce8de] dark:border-[#2a4435] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#edf5f0] focus:bg-white dark:focus:bg-[#1c3226] focus:border-[#244b37] focus:outline-none transition-all"
            >
              <option value="" disabled>-- Pilih Batch Aktif --</option>
              {activeBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_code} ({batch.quantity} baglog)
                </option>
              ))}
            </select>
          </div>

          {/* Input Berat & Quick Chips */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#cee8dc] uppercase tracking-wider mb-2">
              Berat Bersih Panen (KG)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={weight === 0 ? '' : weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full px-4 py-3 text-3xl font-extrabold text-center bg-[#f8faf8] dark:bg-[#15241c] border border-[#dce8de] dark:border-[#2a4435] rounded-2xl text-[#244b37] dark:text-[#cee8dc] focus:bg-white dark:focus:bg-[#1c3226] focus:border-[#244b37] focus:outline-none transition-all"
              />
            </div>

            {/* Quick Action Chips */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleWeightAdd(0.5)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#e8f4ed] dark:bg-[#233d2e] hover:bg-[#d8ece1] dark:hover:bg-[#2c4e3a] text-[#244b37] dark:text-[#cee8dc] text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 0.5 Kg
              </button>
              <button
                type="button"
                onClick={() => handleWeightAdd(1.0)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#e8f4ed] dark:bg-[#233d2e] hover:bg-[#d8ece1] dark:hover:bg-[#2c4e3a] text-[#244b37] dark:text-[#cee8dc] text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 1.0 Kg
              </button>
              <button
                type="button"
                onClick={() => handleWeightAdd(5.0)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#e8f4ed] dark:bg-[#233d2e] hover:bg-[#d8ece1] dark:hover:bg-[#2c4e3a] text-[#244b37] dark:text-[#cee8dc] text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 5.0 Kg
              </button>
            </div>
          </div>

          {/* Catatan Kualitas */}
          <div>
            <label className="block text-xs font-bold text-[#192e22] dark:text-[#cee8dc] uppercase tracking-wider mb-2">
              Catatan Kualitas (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Daun tebal, bersih dari spora liar"
              className="w-full px-4 py-2.5 bg-[#f8faf8] dark:bg-[#15241c] border border-[#dce8de] dark:border-[#2a4435] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#edf5f0] focus:bg-white dark:focus:bg-[#1c3226] focus:border-[#244b37] focus:outline-none transition-all"
            />
          </div>

          {/* Tombol Simpan */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3.5 px-4 bg-[#244b37] hover:bg-[#1b3a2b] text-white rounded-2xl font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan Data Panen...
                </>
              ) : status === 'success' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  Tersimpan!
                </>
              ) : (
                'Simpan Hasil Panen'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
