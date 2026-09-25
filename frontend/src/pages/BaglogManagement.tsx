import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  Trash2, 
  Layers, 
  Package, 
  Search, 
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import AnimatedNumber from '../components/AnimatedNumber';
import AnimatedProgressBar from '../components/AnimatedProgressBar';

// Data Contract Interface
interface BaglogBatch {
  id: number;
  batch_code: string;
  entry_date: string;
  quantity: number;
  supplier: string;
  status: 'active' | 'contaminated' | 'disposed';
  notes?: string | null;
  age_days: number;
  created_at?: string;
}

export default function BaglogManagement() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'contaminated' | 'disposed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State (10 batch per halaman)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Reset ke halaman 1 saat filter status atau kata kunci pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  // Create Batch Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Status Change Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    batchCode: string;
    batchId: number | null;
    status: 'active' | 'contaminated' | 'disposed';
    title: string;
    description: string;
    actionLabel: string;
    statusNotes: string;
  }>({
    isOpen: false,
    batchCode: '',
    batchId: null,
    status: 'active',
    title: '',
    description: '',
    actionLabel: '',
    statusNotes: '',
  });

  // Query: Fetch All Baglog Batches
  const { data: baglogs = [], isLoading } = useQuery<BaglogBatch[]>({
    queryKey: ['baglogs'],
    queryFn: async () => {
      const res = await api.get('/baglogs');
      return res.data.data || [];
    },
  });

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalBatches = baglogs.length;
    const activeBatches = baglogs.filter((b) => b.status === 'active');
    const activeQuantity = activeBatches.reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    const contaminatedQuantity = baglogs
      .filter((b) => b.status === 'contaminated')
      .reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    const disposedQuantity = baglogs
      .filter((b) => b.status === 'disposed')
      .reduce((acc, b) => acc + Number(b.quantity || 0), 0);

    const maxCapacity = 3000;
    const capacityPercentage = Math.min(100, Math.round((activeQuantity / maxCapacity) * 100));

    const avgAge = activeBatches.length > 0
      ? Math.round(activeBatches.reduce((acc, b) => acc + Number(b.age_days || 0), 0) / activeBatches.length)
      : 0;

    let dominantStage = 'Masa Kosong';
    if (activeBatches.length > 0) {
      if (avgAge < 30) dominantStage = 'Fase Inkubasi Miselium';
      else if (avgAge <= 90) dominantStage = 'Fase Produktif Panen (Prime)';
      else dominantStage = 'Fase Akhir / Waspada Afkir';
    }

    return {
      totalBatches,
      activeBatchesCount: activeBatches.length,
      activeQuantity,
      contaminatedQuantity,
      disposedQuantity,
      totalAfkir: contaminatedQuantity + disposedQuantity,
      capacityPercentage,
      maxCapacity,
      avgAge,
      dominantStage,
    };
  }, [baglogs]);

  // Filtered List based on search and tab
  const filteredBatches = useMemo(() => {
    return baglogs.filter((batch) => {
      const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        batch.batch_code.toLowerCase().includes(q) ||
        (batch.supplier && batch.supplier.toLowerCase().includes(q)) ||
        (batch.notes && batch.notes.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [baglogs, statusFilter, searchQuery]);

  // Kalkulasi Pagination Per 10 Batch
  const totalItems = filteredBatches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedBatches = filteredBatches.slice(startIndex, endIndex);

  // Mutation: Create Baglog
  const createMutation = useMutation({
    mutationFn: async (payload: { entry_date: string; quantity: number; supplier: string; notes?: string }) => {
      const res = await api.post('/baglogs', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baglogs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Batch baglog baru berhasil didaftarkan ke kumbung!', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Gagal menambahkan batch baglog.';
      setFormError(msg);
      addToast(msg, 'error');
    },
  });

  // Mutation: Update Status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await api.patch(`/baglogs/${id}/status`, { status, notes });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baglogs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Status batch baglog berhasil diperbarui!', 'success');
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (error: any) => {
      addToast(error.response?.data?.message || 'Gagal mengubah status batch.', 'error');
    },
  });

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setQuantity('');
    setSupplier('');
    setNotes('');
    setFormError('');
  };

  const handleQuantityChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 8);
    if (!clean) {
      setQuantity('');
      return;
    }
    const noLeadingZero = clean.replace(/^0+/, '') || '0';
    setQuantity(noLeadingZero.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  };

  const handleSubmitNewBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryDate || !quantity || !supplier) {
      setFormError('Tanggal tanam, jumlah baglog, dan supplier wajib diisi.');
      return;
    }

    const numericQty = parseInt(quantity.replace(/\./g, ''), 10);
    if (isNaN(numericQty) || numericQty <= 0) {
      setFormError('Jumlah baglog harus berupa angka lebih dari 0.');
      return;
    }

    createMutation.mutate({
      entry_date: entryDate,
      quantity: numericQty,
      supplier: supplier.trim(),
      notes: notes.trim() || undefined,
    });
  };

  // Helper: Umur Media Baglog Badge
  const renderAgeBadge = (ageDays: number) => {
    if (ageDays < 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e8f4fd] dark:bg-[#0f283d] text-[#0284c7] dark:text-[#38bdf8] border border-[#bae6fd] dark:border-[#0369a1]" title="Fase Inkubasi Miselium (0-29 Hari)">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7] dark:bg-[#38bdf8]"></span>
          {ageDays} Hari • Inkubasi
        </span>
      );
    }
    if (ageDays <= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eaf5ef] dark:bg-[#143221] text-[#15803d] dark:text-[#86efac] border border-[#86efac] dark:border-[#225737]" title="Masa Produktif Panen (30-90 Hari)">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] dark:bg-[#86efac]"></span>
          {ageDays} Hari • Produktif
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fffbeb] dark:bg-[#332205] text-[#b45309] dark:text-[#fbbf24] border border-[#fde68a] dark:border-[#78350f]" title="Masa Akhir / Rawan Kontaminasi (>90 Hari)">
        <span className="w-1.5 h-1.5 rounded-full bg-[#b45309] dark:bg-[#fbbf24]"></span>
        {ageDays} Hari • Tua (Afkir)
      </span>
    );
  };

  // Helper: Status Badge
  const renderStatusBadge = (status: 'active' | 'contaminated' | 'disposed') => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#e8f4ed] dark:bg-[#143221] text-[#1e5236] dark:text-[#86efac] border border-[#a5d1b7] dark:border-[#225737]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Aktif
          </span>
        );
      case 'contaminated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#fffbeb] dark:bg-[#332205] text-[#92400e] dark:text-[#fbbf24] border border-[#fcd34d] dark:border-[#78350f]">
            <AlertTriangle className="w-3 h-3 text-[#d97706] dark:text-[#fbbf24]" />
            Terkontaminasi
          </span>
        );
      case 'disposed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#fef2f2] dark:bg-[#381111] text-[#991b1b] dark:text-[#f87171] border border-[#fecaca] dark:border-[#7f1d1d]">
            <Trash2 className="w-3 h-3 text-[#dc2626] dark:text-[#f87171]" />
            Dibuang / Afkir
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
            Manajemen Baglog Kumbung
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#486356] dark:text-[#a3c9b4] mt-0.5">
            Monitoring populasi, masa produktif, dan kesehatan media tanam jamur kuping
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="self-start sm:self-auto bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] active:scale-[0.98] text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Batch Baru</span>
          </button>
        )}
      </div>

      {/* 4 Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* KPI 1: Baglog Aktif */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Baglog Aktif</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-[#eaf5ef] dark:bg-[#163321] px-2 py-0.5 rounded-md border border-[#a5d1b7] dark:border-[#235839]">
              {metrics.capacityPercentage}% Kapasitas
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.activeQuantity}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Baglog</span>
            </div>
            
            {/* Kapasitas Progress Bar Beranimasi */}
            <AnimatedProgressBar percentage={metrics.capacityPercentage} />
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Dari kapasitas maks. {metrics.maxCapacity.toLocaleString('id-ID')} baglog kumbung
            </p>
          </div>
        </div>

        {/* KPI 2: Total Batch Terdaftar */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Batch Terdaftar</span>
            </div>
            <span className="text-[11px] font-bold text-[#244b37] dark:text-[#86efac] bg-slate-100 dark:bg-[#1a2e22] px-2 py-0.5 rounded-md">
              Siklus Tanam
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.totalBatches}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Kelompok Batch</span>
            </div>
            <p className="text-xs font-bold text-[#2e7d52] dark:text-[#4ade80] mt-1">
              {metrics.activeBatchesCount} Batch Aktif Produktif
            </p>
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Tiap batch memiliki rotasi panen independen
            </p>
          </div>
        </div>

        {/* KPI 3: Rata-rata Umur Media */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Rata-rata Umur</span>
            </div>
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 bg-[#e8f4fd] dark:bg-[#0f283d] px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
              Media Aktif
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.avgAge}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Hari Sejak Tanam</span>
            </div>
            <p className="text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] mt-1">
              {metrics.dominantStage}
            </p>
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Jamur kuping optimal dipanen umur 30–90 hari
            </p>
          </div>
        </div>

        {/* KPI 4: Total Afkir & Terkontaminasi */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#fff1f2] dark:bg-[#381111] text-[#e11d48] dark:text-[#f87171] flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Media Afkir / Rusak</span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              metrics.totalAfkir > 0 ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
            }`}>
              {metrics.totalAfkir > 0 ? 'Perlu Dibuang' : 'Steril'}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.totalAfkir}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Baglog</span>
            </div>
            <p className={`text-xs font-bold mt-1 ${metrics.contaminatedQuantity > 0 ? 'text-[#e05345] dark:text-rose-400' : 'text-[#2e7d52] dark:text-[#4ade80]'}`}>
              {metrics.contaminatedQuantity} Terkontaminasi • {metrics.disposedQuantity} Dibuang
            </p>
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Segera pisahkan media hijau agar tidak menular
            </p>
          </div>
        </div>

      </div>

      {/* Main Table Card with Integrated Search & Filter Controls */}
      <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-5">
        
        {/* Toolbar: Search + Segmented Status Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Segmented Filter Pills */}
          <div className="bg-[#d7ebe0] dark:bg-[#182c20] rounded-full p-1 flex items-center text-xs font-semibold overflow-x-auto self-start md:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              Semua ({baglogs.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Aktif ({baglogs.filter((b) => b.status === 'active').length})
            </button>
            <button
              onClick={() => setStatusFilter('contaminated')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'contaminated'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Terkontaminasi ({baglogs.filter((b) => b.status === 'contaminated').length})
            </button>
            <button
              onClick={() => setStatusFilter('disposed')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'disposed'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Dibuang ({baglogs.filter((b) => b.status === 'disposed').length})
            </button>
          </div>

          {/* Search Input Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[#759183] dark:text-[#6b8a78] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode batch atau supplier..."
              className="w-full pl-10 pr-4 py-2 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#16271c] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] placeholder:text-[#8ca497] dark:placeholder:text-[#526a5e] outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#759183] dark:text-[#6b8a78] hover:text-[#192e22] dark:hover:text-[#e4efe8]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Modern Baglog Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#e4efe8] dark:border-[#1e382b]">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#e4efe8] dark:border-[#1e382b] bg-[#f7faf8] dark:bg-[#111c15] text-[#486356] dark:text-[#a3c9b4] font-bold">
                <th className="py-3 px-4">Kode Batch</th>
                <th className="py-3 px-4">Tanggal Tanam</th>
                <th className="py-3 px-4">Umur &amp; Fase</th>
                <th className="py-3 px-4">Jumlah Baglog</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Catatan</th>
                <th className="py-3 px-4">Status</th>
                {user?.role === 'admin' && (
                  <th className="py-3 px-4 text-right">Aksi Cepat</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf5f0] dark:divide-[#1a3023]">
              {isLoading ? (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 8 : 7} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#2e7d52]" />
                      <span>Memuat data media tanam kumbung...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedBatches.length > 0 ? (
                paginatedBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-[#f7faf8]/80 dark:hover:bg-[#192b20]/60 transition-colors">
                    
                    {/* Kode Batch */}
                    <td className="py-3 px-4 font-bold text-[#192e22] dark:text-[#e4efe8]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <span>{batch.batch_code}</span>
                      </div>
                    </td>

                    {/* Tanggal Tanam */}
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                      {new Date(batch.entry_date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Umur & Fase */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderAgeBadge(batch.age_days)}
                    </td>

                    {/* Jumlah Baglog */}
                    <td className="py-3 px-4 font-bold text-[#192e22] dark:text-[#e4efe8]">
                      {Number(batch.quantity).toLocaleString('id-ID')} <span className="font-medium text-slate-500 dark:text-slate-400 text-[11px]">Unit</span>
                    </td>

                    {/* Supplier */}
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {batch.supplier || 'Mandiri / Produksi Sendiri'}
                    </td>

                    {/* Catatan */}
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={batch.notes || '-'}>
                      {batch.notes || <span className="text-slate-300 dark:text-slate-600">-</span>}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(batch.status)}
                    </td>

                    {/* Aksi Cepat (Admin Only) */}
                    {user?.role === 'admin' && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {batch.status === 'active' ? (
                            <>
                              {/* Tombol Tandai Terkontaminasi */}
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    isOpen: true,
                                    batchCode: batch.batch_code,
                                    batchId: batch.id,
                                    status: 'contaminated',
                                    title: 'Tandai Batch Terkontaminasi',
                                    description: `Apakah batch ${batch.batch_code} mengalami kontaminasi (jamur hijau/bakteri lendir)? Media akan dipisahkan dari populasi aktif.`,
                                    actionLabel: 'Tandai Terkontaminasi',
                                    statusNotes: '',
                                  })
                                }
                                title="Tandai batch ini terkontaminasi"
                                className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Tandai Dibuang / Afkir */}
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    isOpen: true,
                                    batchCode: batch.batch_code,
                                    batchId: batch.id,
                                    status: 'disposed',
                                    title: 'Bongkar & Afkir Media Tanam',
                                    description: `Apakah seluruh baglog pada batch ${batch.batch_code} sudah habis masa produktifnya dan akan dibongkar dari rak kumbung?`,
                                    actionLabel: 'Afkir & Buang',
                                    statusNotes: '',
                                  })
                                }
                                title="Bongkar & buang baglog afkir"
                                className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            /* Tombol Kembalikan ke Aktif */
                            <button
                              onClick={() =>
                                setConfirmModal({
                                  isOpen: true,
                                  batchCode: batch.batch_code,
                                  batchId: batch.id,
                                  status: 'active',
                                  title: 'Reaktivasi Batch Baglog',
                                  description: `Kembalikan batch ${batch.batch_code} ke daftar populasi baglog produktif?`,
                                  actionLabel: 'Kembalikan ke Aktif',
                                  statusNotes: '',
                                  })
                              }
                              title="Kembalikan status ke Aktif"
                              className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Reaktivasi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 8 : 7} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">Tidak ada data batch yang sesuai.</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {searchQuery ? 'Coba gunakan kata kunci pencarian yang berbeda.' : 'Belum ada batch dengan status yang dipilih.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Info & Legend */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-[#759183] dark:text-[#6b8a78] font-medium gap-2 pt-2 border-t border-slate-100 dark:border-[#1e382b]">
          <span>
            {totalItems > 0 ? (
              <>
                Menampilkan <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{startIndex + 1}–{endIndex}</span> dari <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{totalItems}</span> total batch
              </>
            ) : (
              'Menampilkan 0 batch'
            )}
            {totalItems > 0 && (
              <span className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4] ml-2 hidden sm:inline">
                • Halaman {safeCurrentPage} dari {totalPages}
              </span>
            )}
          </span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0284c7]"></span>
              &lt; 30 Hari: Inkubasi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#15803d]"></span>
              30–90 Hari: Produktif
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#b45309]"></span>
              &gt; 90 Hari: Rawan Afkir
            </span>
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-1.5 pt-2">
            {/* Tombol Halaman Sebelumnya */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-xl border border-[#d6e9df] dark:border-[#1e382b] bg-white dark:bg-[#142219] text-[#244b37] dark:text-[#86efac] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Tombol Angka Halaman */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  safeCurrentPage === pageNum
                    ? 'bg-[#244b37] dark:bg-[#1f3a2b] text-white dark:text-[#86efac] shadow-xs'
                    : 'bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] text-[#486356] dark:text-[#a3c9b4] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                }`}
              >
                {pageNum}
              </button>
            ))}

            {/* Tombol Halaman Berikutnya */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-xl border border-[#d6e9df] dark:border-[#1e382b] bg-white dark:bg-[#142219] text-[#244b37] dark:text-[#86efac] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

      {/* Modal: Tambah Batch Baglog Baru (Modern Glassmorphism) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e4efe8] dark:border-[#1e382b] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                  <Package className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">Tambah Batch Baglog Baru</h2>
                  <p className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4]">Registrasi media tanam yang baru masuk ke dalam kumbung</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1b3324] text-slate-400 hover:text-slate-700 dark:hover:text-[#e4efe8] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 rounded-2xl p-3 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitNewBatch} className="space-y-4">
              
              {/* Row 1: Tanggal Masuk & Jumlah */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                    Tanggal Masuk / Tanam <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#16271c] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                    Jumlah Baglog (Unit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    placeholder="Contoh: 500"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#16271c] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Supplier Media */}
              <div>
                <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                  Supplier / Asal Bibit Baglog <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Nama supplier bibit atau kumbung asal..."
                  required
                  className="w-full px-3.5 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#16271c] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] outline-none transition-all"
                />
                {/* Quick Supplier Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-[#759183] dark:text-[#6b8a78] font-medium">Saran Cepat:</span>
                  {['Pak Haji Baglog', 'CV Jamur Makmur', 'UD Baglog Sejahtera', 'Mandiri'].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSupplier(s)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#e8f4ed] dark:bg-[#1b3324] hover:bg-[#d8ece1] dark:hover:bg-[#244531] text-[#244b37] dark:text-[#86efac] border border-[#c2e2d0] dark:border-[#2a5a3d] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Catatan Kumbung / Lokasi Rak */}
              <div>
                <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Rak A sisi timur, bibit serbuk kayu sengon F3..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#16271c] rounded-2xl text-xs font-medium text-[#192e22] dark:text-[#e4efe8] outline-none transition-all resize-none"
                />
              </div>

              {/* Automatic Batch Code Preview Box */}
              <div className="bg-[#f0f7f2] dark:bg-[#162a1f] border border-[#c7e4d3] dark:border-[#235839] rounded-2xl p-3 text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#1c4832] dark:text-[#86efac] text-[11px]">Format Penamaan Kode Batch Otomatis</p>
                  <p className="text-[10px] text-[#4d735f] dark:text-[#a3c9b4] mt-0.5">Sistem akan men-generate kode otomatis sesuai tanggal tanam</p>
                </div>
                <span className="font-mono font-bold text-xs bg-white dark:bg-[#142219] text-[#244b37] dark:text-[#86efac] px-2.5 py-1 rounded-xl border border-[#c7e4d3] dark:border-[#235839] shadow-2xs">
                  BL-{entryDate.replace(/-/g, '')}-XXX
                </span>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-[#486356] dark:text-[#a3c9b4] hover:bg-slate-100 dark:hover:bg-[#1b3324] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] text-white shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Batch Baglog</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Ubah Status Batch */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmModal.status === 'contaminated'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : confirmModal.status === 'disposed'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              }`}>
                {confirmModal.status === 'contaminated' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : confirmModal.status === 'disposed' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-mono">{confirmModal.batchCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmModal.description}
            </p>

            {/* Input Alasan Opsional jika Afkir atau Kontaminasi */}
            {confirmModal.status !== 'active' && (
              <div>
                <label className="block text-[11px] font-bold text-[#192e22] dark:text-[#e4efe8] mb-1">
                  Catatan Tambahan / Alasan Afkir (Opsional)
                </label>
                <input
                  type="text"
                  value={confirmModal.statusNotes}
                  onChange={(e) =>
                    setConfirmModal((prev) => ({ ...prev, statusNotes: e.target.value }))
                  }
                  placeholder="Misal: Jamur hijau merambat pada rak C-02..."
                  className="w-full px-3 py-2 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#16271c] rounded-xl text-xs text-[#192e22] dark:text-[#e4efe8] outline-none transition-all"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1b3324] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending}
                onClick={() => {
                  if (confirmModal.batchId) {
                    updateStatusMutation.mutate({
                      id: confirmModal.batchId,
                      status: confirmModal.status,
                      notes: confirmModal.statusNotes.trim() || undefined,
                    });
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  confirmModal.status === 'contaminated'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : confirmModal.status === 'disposed'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341]'
                }`}
              >
                {updateStatusMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmModal.actionLabel}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
