# Smart Shroom SCM 🍄

Sistem Manajemen Rantai Pasok Jamur Tiram Berbasis IoT (**Smart Shroom SCM**) adalah sistem informasi terintegrasi yang dibangun untuk memantau iklim mikro kumbung jamur secara *real-time* dan mendigitalisasi proses rantai pasok budidaya jamur tiram, mulai dari manajemen *baglog*, pencatatan panen, hingga perhitungan pendapatan (revenue) otomatis. Proyek ini merupakan produk utama Tugas Akhir (TA) di bidang Sistem Informasi.

---

## 🛠️ Tech Stack

### 1. Backend (API & Business Logic)
- **Framework:** Laravel 12 (PHP)
- **Database:** SQLite (Development) / MySQL/PostgreSQL (Production)
- **Autentikasi:** Laravel Sanctum (Token-based SPA Auth)
- **Presisi Data:** Penggunaan `bcmul()` dan tipe data `DECIMAL` untuk kalkulasi keuangan agar terhindar dari *floating-point error*.

### 2. Frontend (Dashboard User Interface)
- **Framework:** React 18 + TypeScript + Vite
- **UI & Styling:** TailwindCSS (Neubrutalism Theme)
- **State Management:** Zustand (Auth & UI State) + TanStack Query (Server State)

### 3. IoT Edge Device (Hardware)
- **Mikrokontroler:** ESP32 (NodeMCU / Wemos D1 Mini)
- **Sensor Suhu & Kelembapan:** DHT22
- **Sensor Kualitas Udara (CO2):** MQ-135 / MH-Z19
- **Sensor Intensitas Cahaya:** BH1750
- **Modul Waktu:** RTC DS3231
- **Aktuator:** Relay Module + Mini Water Pump (Sistem Sprinkler Otomatis)

---

## 🚀 Fitur Utama

1. **Pemantauan Iklim Real-Time (EWS):** Dashboard memantau suhu, kelembapan, CO2, dan intensitas cahaya. Jika parameter melewati ambang batas (threshold) yang di-setting Admin, peringatan dini otomatis menyala.
2. **Manajemen Baglog (Lifecycle):** Mencatat *batch* media tanam baru, umur baglog, serta status kontaminasi/kematian.
3. **Rekapitulasi Panen Harian:** Input panen mingguan/harian beserta visualisasi grafis tren produktivitas 14 hari ke belakang.
4. **Sistem Penjualan (Sales):** Mencatat kuantitas terjual dan harga per Kg untuk menghitung total revenue kumbung.
5. **IoT Fault-Tolerant "Blackbox":** Memanfaatkan SPIFFS dan Ring Buffer di memori ESP32 + RTC. Jika koneksi Wi-Fi kumbung terputus, data sensor tidak akan hilang, melainkan disimpan sementara secara lokal dan dikirim massal (bulk upload) ketika internet kembali normal.

---

## 📂 Struktur Direktori
```text
📦 TA_vio
 ┣ 📂 backend          # Source code Laravel 12 (API)
 ┣ 📂 frontend         # Source code React + Vite (Dashboard UI)
 ┣ 📂 esp32_firmware   # Kodingan Arduino/C++ untuk hardware ESP32
 ┣ 📂 docs             # Dokumentasi arsitektur, panduan hardware & UI
 ┗ 📜 README.md
```

---

## ⚙️ Petunjuk Setup Cepat (Development)

### 1. Setup Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### 2. Setup Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

### 3. Setup Hardware IoT
Panduan hardware lebih rinci, *shopping list*, dan arsitektur data flow silakan baca di folder `docs/`!

---

*Dikembangkan untuk Tugas Akhir Sistem Informasi.*
