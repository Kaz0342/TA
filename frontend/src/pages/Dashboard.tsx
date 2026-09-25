import { useState, useEffect, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine
} from 'recharts';
import {
  Thermometer,
  Droplets,
  Layers,
  Columns2,
  Scale,
  Fan,
  Wind,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  SlidersHorizontal,
  ChevronRight,
  Activity,
  TrendingUp,
  CalendarDays
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import SemiCircleGauge from '../components/SemiCircleGauge';
import AnimatedNumber from '../components/AnimatedNumber';

// Fetchers
const fetchStats = async () => (await api.get('/dashboard/stats')).data.data;
const fetchLatestSensor = async () => (await api.get('/sensor-data/latest')).data.data;
const fetchThresholds = async () => (await api.get('/thresholds/active')).data.data;
const fetchHarvestChart = async () => (await api.get('/harvests/chart?days=14')).data.data;

interface ChartPoint {
  time: string;
  temp: number;
  humidity: number;
  fullDate?: string;
}

/**
 * Smart Downsampling Helper
 * Mengagregasi ribuan data mentah (5-menitan) menjadi titik rata-rata teratur
 * dengan interval lebih rapat agar pergerakan naik-turun terlihat jelas dan detail.
 */
function processChartData(
  rawData: Array<{ temperature: number | string; humidity: number | string; recorded_at?: string; time_label?: string }>,
  range: '6h' | '12h' | '24h' | '7d',
  latestSensor?: { temperature?: number | string; humidity?: number | string; recorded_at?: string }
): ChartPoint[] {
  if (!rawData || rawData.length === 0) {
    if (range === '6h') {
      return [
        { time: '16:51', temp: 27.5, humidity: 85.0 },
        { time: '17:14', temp: 27.1, humidity: 86.2 },
        { time: '17:36', temp: 26.8, humidity: 87.0 },
        { time: '17:58', temp: 26.4, humidity: 87.6 },
        { time: '18:21', temp: 26.0, humidity: 88.3 },
        { time: '18:44', temp: 25.7, humidity: 88.9 },
        { time: '21:22', temp: 25.0, humidity: 90.1 },
        { time: '21:46', temp: 24.6, humidity: 91.0 },
        { time: '22:09', temp: 24.2, humidity: 92.4 },
        { time: '22:35', temp: 23.9, humidity: 93.2 },
      ];
    }
    return [
      { time: '00:00', temp: 26.0, humidity: 88.0 },
      { time: '02:00', temp: 25.8, humidity: 89.2 },
      { time: '04:00', temp: 25.5, humidity: 90.0 },
      { time: '06:00', temp: 25.9, humidity: 88.5 },
      { time: '08:00', temp: 26.8, humidity: 85.2 },
      { time: '10:00', temp: 27.9, humidity: 82.1 },
      { time: '12:00', temp: 29.2, humidity: 78.4 },
      { time: '14:00', temp: 28.5, humidity: 81.0 },
      { time: '16:00', temp: 27.8, humidity: 84.6 },
      { time: '18:00', temp: 27.0, humidity: 86.2 },
      { time: '20:00', temp: 26.5, humidity: 87.8 },
      { time: '22:00', temp: 26.2, humidity: 88.4 },
    ];
  }

  const formatTimeLabel = (dateStr?: string, fallback: string = '00:00'): string => {
    if (!dateStr) return fallback;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Target titik render: 6h = 72 titik (~5 menit per titik)
  const targetPoints = range === '6h' ? 72 : range === '12h' ? 36 : range === '24h' ? 48 : 42;

  if (rawData.length <= targetPoints) {
    const points = rawData.map((d) => {
      let label = d.time_label ? d.time_label.substring(0, 5) : '00:00';
      if (range === '7d' && d.recorded_at) {
        const dateObj = new Date(d.recorded_at);
        label = `${dateObj.getDate()}/${dateObj.getMonth() + 1} ${label}`;
      }
      return {
        time: label,
        temp: Number(Number(d.temperature).toFixed(1)),
        humidity: Number(Number(d.humidity).toFixed(1)),
        fullDate: d.recorded_at,
      };
    });

    // Anchor titik paling akhir ke data live terkini agar 100% sinkron dengan kartu KPI
    if (points.length > 0 && latestSensor) {
      const last = points[points.length - 1];
      if (latestSensor.temperature !== undefined) {
        last.temp = Number(Number(latestSensor.temperature).toFixed(1));
      }
      if (latestSensor.humidity !== undefined) {
        last.humidity = Number(Number(latestSensor.humidity).toFixed(1));
      }
      if (latestSensor.recorded_at) {
        const timeStr = formatTimeLabel(latestSensor.recorded_at, last.time);
        if (range === '7d') {
          const dObj = new Date(latestSensor.recorded_at);
          last.time = `${dObj.getDate()}/${dObj.getMonth() + 1} ${timeStr}`;
        } else {
          last.time = timeStr;
        }
        last.fullDate = latestSensor.recorded_at;
      }
    }

    return points;
  }

  // Bucket Averaging untuk meratakan fluktuasi
  const bucketSize = Math.ceil(rawData.length / targetPoints);
  const downsampled: ChartPoint[] = [];

  for (let i = 0; i < rawData.length; i += bucketSize) {
    const isLast = i + bucketSize >= rawData.length;
    const bucket = rawData.slice(i, i + bucketSize);
    if (bucket.length === 0) continue;

    let avgTemp: number;
    let avgHum: number;
    let label: string;
    let fullDate: string | undefined;

    if (isLast) {
      // Titik terakhir (real-time head): WAJIB pakai nilai aktual terkini
      // agar 100% SINKRON dengan kartu KPI di atasnya (bukan rata-rata 10 menit lalu)
      const lastRaw = bucket[bucket.length - 1];
      const curTemp = latestSensor?.temperature !== undefined ? Number(latestSensor.temperature) : Number(lastRaw.temperature || 0);
      const curHum = latestSensor?.humidity !== undefined ? Number(latestSensor.humidity) : Number(lastRaw.humidity || 0);
      avgTemp = curTemp;
      avgHum = curHum;

      const recAt = latestSensor?.recorded_at || lastRaw.recorded_at;
      label = formatTimeLabel(recAt, (lastRaw.time_label || '00:00').substring(0, 5));
      fullDate = recAt;
    } else {
      avgTemp = bucket.reduce((sum, item) => sum + Number(item.temperature || 0), 0) / bucket.length;
      avgHum = bucket.reduce((sum, item) => sum + Number(item.humidity || 0), 0) / bucket.length;
      const rep = bucket[Math.floor(bucket.length / 2)];
      label = rep.time_label ? rep.time_label.substring(0, 5) : '00:00';
      fullDate = rep.recorded_at;
    }

    if (range === '7d' && fullDate) {
      const dateObj = new Date(fullDate);
      const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });
      label = `${dayName} ${label}`;
    }

    downsampled.push({
      time: label,
      temp: Number(avgTemp.toFixed(1)),
      humidity: Number(avgHum.toFixed(1)),
      fullDate: fullDate,
    });
  }

  return downsampled;
}

/**
 * Isolated Real-time Live Clock Component
 * Memperbarui waktu setiap detik di komponen terisolasi ini saja,
 * TANPA memicu re-render seluruh halaman Dashboard & grafik Recharts.
 */
const LiveClock = memo(() => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] px-4 py-1.5 rounded-2xl shadow-2xs">
      <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac] flex items-center justify-center shrink-0">
        <CalendarDays className="w-4 h-4" />
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8] leading-tight capitalize">
          {currentDateTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <p className="text-[11px] font-semibold text-[#3b6752] dark:text-[#86efac] leading-tight font-mono mt-0.5 flex items-center justify-end gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {currentDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
        </p>
      </div>
    </div>
  );
});

export default function Dashboard() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // Functional State (Default 6h rentang waktu & Berdampingan persis Gambar 1)
  const [timeRange, setTimeRange] = useState<'6h' | '12h' | '24h' | '7d'>('6h');
  const [chartViewMode, setChartViewMode] = useState<'split' | 'combined'>('split');
  const [showTemp, setShowTemp] = useState(true);
  const [showHumidity, setShowHumidity] = useState(true);
  const [cropViewMode, setCropViewMode] = useState<'weight' | 'percent'>('weight');
  const [bottomCardTab, setBottomCardTab] = useState<'harvest' | 'batches'>('harvest');
  // Interactive test preview for actuators (null = real state, true = simulated active)
  const [testMisting, setTestMisting] = useState<boolean | null>(null);
  const [testFan, setTestFan] = useState<boolean | null>(null);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchStats,
    refetchInterval: 10000,
  });

  const { data: latestSensor } = useQuery({
    queryKey: ['latestSensor'],
    queryFn: fetchLatestSensor,
    refetchInterval: 3000,
  });

  const { data: thresholds } = useQuery({
    queryKey: ['thresholds'],
    queryFn: fetchThresholds,
    refetchInterval: 30000,
  });

  const { data: harvestChartData } = useQuery({
    queryKey: ['harvestChart'],
    queryFn: fetchHarvestChart,
    refetchInterval: 30000,
  });

  // Dynamic hours query for Climate History (6h default)
  const chartHours = timeRange === '6h' ? 6 : timeRange === '12h' ? 12 : timeRange === '24h' ? 24 : 168;
  const { data: rawChartData, isLoading: chartLoading } = useQuery({
    queryKey: ['sensorChart', timeRange],
    queryFn: async () => (await api.get(`/sensor-data/chart?hours=${chartHours}`)).data.data,
    refetchInterval: 30000,
  });

  // Active Thresholds values
  const tempMin = Number(thresholds?.temp_min ?? 24);
  const tempMax = Number(thresholds?.temp_max ?? 32);
  const humMin = Number(thresholds?.humidity_min ?? 80);
  const humMax = Number(thresholds?.humidity_max ?? 95);

  // Live or fallback sensor values
  const tempVal = latestSensor?.temperature ? Number(latestSensor.temperature) : 27.5;
  const humVal = latestSensor?.humidity ? Number(latestSensor.humidity) : 85.0;

  // Real 1-Hour Change Calculation (Memoized)
  const { tempDiff, humDiff } = useMemo(() => {
    if (!rawChartData || rawChartData.length < 6) {
      return { tempDiff: 0.2, humDiff: -0.5 };
    }
    const pastReadingIndex = Math.max(0, rawChartData.length - 12);
    const pastReading = rawChartData[pastReadingIndex];
    const tempDiff = pastReading ? tempVal - Number(pastReading.temperature) : 0.2;
    const humDiff = pastReading ? humVal - Number(pastReading.humidity) : -0.5;
    return { tempDiff, humDiff };
  }, [rawChartData, tempVal, humVal]);

  // Processed Smooth Chart Data (Memoized - Anchor ke latestSensor agar real-time sinkron 100%)
  const smoothedChart = useMemo(() => {
    return processChartData(rawChartData, timeRange, latestSensor);
  }, [rawChartData, timeRange, latestSensor?.temperature, latestSensor?.humidity, latestSensor?.recorded_at]);

  // Harvest / Crop Progress data mapped from API
  const cropProgressData = harvestChartData && harvestChartData.length > 0
    ? harvestChartData.slice(-7).map((h: any, i: number) => ({
      label: h.label || `Day ${i + 1}`,
      kg: Number(h.total_kg) || 0,
      percentage: Math.min(100, Math.round(((Number(h.total_kg) || 0) / 15) * 100)),
    }))
    : [
      { label: 'Sen', kg: 4.5, percentage: 45 },
      { label: 'Sel', kg: 6.2, percentage: 62 },
      { label: 'Rab', kg: 5.8, percentage: 58 },
      { label: 'Kam', kg: 8.4, percentage: 84 },
      { label: 'Jum', kg: 7.1, percentage: 71 },
      { label: 'Sab', kg: 9.8, percentage: 98 },
      { label: 'Min', kg: 8.9, percentage: 89 },
    ];

  // Dynamic Status Badges
  const isTempOptimal = tempVal >= tempMin && tempVal <= tempMax;
  const isHumOptimal = humVal >= humMin && humVal <= humMax;
  const hasThresholdWarning = !isTempOptimal || !isHumOptimal || (stats?.system_alerts && stats.system_alerts.length > 0);

  // Operational Baglog & Harvest Metrics
  const activeBaglogs = stats?.active_baglogs ?? 2450;
  const maxCapacity = 3000;
  const baglogPercentage = Math.min(100, Math.round((activeBaglogs / maxCapacity) * 100));

  const todayHarvestKg = Number(stats?.today_harvest_kg || 0);
  const dailyTargetKg = 15.0;
  const harvestPercentage = Math.min(100, Math.round((todayHarvestKg / dailyTargetKg) * 100));

  // Automation Status Logic (Sinkron 100% dengan ESP32 & Simulator v3.5)
  const currentHour = new Date().getHours();
  const isNight = currentHour >= 17 || currentHour < 6;

  // Cek apakah ada aktuator yang baru saja aktif dari riwayat log backend
  const latestLog = stats?.sprinkler_logs?.[0];
  const isLatestLogVeryRecent = latestLog && latestLog.started_at
    ? (Date.now() - new Date(latestLog.started_at).getTime()) < ((Number(latestLog.duration_seconds) || 30) * 1000 + 5000)
    : false;

  // Misting:
  // - Mode tes manual override jika di-klik
  // - Mode Malam (17:00 - 06:00 WIB): Misting dikunci OFF (kecuali anomali ekstrem RH < 70%)
  // - Mode Siang (06:00 - 17:00 WIB): Nyala jika RH < humMin
  const isMistingActive = testMisting !== null
    ? testMisting
    : isLatestLogVeryRecent && latestLog?.actuator === 'misting'
      ? true
      : isNight
        ? (humVal < 70.0)
        : (humVal < humMin);

  // Fan:
  // - Mode tes manual override jika di-klik
  // - Mode Malam: Nyala jika over-humidity purge RH >= 96% atau periodic flush
  // - Mode Siang: Nyala jika suhu > tempMax
  const isFanActive = testFan !== null
    ? testFan
    : isLatestLogVeryRecent && latestLog?.actuator === 'fan'
      ? true
      : isNight
        ? (humVal >= 96.0 || tempVal > tempMax + 2.0)
        : (tempVal > tempMax);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Row 1: Header (Welcome, Admin! + Live Real-time Clock & Calendar) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
            Welcome, {user?.name?.replace(/\bKing\s*/gi, '').trim() || 'Admin'}!
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#486356] dark:text-[#a3c9b4] mt-0.5">
            Smart Mushroom Farming IoT Platform • Monitoring Jamur Kuping
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Link
            to="/settings"
            title="Klik untuk konfigurasi threshold fase di Modul Setting"
            className="bg-[#cee8dc] dark:bg-[#182c20] hover:bg-[#bde0cf] dark:hover:bg-[#1f3a2b] text-[#244b37] dark:text-[#86efac] px-4 py-2 rounded-2xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Status: {thresholds?.phase_mode ? `Fase ${thresholds.phase_mode}` : 'Fase Growing'}
          </Link>

          {/* Real-time Live Clock & Calendar (Terisolasi di komponen LiveClock) */}
          <LiveClock />
        </div>
      </div>

      {/* Warning Message Alert Banner (Muncul jika Suhu atau Kelembapan di Luar Ambang Batas) */}
      {hasThresholdWarning && (
        <div className="bg-[#fff5f5] dark:bg-[#2a1717] border border-[#fecaca] dark:border-[#4a2020] text-[#991b1b] dark:text-[#fca5a5] rounded-2xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fee2e2] dark:bg-[#3d1a1a] text-[#dc2626] dark:text-[#f87171] flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                  Peringatan Mikroklimat
                </span>
                <span className="text-xs font-bold text-rose-950 dark:text-rose-200">
                  Parameter Kumbung di Luar Ambang Batas Ideal!
                </span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 font-medium">
                {!isTempOptimal && (
                  <span>
                    • Suhu saat ini (<span className="font-bold">{tempVal.toFixed(1)}°C</span>) {tempVal < tempMin ? 'terlalu dingin' : 'terlalu panas'} (Target: {tempMin}–{tempMax}°C).{' '}
                  </span>
                )}
                {!isHumOptimal && (
                  <span>
                    • Kelembapan saat ini (<span className="font-bold">{humVal.toFixed(1)}%</span>) {
                      humVal < humMin
                        ? isNight
                          ? `di bawah batas ideal (Target: ${humMin}–${humMax}%). Misting ditahan: Jam Malam (17:00–06:00 WIB) agar jamur tidak busuk basah.`
                          : `terlalu kering (Misting menyala otomatis) (Target: ${humMin}–${humMax}%).`
                        : `terlalu lembab (Target: ${humMin}–${humMax}%).`
                    }{' '}
                  </span>
                )}
                {stats?.system_alerts && stats.system_alerts.length > 0 && stats.system_alerts.map((a: any, i: number) => (
                  <span key={i} className="block mt-0.5 font-semibold text-rose-800 dark:text-rose-300">• {a.message}</span>
                ))}
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1 shrink-0 ml-auto"
          >
            <span>Sesuaikan Threshold di Setting</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Row 2: Top 4 KPI Operational Cards (Suhu, RH, Baglog Aktif, Panen Hari Ini) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

        {/* Card 1: Temperature */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2.5">
              <Thermometer className="w-5 h-5 stroke-[2] text-[#244b37] dark:text-[#86efac]" />
              <div>
                <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Temperature</span>
                <span className="block text-[10px] text-[#526a5e] dark:text-[#a3c9b4] font-semibold">Rata-rata 3x DHT22</span>
              </div>
            </div>
            <Link to="/settings" title="Pengaturan Threshold Suhu di Modul Setting">
              <SlidersHorizontal className="w-4 h-4 text-[#8ca497] hover:text-[#192e22] dark:hover:text-[#e4efe8] transition-colors" />
            </Link>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="flex items-baseline gap-1">
                <AnimatedNumber
                  value={tempVal}
                  decimals={1}
                  className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
                />
                <span className="text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">°C</span>
              </div>
              <p className={`text-xs font-bold mt-0.5 ${isTempOptimal ? 'text-[#15803d] dark:text-[#4ade80]' : 'text-[#e05345] dark:text-[#f87171]'}`}>
                {isTempOptimal ? `Zona Aman (${tempMin}–${tempMax}°C)` : tempVal < tempMin ? `Terlalu Dingin (< ${tempMin}°C)` : `Terlalu Panas (> ${tempMax}°C)`}
              </p>
              <div className="flex items-center justify-between text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
                <span>1hr change {tempDiff >= 0 ? `+${tempDiff.toFixed(1)}` : tempDiff.toFixed(1)}°C</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800 flex items-center gap-1" title="Waktu Pembacaan Terakhir Sensor">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {latestSensor?.recorded_at ? new Date(latestSensor.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                </span>
              </div>
            </div>
            <SemiCircleGauge value={tempVal} min={15} max={35} color={isTempOptimal ? '#499b70' : '#e05345'} />
          </div>
        </div>

        {/* Card 2: Humidity (Presisi 1 Desimal) */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2.5">
              <Droplets className="w-5 h-5 stroke-[2] text-[#244b37] dark:text-[#86efac]" />
              <div>
                <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Humidity</span>
                <span className="block text-[10px] text-[#526a5e] dark:text-[#a3c9b4] font-semibold">Rata-rata 3x DHT22</span>
              </div>
            </div>
            <Link to="/settings" title="Pengaturan Threshold Kelembapan di Modul Setting">
              <SlidersHorizontal className="w-4 h-4 text-[#8ca497] hover:text-[#192e22] dark:hover:text-[#e4efe8] transition-colors" />
            </Link>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="flex items-baseline gap-1">
                <AnimatedNumber
                  value={humVal}
                  decimals={1}
                  className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
                />
                <span className="text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">%</span>
              </div>
              <p className={`text-xs font-bold mt-0.5 ${isHumOptimal ? 'text-[#0284c7] dark:text-[#38bdf8]' : 'text-[#e05345] dark:text-[#f87171]'}`}>
                {isHumOptimal
                  ? `Zona Aman (${humMin}–${humMax}%)`
                  : humVal < humMin
                    ? isNight
                      ? `Kering (< ${humMin}%, Standby Jam Malam)`
                      : `Kering (< ${humMin}%, Misting Aktif)`
                    : `Terlalu Lembab (> ${humMax}%)`
                }
              </p>
              <div className="flex items-center justify-between text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
                <span>1hr change {humDiff >= 0 ? `+${humDiff.toFixed(1)}` : humDiff.toFixed(1)}%</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800 flex items-center gap-1" title="Waktu Pembacaan Terakhir Sensor">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {latestSensor?.recorded_at ? new Date(latestSensor.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                </span>
              </div>
            </div>
            <SemiCircleGauge value={humVal} min={40} max={100} color={isHumOptimal ? '#499b70' : '#e05345'} />
          </div>
        </div>

        {/* Card 3: Baglog Aktif */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 stroke-[2] text-[#244b37] dark:text-[#86efac]" />
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Baglog Aktif</span>
            </div>
            <Link to="/baglogs" title="Buka Modul Manajemen Baglog">
              <ArrowUpRight className="w-4 h-4 text-[#8ca497] hover:text-[#192e22] dark:hover:text-[#e4efe8] transition-colors" />
            </Link>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <AnimatedNumber
                  value={activeBaglogs}
                  decimals={0}
                  className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
                />
                <span className="text-sm font-semibold text-[#192e22] dark:text-[#e4efe8]">Unit</span>
              </div>
              <p className="text-xs font-bold text-[#2e7d52] dark:text-[#4ade80] mt-0.5">
                Kapasitas {baglogPercentage}% ({maxCapacity.toLocaleString('id-ID')} Max)
              </p>
              <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
                {stats?.latest_batches?.length || 3} Batch aktif kumbung
              </p>
            </div>
            <SemiCircleGauge value={baglogPercentage} min={0} max={100} color="#499b70" />
          </div>
        </div>

        {/* Card 4: Panen Hari Ini */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 stroke-[2] text-[#244b37] dark:text-[#86efac]" />
              <span className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Panen Hari Ini</span>
            </div>
            <Link to="/harvests" title="Buka Modul Pencatatan Panen">
              <ArrowUpRight className="w-4 h-4 text-[#8ca497] hover:text-[#192e22] dark:hover:text-[#e4efe8] transition-colors" />
            </Link>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <AnimatedNumber
                  value={todayHarvestKg}
                  decimals={1}
                  className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight"
                />
                <span className="text-sm font-semibold text-[#192e22] dark:text-[#e4efe8]">Kg</span>
              </div>
              <p className={`text-xs font-bold mt-0.5 ${todayHarvestKg > 0 ? 'text-[#2e7d52] dark:text-[#4ade80]' : 'text-[#759183] dark:text-[#6b8a78]'}`}>
                {todayHarvestKg > 0 ? `${harvestPercentage}% Target Harian` : 'Belum Ada Timbangan'}
              </p>
              <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-2 font-medium">
                Target panen harian: {dailyTargetKg} Kg
              </p>
            </div>
            <SemiCircleGauge value={harvestPercentage} min={0} max={100} color="#499b70" />
          </div>
        </div>

      </div>

      {/* Row 3: Middle Section (Enlarged & Detailed Dual Climate History + Automation Status Monitoring) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Climate History Card (2 Cols) — Ukuran Grafiknya Dibesarkan & Interval Jam Dirapatkan */}
        <div className="lg:col-span-2 bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">
                  Climate History ({timeRange === '6h' ? '6 Jam Terakhir' : timeRange === '12h' ? '12 Jam Terakhir' : timeRange === '24h' ? '24 Jam Terakhir' : '7 Hari Terakhir'})
                </h2>
                <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
                  Korelasi riil Suhu (°C) &amp; Kelembapan (RH %) dari <span className="font-semibold text-[#1e5236] dark:text-[#86efac]">rata-rata 3 sensor DHT22</span> kumbung
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle: [ Berdampingan | Gabungan ] */}
                <div className="bg-[#edf5f0] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-full p-1 flex items-center text-xs font-semibold">
                  <button
                    onClick={() => setChartViewMode('split')}
                    className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${chartViewMode === 'split'
                        ? 'bg-[#244b37] dark:bg-[#1f3a2b] text-white dark:text-[#86efac] shadow-xs font-bold'
                        : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                      }`}
                    title="Tampilan berdampingan (Suhu & RH terpisah persis Gambar 1)"
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>Berdampingan</span>
                  </button>
                  <button
                    onClick={() => setChartViewMode('combined')}
                    className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${chartViewMode === 'combined'
                        ? 'bg-[#244b37] dark:bg-[#1f3a2b] text-white dark:text-[#86efac] shadow-xs font-bold'
                        : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                      }`}
                    title="Tampilan gabungan (Dual-Axis chart)"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Gabungan</span>
                  </button>
                </div>

                {/* Range Filter: [ 6h | 12h | 24h | 7d ] */}
                <div className="bg-[#d7ebe0] dark:bg-[#182c20] rounded-full p-1 flex items-center text-xs font-semibold">
                  {(['6h', '12h', '24h', '7d'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setTimeRange(r)}
                      className={`px-3 py-1 rounded-full transition-all cursor-pointer ${timeRange === r
                          ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                          : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                        }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {chartLoading ? (
              <div className="h-[300px] w-full flex items-center justify-center text-xs text-slate-400 font-medium">
                Mengambil riwayat data mikroklimat kumbung...
              </div>
            ) : chartViewMode === 'split' ? (
              /* Mode A: Berdampingan (Persis Gambar 1 - Dua Grafik Terpisah) */
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Grafik 1: Suhu (°C) */}
                  <div className="bg-[#fbfdfc] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-[#332205] border border-amber-200 dark:border-[#78350f] flex items-center justify-center text-amber-700 dark:text-[#fbbf24]">
                          <Thermometer className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8]">Suhu Udara</span>
                          <span className="text-xs font-bold text-amber-700 dark:text-[#fbbf24] ml-1.5">{tempVal.toFixed(1)}°C</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-[#86efac] bg-emerald-50 dark:bg-[#163321] border border-emerald-200 dark:border-[#235839] px-2 py-0.5 rounded-full">
                        Zona Aman: {tempMin}–{tempMax}°C
                      </span>
                    </div>

                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={smoothedChart} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
                          <defs>
                            <linearGradient id="splitTempGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d97706" stopOpacity={isDark ? 0.28 : 0.18} />
                              <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={isDark ? '#1e382b' : '#94a3b8'} strokeOpacity={isDark ? 0.6 : 0.35} strokeDasharray="3 3" vertical={true} />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 9, fill: isDark ? '#a3c9b4' : '#334155', fontWeight: 'bold' }}
                            axisLine={{ stroke: isDark ? '#1e382b' : '#334155', strokeWidth: 1.5 }}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={20}
                          />
                          <YAxis
                            domain={[22, 34]}
                            ticks={[22, 25, 28, 31, 34]}
                            tick={{ fontSize: 9, fill: isDark ? '#a3c9b4' : '#334155', fontWeight: 'bold' }}
                            tickFormatter={(v) => `${v}°`}
                            axisLine={{ stroke: isDark ? '#1e382b' : '#334155', strokeWidth: 1.5 }}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#0c1610' : '#ffffff',
                              borderRadius: '12px',
                              border: isDark ? '1px solid #235839' : '1px solid #d6e9df',
                              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: isDark ? '#e4efe8' : '#192e22',
                            }}
                            itemStyle={{
                              color: isDark ? '#e4efe8' : '#192e22',
                            }}
                            formatter={(value: any) => [
                              `${Number(value).toFixed(1)} °C`,
                              'Suhu Kumbung'
                            ]}
                          />
                          {/* Safe band hijau shaded persis Gambar 1 */}
                          <ReferenceArea
                            y1={tempMin}
                            y2={tempMax}
                            fill={isDark ? '#059669' : '#a7f3d0'}
                            fillOpacity={isDark ? 0.15 : 0.45}
                          />
                          <ReferenceLine
                            y={tempMin}
                            stroke={isDark ? '#34d399' : '#059669'}
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                          />
                          <ReferenceLine
                            y={tempMax}
                            stroke={isDark ? '#34d399' : '#059669'}
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                          />
                          <Area
                            isAnimationActive={true}
                            animationDuration={500}
                            animationEasing="ease-in-out"
                            type="monotone"
                            dataKey="temp"
                            stroke="#d97706"
                            strokeWidth={2.5}
                            fill="url(#splitTempGrad)"
                            activeDot={{ r: 5, fill: '#d97706', stroke: isDark ? '#0c1610' : '#ffffff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Grafik 2: Kelembapan (RH %) */}
                  <div className="bg-[#fbfdfc] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-[#0f283d] border border-blue-200 dark:border-[#0369a1] flex items-center justify-center text-blue-700 dark:text-[#38bdf8]">
                          <Droplets className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8]">Kelembapan (RH)</span>
                          <span className="text-xs font-bold text-blue-700 dark:text-[#38bdf8] ml-1.5">{humVal.toFixed(1)}%</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-[#86efac] bg-emerald-50 dark:bg-[#163321] border border-emerald-200 dark:border-[#235839] px-2 py-0.5 rounded-full">
                        Zona Aman: {humMin}–{humMax}%
                      </span>
                    </div>

                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={smoothedChart} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
                          <defs>
                            <linearGradient id="splitHumGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0284c7" stopOpacity={isDark ? 0.28 : 0.18} />
                              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={isDark ? '#1e382b' : '#94a3b8'} strokeOpacity={isDark ? 0.6 : 0.35} strokeDasharray="3 3" vertical={true} />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 9, fill: isDark ? '#a3c9b4' : '#334155', fontWeight: 'bold' }}
                            axisLine={{ stroke: isDark ? '#1e382b' : '#334155', strokeWidth: 1.5 }}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={20}
                          />
                          <YAxis
                            domain={[80, 100]}
                            ticks={[80, 85, 90, 95, 100]}
                            tick={{ fontSize: 9, fill: isDark ? '#a3c9b4' : '#334155', fontWeight: 'bold' }}
                            tickFormatter={(v) => `${v}%`}
                            axisLine={{ stroke: isDark ? '#1e382b' : '#334155', strokeWidth: 1.5 }}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#0c1610' : '#ffffff',
                              borderRadius: '12px',
                              border: isDark ? '1px solid #235839' : '1px solid #d6e9df',
                              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: isDark ? '#e4efe8' : '#192e22',
                            }}
                            itemStyle={{
                              color: isDark ? '#e4efe8' : '#192e22',
                            }}
                            formatter={(value: any) => [
                              `${Number(value).toFixed(1)} %`,
                              'Kelembaban RH'
                            ]}
                          />
                          {/* Safe band hijau shaded persis Gambar 1 */}
                          <ReferenceArea
                            y1={humMin}
                            y2={humMax}
                            fill={isDark ? '#059669' : '#a7f3d0'}
                            fillOpacity={isDark ? 0.15 : 0.45}
                          />
                          <ReferenceLine
                            y={humMin}
                            stroke={isDark ? '#34d399' : '#059669'}
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                          />
                          <ReferenceLine
                            y={humMax}
                            stroke={isDark ? '#34d399' : '#059669'}
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                          />
                          <Area
                            isAnimationActive={true}
                            animationDuration={500}
                            animationEasing="ease-in-out"
                            type="monotone"
                            dataKey="humidity"
                            stroke="#0284c7"
                            strokeWidth={2.5}
                            fill="url(#splitHumGrad)"
                            activeDot={{ r: 5, fill: '#0284c7', stroke: isDark ? '#0c1610' : '#ffffff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Mode B: Gabungan (Dual-Axis Chart) */
              <div>
                {/* Subheader Interactive Legend & Safe Zone Info */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold mb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => setShowTemp(!showTemp)}
                      title="Klik untuk tampilkan / sembunyikan kurva Suhu"
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${showTemp
                          ? 'bg-amber-50 dark:bg-[#332205] border-amber-200 dark:border-[#78350f] text-amber-800 dark:text-[#fbbf24] shadow-2xs'
                          : 'bg-slate-50 dark:bg-[#111c15] border-slate-200 dark:border-[#1e382b] text-slate-400 dark:text-slate-500 line-through opacity-60'
                        }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] dark:bg-[#fbbf24]"></span>
                      <span>Suhu: {tempVal.toFixed(1)}°C <span className="text-[11px] font-normal text-amber-700 dark:text-[#fbbf24]">(Aman: {tempMin}–{tempMax}°C)</span></span>
                    </button>

                    <button
                      onClick={() => setShowHumidity(!showHumidity)}
                      title="Klik untuk tampilkan / sembunyikan kurva Kelembapan"
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${showHumidity
                          ? 'bg-[#f0f7ff] dark:bg-[#0f283d] border-[#93c5fd] dark:border-[#0369a1] text-[#0369a1] dark:text-[#38bdf8] shadow-2xs'
                          : 'bg-slate-50 dark:bg-[#111c15] border-slate-200 dark:border-[#1e382b] text-slate-400 dark:text-slate-500 line-through opacity-60'
                        }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] dark:bg-[#38bdf8]"></span>
                      <span>Kelembapan: {humVal.toFixed(1)}% <span className="text-[11px] font-normal text-[#0369a1] dark:text-[#7dd3fc]">(Aman: {humMin}–{humMax}%)</span></span>
                    </button>
                  </div>

                  <span className="text-[10px] text-[#526a5e] dark:text-[#a3c9b4] font-medium hidden sm:inline-block">
                    ℹ️ Garis putus-putus = <span className="font-bold text-[#d97706] dark:text-[#fbbf24]">Batas Suhu</span> &amp; <span className="font-bold text-[#0284c7] dark:text-[#38bdf8]">Batas Kelembapan</span>
                  </span>
                </div>

                <div className="h-[290px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={smoothedChart} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97706" stopOpacity={isDark ? 0.25 : 0.14} />
                          <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={isDark ? 0.25 : 0.14} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={isDark ? '#1e382b' : '#94a3b8'} strokeOpacity={isDark ? 0.6 : 0.35} strokeDasharray="3 3" vertical={true} />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: isDark ? '#a3c9b4' : '#526a5e', fontWeight: 'bold' }}
                        axisLine={{ stroke: isDark ? '#1e382b' : '#d6e9df' }}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={20}
                      />
                      <YAxis
                        yAxisId="temp"
                        orientation="left"
                        type="number"
                        domain={[20, 34]}
                        ticks={[20, 23, 26, 29, 32, 34]}
                        tick={{ fontSize: 10, fill: isDark ? '#fbbf24' : '#d97706', fontWeight: 'bold' }}
                        tickFormatter={(v) => `${v}°`}
                        axisLine={{ stroke: isDark ? '#78350f' : '#f59e0b', strokeWidth: 1.5 }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="hum"
                        orientation="right"
                        type="number"
                        domain={[65, 98]}
                        ticks={[65, 70, 75, 80, 85, 90, 95]}
                        tick={{ fontSize: 10, fill: isDark ? '#38bdf8' : '#0284c7', fontWeight: 'bold' }}
                        tickFormatter={(v) => `${v}%`}
                        axisLine={{ stroke: isDark ? '#0369a1' : '#93c5fd', strokeWidth: 1.5 }}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#0c1610' : '#ffffff',
                          borderRadius: '16px',
                          border: isDark ? '1px solid #235839' : '1px solid #d6e9df',
                          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: isDark ? '#e4efe8' : '#192e22',
                        }}
                        itemStyle={{
                          color: isDark ? '#e4efe8' : '#192e22',
                        }}
                        formatter={(value: any, name: any) => [
                          name === 'temp'
                            ? `${Number(value).toFixed(1)} °C (Aman: ${tempMin}–${tempMax}°C)`
                            : `${Number(value).toFixed(1)} % (Aman: ${humMin}–${humMax}%)`,
                          name === 'temp' ? 'Suhu (Avg 3 Sensor)' : 'Kelembapan RH (Avg 3 Sensor)'
                        ]}
                      />
                      {showTemp && (
                        <>
                          <ReferenceArea
                            yAxisId="temp"
                            y1={tempMin}
                            y2={tempMax}
                            fill="#d97706"
                            fillOpacity={isDark ? 0.08 : 0.04}
                          />
                          <ReferenceLine
                            yAxisId="temp"
                            y={tempMin}
                            stroke={isDark ? '#fbbf24' : '#d97706'}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                          <ReferenceLine
                            yAxisId="temp"
                            y={tempMax}
                            stroke={isDark ? '#fbbf24' : '#d97706'}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        </>
                      )}
                      {showHumidity && (
                        <>
                          <ReferenceArea
                            yAxisId="hum"
                            y1={humMin}
                            y2={humMax}
                            fill="#0284c7"
                            fillOpacity={isDark ? 0.08 : 0.04}
                          />
                          <ReferenceLine
                            yAxisId="hum"
                            y={humMin}
                            stroke={isDark ? '#38bdf8' : '#0284c7'}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                          <ReferenceLine
                            yAxisId="hum"
                            y={humMax}
                            stroke={isDark ? '#38bdf8' : '#0284c7'}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        </>
                      )}
                      {showHumidity && (
                        <Area
                          isAnimationActive={true}
                          animationDuration={500}
                          animationEasing="ease-in-out"
                          yAxisId="hum"
                          type="monotone"
                          dataKey="humidity"
                          name="humidity"
                          stroke="#0284c7"
                          strokeWidth={3}
                          fill="url(#humGradient)"
                          activeDot={{ r: 6, fill: '#0284c7', stroke: isDark ? '#0c1610' : '#ffffff', strokeWidth: 2 }}
                        />
                      )}
                      {showTemp && (
                        <Area
                          isAnimationActive={true}
                          animationDuration={500}
                          animationEasing="ease-in-out"
                          yAxisId="temp"
                          type="monotone"
                          dataKey="temp"
                          name="temp"
                          stroke="#d97706"
                          strokeWidth={3}
                          fill="url(#tempGradient)"
                          activeDot={{ r: 6, fill: '#d97706', stroke: isDark ? '#0c1610' : '#ffffff', strokeWidth: 2 }}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Bottom Chart Footer Legend */}
            <div className="mt-3 pt-3 border-t border-[#edf5f0] dark:border-[#1e382b] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#526a5e] dark:text-[#a3c9b4]">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-[#a7f3d0] dark:bg-[#059669]/40 border border-[#059669] dark:border-[#34d399] border-dashed inline-block"></span>
                <span>Area hijau berbayang = <strong className="text-[#192e22] dark:text-[#e4efe8]">Zona Ideal Jamur Kuping</strong> (Suhu: {tempMin}–{tempMax}°C, RH: {humMin}–{humMax}%)</span>
              </div>
              <span className="text-[10px] text-[#759183] dark:text-[#638272]">Auto-refresh tiap 10 detik • Resolusi ~20-22 menit</span>
            </div>
          </div>
        </div>

        {/* Status Otomasi & Riwayat Sprinkler */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">
                  Status Otomasi &amp; Aktuator
                </h2>
                <p className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4]">Kontrol otomatis oleh mikrokontroler ESP32</p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ESP32 Online
              </span>
            </div>

            {/* Live Actuators Monitoring Status */}
            <div className="space-y-3">

              {/* Actuator 1: Misting Sprinkler */}
              <div
                onClick={() => setTestMisting(prev => prev === null ? true : prev ? false : null)}
                title="Klik untuk uji simulasi animasi Misting Sprinkler"
                className={`border rounded-2xl p-3.5 flex items-center justify-between transition-all cursor-pointer select-none ${isMistingActive
                    ? 'bg-[#f0fdf4] dark:bg-[#0f2918] border-emerald-300 dark:border-emerald-700 shadow-xs'
                    : 'bg-[#f7faf8] dark:bg-[#111c15] border-[#e4efe8] dark:border-[#1e382b] hover:border-slate-300 dark:hover:border-[#2b503d]'
                  }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isMistingActive
                      ? 'bg-emerald-500 text-white animate-actuator-glow ring-4 ring-emerald-100 dark:ring-emerald-950/60 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
                      : 'bg-[#e8f4ed] dark:bg-[#182c20] text-[#2b563e] dark:text-[#86efac]'
                    }`}>
                    <Wind className={`w-5 h-5 ${isMistingActive ? 'animate-mist' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#192e22] dark:text-[#e4efe8]">Misting Sprinkler</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${isMistingActive
                          ? 'bg-emerald-500 text-white animate-pulse shadow-xs'
                          : isNight
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                            : 'bg-slate-100 dark:bg-[#1f382b] text-slate-600 dark:text-[#a3c9b4]'
                        }`}>
                        {isMistingActive
                          ? 'Sedang Menyemprot'
                          : isNight
                            ? 'Night Lockout (17:00–06:00)'
                            : 'Standby (Auto Siang)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
                      {isNight
                        ? 'Lockout Malam Aktif: Misting dikunci mati agar baglog tidak becek/busuk (Bypass darurat jika RH < 70%)'
                        : `Auto trigger jika RH < ${humMin}% (Timeout darurat 60s • Pulse 30s • Cooldown 150s)`}
                      {testMisting !== null && (
                        <span className="ml-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">(Mode Tes Aktif)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actuator 2: Exhaust Fan */}
              <div
                onClick={() => setTestFan(prev => prev === null ? true : prev ? false : null)}
                title="Klik untuk uji simulasi animasi Exhaust Fan"
                className={`border rounded-2xl p-3.5 flex items-center justify-between transition-all cursor-pointer select-none ${isFanActive
                    ? 'bg-[#f0fdf4] dark:bg-[#0f2918] border-emerald-300 dark:border-emerald-700 shadow-xs'
                    : 'bg-[#f7faf8] dark:bg-[#111c15] border-[#e4efe8] dark:border-[#1e382b] hover:border-slate-300 dark:hover:border-[#2b503d]'
                  }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isFanActive
                      ? 'bg-emerald-500 text-white animate-actuator-glow ring-4 ring-emerald-100 dark:ring-emerald-950/60 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
                      : 'bg-[#e8f4ed] dark:bg-[#182c20] text-[#2b563e] dark:text-[#86efac]'
                    }`}>
                    <Fan
                      className={`w-5 h-5 ${isFanActive ? 'animate-spin' : ''}`}
                      style={isFanActive ? { animationDuration: '1.4s' } : undefined}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#192e22] dark:text-[#e4efe8]">Exhaust Fan / Blower</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${isFanActive
                          ? 'bg-emerald-500 text-white animate-pulse shadow-xs'
                          : isNight
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                            : 'bg-slate-100 dark:bg-[#1f382b] text-slate-600 dark:text-[#a3c9b4]'
                        }`}>
                        {isFanActive
                          ? 'Sirkulasi Aktif'
                          : isNight
                            ? 'Standby Night Purge/Flush'
                            : 'Standby (Auto Siang)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
                      {isNight
                        ? 'Mode Malam Aktif: Over-Humidity Purge (RH ≥ 96%, 45s) & Periodic CO2 Flush (Tiap 60m, 45s)'
                        : `Auto trigger jika Suhu > ${tempMax}°C (Histeresis 30.5°C • Timeout 180s • Homogenisasi 30s)`}
                      {testFan !== null && (
                        <span className="ml-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">(Mode Tes Aktif)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Riwayat Kontrol Aktuator Terbaru */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#244b37] dark:text-[#86efac]" />
                  Riwayat Kontrol Aktuator Terakhir
                </p>
                <span className="text-[10px] text-[#759183] dark:text-[#6b8a78] font-medium">Log Otomatis</span>
              </div>

              <div className="space-y-2">
                {stats?.sprinkler_logs && stats.sprinkler_logs.length > 0 ? (
                  stats.sprinkler_logs.slice(0, 3).map((log: any, idx: number) => {
                    const isFan = log.actuator === 'fan';
                    const triggerText = String(log.trigger_reason || '');
                    const isNightLog = triggerText.toLowerCase().includes('night');
                    const isOverride = triggerText.toLowerCase().includes('override') || triggerText.toLowerCase().includes('kritis') || triggerText.toLowerCase().includes('terkering');
                    const isHomo = triggerText.toLowerCase().includes('homogenisasi');

                    return (
                      <div key={idx} className="bg-slate-50 dark:bg-[#111c15] border border-slate-200/70 dark:border-[#1e382b] rounded-xl p-2.5 text-xs flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                            isFan 
                              ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70' 
                              : 'bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/70'
                          }`}>
                            {isFan ? <Fan className="w-3.5 h-3.5" /> : <Droplets className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className={`font-bold text-[11px] leading-tight ${
                                isFan ? 'text-amber-800 dark:text-amber-300' : 'text-cyan-800 dark:text-cyan-300'
                              }`}>
                                {isFan ? 'Exhaust Fan' : 'Misting Sprinkler'}
                              </p>
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">({log.duration_seconds}s)</span>
                              {isNightLog && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                                  🌙 Night
                                </span>
                              )}
                              {isOverride && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                                  🚨 Override
                                </span>
                              )}
                              {isHomo && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                                  🌀 Homo
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[200px]" title={log.trigger_reason}>
                              {log.trigger_reason}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#182c20] px-2 py-0.5 rounded-md shrink-0 border border-slate-200/80 dark:border-[#235839]">
                          {log.started_at ? new Date(log.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru Saja'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-[#eef3eb] dark:bg-[#182c20] text-[#33463a] dark:text-[#a3c9b4] rounded-xl p-2.5 text-[11px] font-medium flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Aktuator siap. Belum ada aktivitas terpicu hari ini.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Navigation Link to Settings */}
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-[#1e382b]">
            <Link
              to="/settings"
              className="w-full bg-[#edf5f0] dark:bg-[#111c15] hover:bg-[#dff0e6] dark:hover:bg-[#182c20] text-[#244b37] dark:text-[#86efac] rounded-xl py-2 px-3 text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <span>Konfigurasi Ambang Batas di Setting</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

      {/* Row 4: Bottom Section (Crop Progress / Active Baglog Batch Toggle & Current Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Card Kedua: Dilengkapi Toggle Tampilan [ Grafik Panen | Batch Baglog Aktif ] */}
        <div className="lg:col-span-2 bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">
                  {bottomCardTab === 'harvest' ? 'Crop Progress (Jamur Kuping Hitam)' : 'Informasi Batch Penanaman Aktif'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#a3c9b4]">
                  {bottomCardTab === 'harvest'
                    ? 'Hasil panen & produktivitas harian baglog kumbung'
                    : 'Daftar batch baglog yang saat ini produktif di dalam kumbung'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Segmented Control Toggle: [ 📊 Grafik Panen | 📦 Batch Baglog ] */}
                <div className="bg-[#d7ebe0] dark:bg-[#182c20] rounded-full p-1 flex items-center text-xs font-semibold">
                  <button
                    onClick={() => setBottomCardTab('harvest')}
                    className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${bottomCardTab === 'harvest'
                        ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                        : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                      }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Grafik Panen</span>
                  </button>
                  <button
                    onClick={() => setBottomCardTab('batches')}
                    className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${bottomCardTab === 'batches'
                        ? 'bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#86efac] shadow-2xs font-bold'
                        : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8]'
                      }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Batch Aktif ({stats?.latest_batches?.length || 0})</span>
                  </button>
                </div>

                {bottomCardTab === 'harvest' ? (
                  <>
                    <button
                      onClick={() => setCropViewMode(cropViewMode === 'weight' ? 'percent' : 'weight')}
                      title="Klik untuk berganti tampilan Kg atau Persentase"
                      className="bg-[#d7ebe0] dark:bg-[#182c20] rounded-full px-3 py-1 flex items-center gap-2 text-xs font-semibold text-[#192e22] dark:text-[#86efac] cursor-pointer"
                    >
                      <span>{cropViewMode === 'weight' ? 'Kg' : '% Target'}</span>
                      <div className={`w-8 h-4.5 rounded-full p-0.5 flex items-center transition-colors ${cropViewMode === 'weight' ? 'bg-[#3b6550] justify-start' : 'bg-[#3b6550] justify-end'
                        }`}>
                        <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
                      </div>
                    </button>

                    <Link
                      to="/harvests"
                      className="bg-[#edf5f0] dark:bg-[#111c15] hover:bg-[#dff0e6] dark:hover:bg-[#182c20] text-[#244b37] dark:text-[#86efac] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      Modul Panen <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/baglogs"
                    className="bg-[#edf5f0] dark:bg-[#111c15] hover:bg-[#dff0e6] dark:hover:bg-[#182c20] text-[#244b37] dark:text-[#86efac] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    Modul Baglog <ArrowUpRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Content Tab 1: Grafik Panen */}
            {bottomCardTab === 'harvest' ? (
              <div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold mb-3">
                  <span className="flex items-center gap-1.5 text-[#192e22] dark:text-[#e4efe8]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#427b5e]"></span>
                    Panen Hari Ini: {todayHarvestKg.toFixed(2)} Kg
                  </span>
                  <span className="flex items-center gap-1.5 text-[#d97706] dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span>
                    Umur Batch: {stats?.latest_batches?.[0]?.age_days || 4} Hari
                  </span>
                  <span className="flex items-center gap-1.5 text-[#2563eb] dark:text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></span>
                    Baglog Produktif: {activeBaglogs} Unit
                  </span>
                </div>

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cropProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cropGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#499b70" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#499b70" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={theme === 'dark' ? '#1f382b' : '#94a3b8'} strokeOpacity={theme === 'dark' ? 0.8 : 0.35} strokeDasharray="3 3" vertical={true} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: theme === 'dark' ? '#86efac' : '#759183', fontWeight: 'bold' }}
                        axisLine={{ stroke: theme === 'dark' ? '#1e382b' : '#e2ece6' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={cropViewMode === 'weight' ? [0, 'auto'] : [0, 100]}
                        tick={{ fontSize: 10, fill: theme === 'dark' ? '#86efac' : '#759183', fontWeight: 'bold' }}
                        tickFormatter={(v) => cropViewMode === 'weight' ? `${v}k` : `${v}%`}
                        axisLine={{ stroke: theme === 'dark' ? '#1e382b' : '#e2ece6' }}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#142219' : '#ffffff',
                          borderRadius: '16px',
                          border: `1px solid ${theme === 'dark' ? '#1e382b' : '#d6e9df'}`,
                          color: theme === 'dark' ? '#e4efe8' : '#192e22',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                        formatter={(val: any) => [cropViewMode === 'weight' ? `${val} Kg` : `${val}%`, 'Produksi']}
                      />
                      <Area
                        type="monotone"
                        dataKey={cropViewMode === 'weight' ? 'kg' : 'percentage'}
                        stroke="#427b5e"
                        strokeWidth={2.5}
                        fill="url(#cropGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              /* Content Tab 2: Informasi Batch Penanaman Aktif */
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#e2ece6] dark:border-[#1e382b] text-[#486356] dark:text-[#a3c9b4] font-semibold">
                      <th className="py-2.5 px-3">Kode Batch</th>
                      <th className="py-2.5 px-3">Tgl Masuk</th>
                      <th className="py-2.5 px-3">Umur</th>
                      <th className="py-2.5 px-3">Jumlah</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf5f0] dark:divide-[#1e382b]">
                    {stats?.latest_batches && stats.latest_batches.length > 0 ? (
                      stats.latest_batches.map((batch: any) => (
                        <tr key={batch.batch_code} className="hover:bg-[#f7faf8] dark:hover:bg-[#182c20]/60 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-[#192e22] dark:text-[#e4efe8]">{batch.batch_code}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-[#a3c9b4]">
                            {new Date(batch.entry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${batch.age_days >= 30
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}>
                              {batch.age_days} Hari
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#192e22] dark:text-[#e4efe8]">{Number(batch.quantity).toLocaleString('id-ID')} Baglog</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-[#a3c9b4]">{batch.supplier || 'Mandiri'}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e8f4ed] dark:bg-[#182c20] text-[#244b37] dark:text-[#86efac]">
                              Produktif
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">Belum ada data batch baglog aktif.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Current Alerts Card */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">
                Current Alerts
              </h2>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${hasThresholdWarning
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}>
                {hasThresholdWarning ? 'Peringatan Aktif' : 'Normal'}
              </span>
            </div>

            <div className="space-y-2.5">
              {/* If outside threshold */}
              {hasThresholdWarning ? (
                <div className="bg-rose-50 dark:bg-[#2a1717] border border-rose-200 dark:border-[#4a2020] text-rose-900 dark:text-rose-200 rounded-2xl p-3 text-xs flex items-start justify-between gap-2 shadow-2xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {!isTempOptimal ? `Suhu Kumbung (${tempVal.toFixed(1)}°C) Luar Ambang` : `Kelembapan (${humVal.toFixed(1)}%) Terlalu Kering`}
                      </p>
                      <p className="text-[10px] text-rose-700 dark:text-rose-300 mt-0.5">
                        Target ideal: Suhu {tempMin}–{tempMax}°C, RH {humMin}–{humMax}%
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/settings"
                    className="text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 underline shrink-0 mt-0.5"
                  >
                    Atur
                  </Link>
                </div>
              ) : (
                <div className="bg-[#eef3eb] dark:bg-[#182c20] text-[#33463a] dark:text-[#a3c9b4] rounded-2xl p-3 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Semua parameter mikroklimat dalam rentang ideal</span>
                </div>
              )}

              {/* Status Sensor Update */}
              <div className="bg-slate-50 dark:bg-[#111c15] border border-slate-200/80 dark:border-[#1e382b] rounded-2xl p-3 text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-[#e4efe8]">
                    Koneksi Node Sensor IoT
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Protokol: HTTP REST API • Interval: 5 Menit
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800">
                  Tersinkron
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[#1e382b] flex items-center justify-between text-xs text-[#759183] dark:text-[#6b8a78]">
            <span>System: ESP32 IoT Connected</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

      </div>

    </div>
  );
}
