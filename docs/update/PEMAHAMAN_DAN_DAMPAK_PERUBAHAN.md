# Pemahaman & Dampak Perubahan — Tindak Lanjut ANALISIS_SIMULATOR_DAN_AMPLOP_KUMBUNG.md

- **Disusun:** 8 Oktober 2026
- **Status:** Dokumen Sintesis & Kajian Arsitektur Sistem (Sebelum Eksekusi Kode)
- **Basis Analisis:** [ANALISIS_SIMULATOR_DAN_AMPLOP_KUMBUNG.md](ANALISIS_SIMULATOR_DAN_AMPLOP_KUMBUNG.md) (1.314 baris), `S1_ambient.patch`, `iot_simulator_S1.py`, `simulasi_amplop_kumbung.py`, `validasi_simulator_vs_iklim.py`.

---

## 1. Pemahaman Inti (Sintesis Anti-Gravity)

Simulator IoT lama (`iot_simulator.py`) selama ini berjalan di atas **"dunia fiktif"**:
1. **Kondisi Udara Luar (Ambient) Melenceng:** Parameter `AMBIENT_*` lama mengasumsikan suhu dan kelembapan konstan yang tidak sesuai dengan iklim riil Salam/Muntilan (Tmax simulator terlalu panas +2,9 K, RH harian terlalu basah +16%).
2. **Ketiadaan Fisika Bangunan (Amplop Kumbung):** Simulator tidak memiliki model atap, dinding, maupun massa termal baglog (3.000 baglog ≈ 11 MJ/K). Udara dalam kumbung hanya sekadar relaksasi mengikuti udara luar dengan jeda ~3 menit. Akibatnya, simulator tidak bisa membedakan performa atap asbes vs panel sandwich.
3. **Aktuator Tidak Realistis:** Debit ventilasi exhaust fan di kode simulator lama setara 144–288 pertukaran udara/jam (ACH), padahal spesifikasi exhaust fan 300 CFM di dunia nyata hanya setara ~4,2 ACH (selisih 35–69× lipat!). Misting juga tidak memiliki neraca massa air.
4. **Cacat Logika Kendali (Mirror ke Firmware ESP32):**
   * **Night Lockout:** Memblokir misting di malam hari (17:00–06:00 WIB) kecuali RH turun di bawah ambang darurat ekstrem (<70%). Akibatnya, kumbung mengalami kekeringan (RH < 85%) sepanjang malam.
   * **Fan vs Misting Interlock:** Saat siang terik, exhaust fan menyala terus-menerus dan mematikan misting via interlock, padahal udara luar lebih panas/kering dibanding udara dalam kumbung.
   * **Tier 1 Malam Mati Total:** Ambang darurat Tier 2 lebih longgar daripada syarat bypass night lockout, sehingga cabang Tier 1 malam tidak pernah dieksekusi.
   * **Safety Override Margin Kritis (2,0 K):** Nyaris sama dengan offset penempatan sensor A (+1,8 K), menyebabkan override darurat aktif prematur dan memotong timer normal.

---

## 2. Peta Dampak Perubahan: Apa yang Berubah Jika Diterapkan?

### A. Lapisan Simulator IoT (`iot_simulator.py`)
* **Input Iklim (Fase A - Patch S1):**
  * Suhu dan RH luar diturunkan secara termodinamika dari kurva diurnal dan titik embun (dew point) iklim normal bulanan Muntilan 1991–2020.
  * Hasil: Selisih Tmax turun jadi +0,4 K, RH rata-rata selisih hanya +0,2%, dan siklus hujan berganti secara jam-jaman (bukan tiap 45–360 detik).
* **Fisika Amplop Bangunan (Fase F):**
  * Menghitung transfer panas radiasi surya, konveksi dinding/atap, konduksi tanah, dan panas respirasi metabolik baglog (~0,10 W/kg).
  * Menghitung neraca air: penguapan nozzle, kondensasi atap dingin, dan pembuangan uap lewat kebocoran ventilasi.

### B. Lapisan Kontrol Firmware ESP32 (`esp32_firmware.ino`)
Perubahan logika (P1, P2/P2', P3) wajib disinkronkan ke mikrokontroler agar paritas simulasi dan lapangan tetap 1:1:
1. **P1 — Kipas Pendingin Berbasis Komparasi Suhu Luar:**
   * Kipas pendingin **hanya boleh aktif** jika udara luar lebih dingin minimal 1,0 K dibanding dalam kumbung (`T_outdoor < T_indoor - 1.0`). Jika luar lebih panas, kipas dilarang menyala untuk mendinginkan karena hanya akan menyedot udara panas ke dalam.
   * *Konsekuensi Hardware:* Memerlukan **+1 sensor suhu luar ruangan** (SHT30/DS18B20 di bawah naungan radiasi).
2. **P2 / P2' — Reformasi Night Lockout:**
   * Opsi aman (P2'): Night lockout diubah menjadi pembatas jeda siklus misting (minimal jeda 600 detik). RH malam terjaga di atas 85% tanpa risiko membasahi tubuh buah secara berlebihan.
3. **P3 — Pagar RH Maksimum untuk Misting:**
   * Misting yang dipicu oleh suhu tinggi wajib ditahan jika RH sudah mendekati batas atas (`hum >= humMax - 3.0`) dan dimatikan saat `hum >= humMax - 1.0` untuk mencegah penjenuhan/kondensasi berlebih.

### C. Lapisan Fisik & Konstruksi Kumbung (Rekomendasi Bertahap)
* **Atap:**
  * *Tahap 0 (Sekarang):* Asbes sementara dilapisi cat putih reflektif elastomeric (misal HeatGard/Reflecto) atau dipasang paranet 65% dengan celah ventilasi 20–30 cm di atasnya. Menurunkan suhu puncak sebesar −2,0 K s.d. −2,1 K.
  * *Tahap 1 (Upgrade Ekonomis):* Tambahkan lapisan double-sided bubble foil di bawah atap (celah udara). Menurunkan suhu puncak hingga −3,3 K.
  * *Tahap 2 (Jangka Panjang):* Ganti total asbes dengan Sandwich Panel PIR/PU/EPS 50 mm (menghilangkan risiko kesehatan serat asbes dan meredam panas hingga −3,5 K).
* **Dinding:**
  * Pertahankan anyaman bambu (gedek) di sisi luar, tetapi **lapisi plastik di sisi dalam** untuk menekan kebocoran udara dari 4–8 ACH menjadi ~1,5 ACH.
  * Dampak: Menurunkan konsumsi air kabut dan jam kerja pompa hingga 2×–4× lipat (penghematan air dari 84–167 L/hari menjadi 31–42 L/hari).
  * *Catatan Kritis:* Dinding yang sangat rapat menahan gas CO2 hasil respirasi jamur. Wajib disediakan jadwal pertukaran udara segar terkontrol atau integrasi sensor CO2.

### D. Dampak Terhadap Dashboard, Backend, dan Skripsi
1. **Konsistensi Telemetri:** Begitu patch diterapkan, data telemetri simulator yang dikirim ke database backend akan merefleksikan dinamika cuaca yang lebih ekstrem (siang lebih kering, malam lebih dingin). Evaluasi performa aktuator di Bab 4 skripsi akan jauh lebih valid dan dapat dipertanggungjawabkan secara ilmiah.
2. **Preset Suhu Budidaya:** Dokumen analisis mengungkap konflik antara target operasional dokumen (23–27 °C) dan literatur jamur kuping (20–28 °C). Target 23–27 °C menyebabkan malam hari di musim kemarau terlihat "gagal" padahal suhu 19–21 °C adalah kondisi normal dataran Salam/Jumoyo. Disarankan memakai 20–28 °C sebagai batas toleransi alarm.

---

## 3. Matriks Keputusan Sebelum Eksekusi

| Komponen | Status Saat Ini | Rencana Tindakan | Prioritas |
|---|---|---|---|
| `S1_ambient.patch` | Tersedia di `docs/update/` | Terapkan ke `iot_simulator.py` via `git apply` | **Paling Tinggi (Fase A)** |
| Hardware Shopping List | Belum memuat sensor outdoor | Tambahkan 1x Sensor Outdoor (SHT30 IP68) | Tinggi |
| Firmware Logic P1-P3 | Masih logika lama (v3.6) | Porting logika histeresis luar & jeda malam | Menengah (Fase E) |
| Simulasi Amplop (Fase F) | Terpisah di script mandiri | Integrasikan ke `iot_simulator.py` | Menengah-Lanjut |
