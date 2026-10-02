# Bab 4: Hasil dan Pembahasan — Pengujian Sistem (Testing Matrix) 🍄
**Smart Shroom SCM — Tugas Akhir Program Studi Sistem Informasi**

**Penyusun:** Benedictus Vio  
**Topik:** Pengujian Fungsional (*Black-Box Testing*), Pengujian Otomatis (*Automated Feature/Unit Testing*), dan Pengujian Logika IoT  
**Target:** Lampiran Resmi & Sub-Bab Pengujian Skripsi Bab 4  
**Terakhir Diperbarui:** Oktober 2026  

---

## 1. Metodologi Pengujian Perangkat Lunak

Pengujian sistem **Smart Shroom SCM** menerapkan dua pendekatan utama untuk menjamin mutu perangkat lunak (*Software Quality Assurance*):
1. **Black-Box Testing (Pengujian Kotak Hitam):**
   - Berfokus pada pengujian fungsionalitas sistem berdasarkan spesifikasi kebutuhan perangkat lunak (*Software Requirement Specification* / Use Case).
   - Menguji interaksi antarmuka pengguna (UI/UX) pada sisi web dashboard dan integrasi pertukaran data mikrokontroler ESP32 tanpa melihat alur internal baris kode.
   - Melibatkan **29 Use Cases** (`UC-01` s/d `UC-29`) yang mencakup seluruh siklus operasional kumbung jamur, manajemen spasial WMS, pembatalan audit trail non-destruktif, dan kontrol mikroklimat IoT.
2. **Automated Testing (Pengujian Otomatis PHPUnit):**
   - Menerapkan metodologi *Test-Driven Development (TDD) & Logic Hardening* pada backend Laravel 12.
   - Terdiri dari **168 skenario uji otomatis** dengan total **591 assertions** yang dieksekusi secara instan (`php artisan test`) dengan tingkat kelulusan **100% (Zero Failure)** dalam waktu ~4.4 detik.
3. **Pengujian Termodinamika, Offline Resilience, & Rule Engine IoT (`iot_simulator.py` & `sim_harness.py`):**
   - Verifikasi kestabilan algoritma kendali umpan-balik (*closed-loop hysteresis*), eliminasi *relay chatter* (turun 92%), deadband misting dinamis (timeout turun dari 97% ke 0%), mitigasi kegagalan jaringan (non-blocking offline loop), dan *failsafe interupsi* mode panen dalam kondisi cuaca stokastik monsun Indonesia.

---

## 2. Matriks Pengujian Black-Box (29 Use Cases)

Pengujian fungsional kotak hitam dilakukan pada peramban web (*Google Chrome & Mobile Safari*) serta simulasi transmisi HTTP REST API dari perangkat IoT:

### Modul A: Autentikasi & Otorisasi Pengguna (RBAC)

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 1 | **UC-01** | Login dengan kredensial valid (Admin) | Email: `admin@smartshroom.test`<br>Password: `password123` | Sistem memberikan token Sanctum dan mengarahkan ke dashboard utama. | Token Sanctum tersimpan di `authStore`, redirect ke `/` berhasil. | **Valid** |
| 2 | **UC-01** | Login dengan password salah | Email: `admin@smartshroom.test`<br>Password: `salah123` | Sistem menolak akses dan menampilkan pesan galat kredensial tidak cocok. | Muncul toast alert: *"Email atau password yang Anda masukkan salah."* | **Valid** |
| 3 | **UC-02** | Registrasi akun worker baru oleh Admin | Nama: `Budi Worker`<br>Email: `budi@smartshroom.test`<br>Role: `worker` | Akun baru berhasil dibuat oleh Admin dalam batas kuota (maks 5). | User worker baru tersimpan di database, status HTTP 201. | **Valid** |
| 4 | **UC-02** | Proteksi registrasi oleh Guest / Worker | Akses endpoint `POST /api/register` tanpa token Admin | Sistem menolak akses registrasi (khusus Admin). | Sistem merespons 401 Unauthorized / 403 Forbidden. | **Valid** |
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
| 10 | **UC-08** | Pencatatan pengadaan batch baglog baru | Batch: `BL-20261002-001`, Qty: 1.000, Modal: Rp 2.800/baglog | Batch tersimpan dengan kode unik resilient collision dan umur hari dihitung otomatis. | Batch tercatat di database, umur H+0 tertera pada tabel, HTTP 201. | **Valid** |
| 11 | **UC-09** | Pembaruan status siklus batch baglog | Mengubah status batch dari `active` ke `completed` | Status batch ter-update dan kartu ringkasan KPI merefleksikan perubahan. | Status berubah menjadi selesai, slot terkait dapat dikosongkan. | **Valid** |
| 12 | **UC-10** | Navigasi tabel batch dengan paginasi 10 baris | Membuka Halaman Baglog yang memiliki > 10 batch | Sistem menampilkan tepat 10 baris per halaman dengan kontrol navigasi `<` `1` `2` `>`. | Paginasi berfungsi mulus, auto-reset ke Halaman 1 saat filter status diganti. | **Valid** |
| 13 | **UC-19** | Alokasi batch baglog ke koordinat rak 3D (WMS) | Mengalokasikan Batch ke slot `B-05-03` dengan kapasitas awal 10 baglog | Slot `B-05-03` terisi, status `INCUBATION`, kapasitas aktif `10/10`. | Alokasi berhasil tersimpan, slot berubah warna di denah visual. | **Valid** |
| 14 | **UC-19** | Validasi anti tumpang-tindih (*anti-collision*) slot | Mencoba mengalokasikan batch lain ke slot `B-05-03` yang sedang terisi | Sistem menolak alokasi karena slot sedang ditempati batch aktif. | Backend melempar galat HTTP 422: *"Slot B-05-03 sudah ditempati oleh batch aktif."* | **Valid** |
| 15 | **UC-20** | Peninjauan denah spasial dan kolom tier solid | Menggeser layar horizontal (*scroll*) pada Kumbung Grid di smartphone | Kolom nomor tingkat `T-01` s.d. `T-10` tetap terlihat (*sticky*) dengan latar solid 100% opaque. | Slot di belakang tidak bocor tembus pandang, navigasi denah tetap terbaca jelas. | **Valid** |
| 16 | **UC-20** | Visualisasi Heatmap produktivitas panen per slot | Mengklik tombol "Peta Panen" pada Kumbung Grid | Warna kotak slot berubah gradasi hijau sesuai total berat panen (KG) yang pernah dipetik. | Slot dengan panen tertinggi tampil dengan warna hijau paling pekat. | **Valid** |
| 17 | **UC-29** | Penyelesaian Siklus Kamar Rak & Auto-Cull WMS | Menekan tombol "Tutup Siklus" pada slot dengan sisa 4 baglog aktif | Status alokasi berubah ke `COMPLETED`, sisa 4 baglog di-cull otomatis sebagai `HABIS_PRODUKSI`. | Kapasitas aktif slot menjadi 0/10, warna slot berubah abu-abu selesai. | **Valid** |

---

### Modul D: Jurnal Mutasi Afkir & Biosekuriti Kumbung

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 18 | **UC-21** | Pencatatan mutasi baglog afkir (*cull ledger*) | Membuang 2 baglog di slot `B-05-03` akibat *Trichoderma* | Catatan afkir tersimpan di `baglog_culls`, kapasitas aktif slot otomatis berkurang dari 10 menjadi 8. | Kapasitas aktif slot menjadi 8 baglog, formula `10 - SUM(culls)` terbukti dinamis. | **Valid** |
| 19 | **UC-21** | Validasi kapasitas afkir melebihi sisa baglog | Menginput jumlah afkir 15 baglog pada slot berkapasitas 8 | Sistem menolak pencatatan karena jumlah afkir melebihi sisa baglog aktif di slot. | Validasi gagal dengan HTTP 422: *"Jumlah afkir tidak boleh melebihi kapasitas aktif."* | **Valid** |
| 20 | **UC-28** | Pembatalan Catatan Afkir (*Void Cull*) | Admin membatalkan catatan afkir 2 baglog dengan alasan audit | Rekaman afkir ditandai void, kapasitas aktif slot otomatis bertambah kembali dari 8 ke 10. | Status afkir coret merah, kapasitas aktif slot pulih secara atomik. | **Valid** |

---

### Modul E: Panen, Rantai Pasok Penjualan, & HPP Dinamis

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 21 | **UC-11** | Pencatatan panen terhubung slot dan flush | Input panen 8.5 Kg dari slot `B-05-03`, Flush ke-2 | Data panen tersimpan, berat hari ini bertambah, dan data terpaginasi 10 baris. | Panen tersimpan, total harian ter-update otomatis pada kartu KPI beranimasi. | **Valid** |
| 22 | **UC-26** | Pembatalan Catatan Panen (*Void Harvest*) | Admin membatalkan entri panen salah timbangan | Record panen ditandai void, akumulasi panen harian dikurangi kembali tanpa hapus permanen. | Baris panen coret *line-through* badge `Dibatalkan`, KPI harian terpotong rapi. | **Valid** |
| 23 | **UC-12** | Visualisasi grafik tren panen 14 hari | Membuka halaman Harvest Management | Area chart hijau menampilkan akumulasi panen harian 2 minggu terakhir. | Kurva produktivitas panen tampil presisi terhadap target harian. | **Valid** |
| 24 | **UC-13** | Pencatatan transaksi penjualan jamur | Jual 20.0 Kg jamur seharga Rp 25.000/Kg ke "Pak Joko" | Omzet kotor dihitung akurat via `bcmul()`: Rp 500.000,00 tanpa error pembulatan desimal. | Rekaman penjualan tersimpan di database dengan `total_revenue = 500000.00`. | **Valid** |
| 25 | **UC-27** | Pembatalan Transaksi Penjualan (*Void Sale*) | Admin membatalkan transaksi penjualan retur pasar | Record penjualan ditandai void, omzet HPP dikurangi kembali secara otomatis. | Tabel penjualan menampilkan baris void coret, kartu HPP menyesuaikan omzet riil. | **Valid** |
| 26 | **UC-14** | Tinjauan rekapitulasi mingguan dan buffer stok | Membaca widget neraca cadangan stok panen | Sistem menghitung selisih panen kumulatif dikurangi penjualan kumulatif secara dinamis. | Cadangan stok jamur di gudang tertera akurat sesuai mutasi barang. | **Valid** |
| 27 | **UC-22** | Pembukuan beban biaya operasional kumbung | Input pengeluaran: Listrik PLN Rp 250.000,00 | Biaya tercatat pada tabel `operational_expenses` dengan kategori `electricity`. | Pengeluaran tersimpan, otomatis menambah beban biaya variabel pada batch aktif. | **Valid** |
| 28 | **UC-23** | Evaluasi HPP & Margin Kontribusi manajerial | Membuka kartu *HPP Analysis* pada Sales Management | Sistem menampilkan: Modal Pengadaan, Biaya Ops, Total Omzet, dan Margin Kontribusi. | Margin Kontribusi = `Omzet - (Modal + Biaya Ops)` tampil presisi dalam formasi grid 2x2. | **Valid** |

---

### Modul F: Kontrol Interupsi Mode Panen & Integrasi IoT

| No. | Kode UC | Skenario Pengujian | Data Uji / Tindakan | Hasil yang Diharapkan | Hasil Pengujian Aktual | Kesimpulan |
|---|---|---|---|---|---|:---:|
| 29 | **UC-24** | Aktivasi Mode Jeda Panen (Failsafe Timer) | Menekan tombol preset `[ 2 Jam ]` pada widget jeda panen di dashboard | Command `PAUSE` aktif selama 7.200 detik, pompa misting dan kipas mati seketika. | Widget menampilkan countdown live, ESP32 mematikan relay misting dan fan (Fluid Dynamics Guard). | **Valid** |
| 30 | **UC-25** | Akhiri jeda lebih awal (Resume to AUTO) | Menekan tombol "Akhiri Jeda & Balik ke AUTO" | Status kembali ke `AUTO`, ESP32 seketika melakukan *instant-read* sensor DHT22. | Mode jeda nonaktif seketika, kontrol aktuator kembali dievaluasi otomatis. | **Valid** |
| 31 | **UC-15** | Konfigurasi ambang batas iklim & validasi deadband | Memilih preset "Fruiting" dan mencoba set RH spread < 4% | Sistem menolak jika selisih RH < 4% (mencegah osilasi pompa misting). | Validasi HTTP 422: *"Selisih RH Max dan Min harus minimal 4%"*. | **Valid** |
| 32 | **UC-16** | Ingesti telemetri fusi sensor vertikal dari ESP32 | ESP32 mengirim JSON payload rata-rata tertimbang 3x DHT22 | Data diterima dengan status HTTP 201 Created dan tersimpan permanen (*immutable*). | Database mencatat suhu, kelembapan, CO2, dan lux dengan presisi `DECIMAL(5,2)`. | **Valid** |
| 33 | **UC-16** | Pengujian Rate Limiting (Anti-Spam IoT) | Mengirimkan 21 request sensor data dalam rentang waktu < 1 menit | Request ke-21 ditolak oleh middleware Throttle dengan kode status `429 Too Many Requests`. | Server membatasi spamming perangkat dan mencegah overload CPU. | **Valid** |

---

## 3. Rekapitulasi Automated Testing (PHPUnit)

Pengujian unit dan integrasi otomatis dieksekusi menggunakan test runner PHPUnit pada backend Laravel 12. Seluruh suite pengujian mencakup **168 skenario** dengan **591 assertions**:

### A. Tabel Rekapitulasi Test Suite

| Test Suite / Berkas Pengujian | Kategori | Jumlah Test | Assertions | Status | Durasi Eksekusi |
|---|---|:---:|:---:|:---:|:---:|
| `WmsPhaseATest.php` | Feature / WMS Dynamic Capacity & Health | 8 | 33 | ✅ Lulus 100% | ~220 ms |
| `WmsPhaseBTest.php` | Feature / WMS Cycle Completion & Auto-Cull | 6 | 28 | ✅ Lulus 100% | ~190 ms |
| `WmsPhaseCTest.php` | Feature / Voiding Ledger Audit Trail | 8 | 34 | ✅ Lulus 100% | ~250 ms |
| `WmsPhaseDTest.php` | Feature / Race Condition Batch Generator & Resiliency | 5 | 29 | ✅ Lulus 100% | ~180 ms |
| `Phase5IotRuleEngineTest.php` | Feature / IoT & Rules (F-05) | 7 | 56 | ✅ Lulus 100% | ~600 ms |
| `Phase4DeviceControlTest.php` | Feature / Interruption & Cache (F-03, F-04) | 5 | 20 | ✅ Lulus 100% | ~280 ms |
| `Phase3ApiTest.php` | Feature / WMS & Chart Multi-Device (F-06, F-16) | 8 | 53 | ✅ Lulus 100% | ~420 ms |
| `Phase2ModelsTest.php` | Unit / Data Models | 3 | 12 | ✅ Lulus 100% | ~190 ms |
| `SecurityAuthTest.php` | Feature / RBAC & Admin Register (F-02) | 18 | 52 | ✅ Lulus 100% | ~350 ms |
| `SecurityInjectionTest.php` | Feature / Security & RH Spread (F-15) | 23 | 70 | ✅ Lulus 100% | ~390 ms |
| `SecurityRateLimitTest.php` | Feature / Rate Limiter Anti-Spam | 4 | 12 | ✅ Lulus 100% | ~410 ms |
| `EccComprehensiveTestSuiteTest.php` | Feature / End-to-End Regression | 28 | 96 | ✅ Lulus 100% | ~480 ms |
| `BaglogBatchLogicTest.php` | Unit / Lifecycle Baglog | 10 | 25 | ✅ Lulus 100% | ~150 ms |
| `SaleCalculationTest.php` | Unit / Financial Arbitrary `bcmul` | 7 | 21 | ✅ Lulus 100% | ~120 ms |
| `ThresholdViolationTest.php` | Unit / EWS Algorithm | 12 | 30 | ✅ Lulus 100% | ~180 ms |
| `SensorDataHelperTest.php` | Unit / Helper Functions | 14 | 22 | ✅ Lulus 100% | ~110 ms |
| `ExampleTest.php` | Feature & Unit / Smoke Baseline | 2 | 2 | ✅ Lulus 100% | ~50 ms |
| **TOTAL KESELURUHAN** | **Automated Tests** | **168** | **591** | **✅ 100% PASS** | **~4.4 Detik** |

### B. Bukti Output Eksekusi Terminal (`php artisan test`)
```text
   PASS  Tests\Feature\WmsPhaseATest
  ✓ slot active capacity calculates correctly with culls              0.08s
  ✓ slot capacity updates dynamically when culls recorded             0.07s
  ✓ slot details modal api payload returns capacity metrics           0.07s
  ✓ cannot cull more than active capacity                             0.07s
  ✓ health percentage calculates correctly                            0.06s
  ✓ empty slot returns zero active capacity                           0.06s
  ✓ batch total active baglogs accounts for slot culls                0.08s
  ✓ cull reason validation accepts valid enum values                  0.07s

   PASS  Tests\Feature\WmsPhaseBTest
  ✓ complete cycle marks assignment as completed                      0.09s
  ✓ complete cycle automatically culls remaining active baglogs       0.08s
  ✓ complete cycle on empty slot does not create unnecessary cull     0.07s
  ✓ completed slot cannot be assigned until vacated                   0.07s
  ✓ complete cycle requires admin role                                0.08s
  ✓ complete cycle records completed at timestamp                     0.07s

   PASS  Tests\Feature\WmsPhaseCTest
  ✓ void harvest soft voids and records audit trail                   0.08s
  ✓ void sale soft voids and excludes revenue from totals             0.08s
  ✓ void cull restores active capacity on slot assignment             0.09s
  ✓ voided cull cannot exceed original assignment capacity            0.07s
  ✓ void requires reason with minimum length                          0.07s
  ✓ void requires admin authentication                                0.07s
  ✓ cannot void already voided record                                 0.07s
  ✓ voided records excluded from default queries                      0.08s

   PASS  Tests\Feature\WmsPhaseDTest
  ✓ batch code generator retries on collision                         0.08s
  ✓ batch code follows strict format bl yyyymmdd xxx                  0.07s
  ✓ batch creation resilient under simulated collision                0.08s
  ✓ database transaction rolls back on assignment failure             0.08s
  ✓ missing price per baglog returns validation warning               0.07s

  ... [Seluruh 168 Test Lulus Tanpa Galat] ...

  Tests:    168 passed (591 assertions)
  Duration: 4.41s
```

---

## 4. Evaluasi Kinerja & Bukti Kuantitatif Logic Hardening (F-01 s/d F-16)

Berdasarkan pengujian simulasi fisik stokastik (`sim_harness.py`) dan pengujian integrasi hardware-in-the-loop, berikut perbandingan kinerja sistem **sebelum vs sesudah** logic hardening:

### 1. Eliminasi Relay Chattering Kipas saat Suhu Kritis (F-10)
- **Sebelum Perbaikan:** Saat suhu ruang melampaui ambang kritis ($>34^\circ\text{C}$), ketiadaan histeresis 24 jam memicu pemutusan mendadak saat suhu turun $0.1^\circ\text{C}$, menghasilkan **649 kali toggle/hari** (*relay chatter* parah). Kondisi ini berpotensi membakar koil relay dan motor induksi blower.
- **Sesudah Perbaikan:** Histeresis stop 24 jam dengan syarat $T_{\max} \le \text{critical} - 1.0^\circ\text{C}$ dan $T_{\text{avg}} \le \text{tempMax}$ menurunkan frekuensi toggle menjadi **49 kali/hari (penurunan 92.4%)**. Siklus pendinginan berlangsung stabil tanpa osilasi destruktif.

### 2. Normalisasi Siklus Misting & Eliminasi Emergency Timeout (F-11 & F-12)
- **Sebelum Perbaikan:** Pada fase Fruiting, target penghentian histeresis $+5\%$ terlalu ambisius untuk kapasitas evaporasi kumbung dan batas waktu proteksi terlalu sempit (60 detik). Akibatnya, **97% siklus misting berhenti karena *Safety Timeout*** dan bukan karena target kelembapan tercapai. Selain itu, pada fase Inkubasi (target 65–75%), ambang darurat kaku $75\%$ memicu penyemprotan salah sasaran sebanyak **168.8 kali/hari**.
- **Sesudah Perbaikan:** 
  - Ambang darurat dinamis $\text{humMin} - 10\%$ menurunkan penyemprotan fase inkubasi menjadi **3.5 kali/hari (turun 97.9%)**.
  - Deadband $\text{humMin} + \min(3.0, 0.5 \times \Delta RH)$ dan penyesuaian timeout ke 90 detik menekan angka penghentian darurat menjadi **0%**. Pompa misting kini berhenti secara alami saat kelembapan ideal tercapai.

### 3. Matriks Perbandingan Kuantitatif Sebelum vs Sesudah

| Skenario Pengujian | Parameter Kinerja | Sebelum Hardening | Sesudah Hardening | Dampak Ilmiah / Operasional |
|---|---|:---:|:---:|---|
| **Panas Ekstrem (27–36°C)** | Frekuensi Toggle Fan Kritis | 649 kali/hari | **49 kali/hari** | **Osilasi relay turun 92.4%**, mencegah kerusakan mekanis |
| **Misting Fruiting** | Persentase Stop karena Timeout | 97% | **0%** | **Target RH tercapai 100%** secara natural tanpa interupsi paksa |
| **Inkubasi (RH 65–75%)** | Pulse Misting Darurat Salah Sasaran | 168.8 kali/hari | **3.5 kali/hari** | Mencegah pembusukan spora akibat kelebihan air di fase awal |
| **Jeda Panen (Harvest)** | Latensi Respon Eksekusi Relay | 30–40 detik | **< 8 detik** | Polling cepat mematikan kipas sebelum petani masuk kumbung |
| **Konektivitas Wi-Fi Drop** | Perilaku Kontrol Loop ESP32 | Freeze / Macet | **Non-Blocking (100% Aktif)** | Watchdog keselamatan dan pompa tetap beroperasi saat offline |
| **Penyimpanan Log Offline** | Kehilangan Rekaman Riwayat Aktuator | Log hilang 100% | **0% (Antrean RAM 10 slot)** | Sinkronisasi otomatis saat koneksi internet pulih |
| **Persistensi State Vercel** | Keberlanjutan Mode Jeda Panen | State hilang (*array cache*) | **Persisten (*database cache*)** | Jeda panen tidak ter-reset saat serverless berganti container |

### 4. Ketahanan Terhadap Kerusakan Sensor (Fault-Tolerant Fusion)
- Saat salah satu pin sensor DHT22 dilepas atau mengembalikan nilai `NaN`, algoritma *Weighted Sensor Fusion* pada `esp32_firmware.ino` dan `iot_simulator.py` secara otomatis menormalisasi bobot dari sensor yang tersisa (misal jika sensor B mati, bobot dinormalisasi ulang menjadi $A = 58.3\%$ dan $C = 41.7\%$). Jika seluruh sensor mati ($>15$ detik tanpa bacaan valid), sistem masuk ke *Safe State* (mematikan misting untuk biosekuriti).

---

## 5. Kesimpulan Hasil Pengujian untuk Sidang Skripsi

1. **Keandalan Fungsional & Logika (100% Valid):** Seluruh 25 Use Cases dan 141 skenario pengujian otomatis lolos verifikasi tanpa satu pun kegagalan. Seluruh celah kritis (F-01 s/d F-16) telah ditutup dengan arsitektur bersih.
2. **Kestabilan Termodinamika & Umur Hardware:** Implementasi histeresis adaptif dan deadband proporsional berhasil meredam osilasi relay hingga 92% dan menghapus 97% kegagalan timeout misting, memperpanjang estimasi umur pakai aktuator mekanik kumbung.
3. **Integritas Finansial, Spasial, & Keamanan Cloud:** Sistem menjamin presisi moneter dengan `DECIMAL(10,2)` dan `bcmul()`, mencegah tabrakan batch di grid WMS 3D, serta mengamankan hak akses administrasi dan persistensi state kendali pada infrastruktur serverless.

