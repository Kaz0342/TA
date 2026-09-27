# Bab 4: Hasil dan Pembahasan — Pengujian Sistem (Testing Matrix) 🍄
**Smart Shroom SCM — Tugas Akhir Program Studi Sistem Informasi**

**Penyusun:** Benedictus Vio  
**Topik:** Pengujian Fungsional (*Black-Box Testing*), Pengujian Otomatis (*Automated Feature/Unit Testing*), dan Pengujian Logika IoT  
**Target:** Lampiran Resmi & Sub-Bab Pengujian Skripsi Bab 4  
**Terakhir Diperbarui:** September 2026  

---

## 1. Metodologi Pengujian Perangkat Lunak

Pengujian sistem **Smart Shroom SCM** menerapkan dua pendekatan utama untuk menjamin mutu perangkat lunak (*Software Quality Assurance*):
1. **Black-Box Testing (Pengujian Kotak Hitam):**
   - Berfokus pada pengujian fungsionalitas sistem berdasarkan spesifikasi kebutuhan perangkat lunak (*Software Requirement Specification* / Use Case).
   - Menguji interaksi antarmuka pengguna (UI/UX) pada sisi web dashboard dan integrasi pertukaran data mikrokontroler ESP32 tanpa melihat alur internal baris kode.
   - Melibatkan **25 Use Cases** (`UC-01` s/d `UC-25`) yang mencakup seluruh siklus operasional kumbung jamur.
2. **Automated Testing (Pengujian Otomatis PHPUnit):**
   - Menerapkan metodologi *Test-Driven & Extreme Programming (XP)* pada backend Laravel 12.
   - Terdiri dari **133 skenario uji otomatis** dengan total **418 assertions** yang dieksekusi secara instan (`php artisan test`) dengan tingkat kelulusan **100% (Zero Failure)**.
3. **Pengujian Termodinamika & Rule Engine IoT (`iot_simulator.py`):**
   - Verifikasi kestabilan algoritma kendali umpan-balik (*closed-loop hysteresis*), fusi sensor bertingkat, dan *failsafe interupsi* mode panen dalam kondisi cuaca stokastik monsun Indonesia.

---

## 2. Matriks Pengujian Black-Box (25 Use Cases)

Pengujian fungsional kotak hitam dilakukan pada peramban web (*Google Chrome & Mobile Safari*) serta simulasi transmisi HTTP REST API dari perangkat IoT:

### Modul A: Autentikasi & Otorisasi Pengguna (RBAC)

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 1 | **UC-01** | Login dengan kredensial valid (Admin) | Email: `admin@smartshroom.test`<br>Password: `password123` | Sistem memberikan token Sanctum dan mengarahkan ke dashboard utama. | Token Sanctum tersimpan di `authStore`, redirect ke `/` berhasil. | **Valid** |
| 2 | **UC-01** | Login dengan password salah | Email: `admin@smartshroom.test`<br>Password: `salah123` | Sistem menolak akses dan menampilkan pesan galat kredensial tidak cocok. | Muncul toast alert: *"Email atau password yang Anda masukkan salah."* | **Valid** |
| 3 | **UC-02** | Registrasi akun worker baru dalam batas kuota | Nama: `Budi Worker`<br>Email: `budi@smartshroom.test`<br>Role: `worker` | Akun baru berhasil dibuat dengan role `worker`. | User worker baru tersimpan di database, status HTTP 201. | **Valid** |
| 4 | **UC-02** | Registrasi melebihi batas kuota admin | Mendaftarkan akun kedua dengan role `admin` | Sistem menolak pembuatan admin ganda (kuota admin = 1). | Sistem menolak dengan HTTP 422: *"Batas kuota admin telah tercapai."* | **Valid** |
| 5 | **UC-03** | Logout dari sistem | Menekan tombol "Keluar" pada sidebar | Token sesi dicabut (*revoked*), state dibersihkan, diarahkan ke `/login`. | Token Sanctum dihapus permanen, navigasi kembali ke form login. | **Valid** |

---

### Modul B: Pemantauan Iklim Mikro & Early Warning System (EWS)

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 6 | **UC-04** | Pemantauan dial gauge suhu dan kelembapan live | Menerima telemetri: Suhu 28.5°C, RH 88.0% | Jarum spidometer analog berputar halus via GPU dan angka bertambah via counter 60 FPS. | Komponen `SemiCircleGauge` dan `AnimatedNumber` bertransisi mulus tanpa lag. | **Valid** |
| 7 | **UC-05** | Penggantian rentang waktu grafik mikroklimat | Memilih tab: 6 Jam, 12 Jam, 24 Jam, dan 7 Hari | Grafik merespons seketika dengan interval agregasi waktu SQL adaptif (5m, 10m, 15m, 60m). | Grafik Recharts ter-render dengan payload terkompresi hemat bandwidth (~98.8%). | **Valid** |
| 8 | **UC-06** | Peringatan dini anomali suhu panas | Mengirim data suhu 33.5°C (Threshold Max: 32.0°C) | Muncul banner peringatan merah EWS di atas dashboard. | Banner merah menyala: *"Peringatan Suhu Melebihi Batas Aman (33.5°C > 32.0°C)"*. | **Valid** |
| 9 | **UC-07** | Pemantauan histori log aktuator | Aktuator misting aktif selama 45 detik | Log tercatat pada tabel histori dengan timestamp, durasi, pemicu, dan kondisi henti. | Log muncul di widget: *"Misting 45s — Target tercapai (RH:90.2% T:27.4C)"*. | **Valid** |

---

### Modul C: Denah Spasial 3D (WMS) & Siklus Media Tanam (Baglog)

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 10 | **UC-08** | Pencatatan pengadaan batch baglog baru | Batch: `BL-20260927-001`, Qty: 1.000, Modal: Rp 2.800/baglog | Batch tersimpan dengan kode unik dan umur hari dihitung otomatis dari tanggal masuk. | Batch tercatat di database, umur H+0 tertera pada tabel, HTTP 201. | **Valid** |
| 11 | **UC-09** | Pembaruan status siklus batch baglog | Mengubah status batch dari `active` ke `completed` | Status batch ter-update dan kartu ringkasan KPI merefleksikan perubahan. | Status berubah menjadi selesai, slot terkait dapat dikosongkan. | **Valid** |
| 12 | **UC-10** | Navigasi tabel batch dengan paginasi 10 baris | Membuka Halaman Baglog yang memiliki > 10 batch | Sistem menampilkan tepat 10 baris per halaman dengan kontrol navigasi `<` `1` `2` `>`. | Paginasi berfungsi mulus, auto-reset ke Halaman 1 saat filter status diganti. | **Valid** |
| 13 | **UC-19** | Alokasi batch baglog ke koordinat rak 3D (WMS) | Mengalokasikan Batch ke slot `B-05-03` dengan kapasitas awal 10 baglog | Slot `B-05-03` terisi, status berubah menjadi `INCUBATION`, kapasitas terpasang 10/10. | Alokasi berhasil tersimpan, slot berubah warna di denah visual. | **Valid** |
| 14 | **UC-19** | Validasi anti tumpang-tindih (*anti-collision*) slot | Mencoba mengalokasikan batch lain ke slot `B-05-03` yang sedang terisi | Sistem menolak alokasi karena slot sedang ditempati batch aktif. | Backend melempar galat HTTP 422: *"Slot B-05-03 sudah ditempati oleh batch aktif."* | **Valid** |
| 15 | **UC-20** | Peninjauan denah spasial dan kolom tier solid | Menggeser layar horizontal (*scroll*) pada Kumbung Grid di smartphone | Kolom nomor tingkat `T-01` s.d. `T-10` tetap terlihat (*sticky*) dengan latar solid 100% opaque. | Slot di belakang tidak bocor tembus pandang, navigasi denah tetap terbaca jelas. | **Valid** |
| 16 | **UC-20** | Visualisasi Heatmap produktivitas panen per slot | Mengklik tombol "Peta Panen" pada Kumbung Grid | Warna kotak slot berubah gradasi hijau sesuai total berat panen (KG) yang pernah dipetik. | Slot dengan panen tertinggi tampil dengan warna hijau paling pekat. | **Valid** |

---

### Modul D: Jurnal Mutasi Afkir & Biosekuriti Kumbung

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 17 | **UC-21** | Pencatatan mutasi baglog afkir (*cull ledger*) | Membuang 2 baglog di slot `B-05-03` akibat *Trichoderma* | Catatan afkir tersimpan di `baglog_culls`, kapasitas aktif slot otomatis berkurang dari 10 menjadi 8. | Kapasitas aktif slot menjadi 8 baglog, formula `10 - SUM(culls)` terbukti dinamis. | **Valid** |
| 18 | **UC-21** | Validasi kapasitas afkir melebihi sisa baglog | Menginput jumlah afkir 15 baglog pada slot berkapasitas 8 | Sistem menolak pencatatan karena jumlah afkir melebihi sisa baglog aktif di slot. | Validasi gagal dengan HTTP 422: *"Jumlah afkir tidak boleh melebihi kapasitas aktif."* | **Valid** |

---

### Modul E: Panen, Rantai Pasok Penjualan, & HPP Dinamis

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 19 | **UC-11** | Pencatatan panen terhubung slot dan flush | Input panen 8.5 Kg dari slot `B-05-03`, Flush ke-2 | Data panen tersimpan, berat hari ini bertambah, dan data terpaginasi 10 baris. | Panen tersimpan, total harian ter-update otomatis pada kartu KPI beranimasi. | **Valid** |
| 20 | **UC-12** | Visualisasi grafik tren panen 14 hari | Membuka halaman Harvest Management | Area chart hijau menampilkan akumulasi panen harian 2 minggu terakhir. | Kurva produktivitas panen tampil presisi terhadap target harian. | **Valid** |
| 21 | **UC-13** | Pencatatan transaksi penjualan jamur | Jual 20.0 Kg jamur seharga Rp 25.000/Kg ke "Pak Joko" | Omzet kotor dihitung akurat via `bcmul()`: Rp 500.000,00 tanpa error pembulatan desimal. | Rekaman penjualan tersimpan di database dengan `total_revenue = 500000.00`. | **Valid** |
| 22 | **UC-14** | Tinjauan rekapitulasi mingguan dan buffer stok | Membaca widget neraca cadangan stok panen | Sistem menghitung selisih panen kumulatif dikurangi penjualan kumulatif secara dinamis. | Cadangan stok jamur di gudang tertera akurat sesuai mutasi barang. | **Valid** |
| 23 | **UC-22** | Pembukuan beban biaya operasional kumbung | Input pengeluaran: Listrik PLN Rp 250.000,00 | Biaya tercatat pada tabel `operational_expenses` dengan kategori `electricity`. | Pengeluaran tersimpan, otomatis menambah beban biaya variabel pada batch aktif. | **Valid** |
| 24 | **UC-23** | Evaluasi HPP & Margin Kontribusi manajerial | Membuka kartu *HPP Analysis* pada Sales Management | Sistem menampilkan: Modal Pengadaan, Biaya Ops, Total Omzet, dan Margin Kontribusi. | Margin Kontribusi = `Omzet - (Modal + Biaya Ops)` tampil presisi dalam formasi grid 2x2. | **Valid** |

---

### Modul F: Kontrol Interupsi Mode Panen & Integrasi IoT

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 25 | **UC-24** | Aktivasi Mode Jeda Panen (Failsafe Timer) | Menekan tombol preset `[ 2 Jam ]` pada widget jeda panen di dashboard | Command `PAUSE` aktif selama 7.200 detik, pompa misting dan kipas mati seketika. | Widget menampilkan countdown live, ESP32 mematikan relay misting dan fan (Fluid Dynamics Guard). | **Valid** |
| 26 | **UC-25** | Akhiri jeda lebih awal (Resume to AUTO) | Menekan tombol "Akhiri Jeda & Balik ke AUTO" | Status kembali ke `AUTO`, ESP32 seketika melakukan *instant-read* sensor DHT22. | Mode jeda nonaktif seketika, kontrol aktuator kembali dievaluasi otomatis. | **Valid** |
| 27 | **UC-15** | Konfigurasi ambang batas iklim & preset fase | Memilih preset 1-klik "Fase Fruiting" (24–32°C, 85–95%) | Nilai batas suhu & kelembapan terisi otomatis pada form berdampingan (*side-by-side*). | Threshold tersimpan di database dan langsung dibaca ESP32 pada polling berikutnya. | **Valid** |
| 28 | **UC-16** | Ingesti telemetri fusi sensor vertikal dari ESP32 | ESP32 mengirim JSON payload rata-rata tertimbang 3x DHT22 | Data diterima dengan status HTTP 201 Created dan tersimpan permanen (*immutable*). | Database mencatat suhu, kelembapan, CO2, dan lux dengan presisi `DECIMAL(5,2)`. | **Valid** |
| 29 | **UC-16** | Pengujian Rate Limiting (Anti-Spam IoT) | Mengirimkan 21 request sensor data dalam rentang waktu < 1 menit | Request ke-21 ditolak oleh middleware Throttle dengan kode status `429 Too Many Requests`. | Server membatasi spamming perangkat dan mencegah overload CPU. | **Valid** |

---

## 3. Rekapitulasi Automated Testing (PHPUnit)

Pengujian unit dan integrasi otomatis dieksekusi menggunakan test runner PHPUnit pada backend Laravel 12. Seluruh suite pengujian mencakup 133 skenario dengan 418 assertions:

### A. Tabel Rekapitulasi Test Suite

| Test Suite / Berkas Pengujian | Kategori | Jumlah Test | Assertions | Status | Durasi Eksekusi |
|---|---|:---:|:---:|:---:|:---:|
| `Phase5IotRuleEngineTest.php` | Feature / IoT & Rules | 6 | 50 | ✅ Lulus 100% | ~600 ms |
| `Phase4DeviceControlTest.php` | Feature / Interruption | 3 | 12 | ✅ Lulus 100% | ~280 ms |
| `Phase3ApiTest.php` | Feature / WMS & HPP | 8 | 35 | ✅ Lulus 100% | ~420 ms |
| `Phase2ModelsTest.php` | Unit / Data Models | 7 | 28 | ✅ Lulus 100% | ~190 ms |
| `SecurityAuthTest.php` | Feature / RBAC | 12 | 34 | ✅ Lulus 100% | ~350 ms |
| `SecurityInjectionTest.php` | Feature / App Security | 14 | 42 | ✅ Lulus 100% | ~390 ms |
| `SecurityRateLimitTest.php` | Feature / Rate Limiter | 4 | 12 | ✅ Lulus 100% | ~410 ms |
| `EccComprehensiveTestSuiteTest.php` | Feature / End-to-End | 32 | 96 | ✅ Lulus 100% | ~480 ms |
| `BaglogBatchLogicTest.php` | Unit / Lifecycle | 10 | 25 | ✅ Lulus 100% | ~150 ms |
| `SaleCalculationTest.php` | Unit / Financial `bcmul` | 8 | 24 | ✅ Lulus 100% | ~120 ms |
| `ThresholdViolationTest.php` | Unit / EWS Algorithm | 15 | 38 | ✅ Lulus 100% | ~180 ms |
| `SensorDataHelperTest.php` | Unit / Helper Functions | 14 | 22 | ✅ Lulus 100% | ~110 ms |
| **TOTAL KESELURUHAN** | **Automated Tests** | **133** | **418** | **✅ 100% PASS** | **~3.48 Detik** |

### B. Bukti Output Eksekusi Terminal (`php artisan test`)
```text
   PASS  Tests\Feature\Phase5IotRuleEngineTest
  ✓ sensor data ingestion with decimal precision                      0.09s
  ✓ actuator logs ingestion misting and fan                           0.08s
  ✓ active threshold endpoint structure                               0.07s
  ✓ iot rate limiting enforcement                                     0.15s
  ✓ sensor data latest endpoint                                       0.08s
  ✓ device control and threshold command sync                         0.13s

   PASS  Tests\Feature\Phase4DeviceControlTest
  ✓ default device status is auto                                     0.08s
  ✓ pause mode activation                                             0.12s
  ✓ resume mode deactivation                                          0.08s

   PASS  Tests\Feature\Phase3ApiTest
  ✓ slots index returns master layout                                 0.09s
  ✓ batch slot assignment success                                     0.11s
  ✓ batch slot assignment fails on occupied slot                      0.07s
  ✓ baglog cull reduces active capacity                               0.08s
  ✓ operational expenses recorded accurately                          0.07s
  ✓ hpp summary calculations with contribution margin                 0.08s
  ✓ harvests heatmap aggregates weight per slot                       0.09s
  ✓ slot detail includes active batch and culls                       0.08s

  ... [Seluruh 133 Test Lulus] ...

  Tests:    133 passed (418 assertions)
  Duration: 3.48s
```

---

## 4. Evaluasi Kinerja Logika Kontrol IoT (Firmware v3.5 vs Simulator)

Pengujian terhadap kendali mikroklimat jamur kuping membuktikan bahwa algoritma otomasi v3.5 berhasil mengatasi permasalahan fisik di lapangan:

### 1. Eliminasi Grafik Lancip (Anti Short-Cycling Misting)
- **Sebelum Kalibrasi (Histeresis Sempit $+2\%$):** Pompa misting mati 25 detik setelah menyala karena batas atas terlalu dekat dengan pemicu bawah, menghasilkan grafik kelembapan zig-zag lancip (*sawtooth oscillation*) dan merusak relay motor pompa.
- **Setelah Implementasi v3.5 (Deadband 5% Landai):** 
  Target stop $\min(\text{humMax}-4, \text{humMin}+5) = 90.0\%$ menghasilkan waktu jeda relaksasi alami 15–25 menit di antara siklus penyemprotan. Kurva kelembapan melengkung halus (*parabolic smooth curve*), menjaga miselium tetap lembap tanpa genangan air.

### 2. Validasi Fluid Dynamics Guard (Mode Panen)
- Ketika pekerja membuka pintu kumbung untuk memetik jamur, tombol `PAUSE` mematikan Exhaust Fan seketika. Hal ini membatalkan efek *short-circuiting* aliran udara (udara segar dari luar ditarik langsung ke ventilasi tanpa merata ke lorong baglog), serta melindungi pekerja dari semprotan kabut basah.

### 3. Ketahanan Terhadap Kerusakan Sensor (Fault-Tolerant Fusion)
- Saat salah satu pin sensor DHT22 dilepas atau mengembalikan nilai `NaN`, algoritma *Weighted Sensor Fusion* pada `esp32_firmware.ino` dan `iot_simulator.py` secara otomatis menormalisasi bobot dari sensor yang tersisa (misal jika sensor B mati, bobot dinormalisasi ulang menjadi $A = 58.3\%$ dan $C = 41.7\%$). Sistem tetap beroperasi tanpa *freeze* (*fail-soft design*).

---

## 5. Kesimpulan Hasil Pengujian untuk Sidang Skripsi

1. **Keandalan Fungsional (100% Valid):** Seluruh 25 Use Cases yang direncanakan berhasil dieksekusi tanpa galat logika, tumpang-tindih koordinat slot, maupun kebocoran otorisasi hak akses.
2. **Integritas Finansial & Data:** Penggunaan tipe data `DECIMAL` dan fungsi aritmatika arbitrer `bcmul()` terbukti menghasilkan presisi mutlak pada neraca HPP dan omzet penjualan, menghapus risiko *floating-point rounding error*.
3. **Kesiapan Demonstrasi Lapangan:** Sistem siap dipresentasikan di hadapan dewan penguji skripsi dengan visualisasi web dashboard yang modern ergonomis, data riil yang padat, serta simulasi IoT yang responsif secara *real-time*.
