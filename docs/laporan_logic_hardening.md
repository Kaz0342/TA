# 🛡️ Laporan Akhir Logic Hardening & Pengujian Kuantitatif
**Judul Tugas Akhir:** *Sistem Informasi Supply Chain Management dan Spasial WMS pada Kumbung Jamur Terintegrasi dengan Otomasi dan Monitoring Mikroklimat IoT*  
**Produk Sistem:** Smart Shroom SCM — Program Studi Sistem Informasi  

- **Penyusun:** Benedictus Vio
- **Branch:** `fix/logic-hardening` (turunan dari `develop`)
- **Tanggal Selesai:** 1–2 Oktober 2026
- **Status Akhir:** ✅ **100% Lulus (16 Temuan Tuntas, 141 Automated Tests Green, Zero Failures)**

---

## 1. Latar Belakang & Tujuan Hardening

Audit menyeluruh terhadap sistem Smart Shroom SCM mengidentifikasi 16 temuan logika kritis (*latent logic bugs*) yang tersebar di sisi mikrokontroler ESP32, backend API Laravel 12, dan IoT simulator. Meskipun sistem sebelumnya lulus 133 pengujian fungsional dasar di lingkungan lokal, pengujian stres (*stress test*) dan kondisi batas (*boundary conditions*) membuktikan adanya kerentanan fatal:
1. **Keamanan Cloud:** Terdapat endpoint publik tidak terlindungi (`/migrate-db` dan `/register` bebas) yang membuka celah manipulasi database produksi.
2. **State Jeda Panen di Serverless:** Cache Vercel menggunakan memory driver `array` yang mengakibatkan perintah jeda panen (`PAUSE`) hilang seketika antar-request.
3. **Ketahanan Mikrokontroler Saat Offline:** Firmware ESP32 mengalami pemblokiran (*blocking loop*) saat koneksi Wi-Fi putus, melumpuhkan seluruh fungsi pengawasan suhu dan proteksi aktuator.
4. **Osilasi Mekanis Aktuator:** Ketiadaan histeresis 24 jam memicu pembalikan saklar kipas pendingin sebanyak **649 kali/hari** (*relay chatter* parah) saat suhu ruang mencapai batas kritis ($>34^\circ\text{C}$).
5. **Kegagalan Target Misting:** Target penghentian kelembaban yang terlalu tinggi dan safety timeout sempit (60s) mengakibatkan **97% siklus misting berhenti karena *Emergency Timeout***, bukan karena kelembaban ideal tercapai.

---

## 2. Rekapitulasi 16 Temuan & Perbaikan (F-01 s/d F-16)

| Kode | Prioritas | Komponen | Deskripsi Masalah | Solusi & Tindakan Perbaikan | Hash Commit |
|---|:---:|---|---|---|:---:|
| **F-01** | **P0** | Backend API | Route `GET /migrate-db` terbuka untuk publik dengan hardcoded secret di 2 file | Menghapus route `/migrate-db` dari `api.php` dan `web.php` | `cccec8c` |
| **F-02** | **P0** | Backend Auth | Route `POST /api/auth/register` dapat diakses guest tanpa autentikasi | Membatasi registrasi hanya untuk Admin terautentikasi (`auth:sanctum` + `role:admin`) | `2a09740` |
| **F-03** | **P1** | Device Control | Durasi jeda panen (`PAUSE`) tidak memiliki batas atas | Menambahkan validasi `max:28800` (maksimal 8 jam) pada `DeviceControlController` | `e99f072` |
| **F-04** | **P0** | Cloud Deploy | `CACHE_STORE=array` di `vercel.json` menghilangkan state pause di lingkungan serverless | Mengubah cache store ke `database` (PostgreSQL Supabase) untuk persistensi state | `4375252` |
| **F-05** | **P1** | Backend Ingest | Durasi aktuator `max:600` di `StoreSprinklerLogRequest` menolak log kipas berdurasi panjang | Meningkatkan validasi durasi log aktuator menjadi `max:86400` (24 jam) | `c3375e7` |
| **F-06** | **P1** | Database Repo | `SensorDataRepository::getLastHours()` tidak memiliki cabang PostgreSQL | Menambahkan implementasi agregasi native PostgreSQL (`AVG()::numeric` & epoch bucket) | `ede4458` |
| **F-07** | **P0** | Firmware ESP32 | `while(!WiFi.connected())` membekukan kontrol loop saat Wi-Fi terputus | Menghapus loop blocking; menerapkan reconnect non-blocking tiap 15 detik | `b14a747` |
| **F-08** | **P1** | Firmware ESP32 | HTTP blocking di `stop*()`, log hilang saat offline, dan sensor mati tetap kirim data basi | Menurunkan timeout HTTP ke 4s, antrean log RAM 10 slot (`logQ`), dan filter data basi | `cc9d41e` |
| **F-09** | **P1** | Firmware ESP32 | `getCurrentHourWIB()` mengembalikan jam 12 jika NTP belum sinkron | Mengembalikan nilai `-1` saat NTP gagal dan menahan aturan malam via `isNightHour()` | `6cbf419` |
| **F-10** | **P1** | Kontrol & Sim | Ketiadaan histeresis stop 24 jam memicu relay chatter 649x/hari saat panas kritis | Menerapkan histeresis stop 24 jam ($\text{critical} - 1.0^\circ\text{C}$) dan mengecualikan override dari cap 180s | `f8799db` |
| **F-11** | **P1** | Kontrol & Sim | Ambang misting darurat hardcoded 75% RH memicu pulsing berlebih di fase inkubasi | Menjadikan ambang darurat dinamis proporsional: $\text{criticalLowRh} = \text{humMin} - 10\%$ | `f3fafd2` |
| **F-12** | **P1** | Kontrol & Sim | 97% misting berhenti karena timeout 60s akibat formula stop terlalu tinggi | Formula deadband realistis $\text{humMin} + \min(3.0, 0.5 \cdot \Delta RH)$ & timeout 90s | `4dceb03` |
| **F-13** | **P2** | Simulator | Simulator mengevaluasi tiap 1s sedangkan firmware tiap 5s | Menyamakan interval evaluasi kontrol simulator menjadi 5s (*cadence parity*) | `db20d55` |
| **F-14** | **P2** | Firmware ESP32 | Polling perintah jeda panen lambat (30s) | Polling cepat `/api/device/command` tiap 8s, memangkas latensi jeda panen $<8$ detik | `b56955e` |
| **F-15** | **P3** | Backend & FW | Selisih RH min-max bisa bernilai 0, timer malam transisi, dan glitch saat boot relay | Validasi selisih RH $\ge 4\%$, reset timer malam transisi, dan precharge relay sebelum pinMode | `3d1e547` |
| **F-16** | **P3** | Repo & Runner | Data simulator Python bercampur dengan ESP32 fisik pada grafik | Menambahkan parameter filter `device_id` di API/repo dan optimasi cron runner 5 jam | `40be92a` |

---

## 3. Matriks Hasil Pengujian Kuantitatif (Sebelum vs Sesudah)

Pengujian kuantitatif dilakukan menggunakan script pengujian fisik stokastik [`docs/sim_harness.py`](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/sim_harness.py) yang membandingkan baseline fisik kumbung terhadap sistem yang telah diperbaiki:

### A. Pengujian Termodinamika & Aktuator (Simulasi)

| Parameter Pengujian | Kondisi Skenario | Sebelum (Baseline) | Sesudah (Hardened) | Hasil & Manfaat |
|---|---|:---:|:---:|---|
| **Frekuensi Toggle Fan Kritis** | Cuaca panas ekstrem (27–36°C) | **649 kali/hari** | **49 kali/hari** | **Osilasi relay turun 92.4%**, mencegah aus mekanik & busur api |
| **Tingkat Henti Misting via Timeout** | Fase Fruiting (RH 85–95%) | **97% siklus** | **0% siklus** | Target kelembapan tercapai secara alami, eliminasi genangan air |
| **Durasi Pompa Misting per Hari** | Fase Fruiting | 35.9 menit/hari | 33.8 menit/hari | Hemat konsumsi air dan daya pompa sebesar 5.8% |
| **Penyemprotan Salah Sasaran** | Fase Inkubasi (RH 65–75%) | **168.8 kali/hari** | **3.5 kali/hari** | Mencegah pembusukan miselium akibat semprotan berlebih |
| **Latensi Respon Jeda Panen** | Aktivasi Mode Jeda Panen | 30–40 detik | **< 8 detik** | Kipas mati sebelum pintu dibuka, menjaga kenyamanan pekerja |

### B. Pengujian Backend & Keamanan (Automated PHPUnit Suite)

| Kategori Pengujian | Parameter Metrik | Sebelum (Baseline) | Sesudah (Hardened) | Catatan Pengujian |
|---|---|:---:|:---:|---|
| **Total Automated Tests** | Jumlah Kasus Uji | 133 tests | **141 tests** | Penambahan 8 test keamanan & boundary |
| **Total Assertions** | Validasi Assert | 418 assertions | **467 assertions** | Mencakup pengujian injeksi, kuota, & durasi |
| **Tingkat Kelulusan** | Success Rate | 100% (133/133) | **100% (141/141)** | Zero Failure / Zero Error |
| **Keamanan Endpoint Register** | Guest & Worker Access | 201 Created (Bebas) | **401 Unauthorized / 403 Forbidden** | Terkunci khusus Role Admin |
| **Persistensi State Serverless** | Ketahanan State Pause | Hilang (*array*) | **Tersimpan (*PostgreSQL cache*)** | Teruji di lingkungan multi-request |
| **Isolasi Telemetri** | Pemisahan Device ID | Tercampur di grafik | **Terisolasi per `device_id`** | Teruji pada 2 device konkuren di PHPUnit |

---

## 4. Berkas Bukti Resmi (Evidence Files)

Seluruh luaran mentah dari proses verifikasi disimpan di dalam repositori untuk kebutuhan lampiran skripsi:
1. **Baseline Automated Tests:** [`docs/evidence/baseline_test.txt`](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/evidence/baseline_test.txt) *(133 passed, 418 assertions)*
2. **Baseline Simulasi Kontrol:** [`docs/evidence/baseline_sim.txt`](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/evidence/baseline_sim.txt) *(chatter 649x, timeout 97%)*
3. **After-Hardening Automated Tests:** [`docs/evidence/after_test.txt`](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/evidence/after_test.txt) *(141 passed, 467 assertions)*
4. **After-Hardening Simulasi Kontrol:** [`docs/evidence/after_sim.txt`](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/evidence/after_sim.txt) *(chatter 49x, timeout 0%)*

---

## 5. Rekomendasi Narasi untuk Ujian Sidang Skripsi

Saat mempresentasikan hasil perancangan dan pengujian sistem pada Bab 4, mahasiswa dapat menggunakan poin penekanan berikut:
> *"Pengujian fungsional konvensional seringkali gagal mendeteksi kelemahan logika yang hanya muncul pada kondisi ekstrem atau arsitektur komputasi awan. Melalui metode Logic Hardening dan pengujian simulasi fisik stokastik, penelitian ini berhasil mengidentifikasi dan merekayasa ulang algoritma otomasi Smart Shroom SCM. Hasil pengujian membuktikan bahwa perbaikan histeresis adaptif mampu mereduksi osilasi mekanik relay hingga 92.4%, mengeliminasi 97% kegagalan timeout aktuator misting, mengamankan autentikasi multi-peran, serta menjamin keandalan kontrol mikrokontroler saat beroperasi dalam kondisi jaringan offline."*
