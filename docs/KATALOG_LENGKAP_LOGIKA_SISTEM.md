# Katalog Lengkap Seluruh Logika Sistem (Master Logic Catalog)
**Smart Shroom SCM — Tugas Akhir Sistem Informasi**

- **Dokumen:** Single Source of Truth (SSOT) Seluruh Logika Sistem
- **Disusun:** 8 Oktober 2026
- **Cakupan:** **50 Logika Lengkap** tanpa terkecuali, mencakup **Pilar 1 (IoT, Fisika, Sensor & Aktuator)** dan **Pilar 2 (WMS, SCM, Panen, Penjualan & Finansial HPP)**.

---

## 📑 Daftar Isi
1. [Arsitektur 2 Pilar Sistem](#arsitektur-2-pilar-sistem)
2. [PILAR 1: Logika Otomasi IoT & Mikroklimat (34 Logika)](#pilar-1-logika-otomasi-iot--mikroklimat-34-logika)
   - [Kelompok A: Akuisisi & Sensing (L-01 – L-04)](#kelompok-a-akuisisi--sensing-l-01--l-04)
   - [Kelompok B: Kendali Misting & Solenoid (L-05 – L-13)](#kelompok-b-kendali-misting--solenoid-l-05--l-13)
   - [Kelompok C: Kendali Exhaust Fan (L-14 – L-26)](#kelompok-c-kendali-exhaust-fan-l-14--l-26)
   - [Kelompok D: Failsafe & Ketahanan Operasional (L-27 – L-34)](#kelompok-d-failsafe--ketahanan-operasional-l-27--l-34)
3. [PILAR 2: Logika Manajemen Rantai Pasok (SCM) & WMS (16 Logika)](#pilar-2-logika-manajemen-rantai-pasok-scm--wms-16-logika)
   - [Kelompok E: WMS & Penataan Kumbung Rak Dinamis (L-35 – L-40)](#kelompok-e-wms--penataan-kumbung-rak-dinamis-l-35--l-40)
   - [Kelompok F: Pencatatan Panen & Siklus Flush (L-41 – L-44)](#kelompok-f-pencatatan-panen--siklus-flush-l-41--l-44)
   - [Kelompok G: Inventori Penjualan & Finansial HPP (L-45 – L-47)](#kelompok-g-inventori-penjualan--finansial-hpp-l-45--l-47)
   - [Kelompok H: KPI Agrikultur & Heatmap Dashboard (L-48 – L-50)](#kelompok-h-kpi-agrikultur--heatmap-dashboard-l-48--l-50)
4. [Tabel Matriks Referensi Cepat (Cheat Sheet Skripsi)](#tabel-matriks-referensi-cepat-cheat-sheet-skripsi)

---

## Arsitektur 2 Pilar Sistem

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SMART SHROOM ENTERPRISE SCM                            │
├──────────────────────────────────────┬──────────────────────────────────────────┤
│    PILAR 1: IoT & MIKROKLIMAT        │      PILAR 2: SCM, WMS & FINANSIAL       │
│    (34 Aturan Kendali Fisika)        │       (16 Aturan Bisnis & Logistik)      │
├──────────────────────────────────────┼──────────────────────────────────────────┤
│ • Weighted Sensor Fusion             │ • Alokasi Rak Dinamis (Row-Bay-Tier)     │
│ • Histeresis Closed-Loop Misting     │ • Siklus Hidup Batch & Afkir Berbasis    │
│ • Fan Utility 90s Probe (P1)         │   Ledger (Immutable Culls)               │
│ • Night Misting Interval Guard (P2') │ • Pelacakan Flush Multi-Siklus (1–7)     │
│ • Pagar RH Maksimum Misting (P3)     │ • Presisi Finansial HPP/Kg (bcmath)      │
│ • Drainase CO2 Pasif (Plastik 30cm)  │ • Heatmap 3D Spasial Produktivitas Rak   │
└──────────────────────────────────────┴──────────────────────────────────────────┘
```

---

## PILAR 1: Logika Otomasi IoT & Mikroklimat (34 Logika)

### Kelompok A: Akuisisi & Sensing (L-01 – L-04)

* **L-01: Weighted Sensor Fusion (3-Zona Vertikal)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`, `SensorDataRepository.php`
  * **Aturan:** Menggabungkan 3 sensor fisik SHT30 IP68 pada ketinggian berbeda dengan bobot:
    $$T_{\text{avg}} = 0.35 T_{\text{Atas}} + 0.40 T_{\text{Tengah}} + 0.25 T_{\text{Bawah}}$$
    $$RH_{\text{avg}} = 0.35 RH_{\text{Atas}} + 0.40 RH_{\text{Tengah}} + 0.25 RH_{\text{Bawah}}$$
  * **Tujuan:** Menghilangkan bias stratifikasi suhu (*stack effect* di mana udara panas naik ke plafon dan udara dingin/lembab mengendap di lantai).

* **L-02: I2C Multiplexing Channel Switching**
  * **Lokasi:** `esp32_firmware.ino` (`tcaSelect()`)
  * **Aturan:** Mikrokontroler mengalihkan kanal TCA9548A secara berurutan (Kanal 0 $\to$ 1 $\to$ 2) sebelum membaca sensor.
  * **Tujuan:** Menghindari tabrakan bus data (*I2C address collision*) karena ketiga probe SHT30 menggunakan alamat I2C identik (`0x44`).

* **L-03: Sensor Stale Data Invalidation & Dynamic Normalization**
  * **Lokasi:** `esp32_firmware.ino`, `SensorDataRepository.php`
  * **Aturan:** Jika sensor gagal dibaca atau data berusia $>15$ detik, data ditandai *stale*. Jika 1 sensor rusak, bobot dinormalisasi ulang ke sensor yang hidup; jika seluruh sensor mati, aktuator dimatikan (*fail-soft*).
  * **Tujuan:** Biosekuriti agar mikrokontroler tidak mengeksekusi aktuator berbasis data usang (*stale execution*).

* **L-04: Measurement Jitter & Boundary Clamping**
  * **Lokasi:** `iot_simulator.py`, `esp32_firmware.ino`
  * **Aturan:** Pembacaan dibatasi secara fisik ($T: 0–60\ ^\circ\text{C}$, $RH: 0–100\%$) dan diberi filter kestabilan nilai ADC.
  * **Tujuan:** Mencegah lonjakan data palsu (*glitch spike*) yang dapat memicu alarm palsu.

---

### Kelompok B: Kendali Misting & Solenoid (L-05 – L-13)

* **L-05: Tier 1 Normal Misting Trigger**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Misting menyala jika $RH_{\text{avg}} < \text{rhTriggerLow}$ ATAU $T_{\text{avg}} > \text{tempMax}$.
  * **Tujuan:** Mengembalikan kelembaban optimal dan mendinginkan kumbung via pendinginan evaporatif (*evaporative cooling*).

* **L-06: Dynamic Stop Hysteresis (F-12)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Target mati misting dihitung adaptif:
    $$\text{rhTriggerHigh} = \text{humMin} + \min(3.0, 0.5 \cdot (\text{humMax} - \text{humMin}))$$
    Misting berhenti saat $RH \ge \text{rhTriggerHigh}$ DAN $T \le \text{tempMax}$.
  * **Tujuan:** Membentuk kurva kelembapan melengkung landai (*smooth curve*) dan memangkas kegagalan timeout hingga 0%.

* **L-07: Tier 2 Local Rack Pulse Misting (F-11)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Jika sensor tunggal (rak atas) mengalami kekeringan ekstrem ($\min(RH) < \text{humMin} - 10\%$), pompa aktif pulsa pendek **30 detik**.
  * **Tujuan:** Menyelamatkan rak atas yang kering tanpa membanjiri rak bawah (*anti-waterlogging*).

* **L-08: Mutual Exclusion Interlock (Fan vs Misting)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Misting DILARANG hidup jika exhaust fan sedang aktif.
  * **Tujuan:** Mencegah kabut mikro bertekanan tinggi disedot langsung keluar ruangan dan terbuang percuma.

* **L-09: Night Misting Cycle Guard (P2' Reform)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Pada pukul 17:00 – 06:00 WIB, misting diizinkan aktif sesuai histeresis normal, tetapi **wajib memiliki jeda minimal 600 detik (10 menit)** antar-siklus penyemprotan.
  * **Tujuan:** Menjaga kelembapan malam tetap $RH \ge 85\%$ tanpa membasahi tubuh buah secara berlebihan (*anti-rot*).

* **L-10: Critical Temperature Misting Guard & Handover (F-10b)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Misting DILARANG mulai jika ada sensor $\max(T) > \text{tempMax} + 4.0\ ^\circ\text{C}$, KECUALI jika kipas sedang dalam masa lockout 15 menit (`!isFanUseful()`) atau terjadi dehidrasi kritis ($\min(RH) < \text{criticalLowRh}$).
  * **Tujuan:** Mencegah tabrakan kendali jika kipas berguna, namun mengizinkan pendinginan evaporatif darurat (Handover Sinergis) jika kipas terbukti tidak berguna di siang terik.

* **L-11: RH Saturation Safety Hold & Pagar RH (P3)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Jika suhu tinggi namun $RH \ge \text{humMax} - 3\%$, misting DITAHAN; dan dipaksa STOP jika $RH \ge \text{humMax} - 1\%$.
  * **Tujuan:** Mencegah udara lewat jenuh (*super-saturation*) yang menyebabkan kondensasi lantai becek.

* **L-12: Evaporation Cooldown Guard (150 detik)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Setelah pompa mati, pompa dikunci selama 150 detik (2,5 menit).
  * **Tujuan:** Memberi waktu bagi butiran kabut mikro untuk menguap sempurna sebelum sensor dievaluasi ulang.

* **L-13: Emergency Safety Timeout (90 detik — F-12)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Pompa dimatikan paksa jika menyala terus-menerus selama 90 detik tanpa mencapai target.
  * **Tujuan:** Perlindungan kegagalan pipa bocor, air tandon habis, atau sensor macet.

---

### Kelompok C: Kendali Exhaust Fan (L-14 – L-26)

* **L-14: Tier 1 Daytime Cooling Fan**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Fan aktif jika $T_{\text{avg}} > \text{tempMax}$, dan mati saat $T_{\text{avg}} \le \text{tempMax} - 1.5\ ^\circ\text{C}$.
  * **Tujuan:** Membuang akumulasi panas plafon di siang hari.

* **L-15: Fan Utility & Thermal Differential Probe (P1 — Opsi B Trial)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Kipas pendingin normal (Tier 1) dicoba menyala **90 detik**. Jika setelah 90 detik suhu rata-rata dalam tidak turun $\ge 0.2\ ^\circ\text{C}$ (artinya udara luar sama panas/lebih terik), kipas dimatikan dan dikunci selama **15 menit** (`fanLockoutUntil`).
  * **Tujuan:** Mencegah exhaust fan menyedot hawa panas luar masuk ke dalam kumbung tanpa perlu membeli sensor luar tambahan (Capex Rp0).
  * **Handover Sinergis:** Saat kipas dikunci 15 menit, kontrol pendinginan dialihkan ke misting evaporatif (L-10).

* **L-16: Daytime Cooling Max Watchdog Timeout (180 detik)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Kipas pendingin normal dibatasi maksimal berputar 180 detik (3 menit) kontinu.
  * **Tujuan:** Mencegah motor exhaust fan overheating dan menguras kelembapan kumbung.

* **L-17: Cooling Anti-Chattering Cooldown (60 detik)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Kipas pendingin wajib istirahat minimal 60 detik setelah mati sebelum boleh aktif kembali.
  * **Tujuan:** Mencegah saklar relay menyala-mati cepat di batas ambang (*relay chattering*).

* **L-18: Tier 2 Safety Critical Temperature Override (F-10)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Jika ada 1 sensor melonjak $> \text{tempMax} + 4.0\ ^\circ\text{C}$, fan **DIPAKSA ON** mem-bypass seluruh timer cooldown KECUALI jika kipas sedang dalam masa lockout 15 menit (L-15). Jika sedang lockout, kipas ditahan TETAP OFF agar tidak menyedot udara panas luar dan memotong misting. Misting yang sedang berjalan dipotong seketika hanya jika kipas efektif menyala.
  * **Tujuan:** Evakuasi darurat udara panas ekstrem di bawah atap asbes tanpa menimbulkan jebakan thermal loop.

* **L-19: 24-Hour Override Stop Hysteresis (F-10a)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Fan override baru boleh mati jika $\max(T) \le (\text{criticalThreshold} - 1.0\ ^\circ\text{C})$ DAN $T_{\text{avg}} \le \text{tempMax}$. Berlaku 24 jam penuh.
  * **Tujuan:** Meredam getaran relay hingga 92,4% saat kondisi darurat.

* **L-20: Tier 3 Vertical Homogenization Mixing**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Jika disparitas kelembapan $|RH_{\text{atas}} - RH_{\text{bawah}}| > 12\%$, fan menyala kilat **30 detik**.
  * **Tujuan:** Mengaduk udara secara sirkuler untuk meratakan mikroklimat antar-rak.

* **L-21: Homogenization Cooldown Guard (900 detik)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Kipas pengaduk dikunci selama 15 menit (900 detik) setelah aktif.
  * **Tujuan:** Menjaga ketenangan sirkulasi udara kumbung.

* **L-22: Post-Misting Settling Delay Guard (60 detik)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Kipas dilarang menyala selama 60 detik setelah misting mati.
  * **Tujuan:** Memberi kesempatan kabut mikro mengendap pada baglog dan tidak terbuang keluar ventilasi.

* **L-23: Night Mode Transition Failsafe (F-15b)**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Tepat pukul 17:00 WIB, sisa kipas pendingin siang dimatikan dan timer malam di-reset.
  * **Tujuan:** Menghindari lonjakan kipas saat transisi pergantian jam siang ke malam.

* **L-24: Night Over-Humidity Purge**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Di malam hari jika $RH \ge 96.0\%$, kipas aktif **300 detik (5 menit)** dengan cooldown 30 menit.
  * **Tujuan:** Membuang uap jenuh agar tidak terjadi kondensasi tetesan air dingin ke jamur.

* **L-25: Night Periodic CO2 Flush**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Di malam hari setiap 60 menit sekali, kipas aktif **300 detik (5 menit)**.
  * **Tujuan:** Menyapu dan mendilusi gas $\text{CO}_2$ berat yang mengendap di lantai kumbung hingga $35\text{--}45\%$ pergantian volume udara riil.

* **L-26: Night Timer Cross-Synchronizer**
  * **Lokasi:** `esp32_firmware.ino`, `iot_simulator.py`
  * **Aturan:** Jika Over-Humidity Purge baru saja aktif, jadwal CO2 Flush diundur 60 menit ke depan.
  * **Tujuan:** Mencegah dua pemicu malam aktif tumpang tindih dalam waktu berdekatan.

---

### Kelompok D: Failsafe & Ketahanan Operasional (L-27 – L-34)

* **L-27: Harvest Pause Mode (Jeda Interupsi Manual Panen)**
  * **Lokasi:** `esp32_firmware.ino`, `api.php`, `Dashboard.tsx`
  * **Aturan:** Mode jeda diaktifkan dari dashboard (preset 2h/4h/6h/8h); mengunci seluruh aktuator otomatis dan otomatis resume saat waktu habis.
  * **Tujuan:** Menjamin kenyamanan pekerja saat panen tanpa risiko lupa menyalakan sistem kembali (*anti-human-error*).

* **L-28: Fluid Dynamics Guard on Pause**
  * **Lokasi:** `esp32_firmware.ino`
  * **Aturan:** Kipas dan pompa mati seketika $<8$ detik saat jeda panen aktif sebelum pintu kumbung dibuka lebar.
  * **Tujuan:** Mencegah fenomena *short-circuiting* udara luar dan melindungi pekerja dari kabut tekanan tinggi.

* **L-29: Instant-Read Resume**
  * **Lokasi:** `esp32_firmware.ino`
  * **Aturan:** Saat mode panen berakhir, mikrokontroler seketika membaca ulang 3 sensor tanpa menunggu delay interval normal 5 detik.
  * **Tujuan:** Restorasi iklim mikro seketika setelah pintu kumbung ditutup kembali.

* **L-30: Precharge Relay Safe Latch (F-15d)**
  * **Lokasi:** `esp32_firmware.ino` (`setup()`)
  * **Aturan:** Semua pin relay di-set `digitalWrite(pin, HIGH/OFF)` **sebelum** fungsi `pinMode(pin, OUTPUT)`.
  * **Tujuan:** Mencegah denyut liar (*relay glitch spark*) menyalakan pompa saat ESP32 pertama kali dinyalakan.

* **L-31: Non-Blocking Asynchronous WiFi Reconnect (F-07)**
  * **Lokasi:** `esp32_firmware.ino`
  * **Aturan:** Percobaan sambung ulang WiFi dilakukan asinkron tiap 15 detik tanpa fungsi blocking (`delay()`).
  * **Tujuan:** Loop kendali histeresis aktuator tetap bekerja 100% normal meskipun koneksi internet terputus.

* **L-32: Circular RAM Log Buffer (F-08)**
  * **Lokasi:** `esp32_firmware.ino`
  * **Aturan:** Menampung hingga 10 log riwayat pemicu aktuator di memori RAM saat offline dan mengirimkannya bertahap saat online.
  * **Tujuan:** Mencegah hilangnya data histori audit aktuator akibat putus sinyal Wi-Fi.

* **L-33: Dynamic NTP Clock Fallback (F-09)**
  * **Lokasi:** `esp32_firmware.ino`
  * **Aturan:** Jika waktu NTP gagal sinkron, fungsi jam mengembalikan `-1` dan mematikan aturan malam.
  * **Tujuan:** Mencegah kesalahan eksekusi logika malam di siang hari akibat jam acak default epoch 1970.

* **L-34: Dynamic Threshold Cloud Sync**
  * **Lokasi:** `esp32_firmware.ino`, `api.php`
  * **Aturan:** ESP32 menyinkronkan batas target suhu & RH terbaru dari endpoint `GET /api/thresholds/active` setiap 30 detik.
  * **Tujuan:** Perubahan fase budidaya di web dashboard langsung diterapkan ke mesin histeresis mikrokontroler.

---

## PILAR 2: Logika Manajemen Rantai Pasok (SCM) & WMS (16 Logika)

### Kelompok E: WMS & Penataan Kumbung Rak Dinamis (L-35 – L-40)

* **L-35: Batch Traceability Code Generator (`BL-YYYYMMDD-XXX`)**
  * **Lokasi:** `BaglogBatch.php` (`generateBatchCode()`)
  * **Aturan:** Menghasilkan kode batch unik berformat tanggal masuk WIB dan nomor urut 3 digit yang me-reset harian.
  * **Tujuan:** Menjamin silsilah dan ketertelusuran bibit/supplier untuk klaim mutu dan garansi.

* **L-36: Spasial 3D Grid Coordinate (Row-Bay-Tier)**
  * **Lokasi:** `Slot.php`, `KumbungGrid.tsx`, `SlotSeeder.php`
  * **Aturan:** Setiap slot memiliki koordinat diskrit: `Row` (Baris rak), `Bay` (Kolom lorong 01–10), dan `Tier` (Tingkat rak 01–10).
  * **Tujuan:** Memetakan posisi fisik baglog secara presisi untuk audit visual dan korelasi iklim vertikal.

* **L-37: Slot Collision Guard (Unique Occupancy)**
  * **Lokasi:** `BatchSlotAssignmentController.php`, `BatchSlotAssignment.php`
  * **Aturan:** Menolak penempatan batch baru pada slot yang statusnya masih `active` (terisi baglog yang belum selesai siklusnya).
  * **Tujuan:** Mencegah tumpang tindih alokasi fisik di dalam kumbung (*anti-double-booking*).

* **L-38: Dynamic Rack Capacity Expansion**
  * **Lokasi:** `SlotController.php` (`storeRack`), `RackManagementTest.php`
  * **Aturan:** Admin dapat menambah baris rak baru (misal Baris D, E) yang otomatis men-generate 100 slot baru (1.000 kapasitas baglog per rak).
  * **Tujuan:** Fleksibilitas skalabilitas gudang kumbung tanpa perlu modifikasi kode program.

* **L-39: Protected Rack Deletion**
  * **Lokasi:** `SlotController.php` (`destroyRack`)
  * **Aturan:** Rak dilarang dihapus jika terdapat minimal satu slot yang masih memiliki penugasan baglog aktif.
  * **Tujuan:** Integritas referensial data agar data batch dan panen tidak menjadi yatim piatu (*orphaned records*).

* **L-40: Dynamic Total Capacity Aggregator**
  * **Lokasi:** `DashboardService.php`, `BaglogManagement.tsx`
  * **Aturan:** Kapasitas total kumbung dihitung dinamis lewat `Slot::sum('max_capacity')` (bukan angka statis 3.000).
  * **Tujuan:** Menjaga akurasi persentase keterisian gudang (*occupancy rate*) secara real-time.

---

### Kelompok F: Pencatatan Panen & Siklus Flush (L-41 – L-44)

* **L-41: Multi-Flush Productivity Tracking (Siklus 1–7)**
  * **Lokasi:** `Harvest.php`, `StoreHarvestRequest.php`, `BatchSlotAssignment.php`
  * **Aturan:** Mencatat nomor flush panen (1 s.d. 7) dan mengklasifikasikan umur baglog:
    * Flush 1–4: *Prime Productive*
    * Flush 5: *Aging Warning* (Kuning)
    * Flush $\ge 6$: *Exhausted / Tua* (Merah)
  * **Tujuan:** Mengidentifikasi kurva degradasi nutrisi substrat baglog per siklus pemetikan.

* **L-42: Quality Grading Multi-Tier**
  * **Lokasi:** `Harvest.php`, `StoreHarvestRequest.php`
  * **Aturan:** Setiap panen diklasifikasikan ke Grade A (daun mekar tebal kenyal), Grade B (standar), atau Grade C (rusak/afkir).
  * **Tujuan:** Diferensiasi harga jual pasar dan analisis korelasi mutu jamur terhadap iklim mikro.

* **L-43: WMS Lifecycle Cycle Completion (`HABIS_PRODUKSI`)**
  * **Lokasi:** `BatchSlotAssignmentController.php`, `BaglogCullController.php`
  * **Aturan:** Saat siklus slot ditutup (`COMPLETED`), sisa baglog di slot otomatis dicatatkan ke jurnal afkir dengan alasan `HABIS_PRODUKSI` dalam satu transaksi database (`DB::transaction`).
  * **Tujuan:** Mengosongkan slot secara bersih tanpa menyisakan baglog fiktif (*zero ghost inventory*).

* **L-44: Non-Destructive Voiding Ledger Pattern**
  * **Lokasi:** `HarvestController.php`, `SaleController.php`, `BaglogCullController.php`
  * **Aturan:** Koreksi salah input tidak menggunakan perintah SQL `DELETE`, melainkan soft-void (`voided_at`, `void_reason`, `voided_by`).
  * **Tujuan:** Menjaga jejak audit (*audit trail*) dan kepatuhan akuntansi manajerial.

---

### Kelompok G: Inventori Penjualan & Finansial HPP (L-45 – L-47)

* **L-45: High-Precision Monetary Engine (`bcmath` / `DECIMAL`)**
  * **Lokasi:** `BaglogBatch.php`, `SaleService.php`, Migrations
  * **Aturan:** Semua perhitungan uang menggunakan pustaka `bcmath` dan kolom database `DECIMAL(15,2)`, bukan tipe data `FLOAT`.
  * **Tujuan:** Mencegah galat pembulatan fraksi sen/perak pada transaksi penjualan dan valuasi inventori.

* **L-46: Dynamic Cost of Goods Sold (HPP per Kg)**
  * **Lokasi:** `BaglogBatch.php` (`calculateHpp()`), `HppAnalysisCard.tsx`
  * **Aturan:** Menghitung biaya pokok produksi riil per kilogram jamur yang dipanen:
    $$\text{HPP/kg} = \frac{\text{Biaya Pembelian Bibit Batch} + \sum \text{Biaya Operasional (Listrik, Air, Harian)}}{\text{Total Berat Panen Valid (kg)}}$$
  * **Tujuan:** Menentukan batas bawah harga jual (*break-even floor price*) agar penjualan ke tengkulak tidak merugi.

* **L-47: Real-Time Sales Inventory Deduction**
  * **Lokasi:** `SaleService.php`, `SaleController.php`
  * **Aturan:** Transaksi penjualan otomatis memvalidasi ketersediaan stok panen siap jual dan memotong stok gudang.
  * **Tujuan:** Menjamin konsistensi stok fisik terhadap saldo sistem (*stock synchronization*).

---

### Kelompok H: KPI Agrikultur & Heatmap Dashboard (L-48 – L-50)

* **L-48: Heatmap Produktivitas Spasial 3D**
  * **Lokasi:** `SlotController.php` (`heatmap()`), `KumbungGrid.tsx`
  * **Aturan:** Menghitung intensitas warna (0.0 s.d. 1.0) berdasarkan rasio hasil panen slot terhadap panen tertinggi di kumbung:
    $$\text{Intensity} = \frac{\text{Total Panen Slot (kg)}}{\max(\text{Total Panen Kumbung (kg)})}$$
  * **Tujuan:** Deteksi visual zona kumbung yang mandul vs zona yang subur untuk evaluasi peletakan nozzle.

* **L-49: Biological Efficiency (BE %)**
  * **Lokasi:** `DashboardService.php`, `Dashboard.tsx`
  * **Aturan:** Mengukur efisiensi biologi konversi substrat menjadi tubuh buah jamur segar:
    $$\text{BE (\%)} = \frac{\text{Total Bobot Panen Basah (kg)}}{\text{Total Bobot Substrat Kering (kg)}} \times 100\%$$
  * **Tujuan:** Metrik agrikultur ilmiah penentu keberhasilan formulasi serbuk kayu dan bibit.

* **L-50: Mortality / Cull Rate Tracking**
  * **Lokasi:** `DashboardService.php`, `BaglogManagement.tsx`
  * **Aturan:** Menghitung rasio kematian baglog terhadap total populasi:
    $$\text{Cull Rate (\%)} = \frac{\sum \text{Kuantitas Afkir}}{\sum \text{Kuantitas Baglog Terdaftar}} \times 100\%$$
  * **Tujuan:** Mengukur efektivitas biosekuriti dan sterilisasi ruangan kumbung.

---

## Tabel Matriks Referensi Cepat (Cheat Sheet Skripsi)

| No | ID | Nama Logika | Ranah | Komponen Utama | Parameter Kunci |
|---|---|---|---|---|---|
| 1 | L-01 | Weighted Sensor Fusion | IoT | Sensor SHT30 | 35% Atas, 40% Tengah, 25% Bawah |
| 2 | L-02 | I2C Multiplexing | IoT | TCA9548A | Switch Kanal 0 $\to$ 1 $\to$ 2 (Addr 0x44) |
| 3 | L-03 | Stale Data Invalidation | IoT | Firmware / API | Expiry 15s, Fail-Soft fallback |
| 4 | L-04 | Measurement Clamping | IoT | Firmware | Limit fisik 0–60°C, 0–100% RH |
| 5 | L-05 | Tier 1 Misting Trigger | Misting | Pompa Diafragma | $RH < \text{rhTriggerLow}$ \| $T > \text{tempMax}$ |
| 6 | L-06 | Dynamic Stop Hysteresis | Misting | Firmware (F-12) | $\text{humMin} + \min(3.0, 0.5 \times \Delta RH)$ |
| 7 | L-07 | Tier 2 Pulse Misting | Misting | Pompa Diafragma | Pulsa 30s jika $\min(RH) < \text{humMin} - 10\%$ |
| 8 | L-08 | Fan-Misting Interlock | Misting | Firmware Guard | Misting dilarang saat Fan ON |
| 9 | L-09 | Night Misting Guard | Misting | Firmware (P2') | Jeda wajib minimal 600s di jam 17–06 WIB |
| 10 | L-10 | Critical Temp Misting Guard | Misting | Firmware (F-10b) | Tahan jika $\max(T) > \text{tempMax} + 4^\circ\text{C}$ (kecuali lockout) |
| 11 | L-11 | RH Saturation Guard (P3) | Misting | Firmware (P3) | Tahan di $\text{humMax}-3\%$, stop di $\text{humMax}-1\%$ |
| 12 | L-12 | Evaporation Cooldown | Misting | Pompa Guard | Kunci pompa 150s pasca-mati |
| 13 | L-13 | Emergency Safety Timeout | Misting | Pompa Guard | Cut-off paksa 90 detik |
| 14 | L-14 | Tier 1 Daytime Cooling | Fan | Exhaust Fan | ON: $T > \text{tempMax}$, OFF: $T \le \text{tempMax}-1.5$ |
| 15 | L-15 | Fan Utility Probe (P1) | Fan | Exhaust Fan | Uji 90s: harus turun $\ge 0.2^\circ\text{C}$, lockout 15m |
| 16 | L-16 | Cooling Max Timeout | Fan | Exhaust Fan | Batas maksimal 180s kontinu |
| 17 | L-17 | Cooling Cooldown | Fan | Exhaust Fan | Jeda anti-chatter 60s |
| 18 | L-18 | Safety Critical Override | Fan | Exhaust Fan (F-10)| Paksa ON jika $T > \text{tempMax} + 4^\circ\text{C}$ (tunduk lockout) |
| 19 | L-19 | Override Stop Hysteresis | Fan | Exhaust Fan | Stop: $\max(T) \le \text{crit}-1.0$ & $T_{\text{avg}} \le \text{tempMax}$ |
| 20 | L-20 | Vertical Homogenization | Fan | Exhaust Fan | Durasi 30s jika $|RH_A - RH_C| > 12\%$ |
| 21 | L-21 | Homogenization Cooldown | Fan | Exhaust Fan | Jeda relaksasi 900s (15 menit) |
| 22 | L-22 | Post-Misting Settling Delay| Fan | Exhaust Fan | Tahan fan 60s pasca-misting |
| 23 | L-23 | Night Transition Failsafe | Fan | Firmware (F-15b) | Reset timer transisi 17:00 WIB |
| 24 | L-24 | Night Over-Humidity Purge | Fan | Exhaust Fan | Aktif 300s jika malam $RH \ge 96\%$ |
| 25 | L-25 | Night Periodic CO2 Flush | Fan | Exhaust Fan | Aktif 300s tiap 60 menit (dilusi CO2 riil) |
| 26 | L-26 | Night Cross-Synchronizer | Fan | Firmware Guard | Reset jadwal flush jika baru purge |
| 27 | L-27 | Harvest Pause Mode | Failsafe | API & Firmware | Mode jeda panen manual maks 8 jam |
| 28 | L-28 | Fluid Dynamics on Pause | Failsafe | Actuators | Kipas & Pompa mati seketika $<8$ detik |
| 29 | L-29 | Instant-Read Resume | Failsafe | Firmware | Pembacaan seketika pasca-jeda panen |
| 30 | L-30 | Precharge Relay Safe Latch | Failsafe | Hardware (F-15d) | Pin HIGH sebelum OUTPUT saat boot |
| 31 | L-31 | Async WiFi Reconnect | Failsafe | Firmware (F-07) | Polling asinkron reconnect tiap 15s |
| 32 | L-32 | Circular RAM Log Buffer | Failsafe | Firmware (F-08) | Antrean 10 slot log offline di RAM |
| 33 | L-33 | Dynamic NTP Clock Fallback | Failsafe | Firmware (F-09) | Return -1 & disable night jika jam mati |
| 34 | L-34 | Cloud Threshold Sync | Failsafe | API Sync | Polling threshold tiap 30 detik |
| 35 | L-35 | Batch Code Generator | SCM | Laravel Model | `BL-YYYYMMDD-XXX` berbasis WIB |
| 36 | L-36 | 3D Grid Spatial Coord | WMS | Database / UI | Format Row-Bay-Tier (300 Slot) |
| 37 | L-37 | Slot Collision Guard | WMS | Controller | Larangan tumpang tindih slot aktif |
| 38 | L-38 | Dynamic Rack Expansion | WMS | Controller | Penambahan 100 slot per baris rak baru |
| 39 | L-39 | Protected Rack Deletion | WMS | Controller | Cegah hapus rak yang masih berisi baglog |
| 40 | L-40 | Dynamic Total Capacity | WMS | Service | Sum database kapasitas total kumbung |
| 41 | L-41 | Multi-Flush Tracking | SCM | Database / UI | Klasifikasi siklus petik Flush 1 s.d. 7 |
| 42 | L-42 | Multi-Tier Quality Grade | SCM | Database | Grade A, B, C |
| 43 | L-43 | WMS Lifecycle Completion | WMS | DB Transaction | Alasan `HABIS_PRODUKSI` auto-culls |
| 44 | L-44 | Non-Destructive Voiding | SCM | Soft-Void Ledger | Audit trail pembatalan mutasi |
| 45 | L-45 | Monetary Precision Engine | Finance | `bcmath` / Decimal | Anti-float rounding discrepancy |
| 46 | L-46 | Dynamic COGS / HPP | Finance | Service / Model | Biaya bibit + ops per kg panen |
| 47 | L-47 | Sales Stock Deduction | SCM | Sales Service | Pemotongan inventori panen otomatis |
| 48 | L-48 | Spatial 3D Heatmap | Analitik | API / UI | Rasio intensitas warna panen per slot |
| 49 | L-49 | Biological Efficiency (BE)| Analitik | Dashboard KPI | Bobot jamur / Bobot substrat (%) |
| 50 | L-50 | Mortality / Cull Rate | Analitik | Dashboard KPI | Total afkir / Total baglog (%) |

---