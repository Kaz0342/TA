# 🍄 Smart Shroom — Frontend Design & Development Guidelines

Dokumen panduan standar pengembangan antarmuka pengguna (*Frontend*) untuk sistem **Smart Shroom SCM**. Seluruh komponen UI mengacu pada spesifikasi **Harmonious Modern Sage Green Design System** yang mendukung tema terang (*Light Mode*) dan tema gelap (*Dark Mode*), serta tata letak responsif (*Mobile-First Ergonomics*).

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

Sistem menerapkan prinsip desain modern yang estetik, ramah mata (*ergonomic*), dan terasa premium ala SaaS kelas atas:

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

### 2. Standar Responsivitas Mobile (2x2 Grid KPI)
Untuk menghindari scrolling vertikal yang terlalu jauh pada layar smartphone, seluruh modul utama (*HPP Analysis*, *Harvest Management*, *Baglog Management*, dan *Sales Management*) menerapkan formasi kartu KPI **Grid 2x2**:
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
  {/* 4 Kartu KPI Ringkas & Padat */}
</div>
```

---

## 🧩 Komponen Reusable Unggulan

### 1. `AnimatedNumber` ([components/AnimatedNumber.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/AnimatedNumber.tsx))
Komponen penghitung angka beranimasi (*count-up*) yang sangat ringan berbasis `requestAnimationFrame` + `easeOutCubic`:
```tsx
<AnimatedNumber
  value={tempVal}
  decimals={1}
  className="text-3xl font-bold text-[#192e22] dark:text-[#e4efe8]"
/>
```

### 2. `SemiCircleGauge` ([components/SemiCircleGauge.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/SemiCircleGauge.tsx))
Indikator spidometer analog semi-lingkaran yang diakselerasi langsung oleh GPU browser:
- Jarum spidometer berputar dari $-90^\circ$ (ujung kiri) ke sudut target via CSS `transform: rotate(...)`.
- Menggunakan timing curve `cubic-bezier(0.16, 1, 0.3, 1)` berdurasi 1.000ms.
```tsx
<SemiCircleGauge value={tempVal} min={15} max={35} color={isTempOptimal ? '#499b70' : '#e05345'} />
```

### 3. `HarvestPauseWidget` ([components/HarvestPauseWidget.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/HarvestPauseWidget.tsx))
Widget kontrol jeda panen di Dashboard utama yang memungkinkan pengguna mengaktifkan mode panen (failsafe timer 2h, 4h, 6h, 8h) dan mengakhiri jeda seketika untuk kembali ke mode AUTO.

### 4. `HppAnalysisCard` ([components/HppAnalysisCard.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/HppAnalysisCard.tsx))
Kartu 4 metrik analisis biaya manajerial (Modal Pengadaan Baglog, Beban Operasional, Total Omzet, dan Margin Kontribusi) yang tersusun dalam grid 2x2 di ponsel. Dilengkapi **Missing Price Warning Banner** warna kuning amber jika terdeteksi ada batch aktif dengan harga modal 0 (`price_per_baglog == 0`) guna mencegah distorsi HPP.

### 5. `SlotDetailModal` ([components/SlotDetailModal.tsx](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/components/SlotDetailModal.tsx))
Modal detail kamar rak WMS dengan kapabilitas in-context:
- Menampilkan ringkasan batch, umur baglog, status miselium, dan kapasitas aktif fisik (`active_capacity / initial_quantity`).
- Tombol **"Catat Afkir" (In-Context Afkir):** Membuka modal afkir dengan auto-fill `slot_code` dan `baglog_batch_id`.
- Tombol **"Tutup Siklus":** Menyelesaikan masa produksi kamar rak, menandai status `COMPLETED`, dan secara otomatis mencatat seluruh sisa baglog aktif sebagai afkir `HABIS_PRODUKSI`.

### 6. `VoidConfirmModal` & Pola Audit Trail Pembatalan
Seluruh tabel transaksi finansial dan biosekuriti (*Harvests*, *Sales*, *Culls*) menerapkan standar UX pembatalan non-destruktif:
- Tombol aksi merah "Batalkan (Void)" membuka modal dialog penegasan.
- Input teks alasan pembatalan wajib diisi (*required*, min 3 karakter) sebelum tombol konfirmasi aktif.
- Baris data yang berstatus void ditampilkan dengan teks tercoret (*line-through*), opasitas pudar (`opacity-60`), serta badge merah `Dibatalkan` lengkap dengan tooltip tanggal pembatalan dan alasannya.

---

## 🗺️ Desain Spasial: WMS Kumbung Grid (`KumbungGrid.tsx`)

Visualisasi denah rak 3D kamar kumbung jamur menerapkan standar:
1. **Header Rak & Alokasi Kompak:** Pemilih rak A/B/C dan tombol `+ Alokasikan Baglog` berada di satu baris atas yang ringkas tanpa melebarkan kontainer secara berlebihan.
2. **Sticky Tier Column Solid (T-01 s.d. T-10):**
   - Kolom nomor tingkat vertikal memiliki latar belakang solid 100% opaque (`#0f1712`), tinggi seragam (86px), dan bayangan batas (`shadow-[4px_0_10px_rgba(0,0,0,0.5)]`).
   - Slot kamar di belakangnya **tidak tembus pandang** saat digeser horizontal pada layar sempit.
3. **Mode Tampilan Ganda:**
   - **Grid Fisik:** Menampilkan kode slot, status alokasi, umur baglog, dan sisa kapasitas aktif (misal `8/10`). Slot selesai tampil berlatar abu-abu netral.
   - **Peta Panen (Heatmap):** Menampilkan akumulasi total berat panen per kamar rak dengan gradasi warna hijau.

---

## 📋 Aturan Pagination & Penanganan Tabel Data

Seluruh modul tabel data (*Baglog*, *Harvest*, *Sales*, dan *Ledger Culls*) wajib menerapkan standar pagination konsisten:
1. **Ukuran Halaman:** Standar **10 baris data per halaman** (`pageSize = 10`).
2. **Auto-Reset Filter:** Setiap kali pengguna mengubah filter status, rentang waktu, atau kata kunci pencarian, nomor halaman wajib di-reset otomatis ke Halaman 1 (`setCurrentPage(1)`).
3. **Kontrol Navigasi:** Tombol Previous (`<`), Next (`>`), dan indikator rentang data aktif.

---

## ⚙️ Halaman Settings Minimalis (`Settings.tsx`)
1. **Preset Fase Snap Carousel:** Di ponsel, pilihan preset fase pertumbuhan (Inkubasi, Primordia, Fruiting) dapat di-*swipe* horizontal secara mulus.
2. **Side-by-Side Threshold Inputs:** Input Suhu Min & Max serta Kelembapan Min & Max disusun berdampingan 2 kolom dengan helper text di bawahnya.
3. **Validasi Deadband Kelembapan ($\ge 4\%$):** Form memvalidasi bahwa selisih `humidity_max - humidity_min` wajib minimal 4.0% guna mencegah osilasi relay misting yang merusak pompa air.
4. **Zero Visualizer Clutter:** Menghilangkan bar spektrum warna-warni yang redundan untuk meminimalkan scrolling dan mempercepat proses konfigurasi.

---

## 🌐 Layanan API Frontend (`services/`)

- [`slotService.ts`](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/services/slotService.ts): Master slot spasial, heatmap panen, alokasi batch, dan `completeSlotCycle(slotCode, reason)`.
- [`cullService.ts`](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/services/cullService.ts): Pengambilan riwayat afkir, pencatatan mutasi culls, dan `voidCull(id, reason)`.
- [`harvestService.ts`](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/services/harvestService.ts): Pencatatan hasil panen, tren 14 hari, dan `voidHarvest(id, reason)`.
- [`saleService.ts`](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/services/saleService.ts): Pencatatan penjualan, rekap mingguan, dan `voidSale(id, reason)`.
- [`hppService.ts`](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/services/hppService.ts): Ringkasan HPP, margin kontribusi, dan mutasi biaya operasional.
- [`deviceControlService.ts`](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/services/deviceControlService.ts): Perintah jeda panen (`pause`) dan resume ke mode AUTO.
