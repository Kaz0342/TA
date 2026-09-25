# Smart Shroom SCM 🍄

**Sistem Manajemen Rantai Pasok Jamur Kuping Berbasis IoT (Smart Shroom SCM)** adalah sistem informasi terintegrasi yang dirancang untuk memantau iklim mikro kumbung jamur secara *real-time* dan mendigitalisasi proses rantai pasok budidaya jamur kuping (*Auricularia auricula-judae*). Sistem mencakup siklus hidup media tanam (*baglog*), pencatatan panen, hingga perhitungan pendapatan (*revenue*) dan neraca rantai pasok secara otomatis. Proyek ini merupakan produk utama Tugas Akhir (TA) Program Studi Sistem Informasi.

---

## 🛠️ Tech Stack & Arsitektur

### 1. Backend (API & Business Logic)
- **Framework:** Laravel 12 (PHP 8.2+)
- **Database:** SQLite (Development / Testing) & MySQL/PostgreSQL (Production)
- **Autentikasi & RBAC:** Laravel Sanctum (Token-based SPA Auth) dengan peran `admin` dan `worker`
- **Presisi Moneter & Lingkungan:** Penggunaan tipe data `DECIMAL` (bukan `FLOAT`) dan fungsi `bcmul()` untuk mencegah *floating-point error*
- **Query Optimization:** Repository pattern dengan **SQL Time-Bucket Downsampling** adaptif di [SensorDataRepository.php](file:///d:/DevTools/Antigravity/Projects/TA_vio/backend/app/Repositories/SensorDataRepository.php) (latensi query turun dari ~400ms ke 14ms, payload berkurang 98.8%)
- **Automated Testing:** 115 automated tests PHPUnit dengan 299 assertions lulus 100%

### 2. Frontend (Dashboard User Interface)
- **Framework:** React 18 + TypeScript + Vite
- **UI & Styling:** TailwindCSS dengan tema **Harmonious Modern Sage Green & Dark Mode** (desain *clean*, *rounded-3xl*, token warna netral soft, ramah mata)
- **State Management:** Zustand (Auth & UI Theme Store) + TanStack Query (Server State Cache & Polling)
- **Micro-Animations & Visual Excellence:**
  - `LiveClock`: Jam digital mandiri terisolasi (mencegah *re-render tsunami* pada grafik)
  - `AnimatedNumber`: Animasi *count-up* halus berbasis `requestAnimationFrame` + kurva `easeOutCubic`
  - `SemiCircleGauge`: Jarum spidometer analog terakselerasi GPU (`transform: rotate` CSS transition)
  - `AnimatedProgressBar`: Bar persentase kapasitas meluncur mulus
- **Pagination Konsisten:** Pagination per 10 baris di ketiga modul tabel data (*Baglog*, *Harvest*, dan *Sales*)

### 3. IoT Edge Device & Simulasi (Firmware v3.5)
- **Mikrokontroler:** ESP32 (Dual Core 240MHz, Wi-Fi 802.11 b/g/n)
- **Formasi Sensor:** 3x DHT22 dalam konfigurasi **Segitiga Diagonal** (Zona Atas 2.5m, Tengah 1.5m, Bawah 0.5m)
- **Sensor Fusion:** *Weighted Stratification Fusion* (35% Atas, 40% Tengah, 25% Bawah)
- **Aktuator & Relay:**
  - Relay Pompa Misting Nozzle (12V) + Solenoid Valve
  - Relay Exhaust Fan (220V)
- **Logika Kontrol Cerdas (Closed-Loop Hysteresis):**
  - *Dynamic Hysteresis Misting* dengan kurva landai (target stop ~90% RH)
  - *Universal Guard*: Cooldown kipas malam 30 menit & sinkronisasi timer otomatis (*Over-Humidity Purge* vs *Periodic CO2 Flush*)
  - *Safety Override*: Suhu kritis (> 34°C) mem-bypass semua jeda untuk menyalakan fan darurat
- **Simulator IoT:** Engine termodinamika [iot_simulator.py](file:///d:/DevTools/Antigravity/Projects/TA_vio/iot_simulator.py) v3.5 dengan model cuaca stokastik rantai Markov

---

## 🚀 Fitur Utama Sistem

1. **Dashboard Monitoring Real-Time & EWS:**
   - 4 Kartu KPI operasional (Suhu, Kelembaban, Baglog Aktif, Panen Hari Ini) dilengkapi spidometer analog dan animasi counter.
   - Grafik riwayat iklim ganda Recharts dengan rentang waktu adaptif: **6 Jam (tiap 5 menit / 72 titik)**, **12 Jam**, **24 Jam**, dan **7 Hari**.
   - Monitoring status aktuator live (*Misting*, *Fan Homogenisasi*, *Fan Pendinginan*, *Night Purge*).
   - Banner peringatan dini (*Early Warning System*) otomatis saat iklim keluar dari batas optimal.

2. **Manajemen Siklus Baglog (Lifecycle):**
   - Pencatatan batch tanam baru dengan format kode otomatis `BL-YYYYMMDD-XXX`.
   - Klasifikasi otomatis umur media tanam (< 30 hari Inkubasi, 30–90 hari Produktif, > 90 hari Rawan Afkir).
   - Tabel batch lengkap dengan filter status (*Active*, *Contaminated*, *Disposed*), pencarian, dan pagination per 10 batch.

3. **Rekapitulasi & Analitik Panen (Harvest Management):**
   - Input timbangan panen harian per batch baglog asal.
   - Visualisasi tren panen 14 hari terakhir terhadap target harian kumbung.
   - Tabel riwayat panen terpaginasi per 10 baris.

4. **Manajemen Rantai Pasok Penjualan (Sales & SCM):**
   - Pencatatan nota penjualan ke mitra pedagang pasar, toko sayur, resto, dan pengepul.
   - Analisis omzet bulanan, rata-rata harga jual per Kg, dan neraca cadangan stok panen (*SCM buffer*).
   - Tabel riwayat transaksi terpaginasi per 10 baris dengan filter waktu dan pembeli.

5. **Pengaturan Threshold Fleksibel:**
   - Konfigurasi batas atas/bawah suhu dan kelembaban langsung dari dashboard web.
   - ESP32 mengambil threshold terbaru secara dinamis via endpoint `GET /api/thresholds/active`.

---

## 📂 Struktur Direktori

```text
📦 TA_vio
 ┣ 📂 backend          # Laravel 12 API (Clean Architecture, Repositories, Tests)
 ┣ 📂 frontend         # React 18 + Vite SPA (Harmonious Modern Sage UI, Pages, Components)
 ┣ 📂 esp32_firmware   # Source code C++ Arduino ESP32 Firmware v3.5
 ┣ 📂 docs             # Dokumentasi arsitektur, PRD, ERD, Use Case, dan Logika Aktuator
 ┣ 📜 iot_simulator.py # Python IoT Simulator v3.5 (Termodinamika Kumbung 122.5 m³)
 ┣ 📜 DESIGN.md        # Master Design System Specification & Token Manifest
 ┗ 📜 README.md        # Ringkasan Proyek
```

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
