# PANDUAN LENGKAP IMPORT ASET KE GOOGLE STITCH

Folder ini berisi 12 tangkapan layar HD beresolusi tinggi yang mencakup **seluruh halaman (atas & bawah/scrolled)** serta **seluruh pop-up modal input formulir** dari aplikasi **Smart Shroom SCM**. Semua file siap di-**Drag and Drop** langsung ke kanvas **Google Stitch** (https://stitch.withgoogle.com/).

---

## 📂 Daftar 12 Aset Tangkapan Layar (Lengkap):

### 1. 🔐 Autentikasi
* `01_login_page.png`
  * Layar Login Neubrutalism dengan pemilih cepat Akun Demo (Admin & Operator) dan tombol submit tebal.

### 2. 📊 Halaman Dashboard (Monitoring & IoT)
* `02a_dashboard_atas.png`
  * Bagian atas: Status fase aktif (*Fruiting Phase*), 4 Kartu Metrik Iklim (Suhu Kumbung, Kelembaban Kumbung, Suhu Lingkungan, Kelembaban Lingkungan), serta 2 grafik riwayat iklim 6 jam terakhir.
* `02b_dashboard_grafik_panen.png`
  * Bagian tengah: Bar chart tren hasil panen 14 hari terakhir (total kg) dan kartu ringkasan Panen Hari Ini.
* `02c_dashboard_bawah_aktuator.png`
  * Bagian bawah: Tabel batch baglog aktif di kumbung dan panel log aktivitas aktuator otomatis (Misting Pump & Exhaust Fan).

### 3. 🍄 Halaman Batch Baglog
* `03a_baglog_tabel.png`
  * Halaman tabel daftar batch baglog, filter status inkubasi/produksi, dan indikator persentase miselium.
* `03b_baglog_modal_tambah.png`
  * **Pop-Up Modal Input**: Formulir modal "Tambah Batch Baru" (Kode Batch, Jumlah Baglog, Tanggal Inokulasi, Jenis Jamur, Lokasi Rak, Catatan).

### 4. 🧺 Halaman Rekap & Riwayat Panen
* `04a_panen_tabel.png`
  * Tabel riwayat panen harian, rincian per batch, dan kartu ringkasan panen.
* `04b_panen_modal_catat.png`
  * **Pop-Up Modal Input**: Formulir modal "Catat Hasil Panen" (Pilihan Batch Aktif, Tanggal Panen, Berat Total KG, Grade Kualitas Jamur A/B/C, Catatan).

### 5. 💰 Halaman Penjualan & Keuangan
* `05a_penjualan_tabel.png`
  * Tabel transaksi penjualan jamur, status pembayaran, dan kartu kalkulator "Cuan Mingguan".
* `05b_penjualan_modal_input.png`
  * **Pop-Up Modal Input**: Formulir modal "Input Penjualan Jamur" (Nama Pembeli/Mitra, Jumlah KG, Harga Satuan, Metode Pembayaran Cash/Transfer, Tanggal Transaksi).

### 6. ⚙️ Halaman Pengaturan Iklim & Preset
* `06a_pengaturan_preset_fase.png`
  * Bagian atas: 3 Kartu Preset Fase Pertumbuhan Jamur 1-Klik (*Inkubasi*, *Pinhead Initiation*, *Fruiting Body*).
* `06b_pengaturan_threshold_manual.png`
  * Bagian bawah: Formulir konfigurasi manual ambang batas suhu (°C) dan kelembaban (%), rentang misting & exhaust fan, serta tombol aksi "Simpan Konfigurasi".

---

## 🚀 Cara Pakai di Google Stitch:
1. Buka browser dan kunjungi **https://stitch.withgoogle.com/**.
2. Buat proyek baru (*New Project*).
3. Buka folder ini di Windows Explorer:
   `d:\DevTools\Antigravity\Projects\TA_vio\stitch_assets\`
4. **Pilih (Ctrl+A) semua file gambar PNG di atas, lalu Drag and Drop langsung ke dalam kanvas Stitch!**
5. Google Stitch (didukung multimodal Gemini) akan membaca seluruh layar dan pop-up modal, lalu mengubahnya menjadi wireframe/artboard interaktif.
6. Kamu bisa langsung menghubungkan tombol (misal tombol *+ Tambah Batch*) ke layar pop-up modal (`03b_baglog_modal_tambah.png`) untuk membuat alur prototype interaktif yang nyata!

---

## 🎨 Prompt Pendamping untuk Google Stitch:
Ketik atau tempelkan prompt ini di chat AI Google Stitch jika ingin menyelaraskan desain dan interaksi:

```text
Create a comprehensive, production-ready Neubrutalism design system for "Smart Shroom SCM" (Mushroom Farm IoT & SCM Web App).
Style Guide:
- Clean white background (#FFFFFF) with high contrast.
- Thick solid black borders (border: 3px or 4px solid #000000).
- Hard offset drop shadows with zero blur (box-shadow: 4px 4px 0px #000000, active/hover translate effect).
- Vibrant accent palette: Mint Green (#28e085), Energetic Amber/Yellow (#f59e0b), Ocean Cyan (#0ea5e9), Coral Red (#ef4444).
- Bold uppercase sans-serif headers (font: Plus Jakarta Sans / Inter).

Wireframe Flows to generate:
1. Main Monitoring Dashboard with scrollable sensor charts, 14-day harvest bar graphs, and actuator status feeds.
2. Interactive Modal Overlays for "Tambah Batch Baglog", "Catat Hasil Panen", and "Input Penjualan".
3. Growth Phase Preset Selector with 1-click active state toggles in Settings.
```
