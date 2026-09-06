# Panduan Komponen Frontend: QuickHarvestModal.jsx

Dokumen ini berisi kode untuk **QuickHarvestModal.jsx**. Komponen ini dirancang khusus untuk layar *smartphone* (mobile-first) agar para pekerja/buruh kebun gampang mencatat hasil panen harian langsung dari dalam kumbung jamur tanpa harus ke meja komputer.

Komponen ini punya fitur **Tombol Cepat (+1kg, +5kg)** supaya buruh nggak perlu repot ngetik angka pecahan di *keyboard* HP kalau tangan mereka lagi kotor atau basah kena tanah.

---

## 1. Kode Komponen (`frontend/src/components/QuickHarvestModal.tsx`)

Simpan kode di bawah ini pada folder `components` di *frontend*.

```tsx
import React, { useState } from 'react';
import { X, Sprout, Loader2, Check } from 'lucide-react';

interface QuickHarvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBatches: { id: number; batch_code: string; quantity: number }[];
  onSubmit: (data: any) => Promise<void>;
}

export default function QuickHarvestModal({ isOpen, onClose, activeBatches = [], onSubmit }: QuickHarvestModalProps) {
  const [weight, setWeight] = useState<number>(0);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // Guard kalau modal lagi ga dibuka
  if (!isOpen) return null;

  // Fungsi buat nambah berat cepet tanpa ngetik
  const handleWeightAdd = (amount: number) => {
    setWeight((prev) => parseFloat((prev + amount).toFixed(2)));
  };

  // Fungsi simpan ke database (lewat props)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (weight <= 0 || !selectedBatch) return;

    setStatus('loading'); // Kasih feedback visual loading muter
    
    try {
      await onSubmit({
        baglog_batch_id: selectedBatch,
        total_kg: weight,
        notes: notes
      });
      
      setStatus('success'); // Ganti jadi centang hijau
      
      // Auto tutup modal setelah 1.5 detik
      setTimeout(() => {
        setStatus('idle');
        setWeight(0);
        setNotes('');
        onClose();
      }, 1500);
      
    } catch (error) {
      setStatus('idle');
      alert("Gagal menyimpan panen! Cek koneksi internet.");
    }
  };

  return (
    // Overlay Gelap (Backdrop)
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      
      {/* Container Modal (Neobrutalism Design) */}
      <div className="bg-white w-full max-w-md border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-black bg-[#28e085]">
          <div className="flex items-center gap-2">
            <Sprout className="w-6 h-6 stroke-[3] text-black" />
            <h2 className="text-xl font-black text-black uppercase">Catat Panen Harian</h2>
          </div>
          <button 
            onClick={onClose}
            disabled={status === 'loading'}
            className="p-1 bg-white border-2 border-black hover:bg-red-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          
          {/* 1. Dropdown Batch Aktif */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-black uppercase text-black">Pilih Batch Baglog</label>
            <select 
              required
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full p-3 border-4 border-black bg-gray-50 text-black font-bold focus:outline-none focus:bg-yellow-200 transition-colors cursor-pointer"
            >
              <option value="" disabled>-- Pilih Batch Jamur --</option>
              {activeBatches.map(batch => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_code} (Sisa: {batch.quantity} log)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Input Berat & Tombol Tambah Cepat */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-black uppercase text-black">Total Berat (Kg)</label>
            
            <div className="flex gap-2">
              <input 
                type="number" 
                step="0.1"
                min="0"
                required
                value={weight === 0 ? '' : weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full p-3 text-4xl font-black border-4 border-black bg-white focus:outline-none focus:bg-yellow-200 transition-colors text-center"
              />
              
              {/* Tombol Cepat (Biar pekerja ga usah ngetik) */}
              <div className="flex flex-col gap-2 shrink-0">
                <button 
                  type="button" 
                  onClick={() => handleWeightAdd(1)}
                  className="px-4 py-2 bg-[#c084fc] border-4 border-black font-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all"
                >
                  +1 Kg
                </button>
                <button 
                  type="button" 
                  onClick={() => handleWeightAdd(5)}
                  className="px-4 py-2 bg-[#60a5fa] border-4 border-black font-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all"
                >
                  +5 Kg
                </button>
              </div>
            </div>
          </div>

          {/* 3. Catatan Kondisi Jamur */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-black uppercase text-black">Kondisi Jamur (Opsional)</label>
            <textarea 
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cth: Jamur agak kering, butuh disiram..."
              className="w-full p-3 border-4 border-black bg-gray-50 text-black font-bold focus:outline-none focus:bg-yellow-200 transition-colors resize-none"
            />
          </div>

          {/* 4. Tombol Submit (Dengan efek Loading/Success) */}
          <button 
            type="submit" 
            disabled={status !== 'idle' || weight <= 0 || !selectedBatch}
            className="mt-2 w-full p-4 bg-black text-white border-4 border-black font-black text-lg uppercase flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' && <Loader2 className="w-6 h-6 animate-spin" />}
            {status === 'success' && <Check className="w-6 h-6 text-green-400" />}
            
            {status === 'idle' && "Simpan Data Panen"}
            {status === 'loading' && "Menyimpan..."}
            {status === 'success' && "Tersimpan!"}
          </button>
          
        </form>
      </div>
    </div>
  );
}
```

---

## 2. Cara Memanggilnya di Halaman Lain

Misalnya di halaman `Harvests.tsx` atau ada tombol ngambang (FAB) di HP:

```tsx
import { useState } from 'react';
import QuickHarvestModal from '../components/QuickHarvestModal';

export default function WorkerPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Dummy data batch (Ganti jadi hasil fetch API nanti)
  const activeBatches = [
    { id: 1, batch_code: 'BATCH-001', quantity: 1000 },
    { id: 2, batch_code: 'BATCH-002', quantity: 800 }
  ];

  // Fungsi yang dilempar ke modal pas tombol simpan dipencet
  const handleSaveHarvest = async (data) => {
    // Await API Call contoh:
    // await api.post('/harvests', data);
    console.log("Data siap kirim ke Laravel:", data);
  };

  return (
    <div>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-[#28e085] p-4 border-4 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        Mulai Panen
      </button>

      <QuickHarvestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeBatches={activeBatches}
        onSubmit={handleSaveHarvest}
      />
    </div>
  );
}
```
