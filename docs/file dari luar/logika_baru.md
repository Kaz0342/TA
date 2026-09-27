# 🍄 Product Requirement Document (PRD) & Arsitektur Sistem: Smart Shroom SCM
**Dokumen Spesifikasi Teknis, Skema Database, & Logika Bisnis**

---

## 1. ARSITEKTUR SPASIAL (SISTEM GRID KUMBUNG 3D)
Sistem memisahkan entitas fisik (Kamar/Rak) dengan entitas dinamis (Baglog). Rak adalah koordinat statis yang tidak pernah berubah, sedangkan Batch Baglog adalah entitas "tamu" yang menyewa koordinat tersebut selama masa budidaya.

### A. Standar Penomoran Koordinat (Zero-Padded WMS)
Format baku yang digunakan adalah sistem koordinat Kartesius 3D: **[Row]-[Bay]-[Tier]**
*   **Row (Lorong/Rak):** A, B, C (Sumbu X - memanjang)
*   **Bay (Kolom Horizontal):** 01 s/d 10 (Sumbu Y - seksi rak)
*   **Tier (Tingkat Vertikal):** 01 s/d 10 (Sumbu Z - 01 di lantai dasar, 10 di dekat atap)
*   **Kapasitas Default:** 1 Kamar / Slot = Maksimal 10 Baglog.
*   *Contoh:* `B-05-03` berarti Rak B, Kolom 5, Tingkat 3.

### B. Relasi Database (Alokasi & Tagging per Kamar)
**Aturan Lapangan:** Tidak ada mutasi atau pemindahan fisik baglog antar rak. Jika tingkat pertumbuhan miselium berbeda dalam satu slot, sistem menggunakan aturan "Hukum Mayoritas" untuk mengubah status metadata slot tersebut.

```sql
-- Tabel Master Pengadaan (Level Batch 1500 Baglog)
CREATE TABLE batches (
    id VARCHAR(30) PRIMARY KEY,               -- Contoh: 'BL-20260926-001'
    supplier_name VARCHAR(100) NOT NULL,      -- Berguna untuk Evaluasi Vendor
    received_date DATE NOT NULL,
    total_quantity INT NOT NULL,              -- Contoh: 1500
    price_per_baglog DECIMAL(10, 2) NOT NULL, -- Modal awal per biji
    current_status ENUM('ACTIVE', 'COMPLETED') DEFAULT 'ACTIVE'
);

-- Tabel Pivot Alokasi (Level Kamar / 10 Baglog)
CREATE TABLE batch_slot_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id VARCHAR(30) NOT NULL,
    slot_code VARCHAR(10) NOT NULL,           -- Terhubung ke koordinat 'B-05-03'

    -- Metadata Level Slot (Diinput via Drag/Bulk Select saat barang turun dari pikap)
    initial_mycelium_stage ENUM('LEVEL_1', 'LEVEL_2', 'LEVEL_3') NOT NULL,
    current_status ENUM('INCUBATION', 'FRUITING', 'COMPLETED') DEFAULT 'INCUBATION',
    assigned_at DATE NOT NULL
);

```

---

## 2. MANAJEMEN SIKLUS BIOLOGIS & EVENT LEDGER

Karakteristik jamur kuping tidak menggunakan *decay curve* (kurva menurun dari awal), melainkan **Bell Curve (Kurva Lonceng)**. Masa keemasan berada di Flush 2 hingga Flush 5, dan dapat bertahan hingga 6–7 kali panen (durasi hidup 3,5 hingga 4 bulan).

### A. Pencatatan Kematian Baglog (Baglog Culls)

Kapasitas aktif sebuah slot tidak boleh di-edit secara manual. Pengurangan kapasitas wajib menggunakan pencatatan mutasi (*ledger*) untuk keperluan audit garansi ke *supplier* dan pelacakan pusat penyebaran wabah di dalam kumbung.

```sql
-- Tabel Mutasi Pengurangan Baglog
CREATE TABLE baglog_culls (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id VARCHAR(30) NOT NULL,
    slot_code VARCHAR(10) NOT NULL,
    cull_date DATE NOT NULL,
    quantity INT NOT NULL,                    -- Jumlah yang dibuang
    reason ENUM('TRICHODERMA', 'BUSUK_BASAH', 'HAMA', 'KERING', 'LAINNYA') NOT NULL
);

```

*Rumus Kalkulasi UI:* `Kapasitas Aktif Slot = 10 - SUM(quantity dari baglog_culls)`

### B. Tracking Multi-Flush & Analisis Panen

Pencatatan panen per koordinat digunakan untuk memetakan rak mana yang paling produktif (Heatmap Analitik).

```sql
CREATE TABLE harvest_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id VARCHAR(30) NOT NULL,
    slot_code VARCHAR(10) NOT NULL,
    harvest_date DATE NOT NULL,
    weight_kg DECIMAL(5, 2) NOT NULL,
    flush_number INT NOT NULL,             -- Indikator siklus panen ke-berapa
    quality_grade ENUM('A', 'B', 'REJECT') DEFAULT 'A'
);

```

### C. Visual Badge Status (UI Dashboard)

Penandaan umur baglog dihitung sejak **hari pertama masuk kumbung**, dipadukan dengan fase biologisnya:

1. **Abu-abu:** `● H+14 • Adaptasi / Inkubasi` $\rightarrow$ Misting wajib OFF.
2. **Hijau Emerald:** `● Hari ke-45 • Flush 2 (Aktif)` $\rightarrow$ Fase panen raya / *fruiting* optimal.
3. **Kuning/Amber:** `● Hari ke-95 • Flush 6 (Menurun)` $\rightarrow$ Alert *Lead Time* PO Baglog Baru.
4. **Merah:** `● 117 Hari • Tua (Afkir)` $\rightarrow$ Siklus selesai, slot siap dikosongkan.

---

## 3. IOT FAILSAFE LOGIC (MISTING & EXHAUST FAN)

Kontrol *hardware* jarak jauh untuk mematikan pompa secara manual wajib menggunakan algoritma interupsi berbasis *timer*, bukan *toggle switch* permanen untuk menghindari human error (lupa menyalakan kembali).

### A. Komunikasi Payload & Timer C++ (ESP32)

* **Web UI (Tombol Jeda):** Menampilkan preset durasi `[ 2 Jam ]`, `[ 4 Jam ]`, `[ 6 Jam ]`, `[ 8 Jam ]`. Server mengirim JSON durasi: `{"command": "PAUSE", "duration_seconds": 21600}`.
* **Tombol Interupsi:** Terdapat tombol `[ ⏹ Akhiri Jeda & Balik ke AUTO ]` jika panen selesai lebih cepat. Server mengirim: `{"command": "RESUME"}`.
* **Logika Mikrokontroler (ESP32):** Wajib menggunakan `millis()` (non-blocking timer). Jika waktu habis ATAU menerima *command* RESUME, ESP32 **otomatis** masuk mode AUTO dan langsung melakukan *instant-read* sensor DHT22 untuk menstabilkan kelembapan seketika.

### B. Fluid Dynamics (Hukum Sirkulasi Exhaust Fan)

Jika mode **Panen / Jeda Misting** diaktifkan (yang mengindikasikan pintu kumbung terbuka lebar), sistem otomasi wajib mematikan *Exhaust Fan*.

* *Justifikasi Fisika:* Mencegah *Short-Circuiting* sirkulasi udara. Kipas yang menyala saat pintu utama terbuka hanya akan menyedot udara dari pintu langsung ke kipas (jalur minim hambatan), sehingga udara gagal masuk ke sela-sela lorong baglog.

---

## 4. SISTEM KEUANGAN, PENJUALAN, & HPP DINAMIS

Modul Akuntansi Manajerial untuk memastikan sistem menghitung laba bersih operasional (Net Margin) secara presisi, memasukkan pengeluaran siluman ke dalam Harga Pokok Produksi (HPP).

### A. Alur Pool Stok (Inventory Gudang)

Data panen dari 150 koordinat rak diagregasi menjadi total *pool* stok per *batch*. Penjualan ke tengkulak akan memotong saldo total persediaan gudang gabungan ini, bukan memotong langsung dari koordinat rak spesifik.

### B. UI Modal Penjualan & Dynamic Ranking Pengepul

* **Quick Button Tengkulak:** Sistem tidak menampilkan *hardcode* nama. UI menarik data melalui *query ranking* berdasarkan frekuensi transaksi terbanyak agar *input* di lapangan lebih cepat.
```sql
SELECT buyer_name, COUNT(id) as freq 
FROM sales_transactions 
GROUP BY buyer_name 
ORDER BY freq DESC 
LIMIT 4;

```

* **Preset Harga Dinamis:** Menampilkan 5 opsi tombol harga (misal Rp 20k, Rp 22k) berdasarkan tren harga histori transaksi terakhir.
* **Kalkulasi Real-time:** Menampilkan `Estimasi Total Omzet: Rp X` yang terhitung otomatis saat kolom berat dan harga diisi untuk mencegah *fat-finger error*. Wajib menyediakan kolom `Catatan (Opsional)` untuk mendokumentasikan kualitas *grade* jamur atau metode pembayaran tempo.

### C. Kalkulasi HPP & Margin Bersih (CTE Query)

*Dashboard* keuangan mengevaluasi *Break Even Point* (BEP) dengan membandingkan Omzet vs (Modal Baglog + Biaya Operasional).

```sql
WITH Revenue AS (
    -- Total omzet penjualan per batch
    SELECT batch_id, SUM(total_amount) as total_omzet
    FROM sales_transactions
    GROUP BY batch_id
),
OpsCost AS (
    -- Total biaya token listrik, misting, alkohol, plastik per batch
    SELECT batch_id, SUM(amount) as total_ops
    FROM operational_expenses 
    GROUP BY batch_id
)
SELECT 
    b.id as batch_id,
    (b.total_quantity * b.price_per_baglog) as modal_baglog_awal,
    COALESCE(o.total_ops, 0) as biaya_operasional,
    COALESCE(r.total_omzet, 0) as omzet_kotor,

    -- Rumus Laba Bersih = Omzet - Modal Awal - Operasional Siluman
    (COALESCE(r.total_omzet, 0) - (b.total_quantity * b.price_per_baglog) - COALESCE(o.total_ops, 0)) as laba_bersih_real

FROM batches b
LEFT JOIN Revenue r ON b.id = r.batch_id
LEFT JOIN OpsCost o ON b.id = o.batch_id;
```
