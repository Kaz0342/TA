# PRD — Smart Shroom Supply Chain Management (SCM)

**Versi Dokumen:** 2.0 (Updated: Spatial Grid WMS, Ledger Afkir, HPP Dinamis, & IoT Rule Engine)  
**Tanggal:** 27 September 2026  
**Penyusun:** Benedictus Vio  
**Konteks:** Tugas Akhir — Program Studi Sistem Informasi  

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Latar Belakang & Rumusan Masalah](#2-latar-belakang--rumusan-masalah)
3. [Tujuan Sistem](#3-tujuan-sistem)
4. [Target Pengguna & Peran (Aktor)](#4-target-pengguna--peran-aktor)
5. [Arsitektur Sistem & Tech Stack](#5-arsitektur-sistem--tech-stack)
6. [Desain Database (ERD)](#6-desain-database-erd)
7. [Kebutuhan Fungsional (FR)](#7-kebutuhan-fungsional-fr)
8. [Kebutuhan Non-Fungsional (NFR)](#8-kebutuhan-non-fungsional-nfr)
9. [Kontrak API (REST Endpoints)](#9-kontrak-api-rest-endpoints)
10. [Spesifikasi IoT & Perangkat Keras](#10-spesifikasi-iot--perangkat-keras)
11. [Desain Halaman UI/UX](#11-desain-halaman-uiux)
12. [Strategi Pengujian & QA](#12-strategi-pengujian--qa)
13. [Rencana Pengembangan Lanjutan (Roadmap)](#13-rencana-pengembangan-lanjutan-roadmap)

---

## 1. Ringkasan Eksekutif

**Smart Shroom SCM** adalah sistem informasi berbasis web dan IoT yang dirancang untuk mendigitalisasi proses monitoring iklim mikro kumbung, manajemen spasial denah rak 3D (Warehouse Management System), pelacakan siklus hidup media tanam (baglog) dengan event ledger mutasi afkir, pencatatan panen multi-flush, hingga perhitungan Harga Pokok Produksi (HPP) dan Margin Kontribusi secara otomatis. Sistem ini mengintegrasikan mikrokontroler ESP32 dengan dashboard web interaktif untuk budidaya jamur kuping (*Auricularia auricula-judae*).

---

## 2. Latar Belakang & Rumusan Masalah

### 2.1 Latar Belakang
Budidaya jamur kuping memerlukan pengendalian lingkungan yang ketat (suhu 24–32°C, kelembapan 85–95%) serta penataan media tanam yang terorganisir. Petani tradisional umumnya menghadapi tantangan:
- **Kerugian akibat iklim**: Keterlambatan menyalakan misting atau kipas yang membuat baglog dehidrasi atau busuk basah.
- **Pencatatan manual tanpa koordinat**: Kesulitan mendeteksi rak mana yang terserang hama/jamur hijau (*Trichoderma*) dan rak mana yang paling produktif.
- **Biaya operasional siluman**: Listrik, air misting, dan tenaga kerja tidak dibebankan ke HPP, sehingga profitabilitas semu.

### 2.2 Rumusan Masalah
> *"Bagaimana merancang dan mengimplementasikan sistem informasi berbasis web dan IoT untuk mendigitalisasi proses monitoring mikroklimat, manajemen spasial rak 3D, pelacakan afkir, dan perhitungan rantai pasok budidaya jamur kuping?"*

---

## 3. Tujuan Sistem

| No. | Tujuan | Modul Terkait |
|-----|--------|---------------|
| T1 | Memantau iklim mikro kumbung secara *real-time* via fusi sensor vertikal 3x DHT22 | Dashboard Monitoring, IoT |
| T2 | Memetakan dan mengalokasikan batch baglog ke koordinat rak 3D (WMS) | Kumbung Grid Spasial |
| T3 | Mencatat mutasi afkir baglog (*culls ledger*) untuk audit biosekuriti dan garansi bibit | Ledger Afkir & Baglog |
| T4 | Mencatat panen harian multi-flush dan menganalisis Heatmap produktivitas per slot | Harvest Management |
| T5 | Membukukan biaya operasional dan menghitung HPP serta Margin Kontribusi per batch | Analisis HPP & Sales |
| T6 | Mengontrol aktuator secara otomatis (Histeresis, Universal Guard) serta mode jeda panen | IoT Firmware & Rule Engine |

---

## 4. Target Pengguna & Peran (Aktor)

1. **Admin (Pemilik/Pengelola Kumbung)**:
   - Mengelola batch baglog, alokasi slot WMS, transaksi penjualan, pembukuan beban operasional, dan konfigurasi ambang batas iklim.
2. **Worker (Pekerja Lapangan / Buruh Tani)**:
   - Memantau dashboard iklim live, mencatat panen harian per slot/batch, mencatat baglog rusak (culls), dan mengaktifkan mode jeda panen saat pintu kumbung dibuka.
3. **Perangkat IoT (ESP32 Edge Device)**:
   - Membaca 3 sensor DHT22 vertikal, menghitung weighted sensor fusion, mengevaluasi interlock keselamatan lokal, mengirim telemetri via REST API, dan menyinkronkan threshold serta perintah jeda panen.

---

## 5. Arsitektur Sistem & Tech Stack

```
[ ESP32 Edge Device (3x DHT22, Relays) ]
       │  (HTTP POST / GET Polling ~10-30s)
       ▼
[ Laravel 12 Backend API (Sanctum Auth, Repository, Downsampling) ]
       │  (SQLite Dev / PostgreSQL Production)
       ▼
[ React 18 + Vite SPA Frontend (Harmonious Modern Sage UI & Dark Mode) ]
```

*   **Backend:** Laravel 12, PHP 8.2+, SQLite / PostgreSQL, Laravel Sanctum, Presisi `DECIMAL` & `bcmul()`.
*   **Frontend:** React 18, TypeScript, Vite, TailwindCSS (Modern Sage Green Palette), Zustand, TanStack Query, Recharts, Lucide Icons.
*   **IoT Firmware:** C++ Arduino ESP32 Firmware v3.5, non-blocking `millis()`, Dynamic Hysteresis, Dual Cooldown Guard, Ring Buffer Fallback.
*   **IoT Simulator:** Python 3.10+ Engine Termodinamika (`iot_simulator.py`) v3.5 dengan Seasonal Stochastic Markov Chain.

---

## 6. Desain Database (ERD)

Sistem terdiri dari 11 entitas inti:
1. `users`: Akun dan otorisasi RBAC (Admin, Worker).
2. `slots`: Master koordinat fisik rak kumbung 3D (`Row-Bay-Tier`, 300 slot kapasitas 3.000 baglog).
3. `baglog_batches`: Kelompok pengadaan media tanam dengan atribut `price_per_baglog`.
4. `batch_slot_assignments`: Pivot alokasi penempatan batch baglog ke koordinat slot kamar.
5. `baglog_culls`: Jurnal mutasi pengurangan baglog mati/terkontaminasi dengan alasan audit.
6. `harvests`: Rekaman panen harian dilengkapi `slot_code` dan `flush_number`.
7. `sales`: Rekaman penjualan jamur basah terhubung ke batch sumber panen.
8. `operational_expenses`: Pembukuan biaya operasional (listrik, air misting, tenaga kerja, dll.).
9. `threshold_settings`: Ambang batas iklim aktif dan preset fase pertumbuhan.
10. `sensor_data`: Deret waktu (*time-series*) telemetri iklim mikro (append-only).
11. `sprinkler_logs`: Histori pemicu dan durasi aktivasi misting, kipas, atau interupsi sistem.

---

## 7. Kebutuhan Fungsional (FR)

### Modul 1: Dashboard & Monitoring Iklim
*   **FR-1.1**: Real-time Climate Cards (Suhu, Kelembapan, Baglog Aktif, Panen Hari Ini) dilengkapi jarum spidometer analog GPU-accelerated dan animasi counter 60 FPS.
*   **FR-1.2**: Riwayat Iklim Multirentang (6h / 12h / 24h / 7d) dengan downsampling SQL adaptif (5m, 10m, 15m, 60m).
*   **FR-1.3**: Early Warning System (EWS) banner peringatan otomatis jika iklim keluar zona aman.
*   **FR-1.4**: Widget Jeda Panen (*Harvest Pause Mode*) menampilkan sisa waktu interupsi dan tombol akhiri jeda ke AUTO.

### Modul 2: Spatial Grid WMS & Siklus Baglog
*   **FR-2.1**: Master Grid 3D Denah Kumbung (Rak A, B, C; Kolom 01–10; Tingkat T-01 s.d. T-10) dengan kolom tier *sticky solid* 100% opaque.
*   **FR-2.2**: Alokasi Batch ke Slot Kamar via tombol alokasi ringkas dan modal dialog alokasi terintegrasi.
*   **FR-2.3**: Modal Detail Slot menampilkan histori alokasi, umur baglog, kapasitas aktif dinamis, dan riwayat panen.
*   **FR-2.4**: Form Input Batch Pengadaan Baglog dengan modal awal per biji (`price_per_baglog`).
*   **FR-2.5**: Jurnal Mutasi Afkir (*Baglog Culls*) mencatat kematian media tanam akibat *Trichoderma*, busuk basah, hama, atau kekeringan.
*   **FR-2.6**: Tabel Riwayat Afkir terpaginasi per 10 baris dengan filter batch dan alasan.

### Modul 3: Panen, Penjualan, & HPP Dinamis
*   **FR-3.1**: Input Panen Harian dengan pilihan batch baglog, slot kamar pemetikan, berat (KG), dan nomor siklus flush (1–7).
*   **FR-3.2**: Visualisasi Heatmap Produktivitas Panen Spasial per slot kamar di Kumbung Grid.
*   **FR-3.3**: Rekapitulasi Panen & Penjualan terpaginasi per 10 baris dengan kartu KPI responsif 2x2 pada layar ponsel.
*   **FR-3.4**: Pencatatan Beban Biaya Operasional Kumbung (listrik, misting, tenaga kerja, perawatan, logistik).
*   **FR-3.5**: Kartu Analisis HPP & Margin Kontribusi menampilkan modal awal, akumulasi biaya operasional, total omzet, laba kotor, dan HPP per Kg jamur.

### Modul 4: IoT, Aktuator, & Interruption Failsafe
*   **FR-4.1**: Ingesti Telemetri IoT (`POST /api/sensor-data`) dengan rate limiting 20 req/menit dan validasi presisi desimal.
*   **FR-4.2**: Ingesti Log Aktuator (`POST /api/sprinkler-logs`) untuk misting, fan, dan event sistem jeda panen.
*   **FR-4.3**: Pengaturan Threshold & Preset Fase (Inkubasi, Primordia, Fruiting) dengan layout side-by-side ergonomis dan tombol simpan konfigurasi.
*   **FR-4.4**: Sinkronisasi Dinamis Ambang Batas & Command (`GET /api/thresholds/active` & `GET /api/device/command`).
*   **FR-4.5**: Mode Jeda Panen Interaktif (`POST /api/device/pause` & `POST /api/device/resume`) dengan preset durasi 2h, 4h, 6h, 8h.
*   **FR-4.6**: Fluid Dynamics Guard: Mematikan Exhaust Fan dan Pompa Misting seketika saat mode panen aktif guna mencegah *short-circuiting* sirkulasi udara luar.

---

## 8. Kebutuhan Non-Fungsional (NFR)

*   **NFR-1 (Security)**: Sanctum token auth, middleware role check (Admin vs Worker), proteksi SQL injection, XSS sanitization, rate limit 20 req/menit untuk device endpoint.
*   **NFR-2 (Financial Integrity)**: Penggunaan tipe data `DECIMAL` di database dan fungsi `bcmul()` / `bcsub()` di backend untuk eliminasi galat floating-point.
*   **NFR-3 (Performance)**: Latensi query API sub-50ms menggunakan repository SQL bucket downsampling.
*   **NFR-4 (High Availability & Fail-Soft)**: ESP32 beroperasi mandiri (*closed-loop local control*) bahkan jika jaringan internet terputus, dilengkapi ring buffer caching.
*   **NFR-5 (Mobile Ergonomics & Accessibility)**: Seluruh kartu KPI menggunakan formasi grid 2x2 pada layar smartphone, header rak sticky solid, dan dark mode yang nyaman di mata.

---

## 9. Kontrak API (REST Endpoints)

| Method | Endpoint | Deskripsi | Akses |
|--------|----------|-----------|-------|
| `POST` | `/api/login` | Otentikasi pengguna | Publik |
| `POST` | `/api/register` | Registrasi akun worker baru | Publik |
| `POST` | `/api/sensor-data` | Ingesti telemetri dari ESP32 | Publik (Throttle 20/m) |
| `POST` | `/api/sprinkler-logs` | Ingesti log aktuator dari ESP32 | Publik (Throttle 20/m) |
| `GET`  | `/api/thresholds/active` | Ambil batas iklim & command jeda panen | Publik (IoT) |
| `GET`  | `/api/device/command` | Baca status command jeda terkini | Publik (IoT) |
| `GET`  | `/api/sensor-data/latest` | Telemetri iklim mikro terkini | Auth |
| `GET`  | `/api/sensor-data/chart` | Data grafik iklim downsampled adaptif | Auth |
| `GET`  | `/api/dashboard/stats` | Ringkasan 4 kartu KPI & status EWS | Auth |
| `GET`  | `/api/slots` | Daftar master 300 slot rak A/B/C | Auth |
| `GET`  | `/api/slots/heatmap` | Agregasi total berat panen per slot | Auth |
| `GET`  | `/api/slots/{code}` | Detail status & histori slot tertentu | Auth |
| `POST` | `/api/batch-slot-assignments` | Alokasikan batch baglog ke slot | Admin |
| `PATCH`| `/api/batch-slot-assignments/{id}/status` | Update status kamar alokasi | Admin |
| `DELETE`| `/api/batch-slot-assignments/{id}` | Kosongkan/hapus alokasi slot | Admin |
| `GET`  | `/api/baglog-culls` | Daftar histori mutasi afkir baglog | Auth |
| `POST` | `/api/baglog-culls` | Catat mutasi afkir baglog baru | Auth (Admin/Worker) |
| `GET`  | `/api/baglogs/hpp-summary` | Ringkasan HPP & Margin Kontribusi | Auth |
| `GET`  | `/api/operational-expenses` | Daftar beban biaya operasional | Auth |
| `POST` | `/api/operational-expenses` | Catat pengeluaran operasional baru | Admin |
| `DELETE`| `/api/operational-expenses/{id}` | Hapus catatan pengeluaran | Admin |
| `POST` | `/api/device/pause` | Aktifkan jeda panen timer failsafe | Auth |
| `POST` | `/api/device/resume` | Akhiri jeda panen & kembali ke AUTO | Auth |
| `GET`  | `/api/thresholds` | Konfigurasi ambang batas lengkap | Admin |
| `PUT`  | `/api/thresholds` | Update batas suhu, kelembapan, & preset | Admin |

---

## 10. Spesifikasi IoT & Perangkat Keras

*   **Mikrokontroler:** ESP32 DevKit V1 (Dual Core 240MHz, Wi-Fi 802.11 b/g/n).
*   **Sensor:** 3x DHT22 (Formasi Segitiga Diagonal: Atas 2.5m, Tengah 1.5m, Bawah 0.5m).
*   **Formula Fusion:** $T_{\text{avg}} = 0.35 T_A + 0.40 T_B + 0.25 T_C$; $RH_{\text{avg}} = 0.35 RH_A + 0.40 RH_B + 0.25 RH_C$.
*   **Aktuator:** Pompa Misting 12V DC (Nozzle kabut 0.15mm), Solenoid Valve Air 12V, Exhaust Fan 220V AC, Modul Relay Optocoupler.
*   **Display Lokal:** LCD I2C 16x2 menampilkan suhu, kelembapan, status MIST/FAN, dan sisa timer mode panen.

---

## 11. Desain Halaman UI/UX

1. **Dashboard Monitoring**: 4 KPI Cards teratas (Suhu, RH, Baglog Aktif, Panen Hari Ini), Widget Mode Panen, Grafik Iklim Recharts, Grafik Panen 14 Hari, dan Log Aktuator.
2. **Kumbung Grid (WMS 3D)**: Selector Rak A, B, C; Tombol Alokasi Kompak; Matriks Kolom 01–10 dan Tingkat T-01..T-10; Kolom Tier *sticky solid* 100% opaque; Mode Tampilan Grid Fisik dan Peta Panen (Heatmap).
3. **Baglog Management**: Kartu KPI 2x2 di ponsel, tabel batch terpaginasi 10 baris, tombol catat mutasi afkir, dan modal jurnal kematian baglog.
4. **Harvest Management**: Kartu KPI 2x2, tren panen 14 hari, tabel rekapitulasi panen terpaginasi dengan informasi slot kamar dan nomor flush.
5. **Sales & HPP Management**: Kartu Analisis HPP (Modal Awal, Biaya Operasional, Omzet, Keuntungan Kotor/Margin Kontribusi), tombol tambah biaya operasional, dan tabel riwayat transaksi.
6. **Settings Page**: Pemilih preset fase pertumbuhan (carousel snap di mobile), form input batas suhu & kelembapan side-by-side bersih tanpa visualizer redundan, dan tombol terapkan konfigurasi.

---

## 12. Strategi Pengujian & QA

### 12.1 Automated Testing (PHPUnit) — 133 Tests Passing (418 Assertions)
Seluruh pengujian otomatis backend mencapai **100% kelulusan** tanpa kegagalan:
*   `Phase2ModelsTest.php`: Integritas skema database, foreign key constraints, perhitungan umur dinamis, formula kapasitas aktif slot, dan relasi master slots.
*   `Phase3ApiTest.php`: Validasi endpoint alokasi slot WMS, pelarangan tumpang tindih slot, pencatatan ledger afkir, kalkulasi HPP dinamis, dan agregasi heatmap panen.
*   `Phase4DeviceControlTest.php`: Pengujian aktivasi mode jeda panen (`/device/pause`), validasi timer non-blocking, persistensi log sistem aktuator, dan resume kembali ke mode AUTO.
*   `Phase5IotRuleEngineTest.php`: Ingesti data telemetri berpresisi desimal, penerimaan log aktuator misting/fan, penegakan rate limiting (20 req/menit), sinkronisasi threshold dinamis, dan verifikasi endpoint latest.
*   `EccComprehensiveTestSuiteTest.php`, `SecurityAuthTest.php`, `SecurityInjectionTest.php`, `SecurityRateLimitTest.php`: Uji keamanan injeksi SQL, token expiry, pembatasan kuota admin, dan sanitasi payload.

### 12.2 IoT Simulator Testing (`iot_simulator.py`)
*   Uji koneksi sinkronisasi lokal ke backend Laravel (`--local`) dengan respon status HTTP 201 Created.
*   Uji responsifitas stochastic weather transitions (terik siang, hujan malam) dan validasi histeresis kurva landai.

---

## 13. Rencana Pengembangan Lanjutan (Roadmap)

| Phase | Fitur | Deskripsi |
|-------|-------|-----------|
| **Phase 6** | AI Harvest Yield Prediction | Model Random Forest untuk memprediksi tanggal dan tonase panen optimal berdasarkan profil iklim historis. |
| **Phase 6** | Notifikasi WhatsApp / Telegram Gateway | Pengiriman alert instan ke smartphone petani jika suhu/kelembapan kritis atau masa jeda panen hampir habis. |
| **Phase 7** | Native Mobile App | PWA / Flutter mobile application untuk pemindaian barcode fisik rak kumbung. |
