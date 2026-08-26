import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import api from '../services/api';
import { Card, Button } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';

// Types
interface BaglogBatch {
  id: number;
  batch_code: string;
  entry_date: string;
  quantity: number;
  supplier: string;
  status: 'active' | 'contaminated' | 'disposed';
  age_days: number;
}

export default function BaglogManagement() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    batchCode: string;
    batchId: number | null;
    status: string;
    message: string;
  }>({ isOpen: false, batchCode: '', batchId: null, status: '', message: '' });

  // Form State
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch Baglogs
  const { data: baglogs, isLoading } = useQuery({
    queryKey: ['baglogs', statusFilter],
    queryFn: async () => {
      const res = await api.get(`/baglogs${statusFilter ? `?status=${statusFilter}` : ''}`);
      return res.data.data; // .data (ApiResponse wrapper)
    }
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/baglogs', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baglogs'] });
      addToast('Batch baglog berhasil ditambahkan!', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Gagal menambahkan baglog.';
      setFormError(msg);
      addToast(msg, 'error');
    }
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await api.patch(`/baglogs/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baglogs'] });
      addToast('Status batch berhasil diperbarui!', 'success');
      setConfirmModal({ ...confirmModal, isOpen: false });
    },
    onError: (error: any) => {
      addToast(error.response?.data?.message || 'Gagal memperbarui status.', 'error');
    }
  });

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setQuantity('');
    setSupplier('');
    setNotes('');
    setFormError('');
  };

  const handleQuantityChange = (val: string) => {
    let clean = val.replace(/\D/g, '').slice(0, 10);
    if (!clean) { setQuantity(''); return; }
    const noLeadingZero = clean.replace(/^0+/, '') || '0';
    setQuantity(noLeadingZero.replace(/\B(?=(\d{3})+(?!\d))/g, "."));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!entryDate || !quantity || !supplier) {
      setFormError('Semua field wajib diisi');
      return;
    }

    createMutation.mutate({
      entry_date: entryDate,
      quantity: parseInt(quantity.replace(/\./g, ''), 10),
      supplier: supplier,
      notes: notes
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-[#28e085] text-black border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Aktif</span>;
      case 'contaminated':
        return <span className="px-3 py-1 bg-yellow-400 text-black border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Terkontaminasi</span>;
      case 'disposed':
        return <span className="px-3 py-1 bg-red-500 text-black border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Dibuang</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-3xl font-black text-black uppercase">Manajemen Baglog</h1>
          <p className="text-gray-700 font-bold mt-1">Pantau stok, umur, dan kondisi media tanam.</p>
        </div>

        {user?.role === 'admin' && (
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#28e085] hover:bg-green-400">
            <Plus className="w-5 h-5 stroke-[3]" />
            Tambah Batch Baru
          </Button>
        )}
      </div>

      <Card className="bg-white">
        {/* Toolbar & Filter */}
        <div className="flex items-center justify-between mb-6">
          <select
            className="input-field max-w-[200px] bg-white cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="contaminated">Terkontaminasi</option>
            <option value="disposed">Dibuang</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border-4 border-black">
          <table className="w-full text-sm text-left font-bold">
            <thead className="text-xs text-black uppercase bg-gray-200 border-b-4 border-black">
              <tr>
                <th className="px-4 py-3 border-r-4 border-black">Kode Batch</th>
                <th className="px-4 py-3 border-r-4 border-black">Tanggal Tanam</th>
                <th className="px-4 py-3 border-r-4 border-black">Umur</th>
                <th className="px-4 py-3 border-r-4 border-black">Jumlah</th>
                <th className="px-4 py-3 border-r-4 border-black">Supplier</th>
                <th className="px-4 py-3 border-r-4 border-black">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-bold">Memuat data...</td>
                </tr>
              ) : baglogs && baglogs.length > 0 ? (
                baglogs.map((batch: BaglogBatch) => (
                  <tr key={batch.id} className="border-b-4 border-black last:border-0 hover:bg-gray-100 transition-colors">
                    <td className="px-4 py-3 font-black text-black border-r-4 border-black">{batch.batch_code}</td>
                    <td className="px-4 py-3 border-r-4 border-black">{new Date(batch.entry_date).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 border-r-4 border-black">
                      <span className={`font-black whitespace-nowrap inline-block ${batch.age_days >= 30 ? 'text-red-600 bg-red-100 px-2 py-1 border-2 border-black' : 'text-black'}`}>
                        {batch.age_days} Hari
                      </span>
                    </td>
                    <td className="px-4 py-3 border-r-4 border-black font-black">{batch.quantity}</td>
                    <td className="px-4 py-3 border-r-4 border-black text-gray-700">{batch.supplier}</td>
                    <td className="px-4 py-3 border-r-4 border-black">{getStatusBadge(batch.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {/* Action Dropdown Alternative using quick buttons */}
                      <div className="flex items-center justify-end gap-2">
                        {batch.status === 'active' && (
                          <>
                            <button
                              className="group relative p-1.5 bg-yellow-400 text-black border-2 border-black hover:bg-yellow-300 active:translate-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all"
                              onClick={() => setConfirmModal({
                                isOpen: true,
                                batchCode: batch.batch_code,
                                batchId: batch.id,
                                status: 'contaminated',
                                message: 'Tandai media tanam ini sebagai rusak atau gagal tumbuh?'
                              })}
                            >
                              <AlertTriangle className="w-5 h-5 stroke-[3]" />
                              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 border-2 border-black bg-white text-black font-black text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                Tandai Terkontaminasi
                                <div className="absolute top-1/2 -translate-y-1/2 left-full border-[6px] border-transparent border-l-black"></div>
                              </div>
                            </button>

                            <button
                              className="group relative p-1.5 bg-red-500 text-black border-2 border-black hover:bg-red-400 active:translate-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all"
                              onClick={() => setConfirmModal({
                                isOpen: true,
                                batchCode: batch.batch_code,
                                batchId: batch.id,
                                status: 'disposed',
                                message: 'Tandai baglog ini sudah dibongkar karena masa panen habis?'
                              })}
                            >
                              <Trash2 className="w-5 h-5 stroke-[3]" />
                              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 border-2 border-black bg-white text-black font-black text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                Tandai Dibuang
                                <div className="absolute top-1/2 -translate-y-1/2 left-full border-[6px] border-transparent border-l-black"></div>
                              </div>
                            </button>
                          </>
                        )}
                        {batch.status !== 'active' && (
                          <button
                            className="group relative p-1.5 bg-[#28e085] text-black border-2 border-black hover:bg-green-400 active:translate-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all"
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              batchCode: batch.batch_code,
                              batchId: batch.id,
                              status: 'active',
                              message: 'Kembalikan status batch ini menjadi aktif?'
                            })}
                          >
                            <RefreshCw className="w-5 h-5 stroke-[3]" />
                            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-1.5 border-2 border-black bg-white text-black font-black text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              Kembalikan ke Aktif
                              <div className="absolute top-1/2 -translate-y-1/2 left-full border-[6px] border-transparent border-l-black"></div>
                            </div>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-bold">Tidak ada batch ditemukan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Tambah Batch */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <Card className="w-full max-w-lg bg-white p-0 overflow-hidden relative">
            <div className="bg-[#28e085] p-4 border-b-4 border-black flex justify-between items-center">
              <h2 className="text-xl font-black uppercase flex items-center gap-2">
                <Plus className="w-6 h-6 stroke-[3]" /> Tambah Batch Baru
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
                  <label className="block text-sm font-black mb-1 uppercase">Tanggal Tanam</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black mb-1 uppercase">Jumlah (Baglog)</label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      className="input-field"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder="Contoh: 1.000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black mb-1 uppercase">Nama Supplier</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Toko Jamur Makmur"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1 uppercase">Catatan Tambahan (Opsional)</label>
                  <textarea
                    className="input-field resize-none h-20"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Kondisi media tanam sedikit lembab..."
                  />
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <Button variant="ghost" type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-[#28e085] hover:bg-green-400">
                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Batch'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>,
        document.body
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <Card className="w-full max-w-sm bg-white p-0 border-4 border-black overflow-hidden relative">
            <div className={`p-4 border-b-4 border-black flex justify-center items-center ${confirmModal.status === 'contaminated' ? 'bg-yellow-400 text-black' :
                confirmModal.status === 'disposed' ? 'bg-red-500 text-black' :
                  'bg-[#28e085] text-black'
              }`}>
              {confirmModal.status === 'contaminated' ? <AlertTriangle className="w-12 h-12 stroke-[3]" /> :
                confirmModal.status === 'disposed' ? <Trash2 className="w-12 h-12 stroke-[3]" /> :
                  <RefreshCw className="w-12 h-12 stroke-[3]" />}
            </div>

            <div className="p-6 text-center">
              <h3 className="text-2xl font-black mb-2 text-black uppercase">Konfirmasi Aksi</h3>
              <p className="text-gray-700 font-bold mb-6">
                Yakin ingin mengubah status <span className="font-black text-black bg-gray-200 px-2 border-2 border-black">{confirmModal.batchCode}</span>?
                <br /><br />
                {confirmModal.message}
              </p>

              <div className="flex w-full gap-3">
                <Button
                  variant="ghost"
                  className="flex-1 border-4 border-black"
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                >
                  Batal
                </Button>
                <Button
                  className={`flex-1 ${confirmModal.status === 'contaminated' ? 'bg-yellow-400 hover:bg-yellow-300' :
                      confirmModal.status === 'disposed' ? 'bg-red-500 hover:bg-red-400' :
                        'bg-[#28e085] hover:bg-green-400'
                    }`}
                  disabled={updateStatusMutation.isPending}
                  onClick={() => updateStatusMutation.mutate({ id: confirmModal.batchId!, status: confirmModal.status })}
                >
                  {updateStatusMutation.isPending ? 'Proses...' : 'Ya, Lanjutkan'}
                </Button>
              </div>
            </div>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}
