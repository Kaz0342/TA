# Panduan Hardware & Konsep Blackbox IoT (Smart Shroom)

Dokumen ini berisi daftar belanja (shopping list) komponen elektronik yang riil dan spesifik untuk kebutuhan perakitan alat IoT pada Tugas Akhir, beserta penjelasan konsep "Blackbox".

---

## 1. Master Checklist Belanja Hardware IoT (Kumbung 5×7×3,5 m)

> 📌 **Catatan:** Ini adalah **Daftar Belanja Tunggal (Single Source of Truth)** yang sudah mengintegrasikan 14 item keranjang asli lo + **ESP32 Terminal Expansion Board** + **TCA9548A Multiplexer** + **Seluruh Perintilan Kabel & Plumbing**. 
> Tidak perlu lagi melihat daftar lama atau memisah-misahkan tabel. Tinggal centang satu per satu saat checkout di marketplace.
> Rincian teknis perhitungan panjang dan wiring diagram lengkap mengacu ke [`rancangan_hardware_kumbung.md`](rancangan_hardware_kumbung.md).

---

### 📋 Tabel Master Belanja Komponen & Perintilan

| No | Kategori | Komponen / Item | Spesifikasi Wajib & Rekomendasi | Qty | Estimasi Harga | Fungsi & Catatan Perakitan Lapangan |
| :-: | :--- | :--- | :--- | :-: | :-: | :--- |
| **A** | **PEMROSESAN & KENDALI** | | | | | |
| 1 | Processing | **ESP32 DevKit V1** | 30-Pin, Wi-Fi + BLE, Dual Core | 1 Unit | Rp 65.000 | Otak edge compute & histeresis closed-loop. |
| 2 | Expansion | **ESP32 Terminal Shield Expansion Board** | Khusus ESP32 30-Pin dengan Screw Terminal | 1 Unit | Rp 30.000 | **Wajib!** Mengubah semua pin ESP32 jadi terminal baut agar kabel sensor & relay terkunci kokoh anti-goyang/lepas di kumbung. |
| 3 | I2C Hub | **Modul I2C Multiplexer TCA9548A** | 8-Channel I2C Switch, Default Addr 0x70 | 1 Unit | Rp 18.000 | **Wajib!** Memecah jalur I2C agar 3 sensor SHT30 dengan alamat sama (`0x44`) bisa dibaca bergantian tanpa collision. |
| 4 | Aktuator Driver | **Modul Relay 4-Channel 5V Optocoupler** | 5V Coil, Low-Level Trigger, Jumper JD-VCC | 1 Unit | Rp 35.000 | Saklar pompa 12V, solenoid 12V, fan 220V. *(Lepas jumper JD-VCC saat perakitan: VCC=3.3V ESP32, JD-VCC=5V LM2596)*. |
| **B** | **SENSING & MONITORING** | | | | | |
| 5 | Sensing | **Sensor SHT30 / SHT31 Probe IP68 Waterproof** | Varian **I2C (4-Kabel)**, Casing Probe Logam/Plastik Kisi-Kisi | **3 Unit** | Rp 285.000 *(3x @95rb)* | Pengukur Suhu & RH presisi untuk 3 zona (Atas 2.5m, Tengah 1.5m, Bawah 0.5m) mendukung *Weighted Sensor Fusion*. |
| **C** | **AKTUATOR & MISTING PLUMBING** | | | | | |
| 6 | Aktuator | **Pompa Diafragma High Pressure DC 12V** | 130–160 PSI (Otomatis Cut-Off / Pressure Switch) | 1 Unit | Rp 135.000 | Pendorong air bertekanan tinggi untuk 14 titik misting. |
| 7 | Aktuator | **Solenoid Valve Air 12V DC Drat 1/2"** | **Material Kuningan (Brass)**, Tipe NC (Normally Closed), Rating ≥ 10 Bar | 1 Unit | Rp 110.000 | Pemutus aliran air seketika (*anti-drip* agar nozzle tidak menetes saat pompa mati). *(Disarankan kuningan agar kuat nahan 130 PSI)*. |
| 8 | Aktuator | **Exhaust Fan Sirkulasi 10 Inch AC 220V** | Fan Dinding / Ventilasi Plafon, Kabel 3-Wire (L, N, PE) | 1 Unit | Rp 160.000 | Membuang udara panas plafon, pendinginan siang, & sirkulasi CO2 malam. |
| 9 | Misting | **Misting Nozzle Brass 0.3mm + Tee Slip Lock 6mm** | Lubang Nozzle Kuningan 0.3mm + Fitting Tee Quick Push-In 6mm | **16 Set** *(14 pasang + 2 cadangan)* | Rp 192.000 *(16x @12rb)* | Memecah air jadi kabut mikro di langit-langit (2 baris × 7 nozzle). |
| 10 | Misting | **Selang PU (Polyurethane) High Pressure 6mm** | Diameter Luar 6mm, Tekanan Kerja ≥ 10–12 Bar | 25 Meter | Rp 125.000 | Distribusi air bertekanan tinggi dari solenoid ke seluruh baris nozzle. |
| 11 | Filtrasi | **Housing Filter 10" + Cartridge Spun 1 µm** | Drat Inlet/Outlet 1/2" atau 3/4" + Spun PP 1 Mikron | 1 Set (+ 2 Cartridge Cadangan) | Rp 115.000 | Menyaring lumut dan endapan pasir di sisi hisap sebelum pompa agar nozzle 0.3mm tidak buntu. |
| **D** | **ELEKTRIKAL & CATU DAYA** | | | | | |
| 12 | Power Supply | **SMPS 12V 10A DC Metal Enclosure** | Input 220V AC, Output 12V DC 120 Watt Regulasi | 1 Unit | Rp 110.000 | Sumber daya utama pompa (4–5A peak), solenoid, dan sistem logika. |
| 13 | Step Down | **Modul Buck Converter LM2596 DC-DC** | Input 12V, Output Adjustable (Set ke 5.0V Presisi) | 2 Unit *(1 utama + 1 cadangan)* | Rp 30.000 | Menurunkan 12V jadi 5V bersih untuk VIN ESP32 dan koil relay. |
| 14 | Enclosure & MCB | **Box Panel Waterproof IP65 Outdoor + MCB 2A** | Box Panel Plastik ABS (Min. 300×200×130 mm) + MCB 1P 2A | 1 Unit | Rp 120.000 | Rumah seluruh kontroler, tahan percikan air/lembab. Box plastik agar sinyal Wi-Fi ESP32 tembus. |
| 15 | Jaringan | **Wi-Fi Range Extender 300 Mbps** | Colokan PLN, Frekuensi 2.4 GHz | 1 Unit | Rp 140.000 | Penguat sinyal Wi-Fi di luar kumbung agar telemetri ESP32 ke cloud lancar. |
| **E** | **PERINTILAN KABEL & KONEKTOR ELEKTRONIK** | | | | | |
| 16 | Kabel Sinyal | **Kabel UTP / FTP Cat5e Twisted-Pair** | 4-Pair AWG24 Tembaga Murni (Bukan 4-core sejajar) | 25 Meter | Rp 100.000 | Jalur data 3 sensor SHT30. Kabel twisted pair meminimalisir crosstalk & noise I2C jarak 7–8 meter. |
| 17 | Kabel Jumper | **Kabel Jumper Dupont Female-to-Female (20 cm)** | 1 Ribbon (Isi 40 Pin) | 1 Set | Rp 15.000 | **Wajib!** Menghubungkan pin modul TCA9548A ke ESP32 Terminal Shield dan relay. |
| 18 | Kabel Jumper | **Kabel Jumper Dupont Male-to-Female (20 cm)** | 1 Ribbon (Isi 40 Pin) | 1 Set | Rp 15.000 | Untuk cadangan sambungan testing/modul pendukung. |
| 19 | Kabel Daya DC | **Kabel Serabut 2 × 1.5 mm² (Merah-Hitam)** | Tembaga lentur untuk beban arus 12V DC | 6 Meter | Rp 50.000 | Jalur daya 12V dari SMPS/Relay ke Pompa Diafragma dan Solenoid Valve. |
| 20 | Kabel Daya AC | **Kabel Listrik NYYHY / NYM 3 × 1.5 mm²** | 3-Core (Fase Cokelat, Netral Biru, Ground Kuning-Hijau) | 10 Meter | Rp 90.000 | Jalur 220V dari MCB/Relay ke Exhaust Fan (Wajib pasang ground PE bodi fan). |
| 21 | Konduit | **Pipa Konduit Listrik PVC Ø 20 mm + Klem + Elbow** | Pipa pelindung kabel outdoor | 4–5 Batang | Rp 70.000 | Melindungi kabel dari gigitan tikus & tetesan air (buat 2 pipa terpisah: pipa sinyal & pipa 220V). |
| 22 | Cable Gland | **Cable Gland Waterproof PG9 / PG11** | Ulir drat + karet penjepit kabel | 8 Pcs | Rp 40.000 | Dipasang di bawah box panel IP65 agar lubang masuk kabel kedap air & rapi. |
| 23 | Terminal & Skun | **Terminal Blok Busbar / Konektor WAGO + Ferrule Bootlace** | Set skun jarum serabut kabel + konektor sambungan | 1 Set | Rp 65.000 | Merapikan ujung serabut kabel sebelum dibaut ke terminal shield & relay agar tidak mbrudul/konslet. |
| **F** | **PERINTILAN PLUMBING & ADAPTOR NOZZLE** | | | | | |
| 24 | Adaptor Solenoid | **Fitting Adaptor Drat Luar 1/2" Male ke Quick Slip-Lock 6mm** | Kuningan / Plastik Pneumatic Drat 1/2" to 6mm Tube | 2 Pcs | Rp 30.000 | **Wajib!** Menyambungkan selang PU 6mm ke lubang drat 1/2" inlet & outlet solenoid valve. |
| 25 | Adaptor Pompa | **Fitting Nepel Pompa Diafragma ke Quick Slip-Lock 6mm** | Sesuai tipe drat/ulir outlet pompa (biasanya drat 18mm atau 1/2") | 2 Pcs | Rp 30.000 | Menyambungkan outlet pompa bertekanan tinggi ke selang PU 6mm. |
| 26 | Selang Isap | **Selang Spiral Kawat Anyaman Transparan 1/2" + Klem Selang** | Diameter dalam 1/2", kaku tahan kempot hisapan | 1.5 Meter + 4 Klem | Rp 35.000 | Jalur hisap air dari Tandon → Housing Filter Sedimen → Inlet Pompa. |
| 27 | Splitter Misting | **Fitting Tee 6mm Polos (Tanpa Nozzle) + End Plug 6mm** | Quick Fitting Slip-Lock 6mm | 1 Pcs Tee + 2 Pcs Plug | Rp 15.000 | Tee untuk memecah 1 jalur utama menjadi 2 baris rak, dan End Plug untuk menutup ujung selang terakhir. |
| 28 | Sealtape | **Seal Tape Kran Putih (Teflon Tape)** | Panjang 10 meter | 2 Gulung | Rp 5.000 | Melapisi seluruh drat (solenoid, filter, pompa) agar 100% tidak ada rembesan air di 130 PSI. |
| 29 | Klip Gantung | **Klip Klem Selang 6mm / Cable Clamp R-Type** | Untuk memaku selang PU ke atap/tiang bambu | 40 Pcs | Rp 20.000 | Menjaga selang PU tetap lurus kencang dan tidak melendut kena gravitasi/tekanan air. |
| **G** | **KOMPONEN PROTEKSI ELEKTRONIK & ISOLASI** | | | | | |
| 30 | Pull-Up Resistor | **Resistor Metal Film 2.2 kΩ (1/4 Watt)** | Toleransi 1% | 10 Pcs | Rp 5.000 | Resistor pull-up jalur SDA dan SCL pada modul TCA9548A untuk kabel sensor panjang. |
| 31 | Dioda Flyback | **Dioda 1N5408 (3A) & 1N4007 (1A)** | Dioda penyearah silikon | Masing-masing 2 Pcs | Rp 5.000 | **Wajib proteksi!** 1N5408 dipasang paralel terbalik di kutub pompa 12V, 1N4007 di solenoid untuk meredam lonjakan induksi. |
| 32 | Snubber Fan | **RC Snubber (0.1 µF 400V X2 + 100 Ω 2W) / Metal Oxide Varistor (MOV)** | Peredam spark kontak relay AC 220V | 1 Unit | Rp 8.000 | Dipasang melintang di kontak relay fan agar ESP32 tidak restart saat kipas AC mati-nyala. |
| 33 | Kapasitor Filter | **Elco 1000 µF / 16V & Keramik 100 nF** | Kapasitor peredam ripple | 2 Pcs | Rp 5.000 | Menstabilkan tegangan 5V output LM2596 saat ESP32 aktif transmisi Wi-Fi. |
| 34 | Fuse DC | **Fuse Holder Inline Waterproof + Sekring Blade 10A** | Sekring otomotif 10A | 1 Set | Rp 15.000 | Proteksi konsleting jalur DC 12V langsung setelah SMPS. |
| 35 | Isolasi Kabel | **Heat Shrink Tube (Selongsong Bakar) Dual-Wall Berlem** | Diameter 4mm, 6mm, 8mm (ada lem perekat di dalam) | 1 Set | Rp 20.000 | **Wajib!** Membungkus sambungan kabel sensor SHT30 agar sambungan tembaga kedap air 100% dan anti-korosi. |
| 36 | Cable Ties | **Kabel Ties (Insulock) Hitam UV Resistant + Karet Peredam** | Panjang 20 cm & bantalan karet tebal | 1 Pak | Rp 25.000 | Mengikat kabel, sensor bracket, dan meredam getaran dudukan pompa diafragma. |

---

### 💰 Estimasi Total Anggaran Pembelian

| Kategori Pengeluaran | Estimasi Biaya |
| :--- | :--- |
| **Subtotal Komponen Utama (15 Item A–D)** | ± Rp 1.765.000 |
| **Subtotal Kabel, Konduit & Konektor (Item 16–23)** | ± Rp 445.000 |
| **Subtotal Fitting & Plumbing Misting (Item 24–29)** | ± Rp 135.000 |
| **Subtotal Proteksi Elektrikal & Isolasi (Item 30–36)** | ± Rp 83.000 |
| **TOTAL ESTIMASI KESELURUHAN (SIAP RAKIT LENGKAP)** | **± Rp 2.428.000** |

> 💡 **Opsi Keselamatan Ekstra (Sangat Direkomendasikan):**
> * Tambahkan **RCBO / ELCB 30mA (Rp 180.000)** di dalam box panel sebelum MCB. Karena kumbung jamur memiliki kelembapan 90% dan terdapat air mengalir bersamaan dengan tegangan 220V AC, RCBO melindungi pekerja dari risiko sengatan listrik fatal jika terjadi kebocoran arus.

---

---

## 2. Penjelasan Konsep "Blackbox" IoT

Konsep **Blackbox** dalam IoT terinspirasi dari kotak hitam pesawat terbang: ia merekam seluruh aktivitas penerbangan secara lokal, sehingga jika pesawat jatuh (koneksi terputus), data historis tetap aman.

Dalam TA lu, Blackbox ini memecahkan masalah: **"Apa yang terjadi pada data jamur kalau Wi-Fi di kumbung mati seharian?"**

### 🧠 Cara Kerja Blackbox di ESP32

Sistem Blackbox ini memanfaatkan 3 komponen utama:
1. **ESP32 (Prosesor & Memori Flash)**
2. **RTC DS3231 (Penjaga Waktu)**
3. **SPIFFS / LittleFS (Sistem File internal ESP32)**

**Alur Logikanya (State Machine):**

1. **Reading & Timestaping (Baca & Catat Waktu):**
   Setiap 5 menit, ESP32 membaca sensor SHT30 IP68, BH1750, dan MQ-135. Alih-alih langsung dikirim ke internet, ESP32 *nanya* ke modul RTC DS3231: *"Sekarang jam berapa?"*.
   
2. **Writing to Blackbox (Rekam Lokal):**
   ESP32 menggabungkan data sensor dan waktu menjadi format JSON, lalu menyimpannya (append) ke dalam file teks (misal: `datalog.txt`) yang ada di dalam *Flash Memory* ESP32 (SPIFFS). Ini adalah proses "Perekaman Blackbox".

3. **Transmission Attempt (Coba Kirim):**
   ESP32 mencoba melakukan koneksi ke Wi-Fi dan HTTP POST ke backend Laravel (Dashboard).
   
   *   **Skenario A (Wi-Fi Lancar):** Data terkirim, server merespons HTTP `201 Created`. ESP32 kemudian menghapus data tersebut dari `datalog.txt` karena sudah aman di server.
   *   **Skenario B (Wi-Fi Mati/RTO):** Pengiriman gagal. ESP32 *TIDAK* panik. Dia membiarkan data tersebut tertinggal di `datalog.txt` dan kembali tidur (Deep Sleep).

4. **Syncing / Bulk Upload (Sinkronisasi Masal):**
   Katakanlah Wi-Fi mati selama 3 jam (berarti ada 36 baris data ngantre di `datalog.txt`). Begitu Wi-Fi kembali normal, ESP32 menyadari ada tumpukan data di Blackbox. ESP32 akan membaca file tersebut, dan menembakkan semuanya ke server satu per satu. 

### 💡 Kenapa Konsep Ini Sangat Kuat untuk Sidang TA?
*   Menunjukkan bahwa sistem lu **Toleran terhadap Kesalahan (Fault-Tolerant)**.
*   Data lingkungan kumbung yang sangat krusial (suhu/kelembapan) **tidak pernah bolong (missing data)** di grafik Dashboard.
*   Lu mempraktikkan konsep *Edge Computing* murni, di mana perangkat ujung (ESP32) punya kecerdasan dan media penyimpanannya sendiri.
