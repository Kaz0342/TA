# Smart Shroom SCM 🍄
### *Sistem Informasi Supply Chain Management dan Spasial WMS pada Kumbung Jamur Terintegrasi dengan Otomasi dan Monitoring Mikroklimat IoT*

**Smart Shroom SCM** adalah sistem informasi yang dirancang untuk mendigitalisasi proses rantai pasok budidaya jamur kuping (*Auricularia auricula-judae*), manajemen tata letak inventaris rak gudang (Spasial WMS), dan otomasi pemeliharaan iklim mikro kumbung berbasis IoT secara *real-time*. Sistem mencakup siklus hidup baglog, pencatatan panen terhubung slot, perhitungan Harga Pokok Penjualan (HPP) dinamis, hingga neraca rantai pasok secara otomatis. Proyek ini merupakan produk utama Tugas Akhir (TA) Program Studi Sistem Informasi.

---

## 🛠️ Tech Stack & Arsitektur

### 1. Backend (API & Business Logic)
- **Framework:** Laravel 12 (PHP 8.2+)
- **Framework:** Laravel 12 (PHP 8.2+)
- **Database:** SQLite (Development / Testing) & PostgreSQL / Supabase (Production) dengan driver-agnostic aggregations (`date_bin` di PGSQL)
- **Autentikasi & RBAC:** Laravel Sanctum (Token-based SPA Auth) dengan otorisasi peran `admin` dan `worker` (Registrasi dilindungi token Admin)
- **Presisi Moneter & Lingkungan:** Penggunaan tipe data `DECIMAL` (bukan `FLOAT`) dan fungsi `bcmul()` untuk mencegah *floating-point error*
- **Query Optimization:** Repository pattern dengan **SQL Time-Bucket Downsampling** adaptif di [SensorDataRepository.php](file:///d:/DevTools/Antigravity/Projects/TA_vio/backend/app/Repositories/SensorDataRepository.php) (latensi query turun dari ~400ms ke 14ms, payload berkurang 98.8%) serta eliminasi query N+1 pada denah WMS
- **Automated Testing:** **168 automated tests PHPUnit dengan 591 assertions lulus 100%** (mencakup pengujian fungsional Fase 2 s.d. 5, WMS Phase A–D, Audit Trail Voiding, dan Security Hardening F-01–F-16)

### 2. Frontend (Dashboard User Interface)
- **Framework:** React 18 + TypeScript + Vite
- **UI & Styling:** TailwindCSS dengan tema **Harmonious Modern Sage Green & Dark Mode** (desain *clean*, *rounded-3xl*, token warna netral soft, ramah mata)
- **Mobile-First Ergonomics:** Formasi kartu KPI Grid 2x2 responsif di smartphone, kolom tier sticky solid anti-tembus pandang, dan form settings minimalis side-by-side
- **State Management:** Zustand (Auth & UI Theme Store) + TanStack Query (Server State Cache & Polling)
- **Micro-Animations & Visual Excellence:**
  - `LiveClock`: Jam digital mandiri terisolasi (mencegah *re-render tsunami* pada grafik)
  - `AnimatedNumber`: Animasi *count-up* halus berbasis `requestAnimationFrame` + kurva `easeOutCubic`
  - `SemiCircleGauge`: Jarum spidometer analog terakselerasi GPU (`transform: rotate` CSS transition)
  - `AnimatedProgressBar`: Bar persentase kapasitas meluncur mulus
- **Pagination Konsisten:** Pagination per 10 baris di seluruh modul tabel data (*Baglog*, *Harvest*, *Sales*, dan *Ledger Culls*)
- **Audit Trail & In-Context Controls:** Modal pembatalan data (*void*) dengan input alasan wajib di seluruh tabel transaksi dan tombol cepat *"Catat Rusak"* langsung dari modal slot rak

### 3. IoT Edge Device & Simulasi (Firmware v3.6)
- **Mikrokontroler:** ESP32 (Dual Core 240MHz, Wi-Fi 802.11 b/g/n) dengan arsitektur **Offline-First Non-Blocking**
- **Formasi Sensor:** 3x SHT30 / SHT31 Probe IP68 Waterproof dalam konfigurasi **Segitiga Diagonal** (Zona Atas 2.5m, Tengah 1.5m, Bawah 0.5m via TCA9548A Multiplexer)
- **Sensor Fusion:** *Weighted Stratification Fusion* (35% Atas, 40% Tengah, 25% Bawah)
- **Aktuator & Relay:**
  - Relay Pompa Misting Nozzle (12V) + Solenoid Valve
  - Relay Exhaust Fan (220V)
- **Logika Kontrol Cerdas (Closed-Loop Hysteresis & Failsafe):**
  - *Dynamic Hysteresis Misting* dengan target stop adaptif (~88% RH) & timeout proteksi 90 detik
  - *Universal Guard*: Cooldown kipas malam 30 menit & sinkronisasi timer otomatis (*Over-Humidity Purge* vs *Periodic CO2 Flush*)
  - *Safety Override*: Suhu kritis (> 34°C) dengan histeresis 24 jam tanpa *relay chatter*
  - *Fluid Dynamics Guard & Mode Panen*: Mematikan fan dan misting seketika saat pekerja membuka pintu kumbung (maksimal jeda 8 jam / 28.800 detik)
- **Simulator IoT:** Engine termodinamika [iot_simulator.py](file:///d:/DevTools/Antigravity/Projects/TA_vio/iot_simulator.py) v3.6 dengan model cuaca stokastik rantai Markov dan paritas cadence 5 detik terhadap mikrokontroler fisik

---

## 🚀 Fitur Utama Sistem

1. **Dashboard Monitoring Real-Time & EWS:**
   - 4 Kartu KPI operasional (Suhu, Kelembaban, Baglog Aktif, Panen Hari Ini) dilengkapi spidometer analog dan animasi counter.
   - Grafik riwayat iklim ganda Recharts dengan rentang waktu adaptif: **6 Jam (tiap 5 menit / 72 titik)**, **12 Jam**, **24 Jam**, dan **7 Hari**.
   - Monitoring status aktuator live (*Misting*, *Fan Homogenisasi*, *Fan Pendinginan*, *Night Purge*).
   - Banner peringatan dini (*Early Warning System*) otomatis saat iklim keluar dari batas optimal.

2. **Denah Spasial 3D (WMS Kumbung Grid) & Peta Panen:**
   - Master denah fisik 300 slot kamar (Rak A, B, C; Kolom 01–10; Tingkat T-01..T-10) kapasitas 3.000 baglog.
   - Kolom tier sticky solid 100% opaque yang memblokir tembus pandang slot saat digeser horizontal.
   - Mode beralih seketika antara **Grid Fisik** (status alokasi & umur) dan **Peta Panen Heatmap** (akumulasi berat panen per kamar).
   - Dialog alokasi cepat, modal detail riwayat slot, tombol in-context *"Catat Rusak"* yang otomatis membawa kode slot/batch, dan aksi *"Tutup Siklus"* yang otomatis mencatatkan afkir `HABIS_PRODUKSI` untuk sisa kapasitas.

3. **Manajemen Siklus Baglog & Ledger Afkir (Culls):**
   - Pencatatan batch tanam baru dengan format kode otomatis `BL-YYYYMMDD-XXX` yang terlindungi dari *race condition* via database transaction retry lock.
   - Jurnal mutasi pengurangan baglog mati (*culls ledger*) untuk audit biosekuriti (*Trichoderma*, busuk basah, hama, kekeringan, dan habis masa produksi).
   - Perhitungan kapasitas aktif dinamis per slot (`initial_quantity - SUM(culls)`).
   - Fitur pembatalan afkir (*Void Cull*) khusus admin yang otomatis memulihkan kapasitas baglog ke slot terkait.
   - Tabel batch lengkap dengan filter status, pencarian, dan pagination per 10 batch.

4. **Rekapitulasi & Analitik Panen (Harvest Management):**
   - Input timbangan panen harian terhubung ke kode slot kamar dan nomor siklus petik (`flush_number` 1–7).
   - Fitur pembatalan panen (*Void Harvest*) dengan pencatatan alasan pembatalan (audit trail) untuk menganulir kekeliruan timbangan tanpa merusak integritas database.
   - Visualisasi tren panen 14 hari terakhir terhadap target harian kumbung.
   - Tabel riwayat panen terpaginasi per 10 baris lengkap dengan tombol aksi void.

5. **Manajemen Rantai Pasok Penjualan & HPP Dinamis:**
   - Pencatatan nota penjualan ke mitra pedagang pasar, toko sayur, resto, dan pengepul via `bcmul()`.
   - Fitur pembatalan penjualan (*Void Sale*) dengan verifikasi alasan audit trail guna memulihkan perhitungan omzet secara real-time.
   - Pembukuan beban biaya operasional kumbung (listrik PLN, air misting, tenaga kerja).
   - Kartu Analisis HPP & Margin Kontribusi manajerial per batch baglog, dilengkapi banner peringatan jika batch belum memiliki catatan harga beli modal awal (`price_missing`).
   - Tabel riwayat transaksi terpaginasi per 10 baris.

6. **Pengaturan Threshold & Mode Jeda Panen Interaktif:**
   - Konfigurasi batas atas/bawah suhu dan kelembaban minimalis berdampingan (side-by-side) serta carousel preset fase.
   - Penegakan validasi deadband kelembapan minimal 4 poin (`humidity_max - humidity_min >= 4`) di sisi backend dan client UI.
   - Widget Jeda Panen di dashboard dengan failsafe countdown timer (2h, 4h, 6h, 8h) dan tombol resume instan ke mode AUTO.

---

## 📂 Struktur Direktori & Dokumentasi

```text
📦 TA_vio
 ┣ 📂 backend          # Laravel 13 API (Clean Architecture, Repositories, Tests)
 ┣ 📂 frontend         # React 19 + Vite SPA (Harmonious Modern Sage UI, Pages, Components)
 ┣ 📂 esp32_firmware   # Source code C++ Arduino ESP32 Firmware v3.5
 ┣ 📂 docs             # Dokumentasi arsitektur, PRD, ERD, Use Case, Sequence, DFD, & Logika Aktuator
 ┃ ┣ 📜 use_case.md    # 🎯 29 Spesifikasi Use Case SRS & Diagram UML
 ┃ ┣ 📜 sequence_diagram.md # ⚡ 11 Diagram Sekuensial UML Lifelines & Traceability Matrix
 ┃ ┣ 📜 dfd.md         # 🔄 Data Flow Diagram (Level 0, Level 1, Level 2, & Kamus Data)
 ┃ ┣ 📜 EVALUASI_TERMODINAMIKA_DAN_DEADLOCK_IOT.md # 🔬 Kajian Matematis Deadlock Kipas & Dinamika Fluida ACH
 ┃ ┗ 📂 manual         # 📖 Buku Manual Pengguna (Markdown & HTML Siap Cetak A4)
 ┣ 📜 iot_simulator.py # Python IoT Simulator v3.5 (Termodinamika Kumbung 122.5 m³)
 ┣ 📜 DESIGN.md        # Master Design System Specification & Token Manifest
 ┗ 📜 README.md        # Ringkasan Proyek
```

> 📖 **Buku Manual Pengguna Lengkap:** Silakan buka [MANUAL_BOOK.md](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/manual/MANUAL_BOOK.md) atau buka [MANUAL_BOOK.html](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/manual/MANUAL_BOOK.html) di browser untuk langsung dicetak (`Ctrl+P` → Save as PDF).


---

## ⚙️ Petunjuk Menjalankan Sistem (Local Development)

### 1. Menjalankan Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```
*Jalankan automated test untuk memastikan seluruh logika backend 100% lulus:*
```bash
php artisan test
```

### 2. Menjalankan Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Akses dashboard di browser melalui: `http://localhost:5173/`  
Akun demo default:
- **Admin:** `admin@kumbung.id` / `password`
- **Worker:** `worker@kumbung.id` / `password`

### 3. Menjalankan IoT Simulator (Alternatif Hardware Fisik)
```bash
python iot_simulator.py --local --interval 10
```

---

*Dikembangkan untuk Tugas Akhir Program Studi Sistem Informasi.*
