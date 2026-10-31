# 📋 INSTRUMEN FORM PENGUJIAN PENERIMAAN PENGGUNA (UAT)
## Sistem Informasi Smart Shroom SCM & Otomasi Mikroklimat Kumbung Jamur

---

### 📌 INFORMASI PELAKSANAAN PENGUJIAN

* **Nama Produk / Sistem:** Smart Shroom SCM (v2.0 Web Dashboard + Firmware ESP32 v3.6)
* **Objek / Lokasi Pengujian:** Usaha Kumbung Jamur Kuping Mitra (*Kapasitas 3.000 Baglog, Dimensi 7m × 5m × 3m dinding, atap pelana tanpa plafon*)
* **Alamat Kumbung:** Dusun Kemiren, Desa Jumoyo, Kec. Salam, Kab. Magelang, Jawa Tengah (±400 mdpl)
* **Hari / Tanggal Pengujian:** ............................................................
* **Waktu Pengujian:** ..................... s/d ..................... WIB
* **Metode Evaluasi:** *Black-box Testing & Hands-on Field Trial* (Pengujian langsung fitur web dan panel kontrol fisik)

#### Data Evaluator / Penguji:
1. **Penguji 1 (Pemilik Usaha / Admin / Product Owner):**
   * Nama: ............................................................
   * Jabatan: Pemilik Usaha Kumbung Jamur *(Kakak)*
2. **Penguji 2 (Pekerja Lapangan / Operator / Worker):**
   * Nama: ............................................................
   * Jabatan: Perwakilan Pekerja / Buruh Tani Harian
3. **Fasilitator & Pengembang Sistem:**
   * Nama: Benedict Saviola Pradana
   * NIM: 231712243
   * Instansi: Mahasiswa Program Studi Sistem Informasi, Universitas Atma Jaya Yogyakarta

---

### 🎯 PETUNJUK PENGISIAN EVALUATOR

1. Penguji melakukan aksi sesuai instruksi pada kolom **Skenario Pengujian**.
2. Amati respon sistem pada layar smartphone atau box panel fisik, lalu bandingkan dengan kolom **Hasil yang Diharapkan**.
3. Tuliskan ringkasan fakta yang terjadi di lapangan pada kolom **Hasil Pengamatan Lapangan**.
4. Berikan tanda centang ($\checkmark$) pada salah satu status:
   * **[  ] Diterima:** Fitur berjalan akurat sesuai kebutuhan operasional.
   * **[  ] Ditolak:** Fitur gagal berfungsi, error, atau tidak sesuai kebutuhan.
   * **[  ] Perbaikan:** Fitur berjalan namun perlu penyesuaian/catatan khusus.

---

## 📊 MATRIKS PENGUJIAN UAT

### BAGIAN A: PENGUJIAN KEBUTUHAN PEMILIK USAHA (ROLE: ADMIN)
*Evaluator: Pemilik Usaha Kumbung Jamur*

| No | Kode Uji | Skenario Pengujian | Hasil yang Diharapkan | Hasil Pengamatan Lapangan | Status Kelayakan |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **UAT-ADM-01** | Login dengan akun Admin dan memeriksa navigasi menu utama. | Menu manajerial tampil lengkap: *Dashboard, Baglog, Kumbung Grid, Panen, Penjualan, Biaya Operasional, dan Pengaturan*. Menu finansial hanya dapat diakses akun ini. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 2 | **UAT-ADM-02** | Input batch pengadaan baglog baru dari supplier bibit. | Admin dapat mencatat tanggal datang, jumlah bibit (misal 500 baglog), harga beli per baglog (Rp 2.800), dan supplier. Kode batch (`BL-YYYYMMDD-XXX`) otomatis ter-generate unik. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 3 | **UAT-ADM-03** | Alokasi Batch Baglog ke denah rak fisik (WMS 3D Grid 300 slot). | Admin memilih Rak (A/B/C), Kolom (01–10), dan Tingkat (T-01..T-10), lalu menempatkan baglog. Slot rak otomatis terisi dan berubah status visual warnanya. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 4 | **UAT-ADM-04** | Pencatatan mutasi afkir baglog (*culls ledger*) untuk klaim garansi. | Admin mencatat baglog mati akibat *Trichoderma*, busuk basah, atau hama. Kapasitas aktif slot otomatis berkurang dan tercatat di riwayat mutasi afkir. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 5 | **UAT-ADM-05** | Tutup Siklus Kamar Rak (*Complete Cycle WMS*). | Saat baglog di satu slot sudah habis masa panennya, Admin menekan "Tutup Siklus". Sisa baglog berstatus `HABIS_PRODUKSI` dan slot rak kembali bersih/kosong. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 6 | **UAT-ADM-06** | Pembukuan beban biaya operasional kumbung berkala. | Admin mencatat biaya listrik kumbung, penggantian selang/nozzle misting, dan upah buruh harian terpisah dari modal bibit. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 7 | **UAT-ADM-07** | Perhitungan Harga Pokok Produksi (HPP) dinamis per Kilogram. | Sistem mengkalkulasi akumulasi modal baglog + biaya operasional dibagi total hasil panen (kg) secara otomatis tanpa kalkulasi manual. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 8 | **UAT-ADM-08** | Pencatatan transaksi penjualan jamur basah ke pasar/tengkulak. | Admin mencatat penjualan (nama pembeli, berat kg, harga jual per kg). Sistem mengkalkulasi omzet kotor, laba bersih, dan memotong stok panen. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 9 | **UAT-ADM-09** | Pembatalan transaksi salah input (*Void Action Audit Trail*). | Admin membatalkan salah input panen/penjualan/afkir dengan wajib mengisi alasan (min. 5 karakter). Data ditandai void tanpa merusak jejak audit fisik. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 10 | **UAT-ADM-10** | Konfigurasi ambang batas iklim mikro (*Threshold Settings*). | Admin mengubah batas suhu/kelembapan atau memilih preset *Fase Inkubasi* vs *Fruiting*. Perubahan otomatis disinkronkan ke mikrokontroler ESP32. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 11 | **UAT-ADM-11** | Evaluasi performa supplier bibit & rekomendasi restock baglog (PO Advisor). | Admin meninjau Supplier Scorecard (A/B/C/D) dan rekomendasi jadwal & kuantitas order bibit agar kapasitas kumbung (3.000 baglog) tetap optimal tanpa kehabisan stok. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 12 | **UAT-ADM-12** | Pelacakan ketertelusuran rantai pasok dua arah (*Batch Traceability*). | Admin memasukkan kode batch atau ID invoice penjualan untuk melacak asal supplier bibit, penempatan kamar rak, tanggal panen, hingga nama pelanggan/tengkulak yang membeli jamur. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |

---

### BAGIAN B: PENGUJIAN KEBUTUHAN PEKERJA LAPANGAN (ROLE: WORKER)
*Evaluator: Pekerja Kebun / Buruh Tani Harian*

| No | Kode Uji | Skenario Pengujian | Hasil yang Diharapkan | Hasil Pengamatan Lapangan | Status Kelayakan |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 13 | **UAT-WRK-01** | Akses monitoring iklim via smartphone di dalam kumbung. | Tampilan dashboard ringan di HP, dial gauge suhu & RH kontras dan mudah dibaca oleh pekerja tanpa lag. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 14 | **UAT-WRK-02** | Aktivasi Mode Jeda Panen (*Harvest Pause Mode*) saat memetik jamur. | Pekerja menekan tombol "Mode Panen (2 Jam)". Pompa misting dan kipas otomatis mati seketika agar pekerja tidak basah kuyup tersiram nozzle. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 15 | **UAT-WRK-03** | Pencatatan timbangan hasil panen harian per slot rak. | Pekerja menimbang jamur, memilih kode slot rak (`A-02-04`), memilih nomor petikan (*Flush* 1–7), dan menyimpan berat panen (kg) dengan form sederhana. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 16 | **UAT-WRK-04** | Pelaporan cepat baglog rusak langsung dari denah rak (*Quick Cull*). | Saat memetik jamur dan mendapati baglog berjamur hijau, pekerja menekan tombol "Catat Rusak" pada slot terkait tanpa harus mengetik ulang data slot. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 17 | **UAT-WRK-05** | Pengujian proteksi pembatasan hak akses (*RBAC Shield*). | Akun pekerja mencoba membuka menu Penjualan atau mengubah threshold iklim. Menu disembunyikan dan akses langsung via URL ditolak (403 Forbidden). | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |

---

### BAGIAN C: PENGUJIAN INTEGRASI FISIK & PERANGKAT KERAS (EDGE IOT)
*Evaluator Bersama: Pemilik Usaha & Pekerja Lapangan*

| No | Kode Uji | Skenario Pengujian | Hasil yang Diharapkan | Hasil Pengamatan Lapangan | Status Kelayakan |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 18 | **UAT-IOT-01** | Monitoring display lokal LCD 16×2 di Box Panel Kumbung. | Layar LCD pada pintu box kontroler menampilkan suhu, RH, status relay pompa/fan, dan timer jeda panen secara kontras tanpa harus membuka HP. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |
| 19 | **UAT-IOT-02** | Simulasi koneksi Wi-Fi kumbung padam/terputus. | ESP32 tetap menjalankan otomasi penyiraman saat RH < 80% secara mandiri (*Closed-Loop Autonomy*). Kontroler tidak hang atau macet. | <br><br>.................................................... | [ &nbsp; ] Diterima<br>[ &nbsp; ] Ditolak<br>[ &nbsp; ] Perbaikan |

---

## 📈 REKAPITULASI HASIL EVALUASI (Diisi oleh Evaluator)

* **Total Skenario Uji:** 19 Butir Pengujian (12 Manajerial Admin, 5 Operasional Worker, 2 Edge IoT)
* **Jumlah Butir Diterima:** .............. Butir
* **Jumlah Butir Ditolak:** .............. Butir
* **Jumlah Butir Perlu Perbaikan:** .............. Butir
* **Persentase Kelayakan:** .............. %

#### KESIMPULAN AKHIR KELAYAKAN SISTEM:
* [ &nbsp; ] **DITERIMA PENUH:** Sistem dinyatakan memenuhi seluruh kebutuhan operasional kumbung dan siap digunakan secara penuh.
* [ &nbsp; ] **DITERIMA DENGAN CATATAN:** Sistem dapat digunakan operasional dengan perbaikan minor yang disepakati.
* [ &nbsp; ] **DITOLAK:** Sistem belum memenuhi kebutuhan inti dan membutuhkan revisi mayor sebelum dioperasikan.

---

### 💬 CATATAN, MASUKAN & SARAN PERBAIKAN DARI MITRA USAHA:

```text
........................................................................................................................
........................................................................................................................
........................................................................................................................
........................................................................................................................
........................................................................................................................
```

---

### ✍️ LEMBAR PENGESAHAN HASIL UAT

Instrumen pengujian ini diverifikasi dan disahkan oleh para pihak terkait pada tanggal pelaksanaan yang tercantum di atas:

<br><br>

| Penguji 1 (Pemilik Usaha / Mitra) | Penguji 2 (Perwakilan Pekerja) | Fasilitator / Pengembang (Mahasiswa) |
| :---: | :---: | :---: |
| <br><br><br><br><u><b>( .................................................... )</b></u><br>Pemilik Usaha Kumbung Jamur | <br><br><br><br><u><b>( .................................................... )</b></u><br>Operator / Buruh Tani Lapangan | <br><br><br><br><u><b>Benedict Saviola Pradana</b></u><br>NIM: 231712243<br>Program Studi Sistem Informasi UAJY |
