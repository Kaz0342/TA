# Dokumentasi Sistem: Smart Shroom Supply Chain Management (SCM) 🍄

## Daftar Isi
1. [Pendahuluan](#1-pendahuluan)
2. [Arsitektur Sistem & Tech Stack](#2-arsitektur-sistem--tech-stack)
3. [Metodologi Pengembangan (SDLC)](#3-metodologi-pengembangan-sdlc)
4. [Halaman Login & Otorisasi RBAC](#4-halaman-login--otorisasi-rbac)
5. [Halaman Dashboard (Beranda & Monitoring EWS)](#5-halaman-dashboard-beranda--monitoring-ews)
6. [Halaman Kumbung Grid (WMS Spasial 3D & Heatmap)](#6-halaman-kumbung-grid-wms-spasial-3d--heatmap)
7. [Halaman Baglog Management & Ledger Afkir](#7-halaman-baglog-management--ledger-afkir)
8. [Halaman Harvests (Rekap Panen & Multi-Flush)](#8-halaman-harvests-rekap-panen--multi-flush)
9. [Halaman Sales & Analisis HPP Dinamis](#9-halaman-sales--analisis-hpp-dinamis)
10. [Halaman Settings (Konfigurasi Ambang Batas Iklim)](#10-halaman-settings-konfigurasi-ambang-batas-iklim)
11. [Widget Jeda Panen (Failsafe Timer Interupsi IoT)](#11-widget-jeda-panen-failsafe-timer-interupsi-iot)
12. [Sidebar, Header, & Ergonomi Mobile](#12-sidebar-header--ergonomi-mobile)
13. [Hubungan Antar Modul & Relevansi TA](#13-hubungan-antar-modul--relevansi-ta)
14. [Ringkasan Kebutuhan Fungsional (FR)](#14-ringkasan-kebutuhan-fungsional-fr)

---

## 1. Pendahuluan

### 1.1 Nama Sistem
**Smart Shroom SCM** — Sistem Manajemen Rantai Pasok Jamur Kuping Berbasis IoT

### 1.2 Tujuan Sistem
Sistem ini dibangun sebagai produk utama **Tugas Akhir (TA)** bidang Sistem Informasi, dengan tujuan:
1. **Memantau iklim mikro kumbung** (suhu, kelembapan, CO2, cahaya) secara *real-time* via fusi sensor vertikal 3x DHT22.
2. **Memetakan penataan fisik kumbung (WMS)** — memisahkan koordinat kamar rak 3D statis (`slots`) dari entitas dinamis (`baglog_batches`).
3. **Mencatat mutasi afkir berbasis ledger** — melacak kematian baglog (*culls*) akibat kontaminasi jamur hijau (*Trichoderma*) untuk audit biosekuriti dan klaim garansi bibit.
4. **Mencatat dan menganalisis data panen multi-flush** — termasuk visualisasi heatmap produktivitas per slot kamar.
5. **Menghitung Harga Pokok Produksi (HPP) & Margin Kontribusi** — membukukan beban operasional riil (listrik, misting, tenaga kerja) ke dalam analisis keuntungan.
6. **Menerapkan otomasi cerdas aktuator & failsafe interupsi** — histeresis dinamis, cooldown guard, night lockout, dan penahanan exhaust fan saat pintu dibuka panen.

---

## 2. Arsitektur Sistem & Tech Stack

| Layer | Teknologi | Alasan Pemilihan & Karakteristik |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | SPA berkecepatan tinggi, strictly typed, render efisien |
| **Desain UI** | Harmonious Modern Sage Green & Dark Mode | Palet hijau sage `#244b37`, border halus `#d6e9df`, kontras ramah mata |
| **Micro-Animations** | RAF & CSS Hardware Acceleration | Count-up 60 FPS (`AnimatedNumber`), jarum analog GPU (`SemiCircleGauge`), progress bar meluncur |
| **State Management**| Zustand + TanStack Query v5 | Server state caching cerdas, polling latar belakang, no boilerplate |
| **Backend** | Laravel 12 (PHP 8.2+) | MVC Enterprise, Repository Pattern, SQL Downsampling adaptif |
| **Database** | SQLite (Dev) → PostgreSQL (Prod) | Integritas tipe data `DECIMAL` moneter, presisi `bcmul()` |
| **Hardware IoT** | ESP32 DevKit V1 + 3x DHT22 | Weighted Sensor Fusion (35% Atas, 40% Tengah, 25% Bawah) |
| **Protokol IoT** | REST API HTTP/HTTPS (Stateless) | Ringkas tanpa ketergantungan message broker MQTT |

---

## 3. Metodologi Pengembangan (SDLC)
Sistem dikembangkan menggunakan pendekatan **Extreme Programming (XP)** dengan iterasi cepat, Continuous Integration, dan pengujian otomatis komprehensif (**133 PHPUnit automated tests passing 100%**).

---

## 4. Halaman Login & Otorisasi RBAC
* **Autentikasi:** Laravel Sanctum token-based SPA.
* **Role Guard:**
  - `Admin`: Akses menyeluruh ke pengadaan batch, alokasi WMS, data penjualan, pembukuan beban operasional, dan pengaturan threshold.
  - `Worker`: Akses terbatas untuk monitoring iklim, denah grid fisik, input panen harian, pencatatan afkir, dan kontrol jeda panen.
* **Rate Limiting:** Throttle 15 percobaan login per menit untuk mencegah brute-force.

---

## 5. Halaman Dashboard (Beranda & Monitoring EWS)
* **4 Kartu Indikator Utama:**
  - **Suhu Kumbung (°C):** Dial spidometer analog dengan jarum GPU dan nilai count-up.
  - **Kelembapan Udara (%):** Dial spidometer analog dengan status zona nyaman.
  - **Baglog Aktif:** Bar kapasitas dinamis dan persentase kapasitas terpakai.
  - **Panen Hari Ini:** Realisasi berat panen (KG) terhadap target harian kumbung (15 KG).
* **Early Warning System (EWS):** Banner peringatan otomatis jika suhu atau kelembapan melanggar batas threshold aktif.
* **Grafik Mikroklimat Multirentang:** Grafik Area Recharts dengan pilihan rentang 6h (interval 5 menit), 12h, 24h, dan 7d yang dioptimasi melalui SQL bucket downsampling.
* **Grafik Tren Panen 14 Hari:** Visualisasi produktivitas panen harian selama 2 minggu terakhir.
* **Log Aktuator Terkini:** Riwayat durasi dan pemicu menyalanya misting sprinkler, kipas homogenisasi, atau kipas malam.

---

## 6. Halaman Kumbung Grid (WMS Spasial 3D & Heatmap)
Halaman visualisasi tata ruang kumbung pintar berbasis koordinat Kartesius 3D: **Row-Bay-Tier** (`slots`).
* **Kapasitas Fisik:** 3 Baris (Rak A, B, C) × 10 Kolom (Bay 01–10) × 10 Tingkat (Tier 01–10) = **300 Slot** (Maksimal 3.000 baglog).
* **Kolom Tier Sticky Solid:** Kolom nomor tingkat vertikal (`T-01` s.d. `T-10`) memiliki latar belakang solid 100% opaque (`#0f1712`), tinggi seragam (86px), dan bayangan pemisah, sehingga slot di belakangnya tidak bocor transparan saat digeser horizontal (*scroll*).
* **Tombol Alokasi Kompak:** Terletak rapi di baris atas sejajar dengan tab Rak C, tidak melebar memenuhi layar.
* **Mode Tampilan Ganda:**
  1. **Grid Fisik:** Menampilkan kode slot, status alokasi (Kosong, Inkubasi, Fruiting), umur baglog, dan sisa kapasitas aktif.
  2. **Peta Panen (Heatmap):** Menampilkan akumulasi total kilogram jamur yang berhasil dipetik dari tiap slot kamar dengan gradasi warna hijau intensitas panen.
* **Modal Detail Slot:** Klik pada slot manapun untuk melihat batch yang sedang menempati, tanggal masuk, riwayat mutasi afkir, dan rekaman panen historis.

---

## 7. Halaman Baglog Management & Ledger Afkir
* **Kartu KPI 2x2 Responsif:** Pada layar smartphone, 4 kartu ringkasan (Total Batch, Baglog Aktif, Batch Kritis, Tingkat Kontaminasi) tertata simetris 2 kolom × 2 baris.
* **Form Pengadaan Batch:** Input batch baru dengan pencatatan harga beli per baglog (`price_per_baglog`).
* **Jurnal Mutasi Afkir (Ledger Culls):** Fitur pencatatan kematian media tanam dengan alasan terstandarisasi (*Trichoderma*, Busuk Basah, Hama, Kering, Lainnya) dan catatan investigasi garansi vendor.
* **Kapasitas Aktif Dinamis:** Menghitung sisa baglog sehat secara otomatis:
  $$\text{Kapasitas Aktif} = \text{initial\_quantity} - \sum (\text{culls})$$

---

## 8. Halaman Harvests (Rekap Panen & Multi-Flush)
* **Kartu KPI 2x2 Responsif:** Panen Hari Ini, Total Bulan Ini, Estimasi Nilai Panen, dan Rata-rata Sesi tertata ergonomis di mobile.
* **Pencatatan Berbasis Koordinat:** Form input panen mencatat `slot_code` kamar pemetikan serta nomor siklus panen (`flush_number` 1 s.d. 7).
* **Tabel Riwayat Terpaginasi:** Menampilkan riwayat petik per 10 baris dengan filter waktu dan pencarian kode batch.

---

## 9. Halaman Sales & Analisis HPP Dinamis
* **Kartu KPI 2x2 Responsif:** Omzet Bulan Ini, Volume Terjual, Jumlah Transaksi, dan Rata-rata Harga per KG.
* **Kartu Analisis HPP & Margin Kontribusi:**
  - **Modal Awal Pengadaan:** Biaya pembelian baglog bibit (`quantity * price_per_baglog`).
  - **Beban Operasional:** Akumulasi pengeluaran listrik PLN, air misting, dan upah buruh.
  - **Total Omzet Penjualan:** Pendapatan kotor dari nota transaksi.
  - **Margin Kontribusi (Laba Operasional):** Keuntungan kotor riil setelah dikurangi biaya variabel.
  - **HPP per Kg:** Harga pokok per kilogram jamur yang berhasil diproduksi.
* **Modal Tambah Biaya Operasional:** Membukukan pengeluaran harian/bulanan dengan kategori terstandarisasi.
* **Tabel Transaksi Terpaginasi:** Riwayat nota penjualan terpaginasi per 10 baris dengan presisi moneter `bcmul()`.

---

## 10. Halaman Settings (Konfigurasi Ambang Batas Iklim)
* **Preset Fase Cepat:** Carousel snap horizontal di ponsel untuk memilih fase *Inkubasi*, *Primordia*, atau *Fruiting (Generatif)* secara 1-klik.
* **Formulir Input Minimalis & Bersih:** Input Suhu Min & Max serta Kelembapan Min & Max disusun berdampingan 2 kolom (side-by-side) dengan helper text pemicu aktuator di bawahnya.
* **Zero Clutter:** Bar diagram visualizer zona aman telah dibersihkan sepenuhnya sehingga form hemat ruang dan tombol "Terapkan & Simpan Konfigurasi" mudah dijangkau tanpa scroll berlebihan.

---

## 11. Widget Jeda Panen (Failsafe Timer Interupsi IoT)
Terletak pada Dashboard utama, memungkinkan pekerja menjeda otomasi misting dan fan saat proses panen berlangsung.
* **Preset Durasi:** Tombol 1-klik untuk `[ 2 Jam ]`, `[ 4 Jam ]`, `[ 6 Jam ]`, dan `[ 8 Jam ]`.
* **Live Countdown:** Menampilkan sisa jam, menit, dan detik masa jeda.
* **Fluid Dynamics Guard:** Mematikan exhaust fan seketika guna mencegah *short-circuiting* udara saat pintu kumbung dibuka lebar.
* **Tombol Interupsi:** `[ ⏹ Akhiri Jeda & Balik ke AUTO ]` mengembalikan kontrol iklim ke mode AUTO secara instan dan memicu pembacaan sensor DHT22 (*instant-read*).

---

## 12. Sidebar, Header, & Ergonomi Mobile
* **Sidebar Collapsible:** Mode penuh untuk desktop dan overlay hamburger pada smartphone.
* **Live Clock WIB:** Jam digital mandiri terisolasi di header untuk sinkronisasi jam biologis operasional kumbung.
* **Harmonisasi Dark Mode:** Dukungan tema gelap otomatis yang ramah mata untuk pemantauan malam hari.

---

## 13. Hubungan Antar Modul & Relevansi TA
```
[ WMS Spasial 3D (Slots) ]
           │
           ▼
[ Batch Baglog ] ──(Afkir)──> [ Ledger Culls ]
       │                              │ (Pengurangan Kapasitas)
       ▼                              ▼
[ Panen Harian & Multi-Flush ] ──> [ Heatmap Produktivitas Rak ]
       │
       ▼
[ Nota Penjualan Jamur ] ────┐
                             ▼
[ Beban Operasional ] ──> [ Analisis HPP & Margin Kontribusi ]
```
Arsitektur terintegrasi ini menyelesaikan rantai pasok secara utuh: dari pengadaan media tanam di rak, pemantauan iklim mikro oleh ESP32, pencatatan kematian biologis baglog, hingga evaluasi kelayakan finansial usaha tani.

---

## 14. Ringkasan Kebutuhan Fungsional (FR)

| Kode | Modul | Kebutuhan Fungsional | Status |
|---|---|---|:---:|
| FR-1.1 | Dashboard | Monitoring 4 kartu KPI real-time dengan dial gauge analog GPU | ✅ Selesai |
| FR-1.2 | Dashboard | Grafik iklim multirentang adaptif (5m downsampling) | ✅ Selesai |
| FR-1.3 | Dashboard | Early Warning System (EWS) peringatan batas anomali | ✅ Selesai |
| FR-1.4 | Dashboard | Widget Jeda Panen (Failsafe Timer Interupsi IoT) | ✅ Selesai |
| FR-2.1 | WMS 3D | Master denah rak Kartesius 3D (Row A/B/C, 300 slot) | ✅ Selesai |
| FR-2.2 | WMS 3D | Kolom tier sticky solid 100% opaque anti-tembus pandang | ✅ Selesai |
| FR-2.3 | WMS 3D | Alokasi batch baglog ke koordinat slot kamar | ✅ Selesai |
| FR-2.4 | WMS 3D | Heatmap spasial produktivitas panen per slot | ✅ Selesai |
| FR-2.5 | Baglog | Jurnal mutasi afkir baglog (*baglog culls*) | ✅ Selesai |
| FR-2.6 | Baglog | Kartu KPI responsif 2x2 pada layar smartphone | ✅ Selesai |
| FR-3.1 | Panen | Input panen harian multi-flush terhubung slot kamar | ✅ Selesai |
| FR-3.2 | Panen | Paginasi 10 baris pada tabel riwayat panen | ✅ Selesai |
| FR-3.3 | Penjualan | Pencatatan transaksi penjualan presisi `bcmul()` | ✅ Selesai |
| FR-3.4 | Keuangan | Pembukuan biaya operasional kumbung | ✅ Selesai |
| FR-3.5 | Keuangan | Kartu Analisis HPP & Margin Kontribusi per batch | ✅ Selesai |
| FR-4.1 | IoT | Ingesti telemetri IoT rate limited 20 req/menit | ✅ Selesai |
| FR-4.2 | IoT | Weighted Sensor Fusion 3x DHT22 & histeresis landai | ✅ Selesai |
| FR-4.3 | IoT | Dual Cooldown Guard & Night Lockout | ✅ Selesai |
| FR-4.4 | IoT | Konfigurasi threshold preset fase side-by-side | ✅ Selesai |
| FR-4.5 | IoT | Sinkronisasi mode jeda panen dan instant-read resume | ✅ Selesai |
