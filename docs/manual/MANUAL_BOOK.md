<div class="cover">

# BUKU MANUAL PENGGUNA

## Smart Shroom SCM

**Sistem Informasi Supply Chain Management dan Spasial WMS pada Kumbung Jamur Terintegrasi dengan Otomasi dan Monitoring Mikroklimat IoT**

Penulis: Benedictus Vio
Program Studi Sistem Informasi

Versi Manual: 1.0 · Oktober 2026
Versi Sistem: Dashboard Web + Firmware ESP32 v3.6

</div>

<div class="pagebreak"></div>

# Daftar Isi

1. Pengenalan Sistem
2. Persiapan dan Instalasi
3. Login dan Navigasi
4. Dashboard
5. Manajemen Baglog
6. Rak Kumbung (WMS Spasial)
7. Hasil Panen
8. Penjualan, Biaya, dan HPP (Admin)
9. Pengaturan
10. Cara Kerja Otomasi IoT
11. Prosedur Operasional Harian, Mingguan, dan Siklus
12. Penanganan Masalah (Troubleshooting)
13. Pertanyaan Umum (FAQ)
14. Glosarium
15. Lampiran A: Spesifikasi Lengkap Sistem
16. Lampiran B: Catatan Ketidaksesuaian Dokumen

<div class="pagebreak"></div>

# 1. Pengenalan Sistem

## 1.1 Apa itu Smart Shroom SCM?

Smart Shroom SCM adalah dashboard web untuk mengelola **kumbung (rumah) jamur tiram** dari ujung ke ujung:

- **Monitoring mikroklimat**: suhu dan kelembapan dibaca sensor ESP32 secara berkala.
- **Otomasi**: pompa misting dan exhaust fan menyala sendiri sesuai batas yang Anda atur.
- **Supply chain**: pembelian baglog, penempatan di rak, panen, afkir (cull), penjualan, sampai hitung HPP dan margin.
- **WMS spasial**: 300 slot rak dengan kode unik, jadi Anda tahu baglog batch mana ada di rak mana.

## 1.2 Peran Pengguna

| Peran | Jumlah maks. | Boleh melakukan |
|-------|--------------|-----------------|
| **Admin** | 1 | Semua fitur: atur threshold, buat batch baglog, alokasi rak, catat/hapus biaya operasional, catat/void penjualan, daftarkan akun worker |
| **Worker** | 5 | Lihat monitoring, lihat baglog, catat panen, catat afkir, void panen/afkir, jeda/lanjutkan otomasi saat panen, lihat rak |

Worker **tidak** melihat menu Penjualan & Cuan dan tidak bisa mengubah threshold.

## 1.3 Gambaran Alur Kerja

```
Beli baglog (Admin) → Alokasi ke slot rak (Admin) → Inkubasi
  → Fruiting (otomatis saat panen pertama) → Panen berulang (flush 1..7)
  → Tutup siklus (baglog habis/rusak) → Penjualan & HPP (Admin)
```

Sementara itu, ESP32 terus memantau iklim dan menyalakan misting/kipas tanpa Anda sentuh.

<div class="pagebreak"></div>

# 2. Persiapan dan Instalasi

> Bagian ini untuk orang yang memasang sistem. Pengguna harian cukup lanjut ke Bab 3.

## 2.1 Kebutuhan

| Komponen | Kebutuhan |
|----------|-----------|
| PHP | 8.3 atau lebih baru |
| Composer | Terpasang |
| Node.js dan npm | Node 20+ (diuji di Node 25, npm 11) |
| Database | SQLite (pengembangan) atau PostgreSQL/Supabase (produksi) |
| Perangkat keras | ESP32 dan sensor (lihat Lampiran A.3) |

## 2.2 Menjalankan Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=0.0.0.0 --port=8000
```

Perintah `--seed` mengisi data demo (akun, 5 batch baglog, data sensor 24 jam, panen dan penjualan 14 hari).

## 2.3 Menjalankan Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Buka `http://localhost:5173`. Alamat API diatur di `frontend/.env.local`:

```
VITE_API_URL=http://localhost:8000/api
```

## 2.4 Mengakses dari HP

1. Pastikan laptop server dan HP **berada di Wi-Fi yang sama**.
2. Jalankan server dengan opsi `--host 0.0.0.0` (seperti di atas).
3. Buka alamat `http://<IP-laptop>:5173` di HP, atau scan QR dari halaman `frontend/public/qr.html`.
4. Jika tidak terbuka, izinkan port 5173 dan 8000 di Windows Firewall.

## 2.5 Perintah Berguna

| Perintah | Fungsi |
|----------|--------|
| `php artisan test` | Menjalankan seluruh tes backend (168 tes, 591 assertion) |
| `php artisan migrate:fresh --seed` | Reset database dan isi data demo (**menghapus semua data**) |
| `npm run build` | Build frontend untuk produksi |
| `npm run lint` | Cek kualitas kode frontend |
| `npm run preview` | Pratinjau hasil build |

## 2.6 Memasang Firmware ESP32

1. Buka `esp32_firmware/esp32_firmware.ino` di Arduino IDE.
2. Isi **SSID Wi-Fi**, **password**, dan **alamat API server** di bagian konfigurasi atas file.
3. Pilih board *ESP32 Dev Module*, lalu unggah (Upload).
4. Buka Serial Monitor (115200 baud) untuk memastikan Wi-Fi tersambung dan data terkirim.
5. Layar LCD 16x2 akan menampilkan suhu/kelembapan jika perakitan benar.

> **Penting:** alamat API di firmware dan simulator pernah menunjuk ke `tugasakhir-lime.vercel.app`. Alamat itu saat ini tidak aktif (HTTP 402). Ganti ke alamat server Anda yang aktif.

<div class="pagebreak"></div>

# 3. Login dan Navigasi

## 3.1 Login

1. Buka alamat dashboard. Anda diarahkan ke halaman **Login**.
2. Isi **email** dan **password**. Ikon mata menampilkan/menyembunyikan password.
3. Tekan tombol masuk.

Tombol demo (Admin / Worker) di halaman login mengisi akun otomatis. Akun demo menggunakan password `password123`.

| Akun | Email |
|------|-------|
| Admin demo | `admin@smartshroom.com` |
| Worker demo | `worker@smartshroom.com` |

> Seeder database membuat akun `admin@smartshroom.test` dan `worker@smartshroom.test`. Lihat Lampiran B. **Ganti semua password demo sebelum dipakai sungguhan.**

Batas percobaan login: **15 kali per menit**. Lebih dari itu akan diblokir sementara.

## 3.2 Menu Utama

| Halaman | Alamat | Siapa |
|---------|--------|-------|
| Dashboard | `/` | Semua |
| Manajemen Baglog | `/baglogs` | Semua |
| Rak Kumbung | `/kumbung` | Semua |
| Hasil Panen | `/harvests` | Semua |
| Penjualan & Cuan | `/sales` | **Admin** |
| Pengaturan | `/settings` | Semua (simpan threshold hanya Admin) |

## 3.3 Tampilan Desktop dan HP

- **Desktop**: menu berada di sisi layar.
- **HP**: ada header atas berisi tombol tema (terang/gelap) dan tombol **Menu**. Menu membuka laci (drawer) berisi tautan halaman, kartu profil, tombol mode gelap/terang, dan **Keluar Akun**.

## 3.4 Tema

Terdapat dua tema: **Terang ("Clean Sage")** dan **Gelap ("Forest Emerald")**. Ganti lewat tombol tema atau halaman Pengaturan.

## 3.5 Keluar

Tekan **Keluar Akun**. Sesi (token Sanctum) dihapus dari server.

<div class="pagebreak"></div>

# 4. Dashboard

Dashboard adalah pusat pantauan. Dari atas ke bawah:

1. **Sapaan** "Welcome, {nama}!" dan **badge Fase** (Inkubasi/Primordia/Fruiting). Klik badge untuk membuka Pengaturan.
2. **Jam digital** (LiveClock).
3. **Banner peringatan "Peringatan Mikroklimat"** muncul saat suhu atau kelembapan di luar rentang. Pada malam hari muncul pesan bahwa misting ditahan.
4. **Empat kartu KPI**:

| Kartu | Isi |
|-------|-----|
| Suhu | Nilai terkini, indikator rentang aman, tren per jam |
| Kelembapan | Gauge animasi, tren per jam |
| Baglog Aktif | Jumlah baglog aktif dan persen isi (maks. 3000) |
| Panen Hari Ini | Total kg hari ini terhadap target 15 kg/hari |

5. **Widget Jeda Panen** (lihat 4.1).
6. **Grafik Riwayat Iklim**: tombol **Split/Mix**, rentang **6 jam / 12 jam / 24 jam / 7 hari**, pita zona aman, sumbu ganda suhu dan kelembapan.
7. **Status otomasi** dan **progres panen 7 hari**.

Data diperbarui otomatis berkala. Jika data sensor tidak masuk, lihat Bab 12.

## 4.1 Widget Jeda Panen (Mode Panen)

Saat Anda masuk kumbung untuk memanen, misting dan kipas sebaiknya dimatikan agar Anda tidak basah dan tidak terganggu.

1. Pilih durasi: **2, 4, 6, atau 8 jam**.
2. Otomasi ESP32 berhenti selama durasi itu.
3. Setelah selesai tekan **"Selesai Panen (Nyalakan Otomasi)"** untuk melanjutkan lebih awal.

Aturan: durasi maksimum **8 jam**, minimum 60 detik. ESP32 mengecek perintah ini tiap **8 detik**, jadi ada jeda singkat sebelum alat berhenti/menyala.

> Jangan lupa menekan "Selesai Panen". Jika lupa, otomasi baru menyala kembali saat durasi habis.

<div class="pagebreak"></div>

# 5. Manajemen Baglog

Halaman `/baglogs` mengelola **batch** baglog (satu pembelian = satu batch).

## 5.1 Melihat Batch

Daftar batch menampilkan kode, tanggal masuk, jumlah, pemasok, umur (hari), status, dan ringkasan HPP.

## 5.2 Menambah Batch (Admin)

1. Tekan tombol tambah batch.
2. Isi form:

| Kolom | Wajib | Aturan |
|-------|-------|--------|
| Tanggal masuk | Ya | Tanggal pembelian |
| Jumlah | Ya | Bilangan bulat, minimal 1 |
| Pemasok | Ya | Maks. 100 karakter |
| Harga per baglog | Tidak | Minimal 0 |
| Catatan | Tidak | Bebas |

3. Simpan. Kode batch dibuat otomatis: `BL-TTTTBBHH-XXX` (contoh `BL-20261004-001`).

## 5.3 Status Batch

| Status | Arti |
|--------|------|
| `active` | Sedang dipakai/produktif |
| `contaminated` | Terkontaminasi |
| `disposed` | Dibuang |
| `completed` | Selesai (otomatis saat semua penempatan selesai) |

Ubah status lewat aksi di baris batch.

## 5.4 Umur dan Siklus

- Siklus standar: **120 hari**.
- Fase umur: inkubasi sampai ±35 hari, produktif sampai ±110 hari, akhir sekitar 130 hari.
- Maksimal **7 flush** (panen) per baglog.

## 5.5 Ringkasan HPP

Lihat Bab 8.4. Ringkasan HPP per batch juga tersedia dari halaman ini.

<div class="pagebreak"></div>

# 6. Rak Kumbung (WMS Spasial)

Halaman `/kumbung` menampilkan denah fisik rak.

## 6.1 Struktur Rak

- **Rak default: A, B, C** (dan dapat diperluas dengan Rak D, E, dst. lewat tombol `+ Tambah Rak`).
- Tiap rak memiliki dimensi standar seragam: **10 bay (01-10)** dan **10 tingkat (01-10)** = **100 slot per rak**.
- Kapasitas standar: **10 baglog per slot** (1.000 baglog per rak).
- Kode slot: `RAK-BAY-TINGKAT`, contoh **`A-01-01`**, **`D-05-10`**.

### 6.1.1 Menambah & Mengelola Rak (Admin)

1. Tekan tombol **"+ Tambah Rak"** di samping deretan tombol pilihan rak.
2. Sistem akan menyarankan huruf alfabet berikutnya (contoh: **Rak D** jika A, B, dan C sudah ada).
3. Anda dapat langsung menekan **"Buat Rak"** atau mengubah huruf rak (A-Z).
4. Sistem otomatis membuat **100 slot koordinat baru** dengan konfigurasi 10 bay × 10 tier dan kapasitas 1.000 baglog.
5. **Menghapus Rak:** Khusus rak yang seluruh slotnya masih kosong dan belum pernah memiliki catatan alokasi/panen, Admin dapat menghapusnya melalui modal Kelola Rak.

## 6.2 Mode Tampilan

| Mode | Fungsi |
|------|--------|
| **Grid Fisik** | Denah slot dan isinya |
| **Peta Panen** | Heatmap hasil panen: hijau muda (rendah), hijau (sedang), kuning/amber (tinggi), tampil dalam kg |

Filter: **Semua**, **Terisi**, **Kosong**.

Di HP tersedia **Bay Inspector**: carousel BAY 01-10, menampilkan isi `x/10` dan tingkat dari T-10 sampai T-01.

## 6.3 Mengalokasikan Baglog ke Slot (Admin)

1. Tekan **"Alokasikan Baglog"** (masuk mode seleksi).
2. Pilih satu atau beberapa slot **kosong**.
3. Pilih batch, jumlah awal per slot, tanggal penempatan, dan tahap miselium awal.
4. Konfirmasi.

Aturan yang dijaga sistem:

- Jumlah awal per slot: **1 sampai 20**, tetapi tidak boleh melebihi kapasitas slot (10).
- Slot yang sudah terisi tidak bisa dialokasi.
- Total yang ditempatkan tidak boleh melebihi jumlah batch.
- Tanggal penempatan tidak boleh sebelum tanggal masuk batch, dan tidak boleh di masa depan.

Tahap miselium awal: **LEVEL_1** (kurang dari 50%), **LEVEL_2** (50-80%), **LEVEL_3** (lebih dari 80%).

Widget batch menampilkan "Total Beli", "Belum di Rak: N", atau "100% Baglog di Rak".

## 6.4 Fase Penempatan

```
INCUBATION → FRUITING → COMPLETED
```

- Panen pertama otomatis mengubah **INCUBATION menjadi FRUITING**.
- Perpindahan lain mengikuti matriks transisi; status mundur yang tidak diizinkan akan ditolak.

## 6.5 Detail Slot

Klik slot untuk membuka **Detail Slot**: isi, batch, umur, riwayat panen/afkir, serta aksi:

- **Catat afkir** (Bab 6.6).
- **Tutup siklus** (Bab 6.7).

## 6.6 Mencatat Afkir (Cull)

Afkir = baglog rusak yang dikeluarkan.

| Kolom | Aturan |
|-------|--------|
| Jumlah | Minimal 1, tidak melebihi isi aktif slot |
| Tanggal | Tidak di masa depan, tidak sebelum tanggal penempatan |
| Alasan | TRICHODERMA (default), BUSUK_BASAH, HAMA, KERING, LAINNYA, HABIS_PRODUKSI |

Jika isi aktif slot menjadi 0, slot otomatis **COMPLETED (EXHAUSTED)**.

**Membatalkan afkir (void)** wajib menyertakan alasan minimal 5 karakter. Kapasitas dikembalikan, dan slot dibuka kembali bila sebelumnya otomatis selesai.

## 6.7 Menutup Siklus

Gunakan saat baglog di slot sudah tidak produktif. Pilih alasan: **EXHAUSTED, CONTAMINATED, DISPOSED, MANUAL**. Sisa baglog otomatis dicatat sebagai afkir alasan HABIS_PRODUKSI. Jika semua penempatan batch selesai, batch otomatis `completed`.

## 6.8 Menghapus Penempatan (Admin)

Hanya bisa jika penempatan **belum punya panen atau afkir**. Jika sudah ada, tutup siklus saja.

<div class="pagebreak"></div>

# 7. Hasil Panen

Halaman `/harvests` untuk mencatat dan melihat panen.

## 7.1 Mencatat Panen

| Kolom | Aturan |
|-------|--------|
| Tanggal panen | Tidak di masa depan |
| Berat (kg) | Minimal 0,01 |
| Batch | Opsional |
| Kode slot | Opsional, otomatis huruf besar |
| Grade | **A** (default), **B**, atau **REJECT** |
| Flush ke- | Otomatis bertambah 1 per batch/slot (rentang 1-10) |
| Catatan | Opsional |

Cara cepat: tombol panen cepat tersedia dari Dashboard/slot.

## 7.2 Batas Flush

Sistem membatasi **maks. 7 flush**. Jika terlampaui, muncul pesan agar Anda **menutup siklus** slot tersebut.

## 7.3 Pesan Kesalahan Umum

| Pesan/Penyebab | Solusi |
|----------------|--------|
| Slot tanpa batch aktif | Alokasikan baglog ke slot dulu |
| Kapasitas slot 0 | Slot sudah kosong/selesai |
| Panen sebelum tanggal penempatan | Perbaiki tanggal panen |
| Flush melebihi batas | Tutup siklus slot (Bab 6.7) |

## 7.4 Membatalkan Panen (Void)

Salah input? Gunakan **Void**, bukan hapus. Wajib isi alasan **5 sampai 255 karakter**. Data void tetap tersimpan sebagai jejak audit, tetapi **tidak dihitung** di total, grafik, dan HPP.

<div class="pagebreak"></div>

# 8. Penjualan, Biaya, dan HPP (Admin)

Halaman `/sales` hanya untuk Admin.

## 8.1 Mencatat Penjualan

| Kolom | Aturan |
|-------|--------|
| Tanggal | Tanggal transaksi |
| Batch | Opsional |
| Jumlah (kg) | Minimal 0,1 |
| Harga per kg | Minimal Rp 1.000 |
| Nama pembeli | Wajib, maks. 100 karakter |
| Catatan | Opsional |

Pendapatan dihitung presisi desimal (bukan float).

## 8.2 Void Penjualan

Sama dengan panen: wajib alasan, data tetap tersimpan namun tidak dihitung.

## 8.3 Laporan dan Analisis

- **Cari pembeli / catatan**: kotak pencarian.
- **Laporan mingguan**.
- **Peringkat pembeli**.
- **Tren harga**.
- **Kartu analisis HPP**.

## 8.4 Biaya Operasional dan HPP

Catat biaya di panel biaya operasional.

| Kategori (UI) | Contoh |
|---------------|--------|
| NUTRISI | Pupuk/nutrisi |
| LABOR | Upah |
| PACKAGING | Kemasan |
| LAINNYA | Lain-lain |

Nominal minimal Rp 1.000 (UI). Biaya **tanpa batch** dialokasikan **prorata** ke semua batch aktif.

**Rumus:**

```
Biaya operasional batch = biaya langsung + bagian prorata biaya umum
Total biaya             = modal awal (harga x jumlah) + biaya operasional
Margin kontribusi       = omzet - total biaya
HPP per kg              = total biaya / total kg panen
BEP (kg)                = total biaya / harga rata-rata jual
Mortalitas              = jumlah afkir / jumlah baglog
```

Jika belum ada penjualan, BEP memakai harga acuan **Rp 25.000/kg**.

<div class="pagebreak"></div>

# 9. Pengaturan

Halaman `/settings`.

## 9.1 Preset Fase

| Preset | Suhu | Kelembapan |
|--------|------|------------|
| Inkubasi | 26-30 °C | 65-75 % |
| Primordia | 24-28 °C | 85-90 % |
| Fruiting | 24-32 °C | 85-95 % |

Pilih **Custom** untuk nilai sendiri.

## 9.2 Aturan Validasi Threshold

- Suhu 0-50 °C, kelembapan 0-100 %.
- Nilai maksimum harus lebih besar atau sama dengan minimum.
- **Selisih kelembapan min-maks minimal 4 %.**

Hanya **Admin** yang dapat menekan **"Simpan Konfigurasi"**. ESP32 mengambil ulang threshold setiap **30 detik**, jadi perubahan berlaku tanpa restart.

## 9.3 Log Aktuator

Menampilkan kejadian pompa/kipas: filter **semua / misting / kipas**, 10 data terakhir, diperbarui tiap 10 detik.

## 9.4 Status Perangkat dan Tema

Status perangkat ESP32 dan pilihan tema Terang/Gelap ada di halaman ini.

## 9.5 Mendaftarkan Akun (Admin)

Hanya Admin yang dapat mendaftarkan pengguna baru, dengan batas **1 Admin dan 5 Worker**.

<div class="pagebreak"></div>

# 10. Cara Kerja Otomasi IoT

Bagian ini menjelaskan keputusan ESP32 agar Anda tidak kaget saat alat menyala/mati sendiri.

## 10.1 Pembacaan Sensor

Tiga sensor suhu & kelembapan presisi tinggi **SHT30 / SHT31 Probe IP68 Waterproof** dipasang bertingkat (terhubung via modul multiplexer TCA9548A). Nilai digabung dengan **bobot**:

| Sensor | Posisi | Tinggi | Kanal TCA | Bobot |
|--------|--------|--------|-----------|-------|
| A | Atas | 2,5 m | Channel 0 | 35 % |
| B | Tengah | 1,5 m | Channel 1 | 40 % |
| C | Bawah | 0,5 m | Channel 2 | 25 % |

Jika satu sensor gagal baca (NaN), bobot dihitung ulang secara dinamis dari sensor yang sehat.

## 10.2 Misting (Pompa)

- **Mulai** saat kelembapan < batas bawah.
- **Berhenti** saat kelembapan mencapai batas bawah + sedikit margin (maks. 3 %) dan suhu aman, atau habis waktu **90 detik**.
- **Jeda penguapan** 150 detik setelah misting.
- **Misting denyut 30 detik** bila rak atas sangat kering (lebih dari 10 % di bawah batas).
- **Terkunci malam (P2' Night Guard)** pukul **17:00-06:00 WIB** dengan jeda wajib minimal **10 menit (600 detik)** antar siklus darurat (mencegah jamur tidur basah kuyup).
- **Pagar RH (P3)**: ditahan saat suhu panas jika kelembapan $\ge$ batas atas $- 3\%$ (udara jenuh tidak bisa mendinginkan), dan langsung berhenti seketika jika kelembapan $\ge$ batas atas $- 1\%$ (mencegah becek/genangan air di baglog).
- Ditahan jika kelembapan sudah di atas batas atas, atau suhu kritis.

## 10.3 Exhaust Fan

| Situasi | Perilaku |
|---------|----------|
| Siang, suhu > batas atas | Diuji 90 detik (P1 Probe). Jika suhu tidak turun $\ge 0,2^\circ\text{C}$, dikunci 15 menit. Jika efektif, nyala sampai suhu turun 1,5 °C (maks. 180s, jeda 60s) |
| Suhu > batas atas + 4 °C | Dipaksa nyala (override, mem-bypass cooldown; tunduk lockout handover) |
| Selisih RH atas-bawah > 12 % | Homogenisasi 30 detik (jeda 15 menit) |
| Malam, RH ≥ 96 % | Purge 300 detik / 5 menit (jeda 30 menit) |
| Malam | Pembuangan CO2 300 detik / 5 menit tiap 60 menit |
| Setelah misting | Tunda 60 detik (agar kabut mengendap) |

Misting dan kipas saling mengunci (interlock) agar tidak bersamaan.

## 10.4 Ketahanan Saat Offline

- Wi-Fi disambung ulang tanpa menghentikan kontrol (percobaan tiap 15 detik).
- Data yang gagal terkirim disimpan di antrean RAM (10 slot) lalu dikirim saat online.
- Data lama lebih dari 15 detik disaring.
- Relay dimulai dalam kondisi OFF saat boot.

## 10.5 Jadwal Siklus Perangkat

| Aktivitas | Interval |
|-----------|----------|
| Baca sensor | 5 detik |
| Kirim ke server | 60 detik |
| Ambil threshold | 30 detik |
| Cek perintah jeda | 8 detik |

<div class="pagebreak"></div>

# 11. Prosedur Operasional (SOP)

## 11.1 Harian

1. Buka Dashboard, cek banner peringatan dan nilai suhu/RH.
2. Cek status perangkat dan log aktuator terakhir.
3. Sebelum masuk kumbung: **aktifkan Jeda Panen**.
4. Panen, lalu **catat** hasil di Hasil Panen (segera, jangan ditunda).
5. Afkir baglog rusak dan **catat** di Detail Slot.
6. Selesai: tekan **Selesai Panen**.

## 11.2 Mingguan

1. Tinjau grafik riwayat 7 hari.
2. Cek Peta Panen untuk slot berproduksi rendah.
3. (Admin) Catat biaya operasional minggu ini.
4. (Admin) Tinjau laporan mingguan dan harga jual.

## 11.3 Per Siklus

1. (Admin) Catat batch baru, alokasikan ke rak.
2. Atur preset **Inkubasi**. Saat miselium penuh pindah ke **Primordia**, lalu **Fruiting**.
3. Panen sampai maksimal 7 flush.
4. Tutup siklus slot yang habis.
5. (Admin) Tinjau HPP, margin, dan mortalitas batch.

## 11.4 Perawatan Perangkat

- Bersihkan probe sensor SHT30/SHT31 dari debu spora secara berkala (gunakan sikat halus kering).
- Cek nozzle misting dan selang dari penyumbatan (bersihkan cartridge sedimen filter).
- Pastikan box panel IP65 tertutup rapat dan kabel terlindung konduit.

<div class="pagebreak"></div>

# 12. Penanganan Masalah (Troubleshooting)

## 12.1 Dashboard dan Akun

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|----------------------|--------|
| Tidak bisa login | Email/password salah atau akun belum ada | Cek ejaan; pakai akun dari seeder; minta Admin mendaftarkan |
| "Terlalu banyak percobaan" | Melebihi 15 percobaan/menit | Tunggu 1 menit |
| Tiba-tiba kembali ke login | Token kedaluwarsa/dihapus | Login ulang |
| Menu Penjualan tidak ada | Anda login sebagai Worker | Normal, fitur khusus Admin |
| Tombol Simpan Konfigurasi gagal | Bukan Admin | Gunakan akun Admin |
| Muncul data "salinan offline" di HP | Server tidak terjangkau, tampil cache | Cek Wi-Fi dan alamat server (Bab 2.4) |

## 12.2 Data Sensor dan Grafik

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Grafik kosong | Belum ada data pada rentang itu | Pilih rentang lebih panjang; cek ESP32 online |
| Angka tidak berubah | ESP32 mati/Wi-Fi putus | Cek listrik dan Serial Monitor |
| Satu sensor NaN | Kabel longgar, sambungan lepas, atau probe rusak | Cek jalur kanal TCA9548A dan sambungan kabel Cat5e; sistem tetap jalan dengan sensor sisa |
| Nilai lompat aneh | Sensor basah/terkena semprotan nozzle langsung | Pastikan posisi moncong menghadap bawah dan jauh dari semprotan nozzle |
| Data terlambat | Interval kirim 60 detik | Tunggu, itu normal |

## 12.3 Otomasi

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Misting tidak menyala malam hari | Kunci malam 17:00-06:00 | Normal, bukan kerusakan |
| Misting tidak menyala siang | RH sudah cukup, atau jeda penguapan 150 detik, atau suhu kritis | Tunggu, cek threshold |
| Kipas nyala sendiri | Homogenisasi, purge, atau flush CO2 | Normal, lihat Bab 10.3 |
| Otomasi tidak jalan setelah panen | Lupa tekan "Selesai Panen" | Tekan tombolnya |
| Threshold baru tidak berlaku | ESP32 mengambil tiap 30 detik | Tunggu 30 detik |
| Relay bunyi/berkedip | Catu daya kurang | Gunakan adaptor 5V 2A yang stabil |
| Jam salah/NTP gagal | Internet tidak ada | Pastikan Wi-Fi punya akses internet |

## 12.4 Pesan Validasi (HTTP 422)

| Pesan | Arti | Solusi |
|-------|------|--------|
| Kapasitas slot tidak cukup | Isi melebihi 10 | Kurangi jumlah |
| Slot sudah terisi | Slot tidak kosong | Pilih slot lain |
| Melebihi jumlah batch | Total alokasi lebih dari pembelian | Kurangi jumlah |
| Tanggal sebelum batch masuk | Tanggal penempatan salah | Perbaiki tanggal |
| Flush maksimal tercapai | Sudah 7 kali panen | Tutup siklus |
| Selisih kelembapan terlalu sempit | Max-min kurang dari 4 % | Lebarkan rentang |
| Alasan void terlalu pendek | Kurang dari 5 karakter | Tulis alasan lengkap |
| Afkir melebihi isi | Jumlah afkir lebih dari isi aktif | Kurangi jumlah |
| Penempatan tidak bisa dihapus | Sudah punya panen/afkir | Tutup siklus |

## 12.5 Server dan Jaringan

| Gejala | Solusi |
|--------|--------|
| HP tidak bisa buka alamat | Satu Wi-Fi? Server pakai `--host 0.0.0.0`? Firewall? |
| Error 401 | Login ulang |
| Error 403 | Fitur khusus Admin |
| Error 429 | Terlalu banyak permintaan, tunggu sebentar |
| Error 500 | Cek `backend/storage/logs/laravel.log` |
| Vercel menampilkan 402 | Kuota/akun habis; deploy ulang di layanan lain dan ganti alamat API |
| Port 8000/5173 sudah dipakai | Tutup proses lama atau ganti port |

## 12.6 Jika Semua Gagal

1. Restart server backend dan frontend.
2. Restart ESP32 (cabut dan colok daya).
3. Hanya **data demo**: `php artisan migrate:fresh --seed` (**menghapus semua data**).
4. Salin pesan error dan log, lalu hubungi pengembang.

<div class="pagebreak"></div>

# 13. Pertanyaan Umum (FAQ)

**Apakah salah input bisa dihapus?** Tidak dihapus, tetapi di-**void** dengan alasan. Datanya tetap tercatat dan tidak dihitung.

**Kenapa nggak ada tombol edit panen?** Demi jejak audit. Void lalu catat ulang.

**Berapa baglog maksimal?** 3.000 (300 slot x 10).

**Bisa lebih dari 1 Admin?** Tidak, batas sistem 1 Admin dan 5 Worker.

**Apakah bisa dipakai tanpa ESP32?** Fitur supply chain dan WMS tetap jalan. Monitoring iklim butuh data dari ESP32 (atau simulator).

**Kenapa misting berhenti padahal masih kering?** Lihat kunci malam, jeda penguapan, dan batas waktu 90 detik di Bab 10.2.

**Apa beda Inkubasi, Primordia, dan Fruiting?** Inkubasi: miselium tumbuh (lebih hangat, kurang lembap). Primordia: calon jamur muncul (lembap tinggi). Fruiting: panen (lembap tinggi, suhu lebih toleran).

**Bagaimana mencetak manual ini?** Buka `MANUAL_BOOK.html` di browser, tekan Ctrl+P, pilih Save as PDF atau printer. Lihat `README.md` di folder yang sama.

<div class="pagebreak"></div>

# 14. Glosarium

| Istilah | Arti |
|---------|------|
| Baglog | Kantong media tanam jamur |
| Batch | Satu kelompok pembelian baglog |
| Kumbung | Rumah/ruang budidaya jamur |
| Slot | Satu posisi rak, kode `A-01-01` |
| Flush | Satu gelombang panen dari baglog |
| Cull / Afkir | Baglog rusak yang dibuang |
| Void | Pembatalan data dengan alasan (soft delete) |
| Miselium | Jaringan benang jamur di media |
| Primordia | Calon tubuh buah jamur |
| Fruiting | Fase pembentukan dan panen tubuh buah |
| Trichoderma | Jamur kontaminan (hijau) |
| HPP | Harga Pokok Produksi per kg |
| BEP | Break Even Point, titik impas |
| WMS | Warehouse Management System |
| SCM | Supply Chain Management |
| RH | Kelembapan relatif |
| Misting | Penyemprotan kabut air |
| Relay | Saklar elektronik pengendali pompa/kipas |
| Threshold | Batas atas/bawah suhu dan kelembapan |
| Sanctum | Sistem autentikasi token Laravel |

<div class="pagebreak"></div>

# 15. Lampiran A: Spesifikasi Lengkap Sistem

<!-- AUTO-GENERATED: diekstrak dari kode sumber (composer.json, package.json, routes/api.php, config/baglog.php, esp32_firmware.ino) -->

## A.1 Arsitektur

```
 ESP32 (3x SHT30, TCA9548A, relay)  <--HTTPS/JSON-->  Laravel API (Sanctum)  <--->  SQLite / PostgreSQL
                                                    ^
                                                    |  REST + token
                                            React SPA (Dashboard)
```

Pola: **monolit terpisah frontend/backend**, REST JSON, logika bisnis (perhitungan, pengelompokan, filter) berada di backend.

## A.2 Tech Stack

| Lapisan | Teknologi | Versi |
|---------|-----------|-------|
| Backend | Laravel Framework | 13.x (terpasang 13.24.0) |
| Bahasa | PHP | 8.3 (diuji 8.3.26) |
| Autentikasi | Laravel Sanctum | 4 |
| Tes backend | PHPUnit | 12 |
| Frontend | React | 19.2 |
| Build tool | Vite | 8 |
| Bahasa | TypeScript | ~6.0 |
| CSS | Tailwind CSS | 3.4 |
| Data fetching | TanStack Query | 5 |
| State | Zustand | 5 |
| Grafik | Recharts | 3 |
| Routing | react-router-dom | 7 |
| Lain-lain | axios, lucide-react, date-fns, oxlint | - |
| Database dev/test | SQLite | - |
| Database produksi | PostgreSQL (Supabase) | - |
| Mikrokontroler | ESP32 DevKit V1, firmware | v3.5 |

## A.3 Perangkat Keras

| Komponen | Keterangan |
|----------|------------|
| Mikrokontroler | ESP32 DevKit V1 (30-pin) + Terminal Shield Expansion Board |
| Sensor suhu/RH | 3x SHT30 / SHT31 Probe IP68 Waterproof |
| I2C Multiplexer | Modul TCA9548A (8-Kanal, alamat 0x70) |
| Relay | Modul Relay 4-Channel 5V Optocoupler (aktif LOW, JD-VCC terisolasi) |
| Pompa | Pompa diafragma high-pressure DC 12V (130–160 PSI) |
| Solenoid | Solenoid valve kuningan 12V DC drat 1/2" NC |
| Kipas | Exhaust fan 10" AC 220V |
| Nozzle misting | 14x Brass 0.3mm + Tee slip-lock 6mm |
| Catu daya | SMPS 12V 10A (120W) + Buck Converter LM2596 (set ke 5.0V) |
| Box panel | Box Panel Outdoor Waterproof IP65 + MCB 2A |
| Kabel sensor | Cat5e FTP/UTP twisted-pair (jalur dinding ±7–8 m) |
| Tampilan | LCD I2C 16x2 (opsional, alamat 0x27) |

Ruang kumbung: **5 x 7 x 3,5 m (122,5 m3)**.

### Pemetaan Pin & Kanal

| Fungsi | Pin ESP32 / Kanal TCA |
|--------|-----------------------|
| Bus I2C Utama | GPIO 21 (SDA) / GPIO 22 (SCL) |
| SHT30 A (Atas, 2.5m) | TCA9548A Channel 0 (I2C addr 0x44) |
| SHT30 B (Tengah, 1.5m) | TCA9548A Channel 1 (I2C addr 0x44) |
| SHT30 C (Bawah, 0.5m) | TCA9548A Channel 2 (I2C addr 0x44) |
| Relay pompa misting | GPIO 26 |
| Relay solenoid valve | GPIO 25 |
| Relay exhaust fan | GPIO 33 |
| LCD I2C 16x2 (opsional) | GPIO 21 / 22 (I2C addr 0x27) |

## A.4 Parameter Firmware v3.5

| Parameter | Nilai |
|-----------|-------|
| ID perangkat | `ESP32-KUMBUNG-01` |
| Baca sensor | 5 s |
| Kirim API | 60 s |
| Ambil threshold | 30 s |
| Poll perintah | 8 s |
| Timeout misting | 90 s |
| Cooldown penguapan | 150 s |
| Misting denyut | 30 s |
| Kunci malam misting | 17:00-06:00 WIB |
| Kipas siang maks. | 180 s, cooldown 60 s |
| Override kipas | Suhu > batas atas + 2 °C |
| Homogenisasi | 30 s bila selisih RH > 12 %, cooldown 15 menit |
| Purge malam | RH ≥ 96 %, 45 s, cooldown 30 menit |
| Flush CO2 malam | 45 s tiap 60 menit |
| Jeda setelah misting | 60 s |
| Antrean offline | 10 entri (RAM) |
| Filter data basi | 15 s |
| Default threshold | suhu 24-32 °C, RH 80-95 % |

## A.5 Batas dan Konfigurasi Sistem

| Item | Nilai |
|------|-------|
| Jumlah slot | 300+ (3+ rak x 10 bay x 10 tingkat, kelipatan 100/rak) |
| Kapasitas per slot | 10 baglog |
| Kapasitas total | 3.000+ baglog (kelipatan 1.000/rak) |
| Admin maks. | 1 |
| Worker maks. | 5 |
| Maks. flush | 7 |
| Durasi siklus | 120 hari |
| Jeda panen | 60 detik sampai 8 jam |
| Target panen harian | 15 kg |
| Rate limit login | 15 permintaan/menit |
| Rate limit endpoint ESP32 | 20 permintaan/menit |

## A.6 Model Data Utama

| Entitas | Atribut penting |
|---------|-----------------|
| Pengguna | nama, email, password (hash), peran (admin/worker) |
| Batch baglog | kode `BL-YYYYMMDD-XXX`, entry_date, quantity, supplier, price_per_baglog, status, notes |
| Slot | kode `A-01-01`, rak, bay, tingkat, max_capacity (10), status |
| Penempatan batch-slot | batch, slot, initial_quantity, tahap miselium, status (INCUBATION/FRUITING/COMPLETED), assigned_at |
| Panen | harvest_date, weight_kg, batch, slot_code, flush_number, quality_grade (A/B/REJECT), kolom void |
| Penjualan | sale_date, quantity_kg, price_per_kg, buyer_name, batch, kolom void |
| Afkir | batch, slot_code, cull_date, quantity, reason, kolom void |
| Biaya operasional | kategori, amount, tanggal, batch (opsional) |
| Data sensor | suhu, kelembapan, device_id, waktu |
| Log sprinkler/aktuator | aktuator, aksi, waktu |
| Threshold | suhu min/maks, RH min/maks, fase |

Aturan integritas: uang memakai tipe **Decimal** (bukan float); kolom void: `voided_at`, `voided_by`, `void_reason`; indeks pada pengguna dan tanggal transaksi.

## A.7 Referensi Endpoint API

Dasar: `{VITE_API_URL}` (contoh `http://localhost:8000/api`). Autentikasi: header `Authorization: Bearer <token>`.

| Metode | Endpoint | Akses | Fungsi |
|--------|----------|-------|--------|
| POST | `/login` | Publik | Masuk, dapat token |
| POST | `/logout` | Auth | Keluar |
| GET | `/me` | Auth | Profil |
| POST | `/register` | Admin | Daftarkan akun |
| POST | `/sensor-data` | Perangkat | Kirim data sensor |
| POST | `/sprinkler-logs` | Perangkat | Kirim log aktuator |
| GET | `/sensor-data/latest` | Auth | Data terbaru |
| GET | `/sensor-data/chart` | Auth | Data grafik |
| GET | `/dashboard/stats` | Auth | Statistik dashboard & kapasitas total |
| GET | `/sprinkler-logs` | Auth | Log aktuator (limit, filter) |
| GET | `/thresholds/active` | Publik | Threshold aktif (untuk ESP32) |
| GET | `/thresholds` | Admin | Daftar threshold |
| PUT | `/thresholds` | Admin | Ubah threshold |
| GET | `/device/command` | Publik | Perintah jeda (untuk ESP32) |
| POST | `/device/pause` | Auth | Jeda otomasi |
| POST | `/device/resume` | Auth | Lanjutkan otomasi |
| GET | `/racks` | Auth | Daftar seluruh rak & statistik okupansi |
| POST | `/racks` | Admin | Tambah rak baru (100 slot) |
| DELETE | `/racks/{row}` | Admin | Hapus rak kosong |
| GET | `/baglogs` | Auth | Daftar batch |
| POST | `/baglogs` | Admin | Buat batch |
| PATCH | `/baglogs/{id}/status` | Auth | Ubah status |
| GET | `/baglogs/hpp-summary` | Auth | Ringkasan HPP |
| GET | `/baglogs/{id}/hpp` | Auth | HPP satu batch |
| GET | `/harvests` | Auth | Daftar panen |
| POST | `/harvests` | Auth | Catat panen |
| POST | `/harvests/{id}/void` | Auth | Void panen |
| GET | `/harvests/today-total` | Auth | Total hari ini |
| GET | `/harvests/chart` | Auth | Grafik panen |
| GET | `/sales` | Admin | Daftar penjualan |
| POST | `/sales` | Admin | Catat penjualan |
| POST | `/sales/{id}/void` | Admin | Void penjualan |
| GET | `/sales/weekly-report` | Admin | Laporan mingguan |
| GET | `/sales/buyer-ranking` | Admin | Peringkat pembeli |
| GET | `/sales/price-trend` | Admin | Tren harga |
| GET | `/slots` | Auth | Daftar slot |
| GET | `/slots/heatmap` | Auth | Peta panen |
| GET | `/slots/{code}` | Auth | Detail slot |
| GET | `/baglog-culls` | Auth | Daftar afkir |
| POST | `/baglog-culls` | Auth | Catat afkir |
| POST | `/baglog-culls/{id}/void` | Auth | Void afkir |
| GET | `/operational-expenses` | Auth | Daftar biaya |
| POST | `/operational-expenses` | Admin | Tambah biaya |
| DELETE | `/operational-expenses/{id}` | Admin | Hapus biaya |
| POST | `/batch-slot-assignments` | Admin | Alokasi baglog ke slot |
| PATCH | `/batch-slot-assignments/{id}/status` | Admin | Ubah status penempatan |
| POST | `/batch-slot-assignments/{id}/complete` | Admin | Tutup siklus |
| DELETE | `/batch-slot-assignments/{id}` | Admin | Hapus penempatan |

> Hak akses dirangkum dari `routes/api.php` dan middleware `RoleCheck`. Jika ada beda dengan perilaku aplikasi, kode adalah acuan utama.

## A.8 Keamanan

- Autentikasi token **Laravel Sanctum**, otorisasi peran lewat middleware `RoleCheck`.
- Rate limiting pada login dan endpoint perangkat.
- Password disimpan ter-hash.
- Rute utilitas `/make-admin` dan `/seed-db` hanya aktif di lingkungan `local`.
- Validasi input di backend untuk seluruh form.

## A.9 Pengujian

Backend: `php artisan test` menghasilkan **168 tes dan 591 assertion lulus**. Frontend: lint dengan `npm run lint` dan build dengan `npm run build` (belum ada kerangka tes frontend).

## A.10 Data Demo (Seeder)

288 pembacaan sensor, 5 batch (3 aktif, 1 terkontaminasi, 1 dibuang), data panen dan penjualan 14 hari, 5 log aktuator.

<!-- /AUTO-GENERATED -->

<div class="pagebreak"></div>

# 16. Lampiran B: Catatan Ketidaksesuaian Dokumen

Hal-hal berikut ditemukan saat menyusun manual ini dan perlu diselesaikan pengembang:

| No | Temuan | Keterangan |
|----|--------|------------|
| 1 | Versi di README | README menyebut Laravel 12, React 18, PHP 8.2. Kode sebenarnya Laravel 13, React 19, PHP 8.3 |
| 2 | Akun demo | Tombol login memakai `@smartshroom.com`, seeder membuat `@smartshroom.test` |
| 3 | Alamat produksi | `tugasakhir-lime.vercel.app` mengembalikan HTTP 402, tertulis di simulator, firmware, dan dokumen |
| 4 | Kategori biaya | UI: NUTRISI/LABOR/PACKAGING/LAINNYA. Backend juga menerima LISTRIK/AIR. Konstanta model: LISTRIK/MISTING/PLASTIK/LAINNYA |
| 5 | Komentar firmware | Header menulis timeout misting 60 s, konstanta aktual 90 s (manual ini memakai 90 s) |
| 6 | Daftar belanja hardware | Menyebut RTC/blackbox/SPIFFS, sedangkan firmware v3.5 memakai antrean RAM dan NTP |

---

*Akhir buku manual. Dokumen sumber: `docs/manual/MANUAL_BOOK.md`.*
