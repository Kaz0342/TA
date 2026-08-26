import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { Card, Button } from '../components/ui';
import api from '../services/api';
import { Thermometer, Droplets, Save } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  
  const [minTemp, setMinTemp] = useState('20.00');
  const [maxTemp, setMaxTemp] = useState('30.00');
  const [minHum, setMinHum] = useState('70.00');
  const [maxHum, setMaxHum] = useState('90.00');
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const addToast = useToastStore((state) => state.addToast);

  // useEffect HARUS dipanggil SEBELUM conditional return (Rules of Hooks)
  // @see ECC rules/react/patterns.md
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
        setMinTemp(t.temp_min);
        setMaxTemp(t.temp_max);
        setMinHum(t.humidity_min);
        setMaxHum(t.humidity_max);
      }
    } catch (error) {
      console.error('Failed to fetch thresholds', error);
    } finally {
      setFetching(false);
    }
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
      };

      const res = await api.put('/thresholds', payload);
      
      if (res.data.success) {
        addToast('Konfigurasi batas sensor berhasil disimpan!', 'success');
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Gagal menyimpan konfigurasi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-black uppercase">Pengaturan Sistem</h1>
        <p className="text-gray-700 font-bold mt-1">Atur batas pemicu otomatis alat penyemprot (Threshold).</p>
      </div>

      {fetching ? (
        <Card className="p-8 text-center text-slate-500">Memuat konfigurasi...</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Suhu */}
          <Card className="border-t-4 border-t-secondary relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-secondary/10 text-secondary rounded-lg">
                <Thermometer className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold">Batas Suhu (°C)</h2>
            </div>

            <form id="thresholdForm" onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Suhu Minimum (Terlalu Dingin)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field pr-10"
                    value={minTemp}
                    onChange={(e) => setMinTemp(e.target.value)}
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">°C</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Suhu Maksimum (Kritis / Panas)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field pr-10"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(e.target.value)}
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">°C</span>
                </div>
              </div>
            </form>
          </Card>

          {/* Kelembaban */}
          <Card className="border-t-4 border-t-accent relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-accent/10 text-accent rounded-lg">
                <Droplets className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold">Batas Kelembaban (%)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kelembaban Minimum (Kering)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    form="thresholdForm"
                    className="input-field pr-10"
                    value={minHum}
                    onChange={(e) => setMinHum(e.target.value)}
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kelembaban Maksimum (Basah)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    form="thresholdForm"
                    className="input-field pr-10"
                    value={maxHum}
                    onChange={(e) => setMaxHum(e.target.value)}
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Save Action */}
      {!fetching && (
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            form="thresholdForm" 
            className="flex items-center gap-2 px-8"
            disabled={loading}
          >
            <Save className="w-5 h-5" />
            {loading ? 'Menyimpan...' : 'Simpan Konfigurasi'}
          </Button>
        </div>
      )}
    </div>
  );
}
