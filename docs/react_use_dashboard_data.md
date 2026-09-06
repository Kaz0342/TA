# Panduan Custom Hook: useDashboardData.ts

Dokumen ini berisi kode untuk *Custom Hook* React **`useDashboardData.ts`**. Hook ini mengandalkan **TanStack Query (React Query)** dipadukan dengan **Axios** untuk melakukan pengambilan data (fetch) API secara otomatis.

Fitur andalan dari hook ini:
1.  **Auto-Polling:** Otomatis narik data dari *server* tiap 10 detik (nyesuaiin interval pengiriman data ESP32).
2.  **Server Offline Detection:** Bisa deteksi kalau *server* mati/RTO (*Request Time Out*) dan mengembalikan status `isOffline`.
3.  **Background Refresh:** Bisa tahu kalau data lagi di- *refresh* di *background* tanpa harus nge-blok UI.

---

## 1. Kode Hook (`frontend/src/hooks/useDashboardData.ts`)

Simpan file ini di folder `hooks` di dalam proyek React lu. Pastikan lo udah *install* `@tanstack/react-query` dan `axios`.

```typescript
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Konfigurasi instance Axios
// Kasih timeout 5 detik, kalau server ga jawab berarti offline/mati
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 5000, 
});

interface DashboardStats {
  current_temperature: number | null;
  current_humidity: number | null;
  active_baglogs: number;
  today_harvest_kg: number;
  last_update: string | null;
}

export function useDashboardData() {
  // Fungsi utama untuk nembak API
  const fetchDashboardStats = async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data.data;
  };

  // Konfigurasi TanStack Query
  const query = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    
    // Auto-polling tiap 10.000 ms (10 detik)
    refetchInterval: 10000, 
    
    // Kalau gagal (RTO/server mati), coba ulang 2 kali aja biar ga nyepam
    retry: 2, 
    
    // Data dianggap basi setelah 5 detik, jadi wajar kalau mau fetch ulang
    staleTime: 5000, 
  });

  // Logika deteksi Server Offline / Network Error
  // Kalau error dan nggak ada response dari server (artinya ga konek sama sekali)
  const isOffline = query.isError && (
    !axios.isAxiosError(query.error) || 
    !query.error.response || 
    query.error.code === 'ERR_NETWORK' ||
    query.error.code === 'ECONNABORTED'
  );

  // Return objek data dan status ke komponen yang manggil
  return {
    data: query.data,
    
    // isLoading cuma True waktu PERTAMA KALI fetch data
    isLoading: query.isLoading, 
    
    // isFetching True TIAP KALI auto-polling jalan di background
    isFetching: query.isFetching, 
    
    isError: query.isError,
    isOffline: isOffline,
    error: query.error,
  };
}
```

---

## 2. Cara Menggunakannya di Komponen (Contoh: `Dashboard.tsx`)

Hook ini bikin kode di *file* komponen lu jadi super bersih dan elegan. Semua urusan *loading*, *error*, dan data udah di-*handle* sama hook-nya.

```tsx
import React from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import ClimateCards from './ClimateCards';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  // Panggil hook-nya. Keliatan bersih banget kan?
  const { data, isLoading, isFetching, isOffline } = useDashboardData();

  return (
    <div className="space-y-6">
      
      {/* 1. Indikator Server Offline (Banner Merah) */}
      {isOffline && (
        <div className="bg-red-500 border-4 border-black p-4 flex items-center gap-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <WifiOff className="text-black w-8 h-8 stroke-[3] animate-pulse" />
          <div>
            <h3 className="font-black text-black text-lg uppercase">Koneksi Terputus!</h3>
            <p className="font-bold text-black text-sm">Server sedang offline atau koneksi internet bermasalah.</p>
          </div>
        </div>
      )}

      {/* 2. Indikator Refreshing (Kecil di pojok atas) */}
      <div className="flex justify-end">
        {isFetching && !isLoading && !isOffline && (
          <span className="flex items-center gap-1 text-xs font-black uppercase text-gray-500 bg-gray-200 px-2 py-1 border-2 border-black">
            <RefreshCw className="w-3 h-3 animate-spin stroke-[3]" />
            Syncing...
          </span>
        )}
      </div>

      {/* 3. Oper data ke komponen ClimateCards */}
      <ClimateCards 
        temperature={data?.current_temperature} 
        humidity={data?.current_humidity} 
        isLoading={isLoading} 
      />
      
    </div>
  );
}
```
