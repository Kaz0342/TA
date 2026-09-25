import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  Scale, 
  X, 
  RefreshCw, 
  Calendar, 
  Search, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Layers, 
  User, 
  Banknote,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { useThemeStore } from '../stores/themeStore';
import AnimatedNumber from '../components/AnimatedNumber';
import AnimatedProgressBar from '../components/AnimatedProgressBar';

interface HarvestRecord {
  id: number;
  user_id: number;
  baglog_batch_id: number | null;
  harvest_date: string;
  weight_kg: string | number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  baglog_batch?: {
    id: number;
    batch_code: string;
    entry_date: string;
    quantity: number;
    supplier: string;
    status: string;
    notes?: string | null;
  } | null;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface ActiveBatchOption {
  id: number;
  batch_code: string;
  entry_date: string;
  age_days?: number;
  quantity: number;
  supplier: string;
}

export default function HarvestManagement() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const { theme } = useThemeStore();

  // Filter & Search State
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [batchFilter, setBatchFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // 1. Query: All Harvest Records
  const { data: harvests = [], isLoading: isLoadingHarvests } = useQuery<HarvestRecord[]>({
    queryKey: ['harvests'],
    queryFn: async () => {
      const res = await api.get('/harvests');
      return res.data.data || [];
    },
  });

  // 2. Query: Active Baglog Batches for Dropdown
  const { data: activeBatches = [] } = useQuery<ActiveBatchOption[]>({
    queryKey: ['baglogs', 'active'],
    queryFn: async () => {
      const res = await api.get('/baglogs?status=active');
      return res.data.data || [];
    },
  });

  // 3. Query: Harvest Daily Chart (14 Hari Terakhir)
  const { data: chartData = [], isLoading: isLoadingChart } = useQuery({
    queryKey: ['harvestChart', 14],
    queryFn: async () => {
      const res = await api.get('/harvests/chart?days=14');
      return res.data.data || [];
    },
  });

  // KPI Calculations
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayHarvests = harvests.filter((h) => h.harvest_date && h.harvest_date.startsWith(todayStr));
    const todayTotalKg = todayHarvests.reduce((sum, h) => sum + Number(h.weight_kg || 0), 0);
    const dailyTargetKg = 15.0;
    const targetProgress = Math.min(100, Math.round((todayTotalKg / dailyTargetKg) * 100));

    // Bulan Ini
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthHarvests = harvests.filter((h) => {
      const d = new Date(h.harvest_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthTotalKg = thisMonthHarvests.reduce((sum, h) => sum + Number(h.weight_kg || 0), 0);
    const monthEstimatedRevenue = monthTotalKg * 25000; // Standar harga jamur kuping basah segar Rp 25.000/Kg

    // Rata-rata per sesi petik
    const avgWeightKg = harvests.length > 0
      ? Number((harvests.reduce((sum, h) => sum + Number(h.weight_kg || 0), 0) / harvests.length).toFixed(2))
      : 0;

    // Batch Kontributor
    const contributingBatchIds = new Set(harvests.map((h) => h.baglog_batch_id).filter(Boolean));

    return {
      todayTotalKg,
      dailyTargetKg,
      targetProgress,
      monthTotalKg,
      monthEstimatedRevenue,
      avgWeightKg,
      contributingBatchesCount: contributingBatchIds.size,
      totalSessions: harvests.length,
    };
  }, [harvests]);

  // Filtered List
  const filteredHarvests = useMemo(() => {
    return harvests.filter((h) => {
      // Filter Waktu
      if (timeFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!h.harvest_date || !h.harvest_date.startsWith(todayStr)) return false;
      } else if (timeFilter === 'week') {
        const harvestTime = new Date(h.harvest_date).getTime();
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (harvestTime < oneWeekAgo) return false;
      } else if (timeFilter === 'month') {
        const d = new Date(h.harvest_date);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }

      // Filter Batch
      if (batchFilter && String(h.baglog_batch_id) !== String(batchFilter)) {
        return false;
      }

      // Filter Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const batchCode = h.baglog_batch?.batch_code?.toLowerCase() || '';
        const userName = h.user?.name?.toLowerCase() || '';
        const notes = h.notes?.toLowerCase() || '';
        if (!batchCode.includes(q) && !userName.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [harvests, timeFilter, batchFilter, searchQuery]);

  // Reset pagination saat filter berubah
  React.useEffect(() => {
    setCurrentPage(1);
  }, [timeFilter, batchFilter, searchQuery]);

  // Pagination Calculations
  const totalItems = filteredHarvests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedHarvests = useMemo(() => {
    return filteredHarvests.slice(startIndex, endIndex);
  }, [filteredHarvests, startIndex, endIndex]);

  // Mutation: Create Harvest
  const createMutation = useMutation({
    mutationFn: async (payload: { harvest_date: string; weight_kg: number; baglog_batch_id?: number; notes?: string }) => {
      const res = await api.post('/harvests', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvests'] });
      queryClient.invalidateQueries({ queryKey: ['harvestChart'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Data hasil timbangan panen berhasil dicatat!', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Gagal menyimpan data panen.';
      setFormError(msg);
      addToast(msg, 'error');
    },
  });

  const resetForm = () => {
    setHarvestDate(new Date().toISOString().split('T')[0]);
    setWeightKg('');
    setSelectedBatchId('');
    setNotes('');
    setFormError('');
  };

  const handleFloatChange = (val: string) => {
    let clean = val.replace(/[^\d,.]/g, '').slice(0, 10);
    // Standarisasi titik & koma
    clean = clean.replace(',', '.');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }
    setWeightKg(clean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!harvestDate || !weightKg || !selectedBatchId) {
      setFormError('Tanggal panen, batch baglog, dan berat wajib diisi.');
      return;
    }

    const numWeight = parseFloat(weightKg);
    if (isNaN(numWeight) || numWeight <= 0) {
      setFormError('Berat panen harus berupa angka lebih dari 0.');
      return;
    }

    createMutation.mutate({
      harvest_date: harvestDate,
      weight_kg: numWeight,
      baglog_batch_id: parseInt(selectedBatchId, 10),
      notes: notes.trim() || undefined,
    });
  };

  const parsedWeight = parseFloat(weightKg) || 0;
  const liveEstimatedRevenue = parsedWeight * 25000;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
            Manajemen &amp; Rekap Hasil Panen
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#486356] dark:text-[#a3c9b4] mt-0.5">
            Pencatatan timbangan jamur kuping hitam harian &amp; analisis produktivitas baglog
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="self-start sm:self-auto bg-[#244b37] dark:bg-[#1f3a2b] hover:bg-[#1b3a2b] dark:hover:bg-[#2b503d] active:scale-[0.98] text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          <Scale className="w-4 h-4 stroke-[2.2]" />
          <span>Input Timbangan Panen</span>
        </button>
      </div>

      {/* 4 Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* KPI 1: Panen Hari Ini */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Scale className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Panen Hari Ini</span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              metrics.todayTotalKg > 0 
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' 
                : 'bg-slate-100 dark:bg-[#1f382b] text-slate-600 dark:text-[#a3c9b4]'
            }`}>
              {metrics.todayTotalKg > 0 ? `${metrics.targetProgress}% Target` : 'Belum Ditimbang'}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.todayTotalKg}
                decimals={2}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Kg Basah</span>
            </div>
            
            {/* Target Progress Bar */}
            <AnimatedProgressBar percentage={metrics.targetProgress} />
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Target panen harian: {metrics.dailyTargetKg} Kg kumbung
            </p>
          </div>
        </div>

        {/* KPI 2: Total Panen Bulan Ini */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Bulan Berjalan</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-[#eaf5ef] dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-[#a5d1b7] dark:border-emerald-800">
              Akumulasi
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.monthTotalKg}
                decimals={1}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Kg</span>
            </div>
            <p className="text-xs font-bold text-[#15803d] dark:text-[#4ade80] mt-1 flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5" />
              <span>Est. Rp <AnimatedNumber value={metrics.monthEstimatedRevenue} /></span>
            </p>
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Estimasi patokan harga pasar Rp 25.000/Kg
            </p>
          </div>
        </div>

        {/* KPI 3: Rata-rata per Petik */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Clock className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Rata-rata Petik</span>
            </div>
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 bg-[#e8f4fd] dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
              Per Sesi
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.avgWeightKg}
                decimals={2}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Kg / Sesi</span>
            </div>
            <p className="text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] mt-1">
              Dari {metrics.totalSessions} total pencatatan timbangan
            </p>
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Konsistensi panen menentukan siklus penyiraman
            </p>
          </div>
        </div>

        {/* KPI 4: Batch Kontributor */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Layers className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Batch Produktif</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-[#eaf5ef] dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-[#a5d1b7] dark:border-emerald-800">
              Kelompok Rak
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={metrics.contributingBatchesCount}
                className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
              />
              <span className="text-sm font-semibold text-[#526a5e] dark:text-[#a3c9b4]">Batch Baglog</span>
            </div>
            <p className="text-xs font-bold text-[#2e7d52] dark:text-[#4ade80] mt-1">
              Menghasilkan panen aktif di kumbung
            </p>
            <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
              Tiap batch dipantau produktivitas per baglognya
            </p>
          </div>
        </div>

      </div>

      {/* Row 2: Visualisasi Tren Panen Harian 14 Hari Terakhir vs Target 15 Kg */}
      <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#244b37] dark:text-[#86efac]" />
              <span>Tren Panen Harian (14 Hari Terakhir)</span>
            </h2>
            <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
              Fluktuasi timbangan panen jamur kuping terhadap garis batas target harian 15 Kg
            </p>
          </div>
          
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-[#14532d] dark:text-[#86efac]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803d]"></span>
              Hasil Timbangan (Kg)
            </span>
            <span className="flex items-center gap-1.5 text-[#0369a1] dark:text-[#38bdf8]">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-[#0284c7]"></span>
              Target Harian (15 Kg)
            </span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-[220px] w-full">
          {isLoadingChart ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-medium">
              Mengambil data tren panen harian...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="harvestGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme === 'dark' ? '#1f382b' : '#94a3b8'} strokeOpacity={theme === 'dark' ? 0.8 : 0.35} strokeDasharray="3 3" vertical={true} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10, fill: theme === 'dark' ? '#86efac' : '#526a5e', fontWeight: 'bold' }} 
                  axisLine={{ stroke: theme === 'dark' ? '#1e382b' : '#d6e9df' }}
                  tickLine={false}
                />
                <YAxis 
                  domain={[0, 25]} 
                  ticks={[0, 5, 10, 15, 20, 25]}
                  tick={{ fontSize: 10, fill: '#15803d', fontWeight: 'bold' }} 
                  tickFormatter={(v) => `${v}k`}
                  axisLine={{ stroke: '#86efac', strokeWidth: 1.5 }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#142219' : '#ffffff',
                    borderRadius: '16px',
                    border: `1px solid ${theme === 'dark' ? '#1e382b' : '#d6e9df'}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: theme === 'dark' ? '#e4efe8' : '#192e22',
                  }}
                  formatter={(val: any) => [
                    `${Number(val).toFixed(2)} Kg (Est. Rp ${(Number(val) * 25000).toLocaleString('id-ID')})`,
                    'Produksi Panen'
                  ]}
                />
                {/* Garis Target Harian 15 Kg */}
                <ReferenceLine 
                  y={15} 
                  stroke="#0284c7" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  label={{ value: 'Target 15 Kg', position: 'insideTopLeft', fill: '#0369a1', fontSize: 10, fontWeight: 700 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total_kg" 
                  stroke="#15803d" 
                  strokeWidth={3} 
                  fill="url(#harvestGradient)"
                  activeDot={{ r: 6, fill: '#15803d', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Data Table Card with Integrated Search & Filter Controls */}
      <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-5">
        
        {/* Toolbar: Time Range Segmented + Batch Select + Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Segmented Time Filter Pills */}
          <div className="bg-[#d7ebe0] dark:bg-[#182c20] rounded-full p-1 flex items-center text-xs font-semibold overflow-x-auto self-start lg:self-auto">
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              Semua Waktu ({harvests.length})
            </button>
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                timeFilter === 'today'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                timeFilter === 'week'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                timeFilter === 'month'
                  ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Batch Filter Dropdown */}
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-[#192e22] dark:text-[#e4efe8] text-xs font-semibold rounded-2xl px-3.5 py-2 outline-none focus:border-[#2e7d52] transition-colors shadow-2xs cursor-pointer"
            >
              <option value="">Semua Batch Baglog</option>
              {activeBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code} ({b.supplier})
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#759183] dark:text-[#a3c9b4] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari batch, petugas, catatan..."
                className="w-full pl-10 pr-4 py-2 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#182c20] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] placeholder:text-[#8ca497] dark:placeholder:text-slate-500 outline-none transition-all shadow-2xs"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#759183] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Modern Harvest Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#e4efe8] dark:border-[#1e382b]">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#e4efe8] dark:border-[#1e382b] bg-[#f7faf8] dark:bg-[#111c15] text-[#486356] dark:text-[#a3c9b4] font-bold">
                <th className="py-3 px-4">Tanggal Panen</th>
                <th className="py-3 px-4">Batch Baglog Asal</th>
                <th className="py-3 px-4">Berat Timbangan</th>
                <th className="py-3 px-4">Estimasi Valuasi</th>
                <th className="py-3 px-4">Petugas Kebun</th>
                <th className="py-3 px-4">Catatan Mutu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf5f0] dark:divide-[#1e382b]">
              {isLoadingHarvests ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#2e7d52]" />
                      <span>Memuat data hasil panen kumbung...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedHarvests.length > 0 ? (
                paginatedHarvests.map((h) => {
                  const weightNum = Number(h.weight_kg) || 0;
                  const estimatedValuation = weightNum * 25000;
                  return (
                    <tr key={h.id} className="hover:bg-[#f7faf8]/80 dark:hover:bg-[#182c20]/60 transition-colors">
                      
                      {/* Tanggal Panen */}
                      <td className="py-3 px-4 font-semibold text-[#192e22] dark:text-[#e4efe8] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac] flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <span>
                            {new Date(h.harvest_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Batch Baglog Asal */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {h.baglog_batch ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{h.baglog_batch.batch_code}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1f382b] px-2 py-0.5 rounded-md">
                              {h.baglog_batch.supplier}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Umum / Tanpa Batch</span>
                        )}
                      </td>

                      {/* Berat Timbangan (Kg) */}
                      <td className="py-3 px-4 font-bold text-[#15803d] dark:text-[#4ade80] whitespace-nowrap text-sm">
                        {weightNum.toFixed(2)} <span className="text-xs font-semibold text-[#244b37] dark:text-[#86efac]">Kg</span>
                      </td>

                      {/* Estimasi Valuasi */}
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-[#c4ded0] whitespace-nowrap">
                        Rp {estimatedValuation.toLocaleString('id-ID')}
                      </td>

                      {/* Petugas Kebun */}
                      <td className="py-3 px-4 text-slate-600 dark:text-[#a3c9b4] font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{h.user?.name ? h.user.name.replace(/\bKing\s*/gi, '').trim() || 'Admin' : 'Petugas Kebun'}</span>
                        </div>
                      </td>

                      {/* Catatan */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={h.notes || '-'}>
                        {h.notes || <span className="text-slate-300 dark:text-slate-600">-</span>}
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Scale className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400">Tidak ada catatan panen yang sesuai.</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {searchQuery ? 'Coba gunakan kata kunci pencarian yang lain.' : 'Belum ada data pada filter yang dipilih.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-[#759183] dark:text-[#6b8a78] font-medium gap-3 pt-3 border-t border-slate-100 dark:border-[#1e382b]">
          <div className="flex items-center gap-2">
            <span>
              {totalItems > 0 ? (
                <>
                  Menampilkan <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{startIndex + 1}–{endIndex}</span> dari <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{totalItems}</span> riwayat panen
                </>
              ) : (
                'Tidak ada data panen'
              )}
            </span>
            {totalItems > 0 && (
              <span className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4] hidden sm:inline">
                • Halaman {currentPage} dari {totalPages}
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              {/* Prev Button */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-[#d6e9df] dark:border-[#1e382b] bg-white dark:bg-[#142219] text-[#244b37] dark:text-[#86efac] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#244b37] dark:bg-[#1f3a2b] text-white dark:text-[#86efac] shadow-xs'
                      : 'bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] text-[#486356] dark:text-[#a3c9b4] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              {/* Next Button */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl border border-[#d6e9df] dark:border-[#1e382b] bg-white dark:bg-[#142219] text-[#244b37] dark:text-[#86efac] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Modal: Input Timbangan Panen Baru (Modern Glassmorphism) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e4efe8] dark:border-[#1e382b] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                  <Scale className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">Input Hasil Timbangan Panen</h2>
                  <p className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4]">Catat timbangan jamur kuping segar per batch kumbung</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#182c20] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl p-3 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Row 1: Tanggal Panen & Batch Baglog */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                    Tanggal Panen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#182c20] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                    Pilih Batch Baglog <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#182c20] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] outline-none transition-all cursor-pointer"
                  >
                    <option value="" disabled>-- Pilih Batch Aktif --</option>
                    {activeBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_code} ({b.supplier})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Berat Timbangan (Kg) */}
              <div>
                <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                  Berat Panen (Kg) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={weightKg}
                    onChange={(e) => handleFloatChange(e.target.value)}
                    placeholder="Contoh: 15.5 atau 8.25"
                    required
                    className="w-full pl-3.5 pr-12 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#182c20] rounded-2xl text-xs font-bold text-[#192e22] dark:text-[#e4efe8] outline-none transition-all"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#244b37] dark:text-[#86efac]">
                    Kg
                  </span>
                </div>
              </div>

              {/* Live Valuation Box */}
              {parsedWeight > 0 && (
                <div className="bg-[#f0f7f2] dark:bg-[#112419] border border-[#c7e4d3] dark:border-[#1e382b] rounded-2xl p-3 text-xs flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-[#15803d] dark:text-[#4ade80]" />
                    <div>
                      <p className="font-bold text-[#1c4832] dark:text-[#86efac] text-[11px]">Estimasi Nilai Panen (Rp 25.000/Kg)</p>
                      <p className="text-[10px] text-[#4d735f] dark:text-[#a3c9b4] mt-0.5">Valuasi komoditas jamur kuping segar</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-[#15803d] dark:text-[#4ade80]">
                    Rp {liveEstimatedRevenue.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {/* Row 3: Catatan Mutu Panen */}
              <div>
                <label className="block text-xs font-bold text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                  Catatan Mutu &amp; Kondisi Jamur (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Tudung jamur mekar rata, kadar air ideal, siap kirim ke pasar..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:border-[#2e7d52] focus:bg-white dark:focus:bg-[#182c20] rounded-2xl text-xs font-medium text-[#192e22] dark:text-[#e4efe8] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-[#486356] dark:text-[#a3c9b4] hover:bg-slate-100 dark:hover:bg-[#182c20] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#244b37] dark:bg-[#1f3a2b] hover:bg-[#1b3a2b] dark:hover:bg-[#2b503d] text-white shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Data Panen</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
