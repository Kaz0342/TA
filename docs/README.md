# 🍄 Portal Dokumentasi Resmi: Smart Shroom SCM

Selamat datang di repositori dokumentasi **Smart Shroom SCM** (*Sistem Informasi Supply Chain Management dan Spasial WMS pada Kumbung Jamur Terintegrasi dengan Otomasi dan Monitoring Mikroklimat IoT*).

Dokumentasi proyek ini dikelola secara modular, terstruktur, dan bebas dari redundansi (*Zero-Bloat Engineering Standard*). Seluruh berkas di bawah ini merupakan **dokumen hidup (living documents) yang paling mutakhir (up-to-date)** dan menjadi pondasi utama perancangan serta implementasi sistem.

---

## 📂 Struktur & Indeks Direktori Dokumentasi

```
docs/
├── 📁 arsitektur/         # Pemodelan sistem, kebutuhan sistem, alur data & basis data
├── 📁 teknis-iot/         # Hardware as-built, wiring, belanja, fisika & termodinamika
├── 📁 logika-bisnis/      # Master katalog 55 logika sistem, WMS, SCM & otomasi aktuator
├── 📁 ui-ux/              # Panduan desain antarmuka, design tokens & dokumentasi modul
├── 📁 riwayat-pengujian/  # Matriks pengujian, rekam jejak logic hardening & telemetri empiris
└── 📁 manual/             # Buku manual panduan pengguna siap cetak (HTML & Markdown)
```

---

### 1. 📐 [Arsitektur & Pemodelan Sistem](arsitektur/)
Berkas perancangan rekayasa perangkat lunak dan arsitektur data:
* **[PRD.md](arsitektur/PRD.md)** — *Product Requirements Document*: Spesifikasi kebutuhan produk, problem statement, metrik keberhasilan, dan batasan sistem.
* **[erd.md](arsitektur/erd.md)** — *Entity Relationship Diagram*: Desain basis data normalisasi 3NF, kamus data lengkap, indexing strategy, dan ledger imutabel.
* **[dfd.md](arsitektur/dfd.md)** — *Data Flow Diagram*: Diagram konteks (Level 0), Level 1, Level 2, dan kamus aliran data REST API.
* **[use_case.md](arsitektur/use_case.md)** — *Use Case Specification*: Spesifikasi 34 Use Case fungsional beserta matriks kontrol akses (RBAC Admin vs Worker).
* **[sequence_diagram.md](arsitektur/sequence_diagram.md)** — *Sequence Diagram UML*: Alur interaksi aktor, frontend, backend API, dan database untuk skenario inti.
* **[iot-architecture.md](arsitektur/iot-architecture.md)** — *IoT Architecture & Data Flow*: Spesifikasi komunikasi edge ESP32, kontrak JSON telemetry, dan sinkronisasi jeda panen.

---

### 2. ⚡ [Perangkat Keras & IoT](teknis-iot/)
Spesifikasi teknis instalasi fisik, elektronika, dan termodinamika kumbung:
* **[hardware-shopping-list.md](teknis-iot/hardware-shopping-list.md)** — *Master Belanja Hardware IoT*: **Single Source of Truth** daftar pengadaan komponen, koreksi anggaran, integrasi item instalasi (T1–T10), dan strategi belanja bertahap 3 gelombang.
* **[rancangan_hardware_kumbung.md](teknis-iot/rancangan_hardware_kumbung.md)** — *Rancangan Fisik As-Built*: Layout fisik kumbung 7×5m (122,5 m³ tanpa plafon), denah perpipaan misting 14 nozzle, jalur kabel FTP Cat5e, dan skema daya SMPS/RCBO.
* **[penempatan_sensor.md](teknis-iot/penempatan_sensor.md)** — *Penempatan Sensor 3-Zona*: Formasi segitiga diagonal sensor SHT30 IP68, eliminasi bias termal vertikal (*stack effect*), dan formula *Weighted Sensor Fusion*.
* **[EVALUASI_TERMODINAMIKA_DAN_DEADLOCK_IOT.md](teknis-iot/EVALUASI_TERMODINAMIKA_DAN_DEADLOCK_IOT.md)** — *Evaluasi Fisika Lingkungan*: Analisis termodinamika amplop kumbung, safety override Tier-2, pencegahan deadlock algoritma probe kipas siang, dan kalkulasi pertukaran udara (ACH).
* **[PEGANGAN_TEKNIS_DAN_DEFENSE_PROYEK.md](teknis-iot/PEGANGAN_TEKNIS_DAN_DEFENSE_PROYEK.md)** — *Pedoman Teknis & Defense Proyek*: Rujukan ilmiah pendinginan pasif (bubble foil celah udara), biologi jamur kuping (*Trichoderma*, lalat jamur), dan drainase $\text{CO}_2$ gravitasi.

---

### 3. 🧠 [Logika Bisnis & Kendali Aktuator](logika-bisnis/)
Katalog aturan sistem, otomasi mikroklimat, dan manajemen pergudangan (WMS/SCM):
* **[KATALOG_LENGKAP_LOGIKA_SISTEM.md](logika-bisnis/KATALOG_LENGKAP_LOGIKA_SISTEM.md)** — **Master Logic Catalog (SSOT)**: 55 aturan logika sistem lengkap (34 aturan otomasi IoT & mikroklimat + 21 aturan SCM, WMS, dan finansial HPP).
* **[logika_aktuator.md](logika-bisnis/logika_aktuator.md)** — *Logika Kendali Aktuator*: Algoritma histeresis misting/fan, cooldown guard, night lockout, dan arsitektur pertahanan iklim P1–P3.
* **[AUDIT_WMS_SCM.md](logika-bisnis/AUDIT_WMS_SCM.md)** — *Laporan Audit Komprehensif WMS & SCM*: Hasil audit menyeluruh kepatuhan alokasi slot 3D, siklus hidup batch baglog, dan rekonsiliasi data panen/penjualan.
* **[IMPLEMENTATION_PLAN_WMS_SCM.md](logika-bisnis/IMPLEMENTATION_PLAN_WMS_SCM.md)** — *Rencana Aksi & Remediasi WMS*: Matriks perbaikan teknis penguatan integritas data WMS/SCM.
* **[SANITY_CHECK_ANALISIS_WMS.md](logika-bisnis/SANITY_CHECK_ANALISIS_WMS.md)** — *Keputusan Pemilik Budidaya*: 5 pilar keputusan operasional pemilik kumbung terkait sistem batch, penimbangan, dan toleransi afkir.
* **[ANALISIS_ALUR_BAGLOG_WMS.md](logika-bisnis/ANALISIS_ALUR_BAGLOG_WMS.md)** — *Analisis Awal Siklus Hidup Baglog*: Dokumen audit baseline penelusuran siklus hidup baglog (W-01 s.d. W-17) dari registrasi hingga pelepasan slot.

---

### 4. 🎨 [Desain Antarmuka & Modul Aplikasi](ui-ux/)
Panduan tampilan pengguna (*Frontend*) dan dokumentasi fitur aplikasi:
* **[dashboard-documentation.md](ui-ux/dashboard-documentation.md)** — *Dokumentasi Sistem & Modul*: Penjelasan fungsi lengkap halaman Login, Dashboard EWS, Kumbung Grid 3D, Baglog Management, Harvests, Sales, dan Settings.
* **[frontend_guide.md](ui-ux/frontend_guide.md)** — *Frontend Design Guidelines*: Standar desain *Harmonious Modern Sage Green*, token warna Dark Mode, komponen animasi GPU, dan ergonomi mobile 2x2 grid.

---

### 5. 🛡️ [Pengujian & Jaminan Mutu](riwayat-pengujian/)
Verifikasi kualitas, pengujian otomatis, dan data telemetri empiris:
* **[ANALISIS_SIMULATOR_DAN_AMPLOP_KUMBUNG.md](riwayat-pengujian/ANALISIS_SIMULATOR_DAN_AMPLOP_KUMBUNG.md)** — *Analisis Simulator & Amplop Kumbung*: Pemodelan komprehensif termodinamika amplop kumbung 7x5m, simulasi variasi cuaca musiman (Juli & Oktober), evaluasi bahan atap/dinding, dan bukti matematis efektivitas logika v3.6.
* **[Matriks Pengujian & Verifikasi Mutu Sistem.md](riwayat-pengujian/Matriks%20Pengujian%20&%20Verifikasi%20Mutu%20Sistem.md)** — *Matriks Pengujian*: Rencana dan hasil pengujian fungsionalitas, skenario batas, dan penerimaan pengguna (UAT).
* **[laporan_logic_hardening.md](riwayat-pengujian/laporan_logic_hardening.md)** — *Laporan Akhir Logic Hardening*: Pembuktian resolusi 16 temuan kritis (F-01 s.d. F-16) dengan 141 automated unit/feature tests green 100%.
* **[RENCANA_PERBAIKAN_LOGIKA.md](riwayat-pengujian/RENCANA_PERBAIKAN_LOGIKA.md)** — *Dokumen Rencana Perbaikan Logika*: Analisis mendalam per temuan logika dan rencana mitigasi keamanan serta stabilitas aktuator.
* **[analisis_sensor_24jam.md](riwayat-pengujian/analisis_sensor_24jam.md)** — *Analisis Data Sensor 24 Jam Pertama*: Rekap data empiris 5.238 telemetri poin simulasi iklim untuk validasi histeresis 24 jam.

---

### 6. 📖 [Buku Manual Pengguna](manual/)
Panduan operasional sistem bagi pengguna akhir (*End-User Documentation*):
* **[MANUAL_BOOK.md](manual/MANUAL_BOOK.md)** — *Buku Manual Operasional (Markdown)*: Panduan langkah demi langkah penggunaan dashboard, penanganan panen, aktivasi jeda panen, dan kalibrasi parameter.
* **[MANUAL_BOOK.html](manual/MANUAL_BOOK.html)** — *Buku Manual Siap Cetak (HTML)*: Versi cetak rapi terformat CSS standar kertas A4 (`Ctrl+P` $\to$ Save as PDF).

---

## 🗑️ Berkas yang Dieliminasi (Arsip / Retired)
Demi menjaga integritas sistem dan mencegah salah paham teknis, berkas-berkas berikut telah dibersihkan secara permanen:
1. *rancangan_sistem_baru.md* — Draf lama usang (menyebut DHT22, humidifier, dan MQTT). Telah digantikan sepenuhnya oleh `docs/logika-bisnis/KATALOG_LENGKAP_LOGIKA_SISTEM.md` dan `docs/arsitektur/iot-architecture.md`.
2. *analisis_audit_logika.md* — Catatan interim awal sebelum logic hardening. Telah dirangkum tuntas dalam `docs/riwayat-pengujian/laporan_logic_hardening.md`.
3. *update/LIST_BELANJA_FINAL.md* — Telah dilebur dan disinkronkan ke dalam `docs/teknis-iot/hardware-shopping-list.md`.
4. *update/AuditProbeWmsTest.php* — Berkas probe pengujian observasional sementara (telah selesai masa pakainya).
