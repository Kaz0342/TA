import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Banknote } from 'lucide-react';
import api from '../services/api';
import { Card, Button } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { Navigate } from 'react-router-dom';

export default function SalesManagement() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Form State
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantityKg, setQuantityKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [formError, setFormError] = useState('');

  // Hanya admin yang bisa akses halaman sales
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Fetch Sales
  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data.data;
    }
  });

  // Fetch Weekly Report
  const { data: weeklyReport } = useQuery({
    queryKey: ['salesWeeklyReport', weekOffset],
    queryFn: async () => {
      const res = await api.get(`/sales/weekly-report?offset=${weekOffset}`);
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/sales', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['salesWeeklyReport'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Data penjualan berhasil disimpan!', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Gagal menyimpan data penjualan.';
      setFormError(msg);
      addToast(msg, 'error');
    }
  });

  const resetForm = () => {
    setSaleDate(new Date().toISOString().split('T')[0]);
    setQuantityKg('');
    setPricePerKg('');
    setBuyerName('');
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

  const handleIntegerChange = (val: string, setter: (v: string) => void) => {
    let clean = val.replace(/\D/g, '').slice(0, 10);
    if (!clean) { setter(''); return; }
    const noLeadingZero = clean.replace(/^0+/, '') || '0';
    setter(noLeadingZero.replace(/\B(?=(\d{3})+(?!\d))/g, "."));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!saleDate || !quantityKg || !pricePerKg || !buyerName) {
      setFormError('Semua field wajib diisi');
      return;
    }

    createMutation.mutate({
      sale_date: saleDate,
      quantity_kg: parseFloat(quantityKg.replace(/\./g, '').replace(',', '.')),
      price_per_kg: parseInt(pricePerKg.replace(/\./g, ''), 10),
      buyer_name: buyerName
    });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-3xl font-black text-black uppercase">Penjualan & Keuangan</h1>
          <p className="text-gray-700 font-bold mt-1">Catat transaksi dan pantau performa cuan mingguan.</p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#28e085] hover:bg-green-400">
          <Plus className="w-5 h-5 stroke-[3]" />
          Input Penjualan
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Weekly Report Card */}
        <Card className="lg:col-span-1 bg-[#28e085]">
          <div className="flex justify-between items-center mb-4 border-b-4 border-black pb-2">
            <h2 className="text-xl font-black flex items-center gap-2 text-black uppercase">
              <Banknote className="w-6 h-6 stroke-[3]" /> Laporan {weekOffset === 0 ? 'Minggu Ini' : `${weekOffset} Minggu Lalu`}
            </h2>
            <select
              value={weekOffset}
              onChange={(e) => setWeekOffset(Number(e.target.value))}
              className="text-xs font-black text-black border-2 border-black p-1 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 focus:outline-none cursor-pointer uppercase"
            >
              <option value={0}>Minggu Ini</option>
              <option value={1}>1 Minggu Lalu</option>
              <option value={2}>2 Minggu Lalu</option>
              <option value={3}>3 Minggu Lalu</option>
              <option value={4}>4 Minggu Lalu</option>
            </select>
          </div>

          <div className="space-y-4 bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div>
              <p className="text-xs font-black text-black uppercase bg-yellow-400 inline-block px-2 border-2 border-black mb-1">Panen (Masuk)</p>
              <p className="text-2xl font-black text-black">{parseFloat(weeklyReport?.total_harvest_kg || 0).toFixed(2)} Kg</p>
            </div>
            <div>
              <p className="text-xs font-black text-black uppercase bg-[#60a5fa] inline-block px-2 border-2 border-black mb-1">Terjual (Keluar)</p>
              <p className="text-2xl font-black text-black">{parseFloat(weeklyReport?.total_sales_kg || 0).toFixed(2)} Kg</p>
            </div>

            <div className="pt-4 border-t-4 border-black mt-2">
              <p className="text-xs font-black text-black uppercase mb-1">Sisa Stok Panen</p>
              <p className={`text-3xl font-black ${(parseFloat(weeklyReport?.total_harvest_kg || 0) - parseFloat(weeklyReport?.total_sales_kg || 0)) < 0 ? 'text-red-500 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]' : 'text-black'}`}>
                {(parseFloat(weeklyReport?.total_harvest_kg || 0) - parseFloat(weeklyReport?.total_sales_kg || 0)).toFixed(2)} Kg
              </p>
              {(parseFloat(weeklyReport?.total_harvest_kg || 0) - parseFloat(weeklyReport?.total_sales_kg || 0)) < 0 && (
                <p className="text-xs font-black bg-red-500 text-white border-2 border-black p-2 mt-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Warning: Stok terambil dari minggu sebelumnya.</p>
              )}
            </div>
          </div>
        </Card>

        {/* Sales Table */}
        <Card className="lg:col-span-2">
          <h2 className="text-2xl font-black text-black mb-6 uppercase border-b-4 border-black pb-2">Riwayat Penjualan</h2>
          <div className="overflow-x-auto border-4 border-black">
            <table className="w-full text-sm text-left font-bold">
              <thead className="text-xs text-black uppercase bg-gray-200 border-b-4 border-black">
                <tr>
                  <th className="px-4 py-3 border-r-4 border-black">Tanggal</th>
                  <th className="px-4 py-3 border-r-4 border-black">Pembeli</th>
                  <th className="px-4 py-3 border-r-4 border-black">Jumlah</th>
                  <th className="px-4 py-3 border-r-4 border-black">Harga/Kg</th>
                  <th className="px-4 py-3 bg-yellow-400">Total Pemasukan</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Memuat data...</td>
                  </tr>
                ) : sales && sales.length > 0 ? (
                  sales.map((s: any) => (
                    <tr key={s.id} className="border-b-4 border-black last:border-0 hover:bg-gray-100 transition-colors">
                      <td className="px-4 py-3 border-r-4 border-black">{new Date(s.sale_date).toLocaleDateString('id-ID')}</td>
                      <td className="px-4 py-3 border-r-4 border-black font-black text-black">{s.buyer_name || '-'}</td>
                      <td className="px-4 py-3 border-r-4 border-black">{s.quantity_kg} Kg</td>
                      <td className="px-4 py-3 border-r-4 border-black text-gray-600">{formatCurrency(s.price_per_kg)}</td>
                      <td className="px-4 py-3 font-black text-[#28e085] bg-slate-50">
                        {formatCurrency(s.total_revenue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Belum ada data penjualan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal Tambah Penjualan */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <Card className="w-full max-w-md bg-white p-0 overflow-hidden relative">
            <div className="bg-[#28e085] p-4 border-b-4 border-black flex justify-between items-center">
              <h2 className="text-xl font-black uppercase flex items-center gap-2">
                <Banknote className="w-6 h-6 stroke-[3]" /> Input Penjualan
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
                  <label className="block text-sm font-black mb-1 uppercase">Tanggal Transaksi</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-black mb-1 uppercase">Nama Pembeli / Pengepul</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Misal: Pengepul Pasar Induk"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black mb-1 uppercase">Jumlah (Kg)</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={15}
                        className="input-field pr-10"
                        value={quantityKg}
                        onChange={(e) => handleFloatChange(e.target.value, setQuantityKg)}
                        placeholder="Contoh: 10,5"
                      />
                      <span className="absolute right-3 top-2.5 text-gray-500 font-bold">Kg</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-black mb-1 uppercase">Harga per Kg</label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      className="input-field"
                      value={pricePerKg}
                      onChange={(e) => handleIntegerChange(e.target.value, setPricePerKg)}
                      placeholder="Contoh: 15.000"
                    />
                  </div>
                </div>

                {/* Real-time calculation */}
                {(quantityKg && pricePerKg) ? (
                  <div className="p-3 bg-yellow-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center mt-2">
                    <span className="text-sm font-black uppercase">Estimasi Pendapatan:</span>
                    <span className="font-black text-xl text-black">
                      {formatCurrency(parseFloat(quantityKg.replace(/\./g, '').replace(',', '.')) * parseInt(pricePerKg.replace(/\./g, ''), 10))}
                    </span>
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 mt-8">
                  <Button variant="ghost" type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-[#28e085] hover:bg-green-400">
                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Transaksi'}
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
