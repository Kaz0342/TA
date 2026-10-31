# 📜 BERITA ACARA SERAH TERIMA (BAST)
## PERANGKAT KERAS IOT, SISTEM INFORMASI SMART SHROOM SCM, DAN DOKUMENTASI SISTEM
**Nomor Dokumen:** ......./BAST-SSM/X/2026

---

Pada hari ini, ........................... tanggal ............ bulan ............................... tahun Dua Ribu Dua Puluh Enam (........-........-2026), bertempat di Usaha Kumbung Jamur Kuping Mitra, Salam / Jumoyo, Muntilan, Kabupaten Magelang, telah dilaksanakan serah terima operasional sistem oleh dan antara para pihak:

### 1. PIHAK PERTAMA (Pihak yang Menyerahkan):
* **Nama:** Benedict Saviola Pradana
* **NIM:** 231712243
* **Instansi / Status:** Mahasiswa Program Studi Sistem Informasi, Universitas Atma Jaya Yogyakarta (UAJY)
* **Peran:** Pengembang Sistem (*System Architect & Hardware-Software Engineer*)
* **Alamat Domisili:** Yogyakarta

Dalam hal ini bertindak untuk dan atas nama pengembang sistem teknologi agritech, selanjutnya disebut sebagai **PIHAK PERTAMA**.

---

### 2. PIHAK KEDUA (Pihak yang Menerima):
* **Nama:** ..........................................................................................
* **Jabatan / Usaha:** Pemilik Usaha Kumbung Jamur Kuping Mitra
* **Alamat Lokasi Kumbung:** Dusun Kemiren, Desa Jumoyo, Kec. Salam, Kab. Magelang, Jawa Tengah (±400 mdpl)

Dalam hal ini bertindak sebagai pemilik usaha dan pengelola operasional kumbung jamur, selanjutnya disebut sebagai **PIHAK KEDUA**.

---

### KESEPAKATAN BERSAMA

Kedua belah pihak secara sadar dan tanpa paksaan dari pihak mana pun menyatakan sepakat atas hal-hal sebagai berikut:

1. **PIHAK PERTAMA** telah menyelesaikan seluruh perancangan, perakitan perangkat keras, pengkodean sistem informasi, dan implementasi lapangan sistem **Smart Shroom SCM** (v2.0 Web Dashboard & Firmware ESP32 v3.6) sesuai kebutuhan bisnis kumbung jamur kuping milik **PIHAK KEDUA**.
2. **PIHAK KEDUA** telah menguji dan memvalidasi seluruh fungsionalitas sistem melalui instrumen *User Acceptance Testing (UAT)* tertanggal ................................... 2026 dengan hasil layak beroperasi penuh di lapangan.
3. **PIHAK PERTAMA** menyerahkan hasil pekerjaan tersebut kepada **PIHAK KEDUA**, dan **PIHAK KEDUA** menyatakan telah menerima penyerahan objek sistem dalam kondisi baik, terpasang, teruji, dan berfungsi optimal dengan rincian rujukan pada Lampiran berikut:

---

## 📦 LAMPIRAN RINCIAN OBJEK SERAH TERIMA

### A. Perangkat Keras Panel Kontrol Otomasi Kumbung (Hardware Edge IoT)
| No | Item / Komponen | Spesifikasi Teknis | Kuantitas | Kondisi Fisik | Status Fungsi |
| :-: | :--- | :--- | :-: | :---: | :---: |
| 1 | **Central Box Controller IP65** | Box Panel Outdoor Waterproof, Rel Din-Rail, Cable Gland, Indikator Pilot Lamp | 1 Unit | Baik | Beroperasi |
| 2 | **Mainboard Mikrokontroler** | ESP32-WROOM-32 (30-Pin, Wi-Fi 2.4 GHz, Dual-Core 240 MHz, Autonomi Closed-Loop) | 1 Unit | Baik | Beroperasi |
| 3 | **Power Supply Unit (PSU)** | SMPS Industrial 12V 5A + Step-Down Buck Converter LM2596 5V 3A | 1 Set | Baik | Beroperasi |
| 4 | **Probe Sensor Mikroklimat** | Sensor Digital SHT31 Industrial Grade, I2C Interface, Kabel Shielded Anti-Noise (3m, 5m, 7m) | 3 Probe | Baik | Beroperasi |
| 5 | **Modul Display Lokal** | LCD 16×2 Character dengan I2C Backpack (Tampilan Suhu, RH, Status Aktuator, Countdown Mode Panen) | 1 Unit | Baik | Beroperasi |
| 6 | **Modul Aktuator Relay** | Modul 4-Channel 5V Relay dengan Optocoupler Isolation (Pengendali Pompa Misting & Exhaust Fan) | 1 Modul | Baik | Beroperasi |
| 7 | **Instalasi Misting & Pengabutan** | Pompa Tekanan Tinggi 100 PSI 12V DC, Selang PU High Pressure 6mm, Nozzle Misting Anti-Drip 0.3mm | 1 Jalur Lengkap | Baik | Beroperasi |
| 8 | **Sistem Sirkulasi Udara** | Exhaust Fan 8 Inch Exhaust/Ventilasi Sirkulasi Kumbung | 1 Unit | Baik | Beroperasi |

---

### B. Perangkat Lunak, Akun Akses & Lisensi (Software Artifacts)
| No | Komponen Sistem | Spesifikasi & Lingkup Fungsional | Media Penyerahan | Status Verifikasi |
| :-: | :--- | :--- | :--- | :---: |
| 1 | **Aplikasi Web Dashboard** | Frontend SPA (React 19 + TypeScript + Vite + Responsive Mobile UI) | Cloud / Local Server | Terverifikasi |
| 2 | **Backend API & Database** | REST API Engine (Laravel 11, SQLite/MySQL, Sanctum Auth, Prepared Statement Downsampling) | Server Deployment | Terverifikasi |
| 3 | **Firmware ESP32 Controller** | Source Code C++ (PlatformIO / Arduino IDE) v3.6, Closed-Loop Autonomy & Offline Fail-Safe | Terpasang di Chip ESP32 | Terverifikasi |
| 4 | **Kredensial Akun Admin** | Akses Penuh: SCM Hulu-Hilir (Evaluasi Supplier & Rekomendasi Restock PO), WMS Denah Rak 3D, HPP Dinamis, Penjualan, Biaya Operasional, Audit Void, dan Threshold | Amplop Rahasia Akun | Diterima Pihak Kedua |
| 5 | **Kredensial Akun Worker** | Akses Khusus Petani: Monitoring Iklim Ergonomis, Mode Jeda Panen (2 Jam), Input Panen, Quick Cull | Amplop Rahasia Akun | Diterima Pihak Kedua |

---

### C. Dokumen Teknis & Manual Prosedur
| No | Dokumen Panduan | Cakupan Materi Dokumen | Format Berkas |
| :-: | :--- | :--- | :---: |
| 1 | **Buku Panduan Pengguna (*Manual Book*)** | SOP Operasional Akun Admin, Panduan Input Panen Worker, Prosedur Pemeliharaan Nozzle | Hardcopy & PDF |
| 2 | **Diagram Pengkabelan (*Wiring Schematic*)** | Skematik kelistrikan box panel kontrol, proteksi relay, dan tata letak sensor di dalam rak | Berkas PDF / Cetak |
| 3 | **Lembar Hasil Uji Penerimaan (UAT)** | Matriks evaluasi 19 skenario fungsional yang telah ditandatangani bersama | Berkas Fisik Asli |

---

## ⚖️ SYARAT DAN KETENTUAN (KLAUSUL KERJASAMA)

### Pasal 1: Pengalihan Operasional & Tanggung Jawab
Sejak tanggal penandatanganan Berita Acara ini, kepemilikan operasional dan pemanfaatan sistem secara penuh berada di bawah wewenang **PIHAK KEDUA**. **PIHAK KEDUA** berhak menggunakan sistem untuk keperluan komersial kumbung jamur miliknya.

### Pasal 2: Jaminan Pemeliharaan (*Warranty & Maintenance*)
1. **PIHAK PERTAMA** memberikan masa garansi pemeliharaan piranti lunak (*bug fixing* dan stabilitas sistem) selama **3 (tiga) bulan** terhitung sejak tanggal penandatanganan Berita Acara ini tanpa dikenakan biaya tambahan.
2. Pemeliharaan mencakup perbaikan galat (*error/bug*) pada dashboard web, penyesuaian kalibrasi batas sensor jika diperlukan, serta pendampingan teknis bagi pekerja lapangan.
3. Garansi perangkat keras tidak mencakup kerusakan fisik akibat sambaran petir langsung (*direct lightning surge*), bencana alam (*force majeure*), atau kelalaian manipulasi kelistrikan di luar petunjuk teknis.

### Pasal 3: Hak Cipta & Kerahasiaan Data (*Data Privacy*)
1. Seluruh data transaksi finansial, harga pokok produksi (HPP), catatan panen, serta nama pelanggan/tengkulak yang tersimpan dalam sistem merupakan hak milik mutlak dan rahasia dagang **PIHAK KEDUA**.
2. **PIHAK PERTAMA** berhak menggunakan data telemetri teknis mikroklimat (suhu, kelembapan, durasi aktif misting) sebagai bahan publikasi ilmiah dan laporan pertanggungjawaban akademis tanpa mempublikasikan identitas finansial rahasia milik **PIHAK KEDUA**.

---

Demikian Berita Acara Serah Terima ini dibuat dalam rangkap 2 (dua) bermaterai cukup, masing-masing pihak memegang 1 (satu) rangkap asli yang memiliki kekuatan hukum yang sama, untuk dipergunakan sebagaimana mestinya.

<br><br>

| PIHAK KEDUA<br>(Penerima / Pemilik Kumbung) | PIHAK PERTAMA<br>(Penyerah / Pengembang Sistem) |
| :---: | :---: |
| *(Materai Rp 10.000)*<br><br><br><br><br><u><b>( .................................................... )</b></u><br>Pemilik Usaha Kumbung Jamur Mitra | <br><br><br><br><br><u><b>Benedict Saviola Pradana</b></u><br>NIM: 231712243<br>Pengembang Sistem (Mahasiswa SI UAJY) |

<br>

| Mengetahui / Saksi Lapangan:<br>(Perwakilan Pekerja Kumbung Jamur) |
| :---: |
| <br><br><br><br><u><b>( .................................................... )</b></u><br>Operator / Buruh Tani Lapangan |
