# PANDUAN IMPORT ASET KE GOOGLE STITCH

Folder ini berisi tangkapan layar HD dari seluruh layar aplikasi **Smart Shroom SCM** yang siap di-**Drag and Drop** langsung ke kanvas **Google Stitch** (https://stitch.withgoogle.com/).

---

## 📂 File yang Siap di-Drag & Drop:
1. `01_login_page.png` -> Halaman Login & Pemilihan Akun Demo
2. `02_dashboard_overview.png` -> Dashboard Utama (Indikator Fase, Kartu Sensor, Grafik 6 Jam, Log Aktuator)
3. `03_baglog_management.png` -> Halaman Manajemen Batch Baglog
4. `04_harvests_rekap.png` -> Halaman Rekap & Riwayat Panen
5. `05_sales_keuangan.png` -> Halaman Penjualan & Perhitungan Cuan Mingguan
6. `06_settings_phase_presets.png` -> Halaman Pengaturan Preset 1-Klik Fase Pertumbuhan Jamur

---

## 🚀 Cara Pakai di Google Stitch:
1. Buka browser dan pergi ke **https://stitch.withgoogle.com/**
2. Buat proyek baru (*New Project*).
3. Buka folder ini di Windows Explorer:
   `d:\DevTools\Antigravity\Projects\TA_vio\stitch_assets\`
4. **Pilih (blok) file gambar di atas, lalu tarik (Drag and Drop) langsung ke dalam kanvas Stitch!**
5. Google Stitch (didukung multimodal Gemini) akan memindai gambar dan otomatis mengubahnya menjadi elemen desain UI/frame yang bisa di-edit dan diatur alur interaksinya!

---

## 🎨 Prompt Pendamping untuk Google Stitch:
Ketik atau tempelkan prompt ini di kolom AI Google Stitch untuk menyempurnakan desain:

```text
Create a modern Neubrutalism web UI design for "Smart Shroom SCM" (Mushroom Farm IoT & SCM System).
Style: Pure white background, solid 4px black borders, hard offset black drop shadows (shadow: 4px 4px 0px #000000), bold uppercase sans-serif typography.
Color palette: Mint Green (#28e085), Sunny Yellow, Ocean Blue, Pure Black, and Pure White.
Include: Sidebar navigation (Dashboard, Baglogs, Harvests, Sales, Settings), top header with active growth phase badge pill ('🍄 FRUITING') and digital clock, 4 climate stat cards, 2 real-time 6-hour climate trend charts with green optimal target areas, active batch table, and actuator activity logs.
```
