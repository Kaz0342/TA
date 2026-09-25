# Panduan Sinkronisasi Data Dashboard (TanStack Query)

Dokumen ini menjelaskan strategi sinkronisasi data frontend React menggunakan **TanStack Query (React Query)** pada sistem **Smart Shroom SCM**. Pola ini mengelola cache data server, *auto-polling*, *background refresh*, serta penanganan *network fail-safe*.

---

## 1. Arsitektur Polling & Caching

| Query Key | Endpoint API | Interval Polling | Fungsi |
|---|---|---|---|
| `['dashboardStats']` | `GET /api/dashboard/stats` | 30 detik | 4 KPI Cards, EWS Violations, status fase aktif |
| `['sensorChart', range]` | `GET /api/sensor-data/chart?hours=X` | 60 detik | Grafik Recharts multirentang (6h / 12h / 24h / 7d) |
| `['sprinklerLogs']` | `GET /api/sprinkler-logs` | 30 detik | Log riwayat otomasi aktuator misting & fan |

---

## 2. Implementasi Polling di Dashboard (`Dashboard.tsx`)

```tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import SemiCircleGauge from '../components/SemiCircleGauge';
import AnimatedNumber from '../components/AnimatedNumber';
import AnimatedProgressBar from '../components/AnimatedProgressBar';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [range, setRange] = useState<'6h' | '12h' | '24h' | '7d'>('6h');

  // Query Stats Utama (Polling setiap 30 detik)
  const { data: statsData, isLoading, isError, isFetching } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return (
    <div className="space-y-6">
      {/* 1. Indikator Server Offline (Banner Merah Sage) */}
      {isError && (
        <div className="bg-[#fff5f5] dark:bg-[#2d1b1b] border border-[#fecaca] dark:border-[#5c2828] p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <WifiOff className="text-[#e05345] w-6 h-6 animate-pulse" />
          <div>
            <h3 className="font-bold text-[#991b1b] dark:text-[#fca5a5] text-sm">Koneksi Terputus</h3>
            <p className="text-xs text-[#7f1d1d] dark:text-[#f87171]">Gagal menghubungi server API. Sistem mencoba menyambung ulang otomatis...</p>
          </div>
        </div>
      )}

      {/* 2. Indikator Background Syncing */}
      {isFetching && !isLoading && (
        <div className="flex justify-end">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#759183] bg-[#e8f4ed] dark:bg-[#1e382b] px-3 py-1 rounded-full border border-[#d6e9df] dark:border-[#2a4435]">
            <RefreshCw className="w-3 h-3 animate-spin text-[#244b37] dark:text-[#cee8dc]" />
            Memperbarui data...
          </span>
        </div>
      )}

      {/* 3. Grid 4 Kartu KPI Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Suhu */}
        <div className="bg-white dark:bg-[#1a2e23] border border-[#d6e9df] dark:border-[#2a4435] rounded-3xl p-5 shadow-xs">
          <span className="text-xs font-bold text-[#759183] uppercase">Suhu Ruangan</span>
          <div className="text-3xl font-extrabold text-[#192e22] dark:text-[#edf5f0] my-2">
            <AnimatedNumber value={statsData?.current_temperature ?? 0} precision={1} suffix="°C" />
          </div>
          <SemiCircleGauge value={statsData?.current_temperature ?? 24} min={15} max={35} unit="°C" optimalMin={24} optimalMax={32} />
        </div>
      </div>
    </div>
  );
}
```
