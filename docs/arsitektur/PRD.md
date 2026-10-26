# PRD — Smart Shroom Supply Chain Management (SCM)
**Judul Tugas Akhir:** *Sistem Informasi Supply Chain Management dan Spasial WMS pada Kumbung Jamur Terintegrasi dengan Otomasi dan Monitoring Mikroklimat IoT*  

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

### 2.1 Latar Belakang & Konteks Kemitraan Riil
Budidaya jamur kuping (*Auricularia auricula-judae*) memerlukan pengendalian mikroklimat yang ketat (suhu optimal 24–32°C, kelembapan relatif 85–95%) serta penataan media tanam (baglog) yang sistematis. Penelitian rekayasa piranti lunak ini berpijak pada studi kasus operasional nyata pada Usaha Kumbung Jamur Kuping milik mitra eksternal (kakak penyusun) dengan spesifikasi bangunan 5m × 7m × 3.5m (volume 122.5 m³) berkapasitas 3.000 baglog yang disusun pada 3 blok rak bertingkat 10.

### 2.2 Dinamika Kebutuhan Pemangku Kepentingan (Requirements Elicitation & Scope Evolution)
Arsitektur sistem **Smart Shroom SCM** berevolusi secara organik melalui proses *Requirements Elicitation* langsung bersama pemilik usaha (*Primary Stakeholder / Client*):
1. **Inisiasi Awal Sistem (Engineer-Initiated):**  
   Penyusun pada tahap awal merancang sistem yang berfokus pada otomasi lingkungan fisik dan pemantauan mikroklimat berbasis IoT (3 zona sensor SHT31, kontrol histeresis relay misting dan exhaust fan, serta web dashboard telemetri). Tujuannya adalah memitigasi risiko dehidrasi dan pembusukan basah baglog akibat keterlambatan penyiraman manual.
2. **Kebutuhan Kritis Pemilik Usaha (Client-Driven Requirements):**  
   Berdasarkan wawancara terstruktur dan observasi alur kerja harian bersama mitra pemilik usaha (kakak penyusun), teridentifikasi bahwa otomatisasi iklim semata tidak menyelesaikan titik kebocoran modal terbesar operasional kumbung. Mitra secara eksplisit menuntut digitalisasi pada dua pilar manajerial utama:
   - **Manajemen Inventori Spasial (WMS Kumbung):** Kesulitan melacak kondisi fisik 3.000 baglog secara spasial. Ketiadaan pencatatan posisi koordinat rak (`Row-Bay-Tier`) menyebabkan lambatnya karantina baglog yang terkontaminasi jamur hijau (*Trichoderma*), ketidakpastian usia baglog, serta butanya pelacakan siklus panen berulang (*multi-flush* ke-1 hingga ke-7).
   - **Transparansi Rantai Pasok & Keuangan (SCM):** Ketiadaan asosiasi antara berat hasil panen harian dengan modal awal pembelian bibit serta beban biaya operasional (listrik, air bertekanan, dan tenaga kerja). Hal ini menciptakan "profitabilitas semu" di mana pemilik usaha tidak mengetahui secara presisi Harga Pokok Produksi (HPP) riil per kilogram jamur yang dipanen.
3. **Sintesis Arsitektur Solutif:**  
   Penyusun mengintegrasikan inisiatif otomasi mikroklimat dengan tuntutan WMS dan SCM dari pemilik usaha. Hasilnya adalah ekosistem agritech rantai pasok tertutup (*Closed-Loop Agritech SCM*): iklim mikro dikontrol presisi oleh mikrokontroler tepi (Edge IoT) → media tanam dipantau produktivitasnya per koordinat rak 3D (WMS) → hasil panen dan efisiensi biaya dibukukan secara akuntabel (SCM).

### 2.3 Rumusan Masalah
> *"Bagaimana merancang dan mengimplementasikan sistem informasi berbasis web dan IoT yang mengintegrasikan otomasi mikroklimat kumbung dengan manajemen inventori spasial rak 3D (WMS), pelacakan mutasi afkir, dan perhitungan rantai pasok (SCM) sesuai kebutuhan operasional nyata budidaya jamur kuping?"*

---

## 3. Tujuan Sistem

| No. | Tujuan | Modul Terkait |
|-----|--------|---------------|
| T1 | Memantau iklim mikro kumbung secara *real-time* via fusi sensor vertikal 3x SHT30/SHT31 IP68 | Dashboard Monitoring, IoT |
| T2 | Memetakan dan mengalokasikan batch baglog ke koordinat rak 3D (WMS) | Kumbung Grid Spasial |
| T3 | Mencatat mutasi afkir baglog (*culls ledger*) untuk audit biosekuriti dan garansi bibit | Ledger Afkir & Baglog |
| T4 | Mencatat panen harian multi-flush dan menganalisis Heatmap produktivitas per slot | Harvest Management |
| T5 | Membukukan biaya operasional dan menghitung HPP serta Margin Kontribusi per batch | Analisis HPP & Sales |
| T6 | Mengontrol aktuator secara otomatis (Histeresis, Universal Guard) serta mode jeda panen | IoT Firmware & Rule Engine |

---

## 4. Target Pengguna & Peran (Aktor)

1. **Admin (Pemilik Usaha / Mitra / Product Owner):**
   - Memegang kendali manajerial dan kebijakan bisnis: mengelola batch pengadaan baglog, alokasi spasial rak 3D (WMS), tutup siklus kamar alokasi, otorisasi pembatalan audit (*void transaction*), transaksi penjualan hasil panen, pembukuan beban operasional, analisis finansial HPP per kilogram, dan konfigurasi ambang batas iklim mikro.
2. **Worker (Pekerja Lapangan / Operator Kumbung):**
   - Menjalankan aktivitas fisik harian: memantau dial gauge iklim live, mencatat penimbangan hasil panen harian per slot rak dan nomor siklus (*flush*), melaporkan mutasi baglog afkir/rusak (*culls*), dan mengaktifkan mode jeda panen (*Harvest Pause Mode*) saat pintu kumbung dibuka agar misting dan kipas tidak membasahi pekerja.
3. **Perangkat IoT (ESP32 Edge Device):**
   - Agen cerdas fisik di kumbung: membaca 3 zona sensor SHT30/SHT31 via multiplexer TCA9548A, mengeksekusi fusi sensor tertimbang, menjalankan kendali lokal *closed-loop* mandiri (pompa misting dan exhaust fan), mengirimkan telemetri berkala via REST API, serta mematuhi sinkronisasi perintah jeda panen dari dashboard.

---

## 5. Arsitektur Sistem & Tech Stack

```
[ ESP32 Edge Device (3x SHT30/SHT31 + TCA9548A, Relays) ]
       │  (HTTP POST tiap 60s; polling threshold 30s; polling command 8s)
       ▼
[ Laravel 13 Backend API (Sanctum Auth, Repository, Downsampling) ]
       │  (SQLite Dev / PostgreSQL Production)
       ▼
[ React 19 + Vite SPA Frontend (Harmonious Modern Sage UI & Dark Mode) ]
```

*   **Backend:** Laravel 13, PHP 8.3+, SQLite / PostgreSQL, Laravel Sanctum, Presisi `DECIMAL` & `bcmul()`.
*   **Frontend:** React 19, TypeScript, Vite, TailwindCSS 3 (Modern Sage Green Palette), Zustand, TanStack Query, Recharts, Lucide Icons.
*   **IoT Firmware:** C++ Arduino ESP32 Firmware v3.6, non-blocking `millis()`, Dynamic Hysteresis, Dual Cooldown Guard, Ring Buffer Fallback.
*   **IoT Simulator:** Python 3.10+ Engine Termodinamika (`iot_simulator.py`) v3.6 dengan Seasonal Stochastic Markov Chain.

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
| `POST` | `/api/register` | Registrasi akun worker baru (terproteksi) | Auth (Admin) |
| `POST` | `/api/sensor-data` | Ingesti telemetri dari ESP32 | Publik (Throttle 20/m) |
| `POST` | `/api/sprinkler-logs` | Ingesti log aktuator dari ESP32 | Publik (Throttle 20/m) |
| `GET`  | `/api/thresholds/active` | Ambil batas iklim & command jeda panen | Publik (IoT) |
| `GET`  | `/api/device/command` | Baca status command jeda terkini | Publik (IoT) |
| `GET`  | `/api/sensor-data/latest` | Telemetri iklim mikro terkini | Auth |
| `GET`  | `/api/sensor-data/chart` | Data grafik iklim downsampled adaptif | Auth |
| `GET`  | `/api/dashboard/stats` | Ringkasan 4 kartu KPI & status EWS | Auth |
| `GET`  | `/api/slots` | Daftar master 300 slot rak A/B/C (Anti N+1) | Auth |
| `GET`  | `/api/slots/heatmap` | Agregasi total berat panen per slot | Auth |
| `GET`  | `/api/slots/{code}` | Detail status & histori slot tertentu | Auth |
| `POST` | `/api/batch-slot-assignments` | Alokasikan batch baglog ke slot | Admin |
| `PATCH`| `/api/batch-slot-assignments/{id}/status` | Update status kamar alokasi | Admin |
| `POST` | `/api/batch-slot-assignments/{id}/complete` | Selesaikan siklus slot & auto-cull habis | Admin |
| `DELETE`| `/api/batch-slot-assignments/{id}` | Kosongkan/hapus alokasi slot | Admin |
| `GET`  | `/api/baglog-culls` | Daftar histori mutasi afkir baglog | Auth |
| `POST` | `/api/baglog-culls` | Catat mutasi afkir baglog baru | Auth (Admin/Worker) |
| `POST` | `/api/baglog-culls/{id}/void` | Batalkan mutasi afkir & pulihkan kapasitas | Auth (Admin) |
| `GET`  | `/api/harvests` | Daftar riwayat pemetikan panen | Auth |
| `POST` | `/api/harvests` | Catat timbangan hasil panen harian | Auth (Admin/Worker) |
| `POST` | `/api/harvests/{id}/void` | Batalkan catatan panen (audit trail) | Admin |
| `GET`  | `/api/sales` | Daftar riwayat transaksi penjualan | Auth (Admin) |
| `POST` | `/api/sales` | Catat nota transaksi penjualan baru | Auth (Admin) |
| `POST` | `/api/sales/{id}/void` | Batalkan transaksi penjualan (audit trail) | Auth (Admin) |
| `GET`  | `/api/baglogs/hpp-summary` | Ringkasan HPP & Margin Kontribusi | Auth (Admin) |
| `GET`  | `/api/operational-expenses` | Daftar beban biaya operasional | Admin |
| `POST` | `/api/operational-expenses` | Catat pengeluaran operasional baru | Admin |
| `POST` | `/api/operational-expenses/{id}/void` | Batalkan catatan pengeluaran (audit trail) | Admin |
| `DELETE`| `/api/operational-expenses/{id}` | Hapus catatan pengeluaran fisik | Admin |
| `POST` | `/api/device/pause` | Aktifkan jeda panen timer failsafe (max 8h) | Auth |
| `POST` | `/api/device/resume` | Akhiri jeda panen & kembali ke AUTO | Auth |
| `GET`  | `/api/thresholds` | Konfigurasi ambang batas lengkap | Admin |
| `PUT`  | `/api/thresholds` | Update batas suhu, kelembapan, & preset (min 4% diff) | Admin |

---

## 10. Spesifikasi IoT & Perangkat Keras

*   **Mikrokontroler:** ESP32 DevKit V1 (Dual Core 240MHz, Wi-Fi 802.11 b/g/n).
*   **Sensor:** 3x SHT30 / SHT31 Probe IP68 Waterproof (Formasi Segitiga Diagonal: Atas 2.5m, Tengah 1.5m, Bawah 0.5m via TCA9548A Multiplexer).
*   **Formula Fusion:** $T_{\text{avg}} = 0.35 T_A + 0.40 T_B + 0.25 T_C$; $RH_{\text{avg}} = 0.35 RH_A + 0.40 RH_B + 0.25 RH_C$.
*   **Aktuator:** Pompa Misting 12V DC (Nozzle kabut 0.3mm), Solenoid Valve Air 12V, Exhaust Fan 220V AC, Modul Relay Optocoupler.
*   **Display Lokal:** LCD I2C 16x2 menampilkan suhu, kelembapan, status MIST/FAN, dan sisa timer mode panen.

---

## 11. Desain Halaman UI/UX

1. **Dashboard Monitoring**: 4 KPI Cards teratas (Suhu, RH, Baglog Aktif, Panen Hari Ini), Widget Mode Panen, Grafik Iklim Recharts, Grafik Panen 14 Hari, dan Log Aktuator.
2. **Kumbung Grid (WMS 3D)**: Selector Rak A, B, C; Tombol Alokasi Kompak; Matriks Kolom 01–10 dan Tingkat T-01..T-10; Kolom Tier *sticky solid* 100% opaque; Mode Tampilan Grid Fisik dan Peta Panen (Heatmap); Tombol In-Context *"Catat Rusak"* dan *"Tutup Siklus"*.
3. **Baglog Management**: Kartu KPI 2x2 di ponsel, tabel batch terpaginasi 10 baris, tombol catat mutasi afkir, tombol void afkir, dan modal jurnal kematian baglog.
4. **Harvest Management**: Kartu KPI 2x2, tren panen 14 hari, tabel rekapitulasi panen terpaginasi dengan informasi slot kamar, nomor flush, dan tombol pembatalan (*Void Harvest*).
5. **Sales & HPP Management**: Kartu Analisis HPP (Modal Awal, Biaya Operasional, Omzet, Keuntungan Kotor/Margin Kontribusi, Banner Peringatan Harga Modal), tombol tambah biaya operasional, tabel riwayat transaksi terpaginasi, dan tombol pembatalan (*Void Sale*).
6. **Settings Page**: Pemilih preset fase pertumbuhan (carousel snap di mobile), form input batas suhu & kelembapan side-by-side bersih dengan validasi deadband minimal 4 poin, dan tabel riwayat aktuator lengkap dengan badge status terkini.

---

## 12. Strategi Pengujian & QA

### 12.1 Automated Testing (PHPUnit) — 198 Tests Passing (797 Assertions)
Seluruh pengujian otomatis backend mencapai **100% kelulusan** tanpa kegagalan:
*   `Phase2ModelsTest.php`: Integritas skema database, foreign key constraints, perhitungan umur dinamis, formula kapasitas aktif slot, dan relasi master slots.
*   `Phase3ApiTest.php`: Validasi endpoint alokasi slot WMS, pelarangan tumpang tindih slot, pencatatan ledger afkir, kalkulasi HPP dinamis, dan agregasi heatmap panen.
*   `Phase4DeviceControlTest.php`: Pengujian aktivasi mode jeda panen (`/device/pause`), validasi timer non-blocking, persistensi log sistem aktuator, dan resume kembali ke mode AUTO.
*   `Phase5IotRuleEngineTest.php`: Ingesti data telemetri berpresisi desimal, penerimaan log aktuator misting/fan, penegakan rate limiting (20 req/menit), sinkronisasi threshold dinamis, dan verifikasi endpoint latest.
*   `WmsPhaseATest.php` s.d. `WmsPhaseDTest.php`: Pengujian komprehensif lifecycle WMS baglog, pengurangan kapasitas aktif per slot, otomatisasi afkir `HABIS_PRODUKSI` saat siklus selesai, pembatalan data (*void*) dengan audit trail, eliminasi query N+1, dan proteksi race condition nomor batch `BL-YYYYMMDD-XXX`.
*   `WmsAuditRemediationTest.php` (21 test) dan `RackManagementTest.php` (9 test): Remediasi temuan audit WMS/SCM (AUD-01 s.d. AUD-17) dan manajemen rak. Rincian temuan ada di `docs/logika-bisnis/AUDIT_WMS_SCM.md`.
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
