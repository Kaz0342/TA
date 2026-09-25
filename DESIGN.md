---
name: "Smart Shroom Eco-Clean Design System"
version: "3.0.0"
description: "Master Design Specification & Tokens for Smart Shroom SCM covering all 5 core modules, modals, and the authentication/loading flows."
author: "Anti-Gravity & King"
tokens:
  colors:
    background: "#edf5f0"
    sidebar:
      bg: "#e4f3eb"
      active-bg: "#bde5d1"
      active-text: "#1c382b"
      text: "#37473f"
      hover-bg: "#d8ece1"
      border: "#d2e8dc"
    surface:
      card: "#ffffff"
      card-muted: "#f8faf8"
      pill: "#e8f4ed"
      badge-status: "#cee8dc"
      warning-bg: "#fff5f5"
      warning-border: "#fecaca"
      danger-bg: "#fee2e2"
      danger-border: "#fca5a5"
      info-bg: "#f0fdf4"
    text:
      primary: "#192e22"
      secondary: "#486356"
      muted: "#759183"
      subtle: "#8ca497"
      danger: "#991b1b"
      warning: "#92400e"
      inverse: "#ffffff"
    border:
      card: "#d6e9df"
      subtle: "#dce8de"
      divider: "#f0f5f1"
      focus: "#244b37"
    primary:
      default: "#244b37"
      hover: "#1b3a2b"
      active: "#142c20"
      contrast: "#ffffff"
    gauge:
      optimal: "#499b70"
      warning: "#f59e0b"
      danger: "#e05345"
      track: "#e6ece8"
    status:
      active:
        bg: "#e8f4ed"
        text: "#15803d"
        dot: "#10b981"
      contaminated:
        bg: "#fef3c7"
        text: "#b45309"
        dot: "#f59e0b"
      disposed:
        bg: "#f1f5f9"
        text: "#64748b"
        dot: "#94a3b8"
      growing:
        bg: "#cee8dc"
        text: "#244b37"
        dot: "#059669"
    actuator:
      active: "#285a3c"
      inactive: "#d1ded5"
      thumb: "#ffffff"
  typography:
    fontFamilies:
      primary: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
      metrics: "'Plus Jakarta Sans', 'Outfit', sans-serif"
      mono: "'JetBrains Mono', 'Fira Code', monospace"
    scales:
      welcome-title:
        fontSize: "1.75rem"
        fontWeight: "700"
        lineHeight: "1.2"
        letterSpacing: "-0.02em"
        color: "#192e22"
      section-title:
        fontSize: "1.25rem"
        fontWeight: "700"
        lineHeight: "1.3"
        color: "#192e22"
      card-title:
        fontSize: "0.875rem"
        fontWeight: "700"
        color: "#192e22"
      metric-large:
        fontSize: "1.875rem"
        fontWeight: "700"
        lineHeight: "1"
        letterSpacing: "-0.025em"
        color: "#192e22"
      body:
        fontSize: "0.875rem"
        fontWeight: "500"
        lineHeight: "1.5"
      caption:
        fontSize: "0.6875rem"
        fontWeight: "600"
        color: "#759183"
  radius:
    pill: "9999px"
    card: "24px"
    modal: "24px"
    button: "16px"
    input: "16px"
    badge: "12px"
  shadows:
    card: "0 2px 8px 0 rgba(0, 0, 0, 0.02)"
    card-hover: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
    modal: "0 20px 40px -10px rgba(25, 46, 34, 0.15)"
    button: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
---

# 🍄 Smart Shroom SCM — Master Design System Manifest (v3.0 Lengkap)

> **Spesifikasi Lengkap untuk Google Stitch & AI Agents:** 
> Dokumen ini mencakup **seluruh modul aplikasi Smart Shroom SCM**:
> 1. **Autentikasi & Loading Experience** (`/login` & Global Skeletons)
> 2. **Modul 1: Dashboard Monitoring IoT** (`/`)
> 3. **Modul 2: Manajemen Batch Baglog** (`/baglogs`)
> 4. **Modul 3: Rekap Hasil Panen** (`/harvests`)
> 5. **Modul 4: Penjualan & Keuangan SCM** (`/sales`)
> 6. **Modul 5: Pengaturan Iklim & Preset Fase** (`/settings`)
>
> Diambil langsung dari kode lokal yang sedang berjalan di `frontend/src/`.

---

## 0. Shell Navigasi & Tata Letak Global (`DashboardLayout.tsx`)

- **Kanvas Utama:** Background `#edf5f0`, full-height (`min-h-screen`), font antialiased.
- **Sidebar Kiri (Aside):**
  - Lebar: `w-60` (`shrink-0`), warna background `#e4f3eb`, border kanan `#d2e8dc`.
  - Brand Header: Ikon Mushroom Logo hijau daun (`#244b37`) + Teks `Smart Shroom` (Bold 20px `#192e22`).
  - Menu Items: 
    - Normal: `text-[#37473f] hover:bg-[#d8ece1]/60 hover:text-[#192e22] rounded-2xl px-4 py-3 font-semibold`
    - Aktif: `bg-[#bde5d1] text-[#1c382b] font-bold shadow-2xs rounded-2xl px-4 py-3`
  - Logout Aksi (Bawah): Kartu soft red `bg-[#fff0f0] hover:bg-[#ffe5e5] text-[#b91c1c] border border-[#fecaca] rounded-2xl`.

---

## 1. Halaman Autentikasi & Loading Experience (`/login`)

### A. Layar Login (`Login.tsx`)
- **Latar Belakang Ambient:** Canvas `#edf5f0` dengan 2 ornamen gradasi blur hijau lembut:
  - Lingkaran atas: `w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl`
  - Lingkaran bawah: `w-72 h-72 bg-emerald-100/50 rounded-full blur-2xl`
- **Kartu Login:** `bg-white rounded-3xl border border-[#d6e9df] p-7 sm:p-9 shadow-[0_12px_36px_rgba(25,46,34,0.06)] max-w-md w-full`.
- **Form Fields:**
  - Input Email & Password: `bg-[#f8faf8] border border-[#dce8de] rounded-2xl px-4 py-3 text-xs font-semibold text-[#192e22] focus:bg-white focus:border-[#244b37]`
  - Ikon sebelah kiri: `Mail`, `Lock` (warna `#759183`).
  - Tombol toggle mata password: `Eye`, `EyeOff`.
- **Tombol Masuk:** `bg-[#244b37] hover:bg-[#1b3a2b] active:scale-[0.98] text-white rounded-2xl py-3.5 text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2`.
- **Pemilih Cepat Akun Demo:**
  - Akun Admin: Box `bg-[#f0f7f3] border border-[#d4e7dc] rounded-2xl p-3` (Badge `Admin Kumbung`).
  - Akun Operator: Box `bg-[#f9faf9] border border-[#dce8de] rounded-2xl p-3` (Badge `Operator Lapangan`).

### B. Global Loading & Skeleton State
- **Indikator Loading Spinner:** Ikon `RefreshCw` dengan animasi `animate-spin text-[#244b37]`.
- **Skeleton Pulse Cards:** Box dengan `bg-[#e8f4ed] rounded-3xl animate-pulse h-32 border border-[#d6e9df]`.
- **Splash Screen App:** Ikon Jamur `w-14 h-14 text-[#244b37] animate-pulse` di tengah layar dengan tulisan `"Memuat Smart Shroom..."`.

---

## 2. Modul 1: Dashboard Monitoring IoT (`/` — `Dashboard.tsx`)

- **Header Sambutan:**
  - Judul: `"Welcome, {Nama}!"` (`text-2xl sm:text-3xl font-bold text-[#192e22]`).
  - Subtitle: `"Smart Mushroom Farming IoT Platform • Monitoring Jamur Kuping"`.
  - Pill Status Fase: `bg-[#cee8dc] text-[#244b37] px-4 py-2 rounded-2xl text-xs font-semibold`.
  - Widget Jam & Kalender: Box putih `border border-[#d6e9df] px-4 py-1.5 rounded-2xl` dengan live WIB clock.
- **Banner Peringatan Ambang Batas (Muncul Saat Suhu/RH Kritis):**
  - `bg-[#fff5f5] border border-[#fecaca] text-[#991b1b] rounded-2xl px-4 py-3 shadow-xs`.
- **4 Kartu Metrik KPI Utama (Dengan `SemiCircleGauge`):**
  1. `Temperature`: Suhu rata-rata 3x DHT22 (`°C`), delta perubahan 1 jam terakhir, gauge min 15 max 35 (hijau `#499b70` / merah `#e05345`).
  2. `Humidity`: Kelembapan rata-rata (`%`), status zona aman / misting aktif, gauge min 40 max 100.
  3. `Baglog Aktif`: Jumlah baglog aktif dalam kumbung (`Unit`) & persentase kapasitas terhadap limit 3.000 baglog.
  4. `Panen Hari Ini`: Realisasi petik hari ini (`KG`) terhadap target harian 15 KG.
- **Grafik Area Recharts (Riwayat Mikroklimat):**
  - Tombol filter rentang waktu: `6h / 12h / 24h / 7d` (Pills `bg-[#c5e6d0]` saat aktif).
  - Garis kurva halus `monotone` warna `#244b37` dengan gradient hijau transparan.
  - Optimal zone band horizontal (`26–28°C`).
- **Panel Status Aktuator Realtime:**
  - Toggle switch untuk Misting Pump & Fan Exhaust (`bg-[#285a3c]` saat ON, `bg-[#d1ded5]` saat OFF).

---

## 3. Modul 2: Manajemen Batch Baglog (`/baglogs` — `BaglogManagement.tsx`)

- **Header Modul:** Badge `"Manajemen Aset Kumbung • Siklus Baglog"` + Tombol `"+ Tambah Batch Baru"`.
- **4 Kartu Ringkasan Baglog:**
  1. `Total Batch Terdaftar`: Seluruh batch yang tercatat di database.
  2. `Baglog Aktif`: Jumlah baglog produktif & persentase kapasitas kumbung.
  3. `Afkir & Kontaminasi`: Akumulasi baglog rusak/terkontaminasi kapang hijau/hitam.
  4. `Rata-rata Umur Baglog`: Usia rata-rata baglog & penentuan tahap dominan (*Fase Inkubasi Miselium*, *Fase Produktif*, *Fase Akhir Afkir*).
- **Filter Tabs:** Tab pill interaktif: `Semua`, `Aktif (Hijau)`, `Kontaminasi (Kuning)`, `Dibuang (Abu-abu)`.
- **Search Bar:** Input pencarian kode batch atau nama supplier dengan ikon `Search`.
- **Tabel Data Batch Baglog:**
  - Header tabel: `bg-[#f0f7f3] text-[#244b37] border-b border-[#d6e9df] font-bold text-xs uppercase`.
  - Baris tabel: Hover `hover:bg-[#f8faf8]`, border pemisah `border-[#f0f5f1]`.
  - Indikator Visual Umur & Miselium: Progress bar bertingkat (hijau saat muda, kuning saat prime, merah saat > 90 hari).
  - Badges Status: 
    - `Aktif`: `bg-[#e8f4ed] text-[#15803d] border border-[#c4e4cf]`
    - `Terkontaminasi`: `bg-[#fef3c7] text-[#b45309] border border-[#fde68a]`
    - `Dibuang`: `bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]`
  - Tombol Aksi: Dropdown/tombol aksi cepat untuk mencatat kontaminasi atau buang afkir.
- **Modal "Tambah Batch Baru":**
  - Backdrop: `bg-slate-900/40 backdrop-blur-xs`.
  - Card Modal: `bg-white rounded-3xl border border-[#d6e9df] p-6 sm:p-8 max-w-lg shadow-xl`.
  - Field Formulir: Kode Batch (otomatis generate), Tanggal Inokulasi, Jumlah Baglog (Angka), Supplier Bibit, Lokasi Rak Kumbung, Catatan Tambahan.

---

## 4. Modul 3: Rekap Hasil Panen (`/harvests` — `HarvestManagement.tsx`)

- **Header Modul:** Badge `"Produktivitas Pertanian • Pencatatan Hasil Petik"` + Tombol `"+ Catat Hasil Panen"`.
- **4 Kartu Metrik Panen:**
  1. `Panen Hari Ini`: Total KG yang dipetik hari ini & target progress bar harian (Target 15 KG).
  2. `Total Panen Bulan Ini`: Akumulasi KG panen bulan berjalan.
  3. `Estimasi Nilai Panen`: Nilai nominal rupiah berdasarkan standar harga panen segar (`KG x Rp 25.000`).
  4. `Rata-rata per Sesi Petik`: Bobot rata-rata setiap kali operator memetik jamur di kumbung.
- **Grafik Tren Panen 14 Hari (Recharts Area Chart):**
  - Visualisasi grafik batang/area fluktuasi panen harian 2 minggu terakhir.
- **Filter & Search Bar:** Filter waktu (`Hari Ini`, `Minggu Ini`, `Bulan Ini`, `Semua`) dan filter spesifik Batch Baglog.
- **Tabel Riwayat Panen:**
  - Kolom: Waktu & Tanggal Panen, Kode Batch Asal, Bobot Panen (KG besar tebal), Operator Pencatat, Catatan Kualitas Jamur (Tebal, Bersih, dsb).
- **Modal "Catat Hasil Panen":**
  - Dropdown pemilihan Batch Baglog yang berstatus aktif.
  - Input Tanggal Panen (Default hari ini).
  - Input Berat Bersih Hasil Panen (KG presisi 1 desimal).
  - Field Catatan Kualitas / Grade Jamur.

---

## 5. Modul 4: Penjualan & Keuangan SCM (`/sales` — `SalesManagement.tsx`)

- **Header Modul:** Badge `"Akses Administrator • SCM Penjualan"` + Tombol `"+ Catat Transaksi Penjualan"`.
- **4 Kartu Ringkasan Keuangan:**
  1. `Omzet Bulan Ini`: Total pendapatan penjualan jamur kuping (Rp format IDR).
  2. `Volume Terjual`: Total bobot jamur kuping (KG) yang terserap pasar bulan ini.
  3. `Jumlah Transaksi`: Total invoice / nota penjualan yang diterbitkan.
  4. `Rata-rata Harga / KG`: Rata-rata harga jual per kilogram yang terbentuk.
- **Widget Rekomendasi Mitra Pembeli (Quick Chip Suggestions):**
  - Chip tombol cepat untuk memilih pembeli langganan:
    - `Pak Joko (Pasar Induk)` — Pasar Tradisional
    - `Ibu Dewi (Toko Sayur)` — Retail Sayur Segar
    - `Bu Sari (Resto Jamur)` — Horeka / Kuliner
- **Grafik Dual-Axis Penjualan & Volume (Recharts):**
  - Menampilkan tren pendapatan (Rp) dan volume tonase (KG) per hari.
- **Tabel Transaksi Penjualan:**
  - Kolom: Tanggal Transaksi, Nama Pembeli & Kategori, Volume (KG), Harga Satuan (Rp/KG), Total Omzet (Rp tebal hijau), Status Pembayaran (Lunas / Tempo).
- **Modal "Catat Transaksi Penjualan":**
  - Input Nama Pembeli / Mitra.
  - Input Kuantitas (KG) & Harga Satuan (Rp/KG).
  - Kalkulasi otomatis `Total Revenue = KG x Harga` secara live.
  - Pilihan metode pembayaran (Tunai / Transfer Bank).

---

## 6. Modul 5: Pengaturan Iklim & Preset Fase (`/settings` — `Settings.tsx`)

- **Header Modul:** Badge `"Konfigurasi Sistem IoT • Otomasi Mikroklimat"`.
- **3 Kartu Preset Fase Pertumbuhan Jamur (1-Click Selector):**
  1. **Fase Inkubasi (Vegetatif Miselium):**
     - Target Suhu: `26.00 – 30.00 °C` | Target Kelembapan: `65.00 – 75.00 %`
     - Deskripsi: Misting minimal, sirkulasi tenang untuk merangsang pertumbuhan miselium.
  2. **Fase Primordia (Bakal Buah / Pinhead):**
     - Target Suhu: `24.00 – 28.00 °C` | Target Kelembapan: `85.00 – 90.00 %`
     - Deskripsi: Kejut lingkungan dingin & lembab untuk memicu munculnya bakal buah jamur.
  3. **Fase Fruiting (Pertumbuhan Daun Panen):**
     - Target Suhu: `24.00 – 32.00 °C` | Target Kelembapan: `85.00 – 95.00 %`
     - Deskripsi: Kelembapan konstan tinggi agar daun jamur mekar kenyal gelatinous dan bobot maksimal.
- **Formulir Kustomisasi Manual Ambang Batas (Manual Override):**
  - Input Suhu Minimum & Maksimum (°C).
  - Input Kelembapan Minimum & Maksimum (%).
  - Tombol Simpan Konfigurasi: `bg-[#244b37] text-white rounded-2xl px-6 py-3 font-bold flex items-center gap-2`.
- **Panel Status Hardware & Riwayat Penyiraman Sprinkler:**
  - Status koneksi mikrokontroler ESP32 & sensor DHT22.
  - Tabel log riwayat aktuator menyala: Waktu mulai, durasi (detik), aktuator (Misting / Fan), dan alasan trigger otomatis.
- **Panel Profil Pengguna & Hak Akses:**
  - Informasi akun aktif, role (Admin/Operator), dan status sesi keamanan.

---

## 7. Desain Komponen Formulir & Input Standar

- **Input Field Teks/Angka:**
  ```html
  <input class="w-full px-4 py-2.5 bg-[#f8faf8] border border-[#dce8de] rounded-2xl text-xs font-semibold text-[#192e22] focus:bg-white focus:border-[#244b37] focus:outline-none transition-all placeholder:text-[#8ca497]" />
  ```
- **Select Dropdown:**
  ```html
  <select class="w-full px-4 py-2.5 bg-[#f8faf8] border border-[#dce8de] rounded-2xl text-xs font-semibold text-[#192e22] focus:bg-white focus:border-[#244b37] focus:outline-none transition-all">
  ```
- **Form Label:**
  ```html
  <label class="block text-xs font-bold text-[#192e22] mb-1.5 uppercase tracking-wide">
  ```
- **Toast Notification (`ToastContainer.tsx`):**
  - Sukses: `bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] rounded-2xl p-4 shadow-lg flex items-center gap-3`
  - Error: `bg-[#fff1f2] border border-[#fecdd3] text-[#9f1239] rounded-2xl p-4 shadow-lg flex items-center gap-3`

---

## 8. Desain Standar Paginasi Tabel (`PaginationControls`)

Seluruh tabel modul operasional (`BaglogManagement.tsx`, `HarvestManagement.tsx`, `SalesManagement.tsx`) menerapkan standar paginasi **10 baris per halaman (`pageSize = 10`)**:

- **Container Footer:** `flex items-center justify-between pt-4 border-t border-[#d6e9df] dark:border-[#2a4435]`
- **Status Teks:** `text-xs text-[#759183] font-medium` (contoh: *"Menampilkan 1–10 dari 45 data"*).
- **Tombol Navigasi Prev/Next:**
  - Aktif: `p-2 rounded-xl border border-[#d6e9df] dark:border-[#2a4435] text-[#244b37] hover:bg-[#e8f4ed] transition-colors`
  - Nonaktif (`disabled`): `opacity-40 cursor-not-allowed`
- **Pills Nomor Halaman:**
  - Halaman Aktif: `bg-[#244b37] text-white font-bold rounded-xl px-3 py-1 text-xs shadow-xs`
  - Halaman Lain: `text-[#486356] hover:bg-[#e8f4ed] rounded-xl px-3 py-1 text-xs font-semibold`

---

## 9. Desain Micro-Animations & Transisi Terakselerasi GPU

Mencegah tampilan kaku dengan memberikan transisi visual alami pada interaksi pertama (mount) dan pembaruan polling berkala:

1. **`AnimatedNumber.tsx` (60 FPS Count-Up):**
   - Menggunakan `requestAnimationFrame` + kurva interpolasi `easeOutCubic`:
     $$\text{ease}(p) = 1 - (1 - p)^3$$
   - Durasi default: `1000ms`, presisi desimal terkonfigurasi.
2. **`AnimatedProgressBar.tsx` (GPU Width Transition):**
   - Buffer render `50ms` untuk memastikan browser menggambar `width: 0%` terlebih dahulu sebelum menganimasikan bar ke persentase target.
   - CSS Transition: `transition: width 1000ms cubic-bezier(0.34, 1.56, 0.64, 1)`.
3. **`SemiCircleGauge.tsx` (GPU Needle Sweep):**
   - Jarum SVG tegak lurus diputar secara hardware-accelerated melalui CSS `transform: rotate(${rotationDeg}deg)` dengan `transform-origin: 50px 44px`.
   - Menghindari bug SVG XML attribute (`x2`/`y2`) yang tidak didukung animasi transisi CSS standar.

