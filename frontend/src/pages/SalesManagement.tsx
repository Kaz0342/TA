import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  Banknote, 
  Plus, 
  X, 
  RefreshCw, 
  Calendar, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  Layers, 
  User, 
  Scale,
  ShoppingBag,
  Store,
  Tag,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useThemeStore } from '../stores/themeStore';
import AnimatedNumber from '../components/AnimatedNumber';

interface SaleRecord {
  id: number;
  user_id: number;
  sale_date: string;
  quantity_kg: string | number;
  price_per_kg: string | number;
  total_revenue: string | number;
  buyer_name: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface WeeklyReportData {
  period: string;
  start_date: string;
  end_date: string;
  total_harvest_kg: number;
  total_sales_kg: number;
  unsold_kg: number;
  total_revenue_idr: number;
}

const BUYER_SUGGESTIONS = [
  { name: 'Pak Joko (Pasar Induk)', category: 'Pasar Tradisional' },
  { name: 'Ibu Dewi (Toko Sayur)', category: 'Retail / Sayur Segar' },
  { name: 'Bu Sari (Resto Jamur)', category: 'Kuliner & Horeka' },
  { name: 'Mas Adi (Tengkulak)', category: 'Pengepul Komoditas' },
];

const PRICE_PRESETS = [20000, 22000, 25000, 30000, 35000];

export default function SalesManagement() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Filter & Search State
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week'>('month');
  const [buyerFilter, setBuyerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Pagination State (Per 10 transaksi)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Reset ke halaman 1 saat filter atau kata kunci pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [timeFilter, buyerFilter, searchQuery]);

  // Modal Create Transaction State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [buyerName, setBuyerName] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // 1. Query: All Sales
  const { data: sales = [], isLoading: isLoadingSales, refetch: refetchSales } = useQuery<SaleRecord[]>({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data.data || [];
    },
    enabled: user?.role === 'admin'
  });

  // 2. Query: Weekly Report with Offset
  const { data: weeklyReport, isLoading: isLoadingWeeklyReport } = useQuery<WeeklyReportData>({
    queryKey: ['salesWeeklyReport', weekOffset],
    queryFn: async () => {
      const res = await api.get(`/sales/weekly-report?offset=${weekOffset}`);
      return res.data.data;
    },
    enabled: user?.role === 'admin'
  });

  // 3. Mutation: Create Sale
  const createMutation = useMutation({
    mutationFn: async (payload: {
      sale_date: string;
      quantity_kg: number;
      price_per_kg: number;
      buyer_name: string;
      notes?: string;
    }) => {
      const res = await api.post('/sales', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['salesWeeklyReport'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Transaksi penjualan berhasil dicatat!', 'success');
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
    setBuyerName('');
    setQuantityKg('');
    setPricePerKg('');
    setNotes('');
    setFormError('');
  };

  const handleFloatChange = (val: string, setter: (v: string) => void) => {
    let clean = val.replace(/[^\d,.]/g, '').replace('.', ',');
    const parts = clean.split(',');
    if (parts.length > 2) clean = parts[0] + ',' + parts.slice(1).join('');
    setter(clean);
  };

  const handlePriceChange = (val: string) => {
    const numeric = val.replace(/\D/g, '');
    if (!numeric) {
      setPricePerKg('');
      return;
    }
    const num = parseInt(numeric, 10);
    setPricePerKg(num.toLocaleString('id-ID'));
  };

  // Helper formatting
  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Extract unique buyers for dropdown filter
  const uniqueBuyers = useMemo(() => {
    const buyers = Array.from(new Set(sales.map((s) => s.buyer_name).filter(Boolean)));
    return buyers.sort();
  }, [sales]);

  // Financial KPIs Calculations
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Bulan Ini
    const thisMonthSales = sales.filter((s) => {
      const d = new Date(s.sale_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthRevenue = thisMonthSales.reduce((sum, s) => sum + Number(s.total_revenue || 0), 0);
    const monthVolumeKg = thisMonthSales.reduce((sum, s) => sum + Number(s.quantity_kg || 0), 0);
    const monthAvgPrice = monthVolumeKg > 0 ? Math.round(monthRevenue / monthVolumeKg) : 0;

    // All Time Totals
    const totalAllRevenue = sales.reduce((sum, s) => sum + Number(s.total_revenue || 0), 0);
    const totalAllVolumeKg = sales.reduce((sum, s) => sum + Number(s.quantity_kg || 0), 0);
    const totalTransactions = sales.length;

    // Price range
    const prices = sales.map((s) => Number(s.price_per_kg)).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 20000;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 35000;

    // Average transaction size
    const avgTransactionRevenue = thisMonthSales.length > 0 
      ? Math.round(monthRevenue / thisMonthSales.length) 
      : (totalTransactions > 0 ? Math.round(totalAllRevenue / totalTransactions) : 0);

    return {
      monthRevenue,
      monthVolumeKg: Number(monthVolumeKg.toFixed(2)),
      monthTransactionsCount: thisMonthSales.length,
      monthAvgPrice,
      totalAllRevenue,
      totalAllVolumeKg: Number(totalAllVolumeKg.toFixed(2)),
      totalTransactions,
      minPrice,
      maxPrice,
      avgTransactionRevenue
    };
  }, [sales]);

  // Chart Data Preparation: Daily Revenue & Volume
  const chartData = useMemo(() => {
    if (!sales.length) return [];
    
    // Group sales by date
    const dailyMap: Record<string, { date: string; label: string; revenue: number; volume_kg: number }> = {};
    
    // Sort oldest to newest
    const sorted = [...sales].sort((a, b) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime());
    
    sorted.forEach((s) => {
      const d = new Date(s.sale_date);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      
      if (!dailyMap[key]) {
        dailyMap[key] = { date: key, label, revenue: 0, volume_kg: 0 };
      }
      dailyMap[key].revenue += Number(s.total_revenue || 0);
      dailyMap[key].volume_kg += Number(s.quantity_kg || 0);
    });

    return Object.values(dailyMap).map((d) => ({
      ...d,
      volume_kg: Number(d.volume_kg.toFixed(2))
    }));
  }, [sales]);

  // Filtered Sales Table
  const filteredSales = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return sales.filter((s) => {
      const sDate = new Date(s.sale_date);

      // Time Filter
      if (timeFilter === 'month') {
        if (sDate.getMonth() !== currentMonth || sDate.getFullYear() !== currentYear) return false;
      } else if (timeFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        if (sDate < oneWeekAgo) return false;
      }

      // Buyer Filter
      if (buyerFilter !== 'all' && s.buyer_name !== buyerFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchBuyer = s.buyer_name?.toLowerCase().includes(q);
        const matchNotes = s.notes?.toLowerCase().includes(q);
        const matchPrice = s.price_per_kg?.toString().includes(q);
        const matchRevenue = s.total_revenue?.toString().includes(q);
        if (!matchBuyer && !matchNotes && !matchPrice && !matchRevenue) return false;
      }

      return true;
    });
  }, [sales, timeFilter, buyerFilter, searchQuery]);

  // Kalkulasi Pagination Per 10 Item
  const totalItems = filteredSales.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedSales = filteredSales.slice(startIndex, endIndex);

  // Live Calculation in Modal
  const modalParsedKg = parseFloat(quantityKg.replace(',', '.')) || 0;
  const modalParsedPrice = parseInt(pricePerKg.replace(/\./g, ''), 10) || 0;
  const modalLiveRevenue = modalParsedKg * modalParsedPrice;

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!saleDate) {
      setFormError('Tanggal transaksi wajib diisi');
      return;
    }
    if (!buyerName.trim()) {
      setFormError('Nama pembeli atau pengepul wajib diisi');
      return;
    }
    if (!modalParsedKg || modalParsedKg <= 0) {
      setFormError('Jumlah berat panen (Kg) harus lebih dari 0');
      return;
    }
    if (!modalParsedPrice || modalParsedPrice <= 0) {
      setFormError('Harga per Kg harus lebih dari Rp 0');
      return;
    }

    createMutation.mutate({
      sale_date: saleDate,
      quantity_kg: modalParsedKg,
      price_per_kg: modalParsedPrice,
      buyer_name: buyerName.trim(),
      notes: notes.trim() || undefined
    });
  };

  // Guard hak akses: Hanya admin yang bisa akses halaman sales
  if (user && user.role !== 'admin') {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#192e22] dark:text-[#e4efe8]">Akses Dibatasi</h2>
        <p className="text-[#37473f] dark:text-[#a3c9b4] text-sm">
          Halaman Penjualan & Keuangan hanya dapat diakses oleh akun dengan peran <strong>Administrator</strong>. Silakan hubungi pengelola sistem.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* 1. Header & Main Actions — Pure Harmonious Sage Green */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e8f4ed] dark:bg-[#163321] text-[#244b37] dark:text-[#86efac] border border-[#d6e9df] dark:border-[#235839] text-[11px] font-semibold mb-1.5">
            <span>Akses Administrator • SCM Penjualan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
            Penjualan &amp; Rekap Keuangan
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#486356] dark:text-[#a3c9b4] mt-0.5">
            Pencatatan distribusi jamur kuping hitam ke pasar/resto, pantau neraca SCM panen vs penjualan, serta analisis omzet harian
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => refetchSales()}
            className="p-2.5 rounded-2xl bg-white dark:bg-[#142219] hover:bg-slate-50 dark:hover:bg-[#1b3324] text-[#37473f] dark:text-[#a3c9b4] border border-[#d6e9df] dark:border-[#1e382b] shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            title="Refresh Data Penjualan"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingSales ? 'animate-spin text-[#244b37] dark:text-[#86efac]' : ''}`} />
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] active:scale-[0.98] text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.2]" />
            <span>Catat Transaksi Penjualan</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Financial & SCM KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Omzet Bulan Ini */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8] mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Banknote className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Omzet Bulan Ini</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e8f4ed] dark:bg-[#1a3324] text-[#244b37] dark:text-[#86efac]">
              {metrics.monthTransactionsCount} Nota
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
            <AnimatedNumber
              value={metrics.monthRevenue}
              formatter={(val) => formatCurrency(val)}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#759183] dark:text-[#6b8a78]">
            <span>Rata-rata/Nota:</span>
            <span className="font-semibold text-[#192e22] dark:text-[#e4efe8]">
              {formatCurrency(metrics.avgTransactionRevenue)}
            </span>
          </div>
        </div>

        {/* Card 2: Volume Jamur Terjual */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8] mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Scale className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Volume Terjual</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e8f4ed] dark:bg-[#1a3324] text-[#244b37] dark:text-[#86efac]">
              Bulan Ini
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#192e22] dark:text-[#e4efe8] tracking-tight flex items-baseline gap-1.5">
            <AnimatedNumber
              value={metrics.monthVolumeKg}
              decimals={0}
            />
            <span className="text-base font-semibold text-[#759183] dark:text-[#6b8a78]">Kg</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#759183] dark:text-[#6b8a78]">
            <span>Total Kumulatif:</span>
            <span className="font-semibold text-[#192e22] dark:text-[#e4efe8]">
              {metrics.totalAllVolumeKg.toLocaleString('id-ID')} Kg
            </span>
          </div>
        </div>

        {/* Card 3: Rata-Rata Harga Jual */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8] mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <Tag className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Rata2 Harga/Kg</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f7faf8] dark:bg-[#111c15] text-[#526a5e] dark:text-[#a3c9b4] border border-[#d6e9df] dark:border-[#1e382b]">
              Pasar &amp; Resto
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#192e22] dark:text-[#e4efe8] tracking-tight flex items-baseline gap-1">
            <AnimatedNumber
              value={metrics.monthAvgPrice || 22500}
              formatter={(val) => formatCurrency(val)}
            />
            <span className="text-xs font-medium text-[#759183] dark:text-[#6b8a78]">/Kg</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#759183] dark:text-[#6b8a78]">
            <span>Rentang:</span>
            <span className="font-semibold text-[#192e22] dark:text-[#e4efe8]">
              {formatCurrency(metrics.minPrice)} – {formatCurrency(metrics.maxPrice)}
            </span>
          </div>
        </div>

        {/* Card 4: Neraca SCM Panen vs Terjual */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8] mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Neraca SCM</span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e8f4ed] dark:bg-[#1a3324] text-[#244b37] dark:text-[#86efac]">
              Mingguan
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#192e22] dark:text-[#e4efe8] tracking-tight flex items-baseline gap-1.5">
            <AnimatedNumber
              value={weeklyReport?.unsold_kg ?? 0}
              decimals={2}
            />
            <span className="text-base font-semibold text-[#759183] dark:text-[#6b8a78]">Kg Buffer</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#759183] dark:text-[#6b8a78]">
            <span>Panen Supply:</span>
            <span className="font-semibold text-[#192e22] dark:text-[#e4efe8]">
              {(weeklyReport?.total_harvest_kg ?? 0).toFixed(2)} Kg
            </span>
          </div>
        </div>

      </div>

      {/* 3. Analytics & Visualizations: Revenue Trend & Weekly SCM Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column (2 Cols): Grafik Tren Penjualan & Omzet */}
        <div className="lg:col-span-2 bg-white dark:bg-[#142219] rounded-3xl p-6 border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#eef5f1] dark:border-[#1e382b]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#244b37] dark:text-[#86efac]" />
                Tren Pendapatan &amp; Penyerapan Pasar
              </h2>
              <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
                Fluktuasi omzet harian dari hasil penjualan jamur kuping segar ke berbagai mitra
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#edf5f0] dark:bg-[#1a3324] text-[#1e5236] dark:text-[#86efac] border border-[#cbe5d7] dark:border-[#235839]">
                <span className="w-2 h-2 rounded-full bg-[#244b37] dark:bg-[#4ade80]" />
                Omzet (Rp)
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#e8f4fd] dark:bg-[#0f283d] text-[#0284c7] dark:text-[#38bdf8] border border-[#bae6fd] dark:border-[#0369a1]">
                <span className="w-2 h-2 rounded-full bg-[#0284c7] dark:bg-[#38bdf8]" />
                Volume (Kg)
              </span>
            </div>
          </div>

          <div className="w-full h-72 sm:h-80 pt-2">
            {isLoadingSales ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                Memuat data grafik tren...
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenueSage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isDark ? '#4ade80' : '#244b37'} stopOpacity={isDark ? 0.3 : 0.2} />
                      <stop offset="95%" stopColor={isDark ? '#4ade80' : '#244b37'} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} stroke={isDark ? '#1e382b' : '#94a3b8'} strokeOpacity={isDark ? 0.6 : 0.35} />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false} 
                    axisLine={{ stroke: isDark ? '#1e382b' : '#d6e9df' }} 
                    tick={{ fontSize: 11, fill: isDark ? '#a3c9b4' : '#64748b' }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 11, fill: isDark ? '#a3c9b4' : '#64748b' }}
                    tickFormatter={(v) => `Rp ${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 11, fill: isDark ? '#38bdf8' : '#0284c7' }}
                    tickFormatter={(v) => `${v}kg`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#192e22] dark:bg-[#0c1610] text-white p-3.5 rounded-2xl shadow-xl border border-[#2d563f] dark:border-[#235839] text-xs space-y-1.5">
                            <p className="font-bold text-[#cbe5d7] dark:text-[#86efac] border-b border-[#2d563f] dark:border-[#235839] pb-1">{label} ({data.date})</p>
                            <p className="flex justify-between gap-4">
                              <span className="text-[#a5c7b5] dark:text-[#a3c9b4]">Total Omzet:</span>
                              <span className="font-bold text-white dark:text-[#e4efe8]">{formatCurrency(data.revenue)}</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-[#bae6fd] dark:text-[#7dd3fc]">Volume Terjual:</span>
                              <span className="font-bold text-[#bae6fd] dark:text-[#7dd3fc]">{data.volume_kg} Kg</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine 
                    yAxisId="left"
                    y={300000} 
                    stroke={isDark ? '#4ade80' : '#8fa89b'} 
                    strokeDasharray="4 4" 
                    label={{ value: 'Target Harian (Rp 300k)', fill: isDark ? '#86efac' : '#486356', fontSize: 10, position: 'insideTopLeft' }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke={isDark ? '#4ade80' : '#244b37'}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRevenueSage)"
                    name="Omzet (Rp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <Banknote className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                <p>Belum ada data riwayat penjualan untuk ditampilkan pada grafik.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Laporan Neraca SCM Mingguan */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl p-6 border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#eef5f1] dark:border-[#1e382b]">
              <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#244b37] dark:text-[#86efac]" />
                Neraca SCM Mingguan
              </h2>
              <select
                value={weekOffset}
                onChange={(e) => setWeekOffset(Number(e.target.value))}
                className="text-xs font-semibold bg-[#edf5f0] dark:bg-[#111c15] text-[#192e22] dark:text-[#e4efe8] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#244b37] cursor-pointer"
              >
                <option value={0}>Minggu Ini</option>
                <option value={1}>1 Minggu Lalu</option>
                <option value={2}>2 Minggu Lalu</option>
                <option value={3}>3 Minggu Lalu</option>
                <option value={4}>4 Minggu Lalu</option>
              </select>
            </div>

            {/* Periode Info */}
            <div className="mt-3 text-xs text-[#526a5e] dark:text-[#a3c9b4] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#244b37] dark:text-[#86efac]" />
              <span>
                Rentang: <strong>{weeklyReport ? `${formatDateIndo(weeklyReport.start_date)} – ${formatDateIndo(weeklyReport.end_date)}` : 'Memuat rentang...'}</strong>
              </span>
            </div>

            {/* Breakdown SCM Cards */}
            <div className="mt-4 space-y-2.5">
              
              {/* Panen Masuk */}
              <div className="p-3.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#486356] dark:text-[#a3c9b4]">Panen Masuk (Supply)</p>
                  <p className="text-lg font-extrabold text-[#192e22] dark:text-[#e4efe8] mt-0.5">
                    {isLoadingWeeklyReport ? '...' : `${(weeklyReport?.total_harvest_kg ?? 0).toFixed(2)} Kg`}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center text-xs font-bold">
                  IN
                </div>
              </div>

              {/* Terjual Keluar */}
              <div className="p-3.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#486356] dark:text-[#a3c9b4]">Terjual Keluar (Demand)</p>
                  <p className="text-lg font-extrabold text-[#192e22] dark:text-[#e4efe8] mt-0.5">
                    {isLoadingWeeklyReport ? '...' : `${(weeklyReport?.total_sales_kg ?? 0).toFixed(2)} Kg`}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-[#e8f4fd] dark:bg-[#0f283d] text-[#0284c7] dark:text-[#38bdf8] flex items-center justify-center text-xs font-bold">
                  OUT
                </div>
              </div>

              {/* Sisa Stok Buffer */}
              <div className="p-3.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#486356] dark:text-[#a3c9b4]">Sisa Stok Panen (Buffer)</p>
                  <p className="text-lg font-extrabold text-[#192e22] dark:text-[#e4efe8] mt-0.5">
                    {isLoadingWeeklyReport ? '...' : `${(weeklyReport?.unsold_kg ?? 0).toFixed(2)} Kg`}
                  </p>
                </div>
                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                  (weeklyReport?.unsold_kg ?? 0) >= 0 ? 'bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac]' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                }`}>
                  {(weeklyReport?.unsold_kg ?? 0) >= 0 ? 'Tersedia' : 'Defisit'}
                </div>
              </div>

            </div>
          </div>

          {/* Weekly Revenue Summary Banner — Calm & Natural Sage Theme */}
          <div className="p-4 rounded-2xl bg-[#edf5f0] dark:bg-[#162a1f] border border-[#cbe5d7] dark:border-[#235839] text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex justify-between items-center text-xs font-semibold text-[#486356] dark:text-[#a3c9b4] mb-1">
              <span>Total Omzet Mingguan:</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-[#142219] border border-[#cbe5d7] dark:border-[#235839] text-[#244b37] dark:text-[#86efac]">
                {weeklyReport?.period === 'this_week' ? 'Minggu Berjalan' : 'Arsip'}
              </span>
            </div>
            <div className="text-2xl font-extrabold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
              {formatCurrency(weeklyReport?.total_revenue_idr ?? 0)}
            </div>
          </div>
        </div>

      </div>

      {/* 4. Segmentasi Mitra Pembeli (Buyer Quick Insights) */}
      <div className="bg-white dark:bg-[#142219] rounded-3xl p-6 border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
            <Store className="w-4 h-4 text-[#244b37] dark:text-[#86efac]" />
            Segmentasi Mitra &amp; Kanal Pembeli Aktif
          </h2>
          <span className="text-xs text-[#759183] dark:text-[#6b8a78] font-medium">
            Klik mitra untuk memfilter riwayat transaksi
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {BUYER_SUGGESTIONS.map((b) => {
            const count = sales.filter((s) => s.buyer_name === b.name).length;
            const totalKg = sales
              .filter((s) => s.buyer_name === b.name)
              .reduce((sum, s) => sum + Number(s.quantity_kg || 0), 0);
            const isSelected = buyerFilter === b.name;

            return (
              <button
                key={b.name}
                onClick={() => setBuyerFilter(isSelected ? 'all' : b.name)}
                className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
                  isSelected 
                    ? 'bg-[#e8f4ed] dark:bg-[#1b3324] border-[#86c4a3] dark:border-[#387c56] ring-1 ring-[#86c4a3] dark:ring-[#387c56] shadow-xs' 
                    : 'bg-[#f7faf8] dark:bg-[#111c15] hover:bg-[#edf5f0] dark:hover:bg-[#18291d] border-[#d6e9df] dark:border-[#1e382b]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#759183] dark:text-[#6b8a78] truncate max-w-[120px]">{b.category}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#244b37] dark:text-[#86efac] shrink-0" />}
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#192e22] dark:text-[#e4efe8] truncate">{b.name}</p>
                <p className="text-xs font-semibold text-[#244b37] dark:text-[#86efac] mt-1">
                  {totalKg.toFixed(1)} Kg <span className="text-[#759183] dark:text-[#6b8a78] font-normal">({count}x)</span>
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Riwayat Transaksi Penjualan Table Section */}
      <div className="bg-white dark:bg-[#142219] rounded-3xl p-6 border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-5">
        
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#244b37] dark:text-[#86efac]" />
              Riwayat Transaksi Penjualan
            </h2>
            <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
              {totalItems > 0 ? (
                <>
                  Menampilkan <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{startIndex + 1}–{endIndex}</span> dari <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{totalItems}</span> total transaksi penjualan
                </>
              ) : (
                'Menampilkan 0 transaksi penjualan'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* Time Filter Tabs */}
            <div className="bg-[#edf5f0] dark:bg-[#182c20] p-1 rounded-2xl flex items-center border border-[#d6e9df] dark:border-[#1e382b]">
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === 'all'
                    ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs'
                    : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === 'month'
                    ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs'
                    : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                }`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => setTimeFilter('week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === 'week'
                    ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs'
                    : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                }`}
              >
                7 Hari Terakhir
              </button>
            </div>

            {/* Buyer Dropdown Filter */}
            <select
              value={buyerFilter}
              onChange={(e) => setBuyerFilter(e.target.value)}
              className="text-xs font-semibold bg-[#f7faf8] dark:bg-[#111c15] text-[#192e22] dark:text-[#e4efe8] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#244b37] cursor-pointer"
            >
              <option value="all">Semua Pembeli</option>
              {uniqueBuyers.map((buyer) => (
                <option key={buyer} value={buyer}>{buyer}</option>
              ))}
            </select>

            {/* Search Box */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari pembeli / catatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] focus:outline-none focus:ring-1 focus:ring-[#244b37] text-[#192e22] dark:text-[#e4efe8] placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#e4efe8] dark:border-[#1e382b]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#edf5f0] dark:bg-[#111c15] text-[#192e22] dark:text-[#a3c9b4] font-bold uppercase tracking-wider text-[11px] border-b border-[#d6e9df] dark:border-[#1e382b]">
              <tr>
                <th className="px-4 py-3.5">Tanggal</th>
                <th className="px-4 py-3.5">Mitra / Pembeli</th>
                <th className="px-4 py-3.5 text-right">Volume (Kg)</th>
                <th className="px-4 py-3.5 text-right">Harga Satuan</th>
                <th className="px-4 py-3.5 text-right">Total Omzet</th>
                <th className="px-4 py-3.5">Petugas</th>
                <th className="px-4 py-3.5">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef5f1] dark:divide-[#1a3023] bg-white dark:bg-[#142219]">
              {isLoadingSales ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#244b37] dark:text-[#86efac]" />
                    Memuat data transaksi penjualan...
                  </td>
                </tr>
              ) : paginatedSales.length > 0 ? (
                paginatedSales.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f7faf8] dark:hover:bg-[#192b20]/60 transition-colors">
                    
                    {/* Tanggal */}
                    <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDateIndo(s.sale_date)}
                    </td>

                    {/* Pembeli */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[#192e22] dark:text-[#e4efe8]">{s.buyer_name || '-'}</div>
                    </td>

                    {/* Volume Kg */}
                    <td className="px-4 py-3.5 text-right font-extrabold text-[#192e22] dark:text-[#e4efe8]">
                      {Number(s.quantity_kg).toFixed(2)} Kg
                    </td>

                    {/* Harga per Kg */}
                    <td className="px-4 py-3.5 text-right text-slate-600 dark:text-slate-400 font-medium">
                      {formatCurrency(s.price_per_kg)}
                    </td>

                    {/* Total Revenue */}
                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-block px-2.5 py-1 rounded-xl bg-[#edf5f0] dark:bg-[#1a3324] text-[#1e5236] dark:text-[#86efac] font-bold border border-[#cbe5d7] dark:border-[#235839]">
                        {formatCurrency(s.total_revenue)}
                      </span>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#111c15] text-slate-700 dark:text-slate-300 text-xs font-semibold">
                        <User className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        {s.user?.name || 'Admin'}
                      </span>
                    </td>

                    {/* Catatan */}
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                      {s.notes || '-'}
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Banknote className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Tidak ada transaksi penjualan ditemukan</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Coba sesuaikan filter waktu atau kata kunci pencarian lo.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-[#526a5e] dark:text-[#a3c9b4]">
          <div className="flex items-center gap-2">
            <span>
              {totalItems > 0 ? (
                <>
                  Menampilkan <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{startIndex + 1}–{endIndex}</span> dari <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{totalItems}</span> transaksi penjualan
                </>
              ) : (
                'Tidak ada transaksi penjualan'
              )}
            </span>
            {totalItems > 0 && (
              <span className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4] hidden sm:inline">
                • Halaman {safeCurrentPage} dari {totalPages}
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
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

      </div>

      {/* 6. Modal Input Transaksi Penjualan — Harmonious Sage Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e4efe8] dark:border-[#1e382b] pb-3.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                  <Banknote className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">Catat Transaksi Penjualan</h2>
                  <p className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4]">Input nota distribusi hasil panen jamur kuping</p>
                </div>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1b3324] text-slate-400 hover:text-slate-700 dark:hover:text-[#e4efe8] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 flex-1 pr-1">
              
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Tanggal Transaksi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-semibold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                />
              </div>

              {/* Nama Pembeli / Pengepul */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8]">
                    Nama Pembeli / Mitra Pengepul
                  </label>
                  <span className="text-[11px] text-[#759183] dark:text-[#6b8a78]">Ketik manual atau pilih saran</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Misal: Bu Sari (Resto Jamur)"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-semibold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                />
                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {BUYER_SUGGESTIONS.map((b) => (
                    <button
                      type="button"
                      key={b.name}
                      onClick={() => setBuyerName(b.name)}
                      className="text-[11px] px-2.5 py-1 rounded-xl bg-[#edf5f0] dark:bg-[#1b3324] hover:bg-[#e2f0e7] dark:hover:bg-[#244531] text-[#244b37] dark:text-[#86efac] font-semibold border border-[#d6e9df] dark:border-[#2a5a3d] transition-colors cursor-pointer"
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity & Price Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Jumlah Kg */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                    Berat Panen (Kg)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 12,5"
                      value={quantityKg}
                      onChange={(e) => handleFloatChange(e.target.value, setQuantityKg)}
                      className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-bold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      Kg
                    </span>
                  </div>
                </div>

                {/* Harga per Kg */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                    Harga Jual / Kg
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="25.000"
                      value={pricePerKg}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-bold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                    />
                  </div>
                </div>

              </div>

              {/* Price Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-[#759183] dark:text-[#6b8a78]">Preset:</span>
                {PRICE_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPricePerKg(p.toLocaleString('id-ID'))}
                    className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-[#1b3324] hover:bg-slate-200 dark:hover:bg-[#244531] text-slate-700 dark:text-[#86efac] font-bold transition-colors cursor-pointer"
                  >
                    Rp {(p / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              {/* Real-time Calculation Preview */}
              <div className="p-4 rounded-2xl bg-[#edf5f0] dark:bg-[#162a1f] border border-[#cbe5d7] dark:border-[#235839] text-[#192e22] dark:text-[#e4efe8] space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold text-[#486356] dark:text-[#a3c9b4]">
                  <span>Estimasi Total Omzet:</span>
                  <span className="text-[11px]">
                    {modalParsedKg > 0 && modalParsedPrice > 0 ? `${modalParsedKg} Kg × ${formatCurrency(modalParsedPrice)}` : 'Masukkan berat & harga'}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
                  {formatCurrency(modalLiveRevenue)}
                </div>
              </div>

              {/* Catatan Transaksi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                  Catatan Transaksi (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan mutu jamur, pembayaran tunai/tempo, atau detail pengiriman..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-xs font-medium text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#1e382b] text-slate-700 dark:text-[#a3c9b4] font-semibold text-xs hover:bg-slate-50 dark:hover:bg-[#1b3324] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] active:scale-[0.98] text-white font-bold text-xs transition-all shadow-xs hover:shadow disabled:opacity-50 cursor-pointer"
                >
                  {createMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan Transaksi Penjualan</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
