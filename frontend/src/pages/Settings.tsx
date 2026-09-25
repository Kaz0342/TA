import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import api from '../services/api';
import {
  Thermometer,
  Droplets,
  Save,
  Sprout,
  Sparkles,
  CheckCircle2,
  Sliders,
  Layers,
  Cpu,
  Clock,
  Fan,
  ShieldCheck,
  User,
  Activity,
  History,
  Lock,
  Sun,
  Moon,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '../stores/themeStore';

type PhaseMode = 'incubation' | 'primordia' | 'fruiting' | 'custom';

interface PhasePreset {
  id: 'incubation' | 'primordia' | 'fruiting';
  name: string;
  subName: string;
  tempMin: string;
  tempMax: string;
  humMin: string;
  humMax: string;
  desc: string;
}

interface SprinklerLogItem {
  started_at: string;
  actuator: string;
  duration_seconds: number;
  trigger_reason: string;
  stop_reason?: string | null;
}

const PHASE_PRESETS: PhasePreset[] = [
  {
    id: 'incubation',
    name: 'Fase Inkubasi',
    subName: 'Profil Vegetatif (Miselium)',
    tempMin: '26.00',
    tempMax: '30.00',
    humMin: '65.00',
    humMax: '75.00',
    desc: 'Misting minimal dengan sirkulasi tenang untuk merangsang kolonisasi miselium tebal dan mencegah pembusukan baglog.',
  },
  {
    id: 'primordia',
    name: 'Fase Primordia',
    subName: 'Transisi Generatif (Bakal Buah)',
    tempMin: '24.00',
    tempMax: '28.00',
    humMin: '85.00',
    humMax: '90.00',
    desc: 'Environmental shock (suhu sejuk & RH naik tajam) untuk memicu pembentukan pinhead bakal buah jamur kuping hitam.',
  },
  {
    id: 'fruiting',
    name: 'Fase Fruiting',
    subName: 'Profil Generatif (Masa Panen)',
    tempMin: '24.00',
    tempMax: '32.00',
    humMin: '85.00',
    humMax: '95.00',
    desc: 'Kelembaban konstan tinggi agar daun jamur kuping mekar tebal, kenyal gelatinous, dan menghasilkan bobot timbangan maksimal.',
  },
];

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  const { theme, setTheme } = useThemeStore();

  const [minTemp, setMinTemp] = useState('24.00');
  const [maxTemp, setMaxTemp] = useState('32.00');
  const [minHum, setMinHum] = useState('80.00');
  const [maxHum, setMaxHum] = useState('93.00');
  const [phaseMode, setPhaseMode] = useState<PhaseMode>('fruiting');
  const [actuatorFilter, setActuatorFilter] = useState<'all' | 'misting' | 'fan'>('all');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Fetch Dashboard Stats untuk mendapatkan sprinkler logs & status perangkat
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  // Query dedicated sprinkler logs with actuator filter and limit
  const { data: dedicatedLogs } = useQuery({
    queryKey: ['sprinklerLogsList', actuatorFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '10');
      if (actuatorFilter !== 'all') {
        params.append('actuator', actuatorFilter);
      }
      const res = await api.get(`/sprinkler-logs?${params.toString()}`);
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    fetchThresholds();
  }, []);

  const fetchThresholds = async () => {
    try {
      const res = await api.get('/thresholds');
      if (res.data.success && res.data.data) {
        const t = res.data.data;
        const fetchedMinTemp = parseFloat(t.temp_min).toFixed(2);
        const fetchedMaxTemp = parseFloat(t.temp_max).toFixed(2);
        const fetchedMinHum = parseFloat(t.humidity_min).toFixed(2);
        const fetchedMaxHum = parseFloat(t.humidity_max).toFixed(2);

        setMinTemp(fetchedMinTemp);
        setMaxTemp(fetchedMaxTemp);
        setMinHum(fetchedMinHum);
        setMaxHum(fetchedMaxHum);

        if (t.phase_mode && ['incubation', 'primordia', 'fruiting', 'custom'].includes(t.phase_mode)) {
          setPhaseMode(t.phase_mode);
        } else {
          detectPhaseMode(fetchedMinTemp, fetchedMaxTemp, fetchedMinHum, fetchedMaxHum);
        }
      }
    } catch (error) {
      console.error('Failed to fetch thresholds', error);
    } finally {
      setFetching(false);
    }
  };

  // Deteksi otomatis kesesuaian angka dengan preset
  const detectPhaseMode = (tMin: string, tMax: string, hMin: string, hMax: string) => {
    const match = PHASE_PRESETS.find(
      (p) =>
        parseFloat(p.tempMin) === parseFloat(tMin) &&
        parseFloat(p.tempMax) === parseFloat(tMax) &&
        parseFloat(p.humMin) === parseFloat(hMin) &&
        parseFloat(p.humMax) === parseFloat(hMax)
    );
    setPhaseMode(match ? match.id : 'custom');
  };

  // 1-Klik Terapkan Preset
  const handleApplyPreset = (preset: PhasePreset) => {
    setMinTemp(preset.tempMin);
    setMaxTemp(preset.tempMax);
    setMinHum(preset.humMin);
    setMaxHum(preset.humMax);
    setPhaseMode(preset.id);
    addToast(`Preset ${preset.name} dipilih! Klik "Simpan Konfigurasi" untuk menerapkan ke ESP32.`, 'info');
  };

  const handleManualChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    val: string,
    field: 'minTemp' | 'maxTemp' | 'minHum' | 'maxHum'
  ) => {
    setter(val);
    const updated = {
      minTemp: field === 'minTemp' ? val : minTemp,
      maxTemp: field === 'maxTemp' ? val : maxTemp,
      minHum: field === 'minHum' ? val : minHum,
      maxHum: field === 'maxHum' ? val : maxHum,
    };
    detectPhaseMode(updated.minTemp, updated.maxTemp, updated.minHum, updated.maxHum);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        temp_min: parseFloat(minTemp),
        temp_max: parseFloat(maxTemp),
        humidity_min: parseFloat(minHum),
        humidity_max: parseFloat(maxHum),
        phase_mode: phaseMode,
      };

      const res = await api.put('/thresholds', payload);

      if (res.data.success) {
        addToast('Batas ambang & profil fase jamur berhasil disinkronisasi ke ESP32!', 'success');
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Gagal menyimpan konfigurasi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Guard hak akses: Hanya admin yang bisa mengedit setting
  if (user && user.role !== 'admin') {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#192e22] dark:text-[#e4efe8]">Akses Dibatasi</h2>
        <p className="text-[#37473f] dark:text-[#a3c9b4] text-sm">
          Halaman Pengaturan Threshold hanya dapat diakses oleh akun dengan peran <strong>Administrator</strong>. Silakan hubungi pengelola sistem.
        </p>
      </div>
    );
  }

  const sprinklerLogs: SprinklerLogItem[] = dedicatedLogs ?? (dashboardStats?.sprinkler_logs || []);

  const renderTriggerBadge = (reason: string) => {
    if (reason.includes('Night Over-Humidity Purge')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
          <Moon className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          Night Purge
        </span>
      );
    }
    if (reason.includes('Night Periodic CO2 Flush')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shrink-0">
          <Moon className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          CO2 Flush
        </span>
      );
    }
    if (reason.includes('Safety Override') || reason.includes('Sensor Terkering') || reason.toLowerCase().includes('kritis')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 shrink-0">
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          Safety Override
        </span>
      );
    }
    if (reason.includes('Homogenisasi')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
          <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Homogenisasi
        </span>
      );
    }
    if (reason.includes('Pulse Misting')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 shrink-0">
          <Droplets className="w-3 h-3 text-sky-600 dark:text-sky-400" />
          Pulse Misting
        </span>
      );
    }
    if (reason.includes('Kelembaban') || reason.includes('RH')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 shrink-0">
          <Droplets className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
          RH Rendah
        </span>
      );
    }
    if (reason.includes('Suhu')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shrink-0">
          <Thermometer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Suhu Panas
        </span>
      );
    }
    return null;
  };

  const renderStopBadge = (reason?: string | null) => {
    const text = reason || 'Batas durasi tercapai';
    if (text.includes('Kelembaban target') || text.includes('Suhu normal') || text.includes('Target')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Target Tercapai
        </span>
      );
    }
    if (text.includes('Night Lockout')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
          <Moon className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          Night Lockout
        </span>
      );
    }
    if (text.includes('Cooldown')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
          <ShieldCheck className="w-3 h-3 text-slate-600 dark:text-slate-400" />
          Cooldown Aktif
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shrink-0">
        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        Timeout Proteksi
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-7 animate-in fade-in duration-300 pb-16">
      
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e8f4ed] dark:bg-[#163321] text-[#244b37] dark:text-[#86efac] border border-[#d6e9df] dark:border-[#235839] text-[11px] font-semibold mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kontrol Ambang Mikroklimat • Akses Administrator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
            Pengaturan &amp; Ambang Otomasi
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#486356] dark:text-[#a3c9b4] mt-0.5">
            Konfigurasi batas aman mikroklimat kumbung jamur kuping hitam yang disinkronkan langsung ke mikrokontroler ESP32
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#eef7f2] dark:bg-[#162a1f] border border-[#cbe5d7] dark:border-[#235839] text-xs font-semibold text-[#244b37] dark:text-[#86efac]">
            <span className="w-2 h-2 rounded-full bg-[#244b37] dark:bg-[#86efac] animate-pulse" />
            <span>Otomasi Aktif</span>
          </div>
          <button
            form="thresholdForm"
            type="submit"
            disabled={loading || fetching}
            className="bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] active:scale-[0.98] text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 stroke-[2.2]" />
            <span>{loading ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
          </button>
        </div>
      </div>

      {fetching ? (
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-12 text-center text-[#486356] dark:text-[#a3c9b4] font-medium shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="w-8 h-8 rounded-full border-2 border-[#244b37] dark:border-[#86efac] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm">Memuat konfigurasi threshold kumbung dari database...</p>
        </div>
      ) : (
        <div className="space-y-7">

          {/* 2. Profil Fase Biologi Jamur Kuping (1-Click Presets) */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#244b37] dark:text-[#86efac]" />
                  Profil Fase Pertumbuhan Jamur Kuping
                </h2>
                <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
                  Pilih salah satu profil standar biologi di bawah ini untuk mengisi batas suhu dan kelembaban secara instan.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#edf5f0] dark:bg-[#1a3324] text-[#244b37] dark:text-[#86efac] border border-[#cbe5d7] dark:border-[#235839]">
                Mode: {phaseMode.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {PHASE_PRESETS.map((preset) => {
                const isActive = phaseMode === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`rounded-3xl border p-5 sm:p-6 transition-all duration-200 flex flex-col justify-between ${
                      isActive
                        ? 'border-[#244b37] dark:border-[#4ade80] ring-2 ring-[#244b37]/20 dark:ring-[#4ade80]/20 shadow-md bg-[#f9fcfa] dark:bg-[#16271c]'
                        : 'bg-white dark:bg-[#142219] border-[#d6e9df] dark:border-[#1e382b] hover:border-[#a5d1b7] dark:hover:border-[#2e7d52] shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Icon & Title */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-[#244b37] dark:bg-[#2e7d52] text-white' : 'bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac]'
                          }`}>
                            {preset.id === 'incubation' && <Sprout className="w-5 h-5 stroke-[2.2]" />}
                            {preset.id === 'primordia' && <Sparkles className="w-5 h-5 stroke-[2.2]" />}
                            {preset.id === 'fruiting' && <Droplets className="w-5 h-5 stroke-[2.2]" />}
                          </div>
                          <div>
                            <h3 className="font-bold text-[#192e22] dark:text-[#e4efe8] text-base leading-tight">
                              {preset.name}
                            </h3>
                            <span className="text-[11px] font-medium text-[#759183] dark:text-[#6b8a78]">
                              {preset.subName}
                            </span>
                          </div>
                        </div>

                        {isActive && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#e8f4ed] dark:bg-[#1a3324] text-[#244b37] dark:text-[#86efac] border border-[#cbe5d7] dark:border-[#235839] shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Aktif
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] leading-relaxed mb-4 min-h-[42px]">
                        {preset.desc}
                      </p>

                      {/* Parameters Pills */}
                      <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-2xl bg-[#edf5f0]/80 dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b]">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#759183] dark:text-[#6b8a78] block">Suhu Ideal</span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#192e22] dark:text-[#e4efe8]">
                            {preset.tempMin} – {preset.tempMax} °C
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#759183] dark:text-[#6b8a78] block">Kelembapan</span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#192e22] dark:text-[#e4efe8]">
                            {preset.humMin} – {preset.humMax} %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-[#e8f4ed] dark:bg-[#163321] text-[#244b37] dark:text-[#86efac] border border-[#cbe5d7] dark:border-[#235839] font-extrabold cursor-default'
                          : 'bg-[#f7faf8] dark:bg-[#111c15] hover:bg-[#edf5f0] dark:hover:bg-[#1a2e21] text-[#37473f] dark:text-[#a3c9b4] border border-[#d6e9df] dark:border-[#1e382b] active:scale-[0.98]'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Profil Sedang Dipakai</span>
                        </>
                      ) : (
                        <span>Terapkan Profil Ini</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Form Fine-Tuning Manual & Visualizer Rentang Aman */}
          <div className="space-y-4">
            
            {/* Status Indicator Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs text-[#759183] dark:text-[#6b8a78] block">Status Parameter Aktif:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#192e22] dark:text-[#e4efe8] text-sm">
                      {phaseMode === 'incubation' && 'Fase Inkubasi (Vegetatif)'}
                      {phaseMode === 'primordia' && 'Fase Primordia (Transisi)'}
                      {phaseMode === 'fruiting' && 'Fase Fruiting (Generatif)'}
                      {phaseMode === 'custom' && 'Mode Kustom (Manual Fine-Tuning)'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#edf5f0] dark:bg-[#1a3324] text-[#244b37] dark:text-[#86efac] border border-[#cbe5d7] dark:border-[#235839]">
                      {phaseMode === 'custom' ? 'Kustom' : 'Standar Biologi'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#526a5e] dark:text-[#a3c9b4] sm:text-right">
                Batas di bawah ini mengatur logika pemicu otomatis Misting Sprinkler &amp; Exhaust Fan.
              </div>
            </div>

            {/* Manual Form Cards */}
            <form id="thresholdForm" onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Batas Suhu */}
                <div className="p-6 rounded-3xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-[#eef5f1] dark:border-[#1e382b]">
                    <div className="w-9 h-9 rounded-2xl bg-[#fef7ee] dark:bg-[#332205] text-[#b45309] dark:text-[#fbbf24] border border-[#fde68a] dark:border-[#78350f] flex items-center justify-center">
                      <Thermometer className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">Batas Suhu Kumbung (°C)</h2>
                      <p className="text-xs text-[#759183] dark:text-[#6b8a78]">Toleransi temperatur untuk sirkulasi &amp; pendinginan</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    
                    {/* Suhu Minimum */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                        Suhu Minimum (°C)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={minTemp}
                          onChange={(e) => handleManualChange(setMinTemp, e.target.value, 'minTemp')}
                          className="w-full pl-4 pr-12 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-bold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#759183] dark:text-[#6b8a78]">
                          °C
                        </span>
                      </div>
                      <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-1">
                        Batas bawah zona aman. Di bawah suhu ini, exhaust fan tidak membuang hawa hangat.
                      </p>
                    </div>

                    {/* Suhu Maksimum */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                        Suhu Maksimum (°C) — Pemicu Exhaust Fan
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={maxTemp}
                          onChange={(e) => handleManualChange(setMaxTemp, e.target.value, 'maxTemp')}
                          className="w-full pl-4 pr-12 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-bold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#759183] dark:text-[#6b8a78]">
                          °C
                        </span>
                      </div>
                      <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-1">
                        Pemicu exhaust fan menyala untuk membuang panas kumbung ke luar.
                      </p>
                    </div>

                    {/* Range Visualizer Suhu */}
                    <div className="p-3 rounded-2xl bg-[#edf5f0] dark:bg-[#111c15] border border-[#cbe5d7] dark:border-[#1e382b] text-xs">
                      <div className="flex justify-between font-bold text-[#192e22] dark:text-[#e4efe8] mb-1">
                        <span>Zona Aman Suhu:</span>
                        <span>{minTemp}°C – {maxTemp}°C</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-[#1f382b] rounded-full overflow-hidden flex">
                        <div className="w-1/4 bg-blue-300 dark:bg-blue-600" title="Zona Dingin" />
                        <div className="w-2/4 bg-[#244b37] dark:bg-[#4ade80]" title="Zona Ideal Kumbung" />
                        <div className="w-1/4 bg-rose-400 dark:bg-rose-600" title="Zona Panas (Fan ON)" />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Batas Kelembapan */}
                <div className="p-6 rounded-3xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-[#eef5f1] dark:border-[#1e382b]">
                    <div className="w-9 h-9 rounded-2xl bg-[#e8f4fd] dark:bg-[#0f283d] text-[#0284c7] dark:text-[#38bdf8] border border-[#bae6fd] dark:border-[#0369a1] flex items-center justify-center">
                      <Droplets className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">Batas Kelembapan (RH %)</h2>
                      <p className="text-xs text-[#759183] dark:text-[#6b8a78]">Rentang Relative Humidity pemicu misting sprinkler</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    
                    {/* Kelembapan Minimum */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                        Kelembapan Minimum (%) — Pemicu Misting ON
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={minHum}
                          onChange={(e) => handleManualChange(setMinHum, e.target.value, 'minHum')}
                          className="w-full pl-4 pr-12 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-bold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#759183] dark:text-[#6b8a78]">
                          %
                        </span>
                      </div>
                      <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-1">
                        Pemicu misting sprinkler otomatis menyala saat kumbung terlalu kering.
                      </p>
                    </div>

                    {/* Kelembapan Maksimum */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                        Kelembapan Maksimum (%) — Target Henti
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={maxHum}
                          onChange={(e) => handleManualChange(setMaxHum, e.target.value, 'maxHum')}
                          className="w-full pl-4 pr-12 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-bold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37]"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#759183] dark:text-[#6b8a78]">
                          %
                        </span>
                      </div>
                      <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] mt-1">
                        Target batas atas misting sprinkler otomatis berhenti agar baglog tidak becek.
                      </p>
                    </div>

                    {/* Range Visualizer Kelembapan */}
                    <div className="p-3 rounded-2xl bg-[#edf5f0] dark:bg-[#111c15] border border-[#cbe5d7] dark:border-[#1e382b] text-xs">
                      <div className="flex justify-between font-bold text-[#192e22] dark:text-[#e4efe8] mb-1">
                        <span>Zona Aman Kelembapan:</span>
                        <span>{minHum}% – {maxHum}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-[#1f382b] rounded-full overflow-hidden flex">
                        <div className="w-1/4 bg-amber-300 dark:bg-amber-600" title="Kering (Misting ON)" />
                        <div className="w-2/4 bg-[#244b37] dark:bg-[#4ade80]" title="Zona Lembap Ideal" />
                        <div className="w-1/4 bg-sky-400 dark:bg-sky-600" title="Sangat Lembap (Misting OFF)" />
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Bottom Submit Card */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <div className="text-xs text-[#526a5e] dark:text-[#a3c9b4] leading-relaxed">
                  Perubahan batas akan otomatis dibaca oleh mikrokontroler <strong>ESP32</strong> saat siklus polling berikutnya (~10 detik).
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] active:scale-[0.98] text-white px-7 py-3 rounded-2xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4 stroke-[2.2]" />
                  <span>{loading ? 'Menyimpan...' : 'Terapkan & Simpan Konfigurasi'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* 4. Matriks Logika Otomasi Aktuator ESP32 */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#eef5f1] dark:border-[#1e382b]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                  <Activity className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">Matriks Logika Otomasi Aktuator ESP32 (SSC v3.5)</h2>
                  <p className="text-xs text-[#759183] dark:text-[#6b8a78]">Algoritma multi-tier mikroklimat cerdas: Misting 4-Tier Guard &amp; Exhaust Fan 5-Tier Adaptive Ventilation</p>
                </div>
              </div>
              <span className="self-start sm:self-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Firmware Engine v3.5
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Logika Misting */}
              <div className="p-5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#192e22] dark:text-[#e4efe8]">
                    <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <span>Misting Sprinkler (4-Tier Safety Guard)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60">
                    Lockout 17:00–06:00
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 text-[10px] flex items-center justify-center font-bold">1</span>
                      <span>Tier 1: Normal Daytime Misting (06:00–17:00 WIB)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Menyala saat RH fusi &lt; <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{minHum}%</span> (atau Suhu fusi &gt; <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{maxTemp}°C</span> untuk pendinginan evaporatif). Mati jika RH mencapai target histeresis stabil (~{(Math.min(parseFloat(maxHum) - 4.0, parseFloat(minHum) + 5.0)).toFixed(0)}%) atau batas maksimal 60 detik.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 text-[10px] flex items-center justify-center font-bold">2</span>
                      <span>Tier 2: Pulse Misting (Mikro-Dosis 30s)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Jika defisit kelembapan tipis (&lt; 5% di bawah batas ideal), pompa hanya menyala pulsa 30 detik untuk mencegah over-saturation dan tetesan air menggenang di baglog.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 text-[10px] flex items-center justify-center font-bold">3</span>
                      <span>Tier 3: Anti-Waterlogging Cooldown (150s)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Setelah pompa kabut mati, mikrokontroler wajib menahan istirahat (cooldown) minimal 150 detik agar partikel kabut sempat menguap &amp; menyatu dengan udara kumbung.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 text-[10px] flex items-center justify-center font-bold">4</span>
                      <span>Tier 4: Night Lockout Protection (17:00–06:00 WIB)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Misting dikunci mati total saat malam hari karena RH alami lingkungan malam sudah tinggi (&gt; 90%). Mencegah pembusukan miselium &amp; infeksi bakteri pseudomonas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Logika Fan */}
              <div className="p-5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#192e22] dark:text-[#e4efe8]">
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                      <Fan className="w-4 h-4" />
                    </div>
                    <span>Exhaust Fan (5-Tier Adaptive Ventilation)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                    Dual Safety Guard
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] flex items-center justify-center font-bold">1</span>
                      <span>Tier 1: Daytime Evaporative Cooling</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Menyala jika Suhu fusi &gt; <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{maxTemp}°C</span>. Histeresis cut-off di <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">{(parseFloat(maxTemp) - 1.5).toFixed(1)}°C</span> atau batas 180s. Dilengkapi anti-chattering cooldown 60s.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[10px] flex items-center justify-center font-bold">2</span>
                      <span>Tier 2: Safety Override (Sensor Tunggal Kritis)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Fan dipaksa ON jika ada 1 sensor mendeteksi suhu ekstrem (&gt; 34°C) atau RH drop parah (&lt; 65%), mengabaikan siklus normal demi menyelamatkan baglog dari thermal shock.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] flex items-center justify-center font-bold">3</span>
                      <span>Tier 3: Periodic Homogenisasi (30s / 15 Menit)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Sirkulasi halus 30 detik tiap 15 menit pada siang hari untuk meratakan gradien mikroklimat segitiga kumbung tanpa menurunkan RH secara drastis.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] flex items-center justify-center font-bold">4</span>
                      <span>Tier 4: Night Over-Humidity Purge (45s • Cooldown 30m)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Aktif 45 detik saat malam hari jika kelembapan udara mencapai saturasi jenuh (RH ≥ 96%) untuk memecah uap stagnan. Siklus purge otomatis mereset timer CO2 flush karena udara &amp; gas lantai sudah ikut tersegarkan.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#16271c] border border-slate-100 dark:border-[#1f3b2a] space-y-1">
                    <div className="font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] flex items-center justify-center font-bold">5</span>
                      <span>Tier 5: Night Periodic CO2 Flush (45s / 60 Menit Fallback)</span>
                    </div>
                    <p className="text-[#526a5e] dark:text-[#a3c9b4] text-[11px] leading-relaxed pl-5.5">
                      Sirkulasi udara segar 45 detik tiap 1 jam sebagai fallback jika kumbung tidak mengalami purge (RH &lt; 96%). Timer terkoordinasi menjamin fan malam hanya nyala maksimal 1–2 kali/jam demi menjaga suhu stabil.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 5. Telemetri Hardware IoT & Riwayat Sprinkler */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left (1 Col): Status Hardware IoT */}
            <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#eef5f1] dark:border-[#1e382b]">
                <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                  <Cpu className="w-4 h-4 stroke-[2.2]" />
                </div>
                <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">Telemetri IoT Node</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1e382b]">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Node ID:</span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">ESP32-KUMBUNG-01</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1e382b]">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Firmware Engine:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">v3.5.0 (SSC Multi-Tier)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1e382b]">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Status Jaringan:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#244b37] dark:text-[#86efac]">
                    <span className="w-2 h-2 rounded-full bg-[#244b37] dark:bg-[#86efac] animate-pulse" />
                    Online (WiFi Local)
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1e382b]">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Sensor Input:</span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">3x DHT22 (Segitiga Diagonal)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1e382b]">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Algoritma Fusi:</span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">Weighted Tri-Sensor Fusion</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1e382b]">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Interval Polling:</span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">10 Detik (Real-Time Sync)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1e382b]">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Fan Protection:</span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">Anti-Chattering (60s Cooldown)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[#759183] dark:text-[#6b8a78]">Database Storage:</span>
                  <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">SQLite Local (ACID)</span>
                </div>
              </div>
            </div>

            {/* Right (2 Cols): Riwayat Log Sprinkler Terakhir */}
            <div className="lg:col-span-2 bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#eef5f1] dark:border-[#1e382b] gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center shrink-0">
                    <History className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">Log Aktivitas Kontrol Otomatis</h2>
                    <p className="text-xs text-[#759183] dark:text-[#6b8a78]">Catatan aktivasi penyemprotan kabut (Misting) &amp; sirkulasi udara (Fan) oleh mikrokontroler</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-[#111c15] p-1 rounded-xl border border-slate-200 dark:border-[#1e382b]">
                  <button
                    type="button"
                    onClick={() => setActuatorFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      actuatorFilter === 'all'
                        ? 'bg-white dark:bg-[#1e382b] text-[#192e22] dark:text-[#86efac] shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setActuatorFilter('misting')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      actuatorFilter === 'misting'
                        ? 'bg-white dark:bg-[#1e382b] text-cyan-700 dark:text-cyan-300 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Droplets className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    Misting
                  </button>
                  <button
                    type="button"
                    onClick={() => setActuatorFilter('fan')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      actuatorFilter === 'fan'
                        ? 'bg-white dark:bg-[#1e382b] text-amber-700 dark:text-amber-300 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Fan className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    Exhaust Fan
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#e4efe8] dark:border-[#1e382b]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#edf5f0] dark:bg-[#111c15] text-[#192e22] dark:text-[#a3c9b4] font-bold uppercase tracking-wider text-[11px] border-b border-[#d6e9df] dark:border-[#1e382b]">
                    <tr>
                      <th className="px-4 py-3">Waktu Mulai</th>
                      <th className="px-4 py-3">Aktuator</th>
                      <th className="px-4 py-3 text-right">Durasi</th>
                      <th className="px-4 py-3">Alasan Pemicu</th>
                      <th className="px-4 py-3">Alasan Berhenti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef5f1] dark:divide-[#1a3023] bg-white dark:bg-[#142219]">
                    {sprinklerLogs.length > 0 ? (
                      sprinklerLogs.map((log, idx) => {
                        const isFan = log.actuator === 'fan';
                        return (
                          <tr key={idx} className="hover:bg-[#f7faf8] dark:hover:bg-[#192b20]/60 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap align-top">
                              <div className="font-mono text-[11px] font-semibold text-[#192e22] dark:text-[#e4efe8]">
                                {new Date(log.started_at).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })} WIB
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                {new Date(log.started_at).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              {isFan ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs">
                                  <Fan className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  Exhaust Fan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 shadow-2xs">
                                  <Droplets className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                  Misting Sprinkler
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-[#192e22] dark:text-[#e4efe8] align-top">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 font-mono text-[11px]">
                                {log.duration_seconds}s
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <div>{renderTriggerBadge(log.trigger_reason)}</div>
                                <span className="block text-slate-600 dark:text-slate-300 text-xs font-medium leading-relaxed">
                                  {log.trigger_reason}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <div>{renderStopBadge(log.stop_reason)}</div>
                                <span className="block text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                                  {log.stop_reason || 'Batas durasi tercapai'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                          <Clock className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                          <p className="font-semibold text-slate-600 dark:text-slate-300">Belum ada log penyemprotan otomatis.</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">Sprinkler &amp; Fan akan mencatat log saat kelembapan atau suhu memicu otomasi.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* 6. Preferensi Tampilan & Tema (Dark Mode / Light Mode) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eef5f1] dark:border-[#1e382b]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center">
                  {theme === 'dark' ? <Moon className="w-4 h-4 stroke-[2.2]" /> : <Sun className="w-4 h-4 stroke-[2.2]" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">Preferensi Tampilan Aplikasi</h2>
                  <p className="text-xs text-[#759183] dark:text-[#6b8a78]">Pilih tema tampilan yang nyaman di mata untuk monitoring 24/7</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#edf5f0] dark:bg-[#1a3324] text-[#244b37] dark:text-[#86efac]">
                Aktif: {theme === 'dark' ? 'Mode Gelap (Forest Emerald)' : 'Mode Terang (Clean Sage)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Option 1: Light Mode */}
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  addToast('Tema Mode Terang (Clean Sage) diaktifkan!', 'info');
                }}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  theme === 'light'
                    ? 'bg-[#e8f4ed] border-[#244b37] ring-2 ring-[#244b37]/20 shadow-xs'
                    : 'bg-[#f7faf8] dark:bg-[#111c15] hover:bg-[#edf5f0] dark:hover:bg-[#18291d] border-[#d6e9df] dark:border-[#1e382b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#d6e9df] text-amber-500 flex items-center justify-center shadow-2xs">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Mode Terang (Clean Sage)</h3>
                    <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4]">Palet natural hijau lumut segar, optimal untuk siang hari</p>
                  </div>
                </div>
                {theme === 'light' && <CheckCircle2 className="w-5 h-5 text-[#244b37] shrink-0" />}
              </button>

              {/* Option 2: Dark Mode */}
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  addToast('Tema Mode Gelap (Forest Emerald) diaktifkan!', 'info');
                }}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#182e21] border-[#4ade80] ring-2 ring-[#4ade80]/20 shadow-xs'
                    : 'bg-[#f7faf8] dark:bg-[#111c15] hover:bg-[#edf5f0] dark:hover:bg-[#18291d] border-[#d6e9df] dark:border-[#1e382b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0c140e] border border-[#1e382b] text-[#86efac] flex items-center justify-center shadow-2xs">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#192e22] dark:text-[#e4efe8]">Mode Gelap (Forest Emerald)</h3>
                    <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4]">Nuansa hutan malam lembut, nyaman di mata saat begadang</p>
                  </div>
                </div>
                {theme === 'dark' && <CheckCircle2 className="w-5 h-5 text-[#86efac] shrink-0" />}
              </button>

            </div>
          </div>

          {/* 7. Info Akun & Keamanan */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center shrink-0">
                <User className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="text-xs">
                <span className="text-[#759183] dark:text-[#6b8a78]">Pengguna Login:</span>
                <p className="font-bold text-[#192e22] dark:text-[#e4efe8]">{user?.name} ({user?.email})</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#759183] dark:text-[#6b8a78]">
              <ShieldCheck className="w-4 h-4 text-[#244b37] dark:text-[#86efac]" />
              <span>Sistem dilindungi otentikasi Bearer Token Laravel Sanctum &amp; Role Guard.</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
