---
name: "Smart Shroom Harmonious Sage Green & Dual-Theme Design System"
version: "4.0.0"
description: "Master Design Specification & Tokens for Smart Shroom SCM covering all 6 core modules, 3D WMS Kumbung Grid, Modals, HPP Analysis, IoT Harvest Pause Failsafe, and Non-Destructive Voiding Audit Trail."
author: "Anti-Gravity & King"
tokens:
  colors:
    light:
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
    dark:
      background: "#0c140e"
      sidebar:
        bg: "#0f1a13"
        active-bg: "#182c20"
        active-text: "#86efac"
        text: "#a3c9b4"
        hover-bg: "#14251b"
        border: "#1e382b"
      surface:
        card: "#142219"
        card-muted: "#111c15"
        pill: "#182c20"
        badge-status: "#1a3625"
        warning-bg: "#2d1616"
        warning-border: "#7f1d1d"
        danger-bg: "#3b1219"
        danger-border: "#991b1b"
        info-bg: "#0d2618"
      text:
        primary: "#e4efe8"
        secondary: "#a3c9b4"
        muted: "#6b8a78"
        subtle: "#526a5e"
        danger: "#f87171"
        warning: "#fbbf24"
        inverse: "#192e22"
      border:
        card: "#1e382b"
        subtle: "#1a3324"
        divider: "#132318"
        focus: "#86efac"
      primary:
        default: "#059669"
        hover: "#10b981"
        active: "#34d399"
        contrast: "#ffffff"
    gauge:
      optimal: "#499b70"
      optimal-dark: "#4ade80"
      warning: "#f59e0b"
      danger: "#e05345"
      danger-dark: "#f87171"
      track: "#e6ece8"
      track-dark: "#1a2e22"
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
      voided:
        bg: "#fee2e2"
        text: "#991b1b"
        dot: "#ef4444"
    wms:
      tier-sticky-bg: "#0f1712"
      tier-sticky-light-bg: "#ffffff"
      slot-empty-border: "#c6dfd1"
      slot-occupied-border: "#d6e9df"
      slot-selected-ring: "#10b981"
      heatmap-low: "#dcfce7"
      heatmap-mid: "#86efac"
      heatmap-high: "#22c55e"
      heatmap-max: "#15803d"
    actuator:
      active: "#285a3c"
      active-dark: "#10b981"
      inactive: "#d1ded5"
      inactive-dark: "#1f3326"
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

# 🍄 Smart Shroom SCM — Master Design System & Frontend Blueprint (v4.0 Lengkap)

> **Single Source of Truth (SSOT) Desain untuk Google Stitch, AI Agents, & Engineering:**
> Dokumen ini mencakup **seluruh modul aplikasi Smart Shroom SCM** yang telah diselaraskan 100% dengan kode produksi di `frontend/src/`:
> 1. **Autentikasi & Loading Experience** (`/login` & Global Skeletons)
> 2. **Modul 1: Dashboard Monitoring IoT & Failsafe Jeda Panen** (`/`)
> 3. **Modul 2: WMS Spasial 3D Kumbung Grid & Heatmap** (`/kumbung`)
> 4. **Modul 3: Manajemen Batch Baglog & Mutasi Afkir Biosekuriti** (`/baglogs`)
> 5. **Modul 4: Rekap Hasil Panen Multi-Flush & Tren Produksi** (`/harvests`)
> 6. **Modul 5: Penjualan SCM & Analisis Finansial HPP Dinamis** (`/sales`)
> 7. **Modul 6: Pengaturan Iklim, Preset Fase, & Hardware Status** (`/settings`)
>
> Dilengkapi standar **Dual-Theme (Light & Dark Mode)**, **Audit Trail Pembatalan (Non-Destructive Voiding)**, serta **Micro-Animations GPU 60 FPS**.

---

## 0. Shell Navigasi, Theme Provider & Tata Letak Global (`DashboardLayout.tsx`)

- **Kanvas Utama:** 
  - Light Mode: `#edf5f0` (Sage tint lembut), antialiased font.
  - Dark Mode: `#0c140e` (Deep night green forest), text `#e4efe8`.
  - Full-height (`min-h-screen`), transisi warna halus 200ms.
- **Sidebar Kiri Desktop (Aside):**
  - Lebar: `w-60` (`shrink-0`), background `#e4f3eb` (Dark: `#0f1a13`), border kanan `#d2e8dc` (Dark: `#1e382b`).
  - Brand Header: Ikon Mushroom Logo hijau daun (`#244b37` / Dark: `#86efac`) + Teks `Smart Shroom` (Bold 20px).
  - Menu Items: 
    - Normal: `text-[#37473f] dark:text-[#a3c9b4] hover:bg-[#d8ece1]/60 dark:hover:bg-[#14251b] rounded-2xl px-4 py-3 font-semibold`
    - Aktif: `bg-[#bde5d1] dark:bg-[#182c20] text-[#1c382b] dark:text-[#86efac] font-bold shadow-2xs rounded-2xl px-4 py-3`
  - Dark Mode Switch: Toggle pill tombol matahari/bulan untuk switch kelas `dark` pada root DOM.
  - Logout Aksi (Bawah): Kartu soft red `bg-[#fff0f0] dark:bg-[#2d1616] hover:bg-[#ffe5e5] text-[#b91c1c] dark:text-[#f87171] border border-[#fecaca] dark:border-[#7f1d1d] rounded-2xl`.
- **Navigasi Mobile (Bottom Bar & Drawer):**
  - Mobile header bar dengan hamburger menu, indicator koneksi realtime, dan toggle dark mode cepat.
  - Bottom action bar dengan akses instan ke Dashboard, Kumbung Grid, dan Panen.

---

## 1. Halaman Autentikasi & Loading Experience (`/login` — `Login.tsx`)

### A. Layar Login (`Login.tsx`)
- **Latar Belakang Ambient:** Canvas `#edf5f0` (Dark: `#0c140e`) dengan ornamen gradasi blur hijau lembut:
  - Lingkaran atas: `w-96 h-96 bg-emerald-200/40 dark:bg-emerald-900/20 rounded-full blur-3xl`
  - Lingkaran bawah: `w-72 h-72 bg-emerald-100/50 dark:bg-emerald-950/30 rounded-full blur-2xl`
- **Kartu Login:** `bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-7 sm:p-9 shadow-xl max-w-md w-full`.
- **Form Fields:**
  - Input Email & Password: `bg-[#f8faf8] dark:bg-[#111c15] border border-[#dce8de] dark:border-[#1e382b] rounded-2xl px-4 py-3 text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] focus:bg-white dark:focus:bg-[#142219] focus:border-[#244b37]`
  - Ikon kiri: `Mail`, `Lock` (warna `#759183` / Dark: `#6b8a78`).
  - Toggle mata password: `Eye`, `EyeOff`.
- **Tombol Masuk:** `bg-[#244b37] dark:bg-emerald-600 hover:bg-[#1b3a2b] dark:hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl py-3.5 text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2`.
- **Pemilih Cepat Akun Demo (Quick Switcher):**
  - Akun Admin: Box `bg-[#f0f7f3] dark:bg-[#182c20] border border-[#d4e7dc] dark:border-[#1e382b] rounded-2xl p-3` (Badge `Admin Kumbung`).
  - Akun Operator: Box `bg-[#f9faf9] dark:bg-[#111c15] border border-[#dce8de] dark:border-[#1e382b] rounded-2xl p-3` (Badge `Operator Lapangan`).

### B. Global Loading & Skeleton State
- **Indikator Loading Spinner:** Ikon `RefreshCw` dengan animasi `animate-spin text-[#244b37] dark:text-[#86efac]`.
- **Skeleton Pulse Cards:** Box dengan `bg-[#e8f4ed] dark:bg-[#182c20] rounded-3xl animate-pulse h-32 border border-[#d6e9df] dark:border-[#1e382b]`.
- **Splash Screen App:** Ikon Jamur `w-14 h-14 text-[#244b37] dark:text-[#86efac] animate-pulse` di tengah layar dengan teks `"Memuat Smart Shroom..."`.

---

## 2. Modul 1: Dashboard Monitoring IoT & Failsafe Jeda Panen (`/` — `Dashboard.tsx`)

- **Header Sambutan:**
  - Judul: `"Welcome, {Nama}!"` (`text-2xl sm:text-3xl font-bold text-[#192e22] dark:text-[#e4efe8]`).
  - Subtitle: `"Smart Mushroom Farming IoT Platform • Monitoring Jamur Kuping"`.
  - Pill Status Fase: `bg-[#cee8dc] dark:bg-[#1a3625] text-[#244b37] dark:text-[#86efac] px-4 py-2 rounded-2xl text-xs font-semibold`.
  - Widget Jam & Kalender: Box putih `bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] px-4 py-1.5 rounded-2xl` dengan live WIB clock.
- **Banner Peringatan Ambang Batas (EWS Alarm Suhu/RH Kritis):**
  - `bg-[#fff5f5] dark:bg-[#2d1616] border border-[#fecaca] dark:border-[#7f1d1d] text-[#991b1b] dark:text-[#f87171] rounded-2xl px-4 py-3 shadow-xs`.
- **4 Kartu Metrik KPI Utama (Dengan `SemiCircleGauge`):**
  1. `Temperature`: Suhu rata-rata 3-zona SHT30 (`°C`), delta 1 jam, gauge min 15 max 35 (hijau `#499b70` / merah `#e05345`).
  2. `Humidity`: Kelembapan rata-rata (`%`), status zona aman / misting aktif, gauge min 40 max 100.
  3. `Baglog Aktif`: Jumlah baglog aktif dalam kumbung (`Unit`) & persentase kapasitas terhadap limit 3.000 baglog.
  4. `Panen Hari Ini`: Realisasi petik hari ini (`KG`) terhadap target harian 15 KG.
- **Widget Kontrol Jeda Panen (`HarvestPauseWidget.tsx`):**
  - Mengunci aktuator ke status OFF selama aktivitas petik jamur agar operator tidak terkena semprotan misting otomatis.
  - Pilihan durasi jeda cepat: `2 Jam`, `4 Jam`, `6 Jam`, `8 Jam` (dengan failsafe auto-release kembali ke mode AUTO).
  - Banner aktif: `bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700` dengan live countdown timer dan tombol resume seketika `"Selesai Panen (Nyalakan Otomasi)"`.
- **Grafik Area Recharts (Riwayat Mikroklimat):**
  - Tombol filter rentang waktu: `6h / 12h / 24h / 7d` (Pills `bg-[#c5e6d0] dark:bg-[#182c20]` saat aktif).
  - Garis kurva halus `monotone` warna `#244b37` (Dark: `#86efac`) dengan gradasi transparan.
  - Optimal zone band horizontal (`26–28°C` & `85–95% RH`).
- **Panel Status Aktuator Realtime:**
  - Toggle switch interaktif untuk Misting Pump & Fan Exhaust (`bg-[#285a3c]` saat ON, `bg-[#d1ded5]` saat OFF).

---

## 3. Modul 2: WMS Spasial 3D Kumbung Grid (`/kumbung` — `KumbungGrid.tsx`)

- **Header Modul & Kendali Spasial:**
  - Selector Rak: Pilihan Rak Baris `Rak A`, `Rak B`, `Rak C` (Pills rounded-2xl dengan indikator total kapasitas).
  - Filter Status Cepat: `Semua`, `Terisi`, `Kosong`.
  - Mode Switcher:
    - **Grid Fisik:** Menampilkan status okupansi slot, kode kamar, umur baglog, dan kapasitas kamar (`8/10`).
    - **Peta Panen (Heatmap):** Visualisasi akumulasi bobot panen per slot dengan gradasi warna hijau intensif.
  - Status Alokasi Batch Preview: Box ringkasan menampilkan sisa baglog batch aktif yang belum dialokasikan ke kamar rak.
- **Mobile Bay Inspector (Viewport Smartphone):**
  - **Bay Selector Carousel:** Scrollable horizontal pills untuk berpindah cepat antara `Bay 01` s.d. `Bay 10` dengan status okupansi (contoh: `10/10 Isi`).
  - **Tier Vertical Stack:** Tumpukan vertikal dari tingkat atas `T-10` turun ke `T-01` yang ergonomis untuk scrolling satu jempol.
- **Desktop Matrix Kumbung Grid:**
  - **Sticky Tier Column Solid (`T-01` s.d. `T-10`):**
    - Latar belakang solid 100% opaque (`#ffffff` / Dark: `#0f1712`), tinggi seragam (86px), dan bayangan batas (`shadow-[4px_0_10px_rgba(0,0,0,0.5)]`).
    - Mencegah *opacity bleed* atau teks slot kamar tembus pandang saat tabel digeser horizontal.
  - **Slot Kamar Rak Cards:**
    - Slot Kosong: Garis putus-putus (*dashed border* `#c6dfd1` / Dark: `#223b2b`).
    - Slot Terisi: Background putih / dark card dengan badge umur, bar miselium bertingkat, dan rasio kapasitas.
    - Slot Terpilih: Ring hijau tebal `ring-2 ring-emerald-500` dengan latar tint hijau.
- **Floating Multi-Allocation Bar (Saat Memilih Banyak Slot Kosong):**
  - Muncul melayang di bawah layar: Menampilkan jumlah slot terpilih, total baglog (`Slot x 10`), dan tombol `"Lanjutkan Alokasi"`.
- **Modal "Detail Kamar Rak" (`SlotDetailModal.tsx`):**
  - Ringkasan batch penghuni, tanggal alokasi, sisa baglog produktif.
  - Tombol **"Catat Afkir (In-Context)":** Membuka modal pencatatan afkir dengan pre-fill otomatis `slot_code` dan `batch_id`.
  - Tombol **"Tutup Siklus":** Mengakhiri masa panen kamar rak, menandai status `COMPLETED`, dan otomatis mencatat seluruh sisa baglog sebagai afkir `HABIS_PRODUKSI`.

---

## 4. Modul 3: Manajemen Batch Baglog & Mutasi Afkir (`/baglogs` — `BaglogManagement.tsx`)

- **Header Modul:** Badge `"Manajemen Aset Kumbung • Siklus Baglog"` + Tombol `"+ Tambah Batch Baru"`.
- **4 Kartu Ringkasan KPI (Mobile 2x2 Grid):**
  1. `Total Batch Terdaftar`: Seluruh batch yang tercatat di database.
  2. `Baglog Aktif`: Jumlah baglog produktif & persentase kapasitas kumbung (maks 3.000 baglog).
  3. `Afkir & Kontaminasi`: Akumulasi baglog rusak/terkontaminasi kapang hijau/hitam.
  4. `Rata-rata Umur Baglog`: Usia rata-rata baglog & penentuan tahap dominan (*Inkubasi*, *Produktif*, *Afkir*).
- **Filter Tabs:** Tab pill interaktif: `Semua`, `Aktif (Hijau)`, `Kontaminasi (Kuning)`, `Selesai/Afkir (Abu-abu)`.
- **Tabel Data Batch Baglog:**
  - Header: `bg-[#f0f7f3] dark:bg-[#142219] text-[#244b37] dark:text-[#86efac] font-bold text-xs uppercase`.
  - Progress bar umur & miselium: Hijau saat muda, kuning saat fase prime, merah saat > 90 hari.
- **Buku Catatan Mutasi Afkir Biosekuriti (`CullHistoryTable.tsx`):**
  - Tabel audit kematian baglog per kamar rak dan per batch:
    - Kategori Culls: Kapang Hijau (*Trichoderma*), Kapang Hitam, Ulat/Hama, Miselium Mati, Habis Produksi.
  - **Aksi Pembatalan (Non-Destructive Voiding):**
    - Tombol merah "Batalkan (Void)" untuk meralat salah catat culls.
    - Dialog konfirmasi wajib alasan minimal 5 karakter.
    - Baris data dibatalkan ditampilkan teks tercoret (*line-through*), opasitas pudar (`opacity-60`), serta badge merah `Dibatalkan`.
- **Modal "Tambah Batch Baru":**
  - Field: Kode Batch (otomatis generate), Tanggal Masuk, Kuantitas Baglog, Harga Modal per Baglog (Rp), Supplier Bibit, Catatan.

---

## 5. Modul 4: Rekap Hasil Panen Multi-Flush (`/harvests` — `HarvestManagement.tsx`)

- **Header Modul:** Badge `"Produktivitas Pertanian • Pencatatan Hasil Petik"` + Tombol `"+ Catat Hasil Panen"`.
- **4 Kartu Metrik Panen (Mobile 2x2 Grid):**
  1. `Panen Hari Ini`: Total KG yang dipetik hari ini & target progress bar harian (Target 15 KG).
  2. `Total Panen Bulan Ini`: Akumulasi KG panen bulan berjalan.
  3. `Estimasi Nilai Panen`: Nilai nominal rupiah berdasarkan standar harga panen segar (`KG x Rp 25.000`).
  4. `Rata-rata per Sesi Petik`: Bobot rata-rata setiap kali operator memetik jamur di kumbung.
- **Grafik Tren Panen 14 Hari (Recharts Area Chart):**
  - Visualisasi grafik fluktuasi panen harian 2 minggu terakhir dengan kurva halus dan area fill gradien.
- **Filter & Search Bar:** Filter waktu (`Hari Ini`, `Minggu Ini`, `Bulan Ini`, `Semua`) dan filter spesifik Batch Baglog.
- **Tabel Riwayat Panen Multi-Flush:**
  - Kolom: Waktu & Tanggal Panen, Kode Batch Asal, Bobot Panen (KG besar tebal), Operator Pencatat, Grade Kualitas Jamur.
  - Fitur Pembatalan Catatan Salah (*Void Harvest*) dengan audit trail alasan pembatalan.
- **Modal "Catat Hasil Panen":**
  - Dropdown pemilihan Batch Baglog yang berstatus aktif.
  - Input Tanggal Panen (Default hari ini WIB).
  - Input Berat Bersih Hasil Panen (KG presisi 1 desimal).
  - Pilihan Grade Kualitas (Super, Standar, Basah/Sortir).

---

## 6. Modul 5: Penjualan SCM & Analisis Finansial HPP (`/sales` — `SalesManagement.tsx`)

- **Header Modul:** Badge `"Akses Administrator • SCM Penjualan"` + Tombol `"+ Catat Transaksi Penjualan"`.
- **4 Kartu Ringkasan Penjualan (Mobile 2x2 Grid):**
  1. `Omzet Bulan Ini`: Total pendapatan penjualan jamur kuping (Rp format IDR).
  2. `Volume Terjual`: Total bobot jamur kuping (KG) yang terserap pasar bulan ini.
  3. `Jumlah Transaksi`: Total invoice / nota penjualan yang diterbitkan.
  4. `Rata-rata Harga / KG`: Rata-rata harga jual per kilogram yang terbentuk di pasar.
- **Widget Rekomendasi Mitra Pembeli (Quick Chip Suggestions):**
  - Tombol cepat pembeli langganan: `Pak Joko (Pasar Induk)`, `Ibu Dewi (Toko Sayur)`, `Bu Sari (Resto Jamur)`.
- **Grafik Dual-Axis Penjualan & Volume (Recharts):**
  - Membandingkan tren pendapatan (Rp) dan volume tonase (KG) per hari secara berdampingan.
- **Kartu Analisis HPP Dinamis (`HppAnalysisCard.tsx`):**
  - **4 Metrik Manajerial (2x2 Grid):**
    1. `Modal Pengadaan Baglog`: Total modal bibit batch aktif.
    2. `Beban Operasional Riil`: Akumulasi tagihan listrik, air, nutrisi, upah petik.
    3. `Omzet Penjualan`: Total pendapatan penjualan terealisasi.
    4. `Keuntungan Kotor (Margin Kontribusi)`: Laba bersih kotor (`Omzet - Modal - Operasional`).
  - **Missing Price Warning Banner:**
    - Muncul warna kuning amber otomatis jika terdeteksi ada batch aktif dengan harga modal Rp 0 (`price_per_baglog == 0`) guna mencegah distorsi HPP.
  - **Ledger Beban Operasional & Tombol `"+ Tambah Beban"`:**
    - Modal pencatatan pengeluaran: Kategori (Listrik, Air/Pompa, Tenaga Kerja, Pemeliharaan, Lain-lain), Nominal (Rp), Tanggal, dan Catatan.
- **Tabel Transaksi Penjualan & Audit Void:**
  - Menampilkan pembeli, volume, harga satuan, omzet, status pelunasan (Lunas / Tempo), dan opsi batalkan invoice (Void) bagi Admin.

---

## 7. Modul 6: Pengaturan Iklim & Preset Fase (`/settings` — `Settings.tsx`)

- **Header Modul:** Badge `"Konfigurasi Sistem IoT • Otomasi Mikroklimat"`.
- **3 Kartu Preset Fase Pertumbuhan Jamur (1-Click Selector):**
  1. **Fase Inkubasi (Vegetatif Miselium):**
     - Target Suhu: `26.00 – 30.00 °C` | Target Kelembapan: `65.00 – 75.00 %`
     - Deskripsi: Misting minimal, sirkulasi tenang untuk merangsang kolonisasi miselium.
  2. **Fase Primordia (Bakal Buah / Pinhead):**
     - Target Suhu: `24.00 – 28.00 °C` | Target Kelembapan: `85.00 – 90.00 %`
     - Deskripsi: Kejut lingkungan dingin & lembab untuk memicu kemunculan pinhead jamur.
  3. **Fase Fruiting (Pertumbuhan Daun Panen):**
     - Target Suhu: `24.00 – 32.00 °C` | Target Kelembapan: `85.00 – 95.00 %`
     - Deskripsi: Kelembapan konstan tinggi agar daun jamur mekar kenyal gelatinous dan bobot maksimal.
- **Formulir Kustomisasi Manual Ambang Batas (Manual Override):**
  - Input Suhu Minimum & Maksimum (°C).
  - Input Kelembapan Minimum & Maksimum (%).
  - **Validasi Deadband Kelembapan ($\ge 4\%$):**
    - Sistem mewajibkan selisih `humidity_max - humidity_min` minimal 4.0% guna mencegah osilasi relay misting yang dapat membakar pompa air.
- **Panel Status Hardware & Sensor Fusion:**
  - Status koneksi mikrokontroler ESP32 DevKit V1 dan modul I2C multiplexer TCA9548A.
  - Pembacaan 3 titik sensor SHT30 IP68 (Atas 35%, Tengah 40%, Bawah 25%).
  - Log riwayat aktuator menyala: Waktu mulai, durasi (detik), aktuator (Misting / Fan), dan alasan trigger otomatis.
- **Panel Profil Pengguna & Hak Akses RBAC:**
  - Menampilkan role pengguna aktif (Admin vs Operator), switch tema Dark Mode, dan manajemen akun.

---

## 8. Desain Komponen Formulir, Modal, & Dialog Penegasan

- **Input Field Teks/Angka Standar:**
  ```html
  <input class="w-full px-4 py-2.5 bg-[#f8faf8] dark:bg-[#111c15] border border-[#dce8de] dark:border-[#1e382b] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] focus:bg-white dark:focus:bg-[#142219] focus:border-[#244b37] dark:focus:border-emerald-500 focus:outline-none transition-all placeholder:text-[#8ca497]" />
  ```
- **Select Dropdown:**
  ```html
  <select class="w-full px-4 py-2.5 bg-[#f8faf8] dark:bg-[#111c15] border border-[#dce8de] dark:border-[#1e382b] rounded-2xl text-xs font-semibold text-[#192e22] dark:text-[#e4efe8] focus:bg-white dark:focus:bg-[#142219] focus:border-[#244b37] dark:focus:border-emerald-500 focus:outline-none transition-all">
  ```
- **Form Label Standar:**
  ```html
  <label class="block text-xs font-bold text-[#192e22] dark:text-[#a3c9b4] mb-1.5 uppercase tracking-wide">
  ```
- **Modal Container Standar (`ModalPortal.tsx`):**
  - Backdrop: `fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200`.
  - Body: `bg-white dark:bg-[#111c15] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] shadow-2xl w-full max-w-lg overflow-hidden`.
- **Pola Dialog Konfirmasi Voiding (Audit Trail):**
  - Membuka modal dengan rincian data transaksi yang akan dibatalkan.
  - Textarea alasan pembatalan wajib diisi (*required*, min 5 karakter).
  - Tombol merah konfirmasi: `bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl px-4 py-2`.
- **Toast Notifications (`ToastContainer.tsx`):**
  - Sukses: `bg-[#f0fdf4] dark:bg-[#0d2618] border border-[#bbf7d0] dark:border-[#1e382b] text-[#166534] dark:text-[#86efac] rounded-2xl p-4 shadow-lg`.
  - Error: `bg-[#fff1f2] dark:bg-[#3b1219] border border-[#fecdd3] dark:border-[#7f1d1d] text-[#9f1239] dark:text-[#f87171] rounded-2xl p-4 shadow-lg`.

---

## 9. Desain Standar Paginasi Tabel (`PaginationControls`)

Seluruh tabel modul operasional (`KumbungGrid.tsx`, `BaglogManagement.tsx`, `HarvestManagement.tsx`, `SalesManagement.tsx`, `CullHistoryTable.tsx`) menerapkan standar:

1. **Ukuran Halaman:** Standar **10 baris per halaman (`pageSize = 10`)**.
2. **Auto-Reset Filter:** Setiap kali pengguna mengubah filter status, rentang tanggal, atau kata kunci pencarian, nomor halaman wajib di-reset otomatis ke Halaman 1 (`setCurrentPage(1)`).
3. **Container Footer:** `flex items-center justify-between pt-4 border-t border-[#d6e9df] dark:border-[#1e382b]`.
4. **Status Teks:** `text-xs text-[#759183] dark:text-[#6b8a78] font-medium` (contoh: *"Menampilkan 1–10 dari 45 data"*).
5. **Tombol Navigasi Prev/Next:**
   - Aktif: `p-2 rounded-xl border border-[#d6e9df] dark:border-[#1e382b] text-[#244b37] dark:text-[#86efac] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] transition-colors cursor-pointer`.
   - Nonaktif (`disabled`): `opacity-40 cursor-not-allowed`.
6. **Pills Nomor Halaman:**
   - Halaman Aktif: `bg-[#244b37] dark:bg-emerald-600 text-white font-bold rounded-xl px-3 py-1 text-xs shadow-xs`.
   - Halaman Lain: `text-[#486356] dark:text-[#a3c9b4] hover:bg-[#e8f4ed] dark:hover:bg-[#182c20] rounded-xl px-3 py-1 text-xs font-semibold cursor-pointer`.

---

## 10. Desain Micro-Animations & Transisi Terakselerasi GPU

Mencegah tampilan kaku dengan memberikan transisi visual alami pada interaksi pertama (*mount*) dan pembaruan polling berkala:

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
4. **CSS Realtime Keyframe Animations ([index.css](file:///d:/DevTools/Antigravity/Projects/TA_vio/frontend/src/index.css)):**
   - `.animate-mist`: Simulasi semburan nozzle misting dengan pergerakan translasi mikro dan opasitas dinamis.
   - `.animate-actuator-glow`: Efek pendaran lampu status aktuator aktif berfrekuensi 2 detik.
