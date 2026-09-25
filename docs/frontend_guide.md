# 🍄 Smart Shroom — Frontend Design & Development Guidelines

Dokumen panduan standar pengembangan antarmuka pengguna (*Frontend*) untuk sistem **Smart Shroom SCM**. Seluruh komponen UI mengacu pada spesifikasi **Harmonious Modern Sage Green Design System** yang mendukung tema terang (*Light Mode*) dan tema gelap (*Dark Mode*).

---

## 🛠️ Tech Stack Frontend

- **Framework & Runtime:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS v3 dengan *Custom Design Tokens* dan dukungan *Dark Mode* berbasis class (`dark:`)
- **Icons:** Lucide React (ikon minimalis modern stroke 2)
- **Data Fetching & Cache:** TanStack Query v5 (React Query) + Axios
- **State Management:** Zustand (Auth Store & Theme Store)
- **Charting & Visualizations:** Recharts (AreaChart, BarChart dengan kurva gradien dan animasi aktif 500ms)
- **Routing:** React Router DOM v7

---

## 🎨 Prinsip Desain: Harmonious Modern Sage Green & Dark Mode

Sistem meninggalkan gaya Neubrutalism kaku dan beralih ke desain modern yang estetik, ramah mata (*ergonomic*), dan terasa premium ala SaaS kelas atas:

### 1. Palet Warna Utama (Design Tokens)

| Token | Light Mode | Dark Mode | Fungsi |
|---|---|---|---|
| **Background Halaman** | `#edf5f0` (Sage tint lembut) | `#0d1711` (Deep night green) | Latar belakang kanvas aplikasi |
| **Card / Surface** | `#ffffff` | `#142219` | Kontainer kartu metrik dan tabel |
| **Border Utama** | `#d6e9df` | `#1e382b` | Garis pembatas kartu & tabel halus |
| **Teks Utama** | `#192e22` (Forest green pekat) | `#e4efe8` (Off-white soft) | Judul dan nilai metrik utama |
| **Teks Sekunder** | `#526a5e` | `#a3c9b4` | Label, subteks, dan deskripsi |
| **Primary Brand Accent** | `#244b37` | `#86efac` | Tombol aksi utama, tab aktif |
| **Status Hijau (Optimal)** | `#15803d` / `#2e7d52` | `#4ade80` / `#86efac` | Nilai iklim normal, badge aktif |
| **Status Bahaya (Alert)** | `#e05345` / `#b91c1c` | `#f87171` | Indikator suhu/kelembaban kritis |

### 2. Bentuk & Sudut Elemen
- **Card Utama:** Menggunakan `rounded-3xl` (radius 24px) dengan padding lega (`p-5` atau `p-6`).
- **Button & Input:** Menggunakan `rounded-xl` atau `rounded-2xl` dengan transisi hover yang halus (`transition-all`).
- **Pills & Badge:** Menggunakan `rounded-full` atau `rounded-lg` dengan border tipis 1px.

---

## 🧩 Komponen Reusable Unggulan

### 1. `AnimatedNumber` ([components/AnimatedNumber.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/AnimatedNumber.tsx))
Komponen penghitung angka beranimasi (*count-up*) yang sangat ringan berbasis `requestAnimationFrame` + `easeOutCubic`:
- **Saat mount:** Angka berputar mulus dari 0 ke nilai target (misal: 0 $\rightarrow$ 690 Baglog).
- **Saat polling live data:** Bertransisi halus dari nilai lama ke nilai baru (tidak reset ke 0).
```tsx
<AnimatedNumber
  value={tempVal}
  decimals={1}
  className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8]"
/>
```

### 2. `SemiCircleGauge` ([components/SemiCircleGauge.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/SemiCircleGauge.tsx))
Indikator spidometer analog semi-lingkaran yang diakselerasi langsung oleh GPU browser:
- Jarum spidometer berputar dari $-90^\circ$ (ujung kiri) ke sudut target via CSS `transform: rotate(...)` dan `transform-origin: 50px 44px`.
- Menggunakan timing curve `cubic-bezier(0.16, 1, 0.3, 1)` berdurasi 1.000ms.
```tsx
<SemiCircleGauge value={tempVal} min={15} max={35} color={isTempOptimal ? '#499b70' : '#e05345'} />
```

### 3. `AnimatedProgressBar` ([components/AnimatedProgressBar.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/AnimatedProgressBar.tsx))
Bar kapasitas persentase meluncur mulus dari 0% ke persentase target saat pertama kali dimuat.
```tsx
<AnimatedProgressBar percentage={metrics.capacityPercentage} />
```

### 4. `LiveClock` ([pages/Dashboard.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/pages/Dashboard.tsx))
Jam digital mandiri terisolasi di pojok header. Detik yang berganti tiap 1.000ms hanya me-render teks kecil tersebut tanpa memicu re-render pada grafik atau kartu dashboard.

---

## 📋 Aturan Pagination & Penanganan Tabel Data

Seluruh modul tabel data (*Baglog*, *Harvest*, dan *Sales*) wajib menerapkan standar pagination konsisten:
1. **Ukuran Halaman:** Standar **10 baris data per halaman** (`pageSize = 10`).
2. **Auto-Reset Filter:** Setiap kali pengguna mengubah filter status, rentang waktu, atau kata kunci pencarian, nomor halaman wajib di-reset otomatis ke Halaman 1 (`setCurrentPage(1)`).
3. **Kontrol Navigasi:**
   - Tombol Previous (`<`) dan Next (`>`) dengan proteksi `disabled` saat berada di batas halaman.
   - Tombol nomor halaman bernomor aktif berlatar belakang `#244b37` (atau `#1f3a2b` di dark mode).
   - Teks info rentang: `Menampilkan {startIndex + 1}–{endIndex} dari {totalItems} total data`.

---

## 🧠 Aturan Logika & State Management

1. **Server State (TanStack Query):** Seluruh pengambilan data dari backend wajib menggunakan `useQuery` dengan *queryKey* terstruktur (misal: `['sales']`, `['baglogs']`, `['dashboardStats']`).
2. **Mutasi Data:** Gunakan `useMutation` dengan callback `onSuccess` yang memanggil `queryClient.invalidateQueries()` untuk memastikan sinkronisasi data seketika.
3. **Pemisahan Logika:** Logika perhitungan agregasi berat, grouping, atau kalkulasi finansial utama berada di Backend/API Laravel, bukan dihitung manual yang membebani client.
4. **Format Uang & Tanggal:**
   - Angka moneter diformat ke Rupiah (`formatCurrency()` atau `toLocaleString('id-ID')`).
   - Tanggal diformat lokal Indonesia (misal: `Sen, 7 Sep 2026`).
