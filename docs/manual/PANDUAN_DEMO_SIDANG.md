# 🎯 PANDUAN TAKTIS & CHEATSHEET DEMO SIDANG TUGAS AKHIR (5 MENIT)
## Sistem Informasi Smart Shroom SCM & Otomasi Mikroklimat Kumbung Jamur
**Penyusun:** Benedict Saviola Pradana (NIM: 231712243)  
**Target:** Pegangan Demonstrasi Software di Depan Dosen Pembimbing & Penguji  
**Durasi Alokasi Demo:** 5 – 7 Menit  

---

## ⏱️ RANGKUMAN ALUR DEMO 5 MENIT

| Menit Ke- | Modul yang Didemokan | Antarmuka / Alat | Poin Kunci yang Wajib Diucapkan |
|:---:|:---|:---|:---|
| **00:00 – 01:30** | **Monitoring IoT & EWS** | Web Browser (`/`) | Fusi sensor vertikal 3 zona (anti bias termal atap), speedometer GPU 60 FPS, dan failsafe jeda panen (2 jam). |
| **01:30 – 02:45** | **WMS Spasial 3D (3.000 Baglog)** | Web Browser (`/kumbung`) | Pemisahan entitas batch vs slot fisik, kuota absolut 300 slot / 3.000 baglog, kolom tier sticky solid, dan heatmap panen. |
| **02:45 – 04:00** | **SCM Hulu: Supplier Scorecard** | VS Code (`api_demo_scm.http`) | Evaluasi bobot 4 kriteria (cacat tiba 35%, mortalitas 25%, panen 25%, HPP 15%) dan ranking supplier Grade A/B/C/D. |
| **04:00 – 05:15** | **SCM Tengah: DSS Restock Advisor** | VS Code (`api_demo_scm.http`) | Proyeksi pelepasan rak 14–30 hari dan kalkulasi reorder otomatis yang mencegah kumbung overload di atas 3.000 baglog. |
| **05:15 – 06:30** | **SCM Hilir: Dual Traceability** | VS Code (`api_demo_scm.http`) | Pelacakan rantai pasok dua arah: dari kode batch ke pelanggan restoran, dan dari nota invoice balik ke supplier bibit. |

---

## 🛠️ PERSIAPAN SEBELUM MASUK RUANG SIDANG

1. **Terminal 1 (Backend Laravel):**
   ```bash
   cd backend
   php artisan serve
   ```
2. **Terminal 2 (Frontend React):**
   ```bash
   cd frontend
   npm run dev
   ```
3. **Buka Web Browser:**
   - Akses `http://localhost:5173/login`.
   - Login dengan: `admin@smartshroom.test` / `password123`.
4. **Buka VS Code:**
   - Buka file [`docs/manual/api_demo_scm.http`](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/manual/api_demo_scm.http).
   - Pastikan ekstensi **REST Client** aktif (muncul teks kecil `Send Request` di atas baris POST/GET).

---

## 📋 SKENARIO KLIK & NARASI DEMO LANGKAH DEMI LANGKAH

### BABAK 1: Dashboard Monitoring & Integrasi IoT (Menit 00:00 – 01:30)
1. **Buka halaman Beranda (`/`):**
   - *Tindakan:* Arahkan kursor ke jarum speedometer suhu dan kelembapan.
   - *Narasi ke Penguji:*
     > *"Selamat pagi Bapak/Ibu Dewan Penguji. Sistem Smart Shroom SCM memantau iklim mikro kumbung jamur kuping secara real-time. Data ini bukan hasil dummy sensor tunggal, melainkan fusi rata-rata tertimbang dari 3 titik vertikal (atas, tengah, bawah) menggunakan sensor industri SHT31 IP68 untuk mengeliminasi bias panas atap."*
2. **Tunjukkan Mode Jeda Panen (*Harvest Pause Mode*):**
   - *Tindakan:* Tunjukkan tombol preset `[ 2 Jam ]` pada widget jeda panen.
   - *Narasi ke Penguji:*
     > *"Sistem dilengkapi fitur keselamatan fluida: saat buruh tani memanen jamur subuh, mereka mengaktifkan mode jeda 2 jam. Pompa misting dan exhaust fan otomatis ditahan mati agar pekerja tidak tersiram air bertekanan tinggi saat memetik."*

---

### BABAK 2: WMS Spasial 3D & Kapasitas 3.000 Baglog (Menit 01:30 – 02:45)
1. **Klik Menu "Rak Kumbung" (`/kumbung`):**
   - *Tindakan:* Tunjukkan denah grid Rak A, B, dan C. Klik tombol **Peta Panen** (Heatmap hijau).
   - *Narasi ke Penguji:*
     > *"Secara fisik, kumbung mitra memiliki kapasitas maksimal 3.000 baglog yang terbagi dalam Rak A, B, dan C dengan 300 slot koordinat kamar. Desain database kami secara ketat memisahkan entitas fisik `slots` dari media tanam `baglog_batches`. Melalui fitur Heatmap Panen ini, pemilik kumbung langsung mengetahui slot rak mana yang paling produktif."*
2. **Jelaskan Integritas Audit Trail Non-Destruktif:**
   - *Narasi ke Penguji:*
     > *"Seluruh transaksi salah input—baik panen, afkir, maupun biaya—tidak pernah dihapus fisik (`DELETE`), melainkan menggunakan mekanisme `voided_by` non-destruktif dengan kewajiban mengisi alasan pembatalan untuk menjaga integritas biosekuriti."*

---

### BABAK 3: SCM Hulu & Supplier Scorecard (Menit 02:45 – 04:00)
1. **Pindah Layar ke VS Code (`docs/manual/api_demo_scm.http`):**
   - *Tindakan:* Klik **Send Request** pada `0.1 Login Akun Admin` $\to$ token Sanctum otomatis tersimpan.
2. **Klik Send Request pada `1.3 Matriks Komparasi Kinerja Seluruh Pemasok`:**
   - *Tindakan:* Tunjukkan panel JSON di sebelah kanan.
   - *Narasi ke Penguji:*
     > *"Untuk sisi Supply Chain Management (SCM), sistem kami beroperasi dengan arsitektur modern API-First. Pada modul SCM Hulu, sistem secara otomatis mengevaluasi seluruh pemasok bibit melalui Supplier Scorecard berbobot: defect tiba 35%, mortalitas inkubasi 25%, produktivitas panen 25%, dan harga beli 15%. Sistem menghasilkan pemeringkatan Grade A, B, C, hingga D sehingga pemilik kumbung tahu supplier mana yang paling bermutu."*
3. **Klik Send Request pada `1.5 Input Pengadaan Batch dengan Cacat Kedatangan`:**
   - *Narasi ke Penguji:*
     > *"Saat bibit tiba dan ditemukan cacat, sistem mencatat `rejected_at_arrival`. 15 bibit rusak ini otomatis dipisahkan ke ledger afkir dan memotong kuota siap alokasi rak menjadi 485, mencegah bibit berjamur masuk ke kumbung."*

---

### BABAK 4: SCM Tengah — DSS Restock Advisor (Menit 04:00 – 05:15)
1. **Klik Send Request pada `2.3 Rekomendasi Restock / Purchase Order Cerdas`:**
   - *Tindakan:* Sorot JSON bagian `recommended_order_date`, `recommended_quantity`, dan `recommended_supplier`.
   - *Narasi ke Penguji:*
     > *"Ini adalah modul Sistem Pendukung Keputusan (DSS) Restock Advisor kami. Sistem menghitung proyeksi pelepasan slot rak 14–30 hari ke depan berdasarkan baglog yang mendekati flush ke-7. Sistem merekomendasikan tanggal order mundur berdasarkan lead time supplier, merekomendasikan kuantitas optimal tanpa pernah melanggar batas kapasitas fisik 3.000 baglog, dan merekomendasikan supplier berperingkat Grade A."*

---

### BABAK 5: SCM Hilir — Ketertelusuran Dua Arah (Menit 05:15 – 06:30)
1. **Klik Send Request pada `3.4 Ketertelusuran Maju (Batch ke Pelanggan)`:**
   - *Narasi ke Penguji:*
     > *"Terakhir, sistem kami memiliki fitur End-to-End Traceability. Dari kode batch baglog, kami dapat melacak silsilah komoditas secara utuh: dari supplier mana bibit dibeli, ditempatkan di rak mana, tanggal berapa dipanen, hingga dijual ke pelanggan restoran mana saja."*
2. **Klik Send Request pada `3.5 Ketertelusuran Mundur (Nota ke Supplier)`:**
   - *Narasi ke Penguji:*
     > *"Begitu juga sebaliknya, dari nomor invoice penjualan, kami dapat menelusuri balik jamur tersebut berasal dari bibit supplier mana. Demikian demonstrasi sistem kami, terima kasih."*

---

## 🧠 CHEATSHEET JAWABAN CEPAT PERTANYAAN JEBAKAN PENGUJI

### Q1: "Kenapa DSS Restock Advisor kamu pakai model rolling capacity deterministik, bukan Machine Learning (LSTM / Random Forest)?"
> **Jawaban:**  
> *"Siklus budidaya jamur kuping memiliki batasan kapasitas fisik diskrit yang mutlak (maksimum 3.000 baglog) dan umur biologis panen berkala per kamar (flush 1–7 selama 120 hari). Menggunakan Machine Learning untuk kapasitas fisik 3.000 baglog adalah over-engineering dan rentan halusinasi data. Model rolling capacity forecast deterministik berbasis inventori spasial jauh lebih reliable, explainable, hemat komputasi, dan menjamin 100% kapasitas rak tidak pernah overload."*

### Q2: "Kenapa sistem ini Monolith Laravel, bukan Microservices?"
> **Jawaban:**  
> *"Kumbung mitra memiliki skala operasional satu unit usaha dengan beban transaksi puluhan transaksi per hari dan telemetri IoT 1 request per menit. Membagi sistem menjadi Microservices akan memicu network latency berlebih, overhead distributed transaction, dan biaya server cloud yang tidak realistis bagi UMKM. Arsitektur modular monolith Laravel dengan Repository & Service layer memberikan pemisahan logika yang bersih (*Separation of Concerns*), performa query sub-10ms, dan biaya pemeliharaan yang ekonomis."*

### Q3: "Kenapa alokasi HPP biaya operasional dihitung non-retroaktif?"
> **Jawaban:**  
> *"Secara prinsip akuntansi manajemen biaya, pengeluaran operasional (seperti listrik dan air misting) yang terjadi pada bulan Oktober hanya boleh dibebankan kepada batch baglog yang aktif di dalam kumbung pada bulan Oktober. Jika dihitung secara retroaktif ke seluruh batch sejak awal tahun, batch lama yang sudah selesai akan berubah HPP-nya secara tidak adil dan merusak laporan laba-rugi historis."*

### Q4: "Kenapa worker lapangan dilarang melakukan void data panen atau afkir?"
> **Jawaban:**  
> *"Demi penegakan biosekuriti dan integritas audit. Jika buruh lapangan memiliki izin membatalkan afkir, ada potensi manipulasi data baglog mati akibat hama atau penghilangan selisih timbangan panen. Hak pembatalan (*void*) dibatasi khusus Admin dengan kewajiban mencatat alasan audit minimal 5 karakter."*

