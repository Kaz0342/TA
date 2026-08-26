import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Sprout } from 'lucide-react';
import api from '../services/api';
import { Card, Button } from '../components/ui';
import { useToastStore } from '../stores/toastStore';

export default function HarvestManagement() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState('');
  const [batchId, setBatchId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch Harvests
  const { data: harvests, isLoading } = useQuery({
    queryKey: ['harvests'],
    queryFn: async () => {
      const res = await api.get('/harvests');
      return res.data.data;
    }
  });

  // Fetch Active Baglogs for Dropdown
  const { data: activeBatches } = useQuery({
    queryKey: ['baglogs', 'active'],
    queryFn: async () => {
      const res = await api.get('/baglogs?status=active');
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/harvests', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }); // Refresh dashboard
      addToast('Data panen berhasil dicatat!', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Gagal menyimpan data panen.';
      setFormError(msg);
      addToast(msg, 'error');
    }
  });

  const resetForm = () => {
    setHarvestDate(new Date().toISOString().split('T')[0]);
    setWeightKg('');
    setBatchId('');
    setNotes('');
    setFormError('');
  };

  const handleFloatChange = (val: string, setter: (v: string) => void) => {
    let clean = val.replace(/[^\d,]/g, '').slice(0, 12);
    const parts = clean.split(',');
    if (parts.length > 2) clean = parts[0] + ',' + parts.slice(1).join('');

    const [intPart, decPart] = clean.split(',');
    let formatted = '';
    if (intPart) {
      const noLeadingZero = intPart.replace(/^0+/, '') || '0';
      formatted = noLeadingZero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    if (decPart !== undefined) formatted += ',' + decPart;

    setter(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!harvestDate || !weightKg || !batchId) {
      setFormError('Semua field wajib diisi');
      return;
    }

    createMutation.mutate({
      harvest_date: harvestDate,
      weight_kg: parseFloat(weightKg.replace(/\./g, '').replace(',', '.')),
      baglog_batch_id: parseInt(batchId),
      notes: notes
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-3xl font-black text-black uppercase">Rekap Panen</h1>
          <p className="text-gray-700 font-bold mt-1">Catat dan pantau hasil panen harian.</p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#28e085] hover:bg-green-400">
          <Plus className="w-5 h-5 stroke-[3]" />
          Input Panen
        </Button>
      </div>

      <Card className="bg-white">
        <div className="overflow-x-auto border-4 border-black">
          <table className="w-full text-sm text-left font-bold">
            <thead className="text-xs text-black uppercase bg-gray-200 border-b-4 border-black">
              <tr>
                <th className="px-4 py-3 border-r-4 border-black">Tanggal Panen</th>
                <th className="px-4 py-3 border-r-4 border-black">Kode Batch Baglog</th>
                <th className="px-4 py-3 border-r-4 border-black">Berat (Kg)</th>
                <th className="px-4 py-3 border-r-4 border-black">Pencatat</th>
                <th className="px-4 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Memuat data...</td>
                </tr>
              ) : harvests && harvests.length > 0 ? (
                harvests.map((h: any) => (
                  <tr key={h.id} className="border-b-4 border-black last:border-0 hover:bg-gray-100 transition-colors">
                    <td className="px-4 py-3 border-r-4 border-black">{new Date(h.harvest_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</td>
                    <td className="px-4 py-3 border-r-4 border-black font-black text-black">
                      {h.baglog_batch?.batch_code || 'N/A'}
                    </td>
                    <td className="px-4 py-3 border-r-4 border-black font-black text-[#28e085] bg-slate-50">{h.weight_kg} Kg</td>
                    <td className="px-4 py-3 border-r-4 border-black text-gray-600">{h.user?.name}</td>
                    <td className="px-4 py-3 text-gray-600">{h.notes || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Belum ada data panen.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Tambah Panen */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <Card className="w-full max-w-md bg-white p-0 overflow-hidden relative">
            <div className="bg-[#28e085] p-4 border-b-4 border-black flex justify-between items-center">
              <h2 className="text-xl font-black uppercase flex items-center gap-2">
                <Sprout className="w-6 h-6 stroke-[3]" /> Input Hasil Panen
              </h2>
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="text-black hover:scale-110 active:scale-95 transition-all bg-white border-2 border-black p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            <div className="p-6">
              {formError && (
                <div className="bg-red-400 text-black font-bold border-4 border-black p-3 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label className="block text-sm font-black mb-1 uppercase">Tanggal Panen</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-black mb-1 uppercase">Pilih Batch Baglog</label>
                  <select
                    required
                    className="input-field bg-white"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                  >
                    <option value="" disabled>-- Pilih Batch --</option>
                    {activeBatches?.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.batch_code} (Umur: {b.age_days} Hari)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1 uppercase">Berat Panen (Kg)</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={15}
                      className="input-field pr-10"
                      value={weightKg}
                      onChange={(e) => handleFloatChange(e.target.value, setWeightKg)}
                      placeholder="Contoh: 15,5"
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500 font-bold">Kg</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1 uppercase">Catatan (Opsional)</label>
                  <textarea
                    className="input-field resize-none h-20"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Kondisi jamur bagus..."
                  />
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <Button variant="ghost" type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-[#28e085] hover:bg-green-400">
                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Panen'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}
