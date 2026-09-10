import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { Card, Button } from '../components/ui';
import api from '../services/api';
import {
  Thermometer,
  Droplets,
  Save,
  Sprout,
  Sparkles,
  CheckCircle2,
  Sliders,
  Layers
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

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
  colorBg: string;
  borderColor: string;
  iconBg: string;
}

const PHASE_PRESETS: PhasePreset[] = [
  {
    id: 'incubation',
    name: 'Fase Inkubasi',
    subName: 'Profil Vegetatif',
    tempMin: '26.00',
    tempMax: '30.00',
    humMin: '65.00',
    humMax: '75.00',
    desc: 'Misting minimal, sirkulasi pelan untuk merangsang kolonisasi miselium tebal & cegah jamur liar.',
    colorBg: 'bg-[#dcfce7]',
    borderColor: 'border-emerald-600',
    iconBg: 'bg-emerald-200 text-emerald-900',
  },
  {
    id: 'primordia',
    name: 'Fase Primordia',
    subName: 'Transisi Generatif',
    tempMin: '24.00',
    tempMax: '28.00',
    humMin: '85.00',
    humMax: '90.00',
    desc: 'Environmental shock (suhu sejuk & RH naik) untuk memicu pembentukan pinhead bakal buah.',
    colorBg: 'bg-[#fef9c3]',
    borderColor: 'border-amber-600',
    iconBg: 'bg-amber-200 text-amber-900',
  },
  {
    id: 'fruiting',
    name: 'Fase Fruiting',
    subName: 'Profil Generatif (Panen)',
    tempMin: '24.00',
    tempMax: '32.00',
    humMin: '85.00',
    humMax: '95.00',
    desc: 'Kelembaban konstan tinggi agar daun jamur kuping mekar tebal, kenyal gelatinous, dan bobot optimal.',
    colorBg: 'bg-[#e0f2fe]',
    borderColor: 'border-sky-600',
    iconBg: 'bg-sky-200 text-sky-900',
  },
];

export default function Settings() {
  const user = useAuthStore((state) => state.user);

  const [minTemp, setMinTemp] = useState('24.00');
  const [maxTemp, setMaxTemp] = useState('32.00');
  const [minHum, setMinHum] = useState('80.00');
  const [maxHum, setMaxHum] = useState('95.00');
  const [phaseMode, setPhaseMode] = useState<PhaseMode>('fruiting');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const addToast = useToastStore((state) => state.addToast);

  // useEffect HARUS dipanggil SEBELUM conditional return (Rules of Hooks)
  useEffect(() => {
    fetchThresholds();
  }, []);

  // Guard clause: redirect non-admin SETELAH semua hooks
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

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

  // Deteksi otomatis apakah konfigurasi angka saat ini cocok dengan preset tertentu
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

  // Handler 1-Klik Preset
  const handleApplyPreset = (preset: PhasePreset) => {
    setMinTemp(preset.tempMin);
    setMaxTemp(preset.tempMax);
    setMinHum(preset.humMin);
    setMaxHum(preset.humMax);
    setPhaseMode(preset.id);
    addToast(`Preset ${preset.name} dipilih! Klik "Simpan Konfigurasi" untuk menerapkan.`, 'info');
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
        addToast('Konfigurasi batas & profil fase jamur berhasil disimpan!', 'success');
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Gagal menyimpan konfigurasi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-black uppercase tracking-tight">
          Pengaturan Threshold & Fase
        </h1>
      </div>

      {fetching ? (
        <Card className="p-12 text-center text-black font-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          Memuat konfigurasi sistem...
        </Card>
      ) : (
        <div className="space-y-8">
          {/* ========================================================= */}
          {/* SEKSI 1: PRESET FASE PERTUMBUHAN (1-KLIK)                */}
          {/* ========================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-black uppercase tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 stroke-[3]" />
                Profil Fase Pertumbuhan
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {PHASE_PRESETS.map((preset) => {
                const isActive = phaseMode === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`relative p-5 border-4 border-black transition-all duration-200 flex flex-col justify-between ${preset.colorBg
                      } ${isActive
                        ? 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] scale-[1.03] ring-4 ring-[#28e085]'
                        : 'shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5'
                      }`}
                  >
                    <div>
                      {/* Icon & Title */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2.5 border-2 border-black ${preset.iconBg} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                          {preset.id === 'incubation' && <Sprout className="w-6 h-6 stroke-[2.5]" />}
                          {preset.id === 'primordia' && <Sparkles className="w-6 h-6 stroke-[2.5]" />}
                          {preset.id === 'fruiting' && <Droplets className="w-6 h-6 stroke-[2.5]" />}
                        </div>
                        <div>
                          <h3 className="font-black text-black text-lg leading-tight uppercase">
                            {preset.name}
                          </h3>
                          <span className="text-xs font-black text-gray-700 uppercase">
                            {preset.subName}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-gray-800 leading-relaxed mb-4 min-h-[3rem]">
                        {preset.desc}
                      </p>

                      {/* Parameters Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-4 bg-white/80 p-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div>
                          <span className="text-[10px] font-black uppercase text-gray-600 block">Suhu Ideal</span>
                          <span className="text-sm font-black text-black">
                            {preset.tempMin} - {preset.tempMax} °C
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-gray-600 block">Kelembaban</span>
                          <span className="text-sm font-black text-black">
                            {preset.humMin} - {preset.humMax} %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`w-full py-2.5 px-4 font-black text-xs uppercase tracking-wider border-2 border-black transition-all flex items-center justify-center gap-2 ${isActive
                        ? 'bg-[#28e085] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-default'
                        : 'bg-white hover:bg-black hover:text-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5'
                        }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                          Sedang Digunakan
                        </>
                      ) : (
                        'Terapkan Fase Ini'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* SEKSI 2: STATUS AKTIF & FINE-TUNING MANUAL               */}
          {/* ========================================================= */}
          <div className="space-y-4 pt-2">
            {/* Status Banner */}
            <div className="p-4 border-4 border-black bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3">
                <div className="p-2 border-2 border-black bg-[#28e085] text-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Sliders className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">Mode Operasi Saat Ini:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-black text-base uppercase">
                      {phaseMode === 'incubation' && '🌱 Fase Inkubasi (Vegetatif)'}
                      {phaseMode === 'primordia' && '⚡ Fase Primordia (Transisi)'}
                      {phaseMode === 'fruiting' && '🍄 Fase Fruiting (Generatif)'}
                      {phaseMode === 'custom' && '🛠️ Mode Kustom (Manual Fine-Tuning)'}
                    </span>
                    {phaseMode === 'custom' ? (
                      <span className="text-[10px] font-black uppercase bg-yellow-300 text-black px-2 py-0.5 border border-black">
                        Parameter Khusus
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase bg-[#28e085] text-black px-2 py-0.5 border border-black">
                        Standar Biologis
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-xs font-semibold text-gray-600 sm:text-right">
                Batas di bawah akan memicu penyemprot otomatis (Sprinkler) & blower.
              </div>
            </div>

            {/* Manual Form Cards */}
            <form id="thresholdForm" onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Batas Suhu */}
                <div className="p-6 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b-2 border-black">
                    <div className="p-2 bg-yellow-300 border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Thermometer className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-black uppercase">Batas Suhu (°C)</h2>
                      <p className="text-xs font-bold text-gray-600">Rentang toleransi temperatur kumbung</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                        Suhu Minimum (Terlalu Dingin / Pemanas)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="w-full px-3 py-2.5 border-2 border-black font-black text-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black pr-12 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          value={minTemp}
                          onChange={(e) => handleManualChange(setMinTemp, e.target.value, 'minTemp')}
                        />
                        <span className="absolute right-3 top-3 text-black font-black text-sm pointer-events-none">
                          °C
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-gray-500 mt-1">
                        Jika suhu turun di bawah batas ini, fan tidak akan membuang hawa hangat.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                        Suhu Maksimum (Kritis / Exhaust Fan ON)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="w-full px-3 py-2.5 border-2 border-black font-black text-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black pr-12 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          value={maxTemp}
                          onChange={(e) => handleManualChange(setMaxTemp, e.target.value, 'maxTemp')}
                        />
                        <span className="absolute right-3 top-3 text-black font-black text-sm pointer-events-none">
                          °C
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-gray-500 mt-1">
                        Pemicu exhaust fan menyala untuk membuang udara panas dari kumbung.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Batas Kelembaban */}
                <div className="p-6 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b-2 border-black">
                    <div className="p-2 bg-sky-300 border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Droplets className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-black uppercase">Batas Kelembaban (%)</h2>
                      <p className="text-xs font-bold text-gray-600">Rentang Relative Humidity (RH) optimal</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                        Kelembaban Minimum (Kering / Sprinkler ON)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="w-full px-3 py-2.5 border-2 border-black font-black text-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black pr-12 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          value={minHum}
                          onChange={(e) => handleManualChange(setMinHum, e.target.value, 'minHum')}
                        />
                        <span className="absolute right-3 top-3 text-black font-black text-sm pointer-events-none">
                          %
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-gray-500 mt-1">
                        Pemicu alat penyemprot misting/sprinkler otomatis aktif saat kumbung kering.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                        Kelembaban Maksimum (Target Henti Misting)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="w-full px-3 py-2.5 border-2 border-black font-black text-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black pr-12 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          value={maxHum}
                          onChange={(e) => handleManualChange(setMaxHum, e.target.value, 'maxHum')}
                        />
                        <span className="absolute right-3 top-3 text-black font-black text-sm pointer-events-none">
                          %
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-gray-500 mt-1">
                        Sprinkler otomatis berhenti ketika target kelembaban ini terpenuhi.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-4 border-black">
                <div className="text-xs font-bold text-gray-600">
                  Pastikan nilai batas sudah sesuai dengan observasi kondisi kumbung riil.
                </div>
                <Button
                  type="submit"
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-3 text-base border-4 border-black bg-[#28e085] hover:bg-green-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                  disabled={loading}
                >
                  <Save className="w-5 h-5 stroke-[2.5]" />
                  {loading ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
