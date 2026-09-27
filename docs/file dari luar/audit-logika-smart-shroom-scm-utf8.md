# Audit Logika — Smart Shroom SCM (PRD `logika_baru.md`)

*Ringkasan temuan, tingkat urgensi, dan rekomendasi perbaikan atas dokumen PRD & Arsitektur Sistem Smart Shroom SCM.*

---

## Ringkasan Eksekutif

Struktur dasarnya sudah tepat — pemisahan entitas fisik (rak/slot) dari entitas dinamis (batch baglog) adalah pola desain yang solid untuk sistem berbasis koordinat seperti WMS. Namun ada beberapa celah yang cukup signifikan, dan dua yang paling kritis bukan sekadar isu SQL, melainkan ketidakcocokan antara logika sistem dengan target produksi dan hardware yang sudah direncanakan sendiri. Detail dan rekomendasi ada di bawah.

---

## Tabel Ringkasan Temuan

| # | Bagian PRD | Temuan | Urgensi | Status |
|---|---|---|---|---|
| 1 | 3.B (IoT) | Hardware (1 pompa, 1 solenoid valve, 1 exhaust fan) hanya mendukung kontrol satu zona, sementara data model mengasumsikan status independen per slot | **Kritis** | Perlu keputusan desain |
| 2 | 1.A (Grid) | Kapasitas grid koordinat (maks. 300 slot / 3.000 baglog) tidak menutup target produksi 5.000 baglog (butuh min. 500 slot) | **Kritis** | Perlu keputusan desain |
| 3 | 1.B (Skema DB) | Tidak ada tabel master untuk slot/rak — `slot_code` tersebar di 3 tabel tanpa satu sumber kebenaran, tanpa constraint anti-duplikasi | Tinggi | Perlu perbaikan skema |
| 4 | 2.C (Badge Umur) | Badge umur berbasis kalender bisa kontradiksi dengan data `flush_number` asli dari `harvest_logs` | Tinggi | Perlu perbaikan logic |
| 5 | 4.C (HPP) | `laba_bersih_real` sebenarnya margin kontribusi, bukan laba bersih — tidak memasukkan depresiasi aset (kumbung, rak, hardware IoT) | Tinggi | Perlu perbaikan definisi |
| 6 | 2.A (Culls) | Formula `Kapasitas Aktif = 10 - SUM(culls)` mengasumsikan semua slot mulai dari 10 baglog penuh | Sedang | Perlu kolom tambahan |
| 7 | 4.C (HPP) | Query tidak membedakan laporan tengah-siklus (batch masih berjalan) vs laporan final | Sedang | Perlu indikator tambahan |
| 8 | 4.A (Ops Cost) | Alokasi biaya operasional yang sifatnya *shared* antar batch (mis. listrik saat beberapa batch berjalan bersamaan) belum didefinisikan | Sedang | Perlu aturan alokasi |
| 9 | 2.A (Culls) | Ledger `baglog_culls` terlalu tipis untuk keperluan audit garansi ke supplier (hanya enum `reason`, tanpa bukti/catatan) | Rendah | Nice-to-have |

---

## Detail Temuan & Rekomendasi

### 1. Arsitektur Spasial (Grid Koordinat)

**1.1 — Kapasitas grid tidak menutup target produksi (Kritis)**
Format koordinat `Row-Bay-Tier` dengan Row terbatas A/B/C (3 opsi), Bay 01–10, dan Tier 01–10 menghasilkan maksimum 3 × 10 × 10 = 300 slot, atau 3.000 baglog pada kapasitas 10 baglog/slot. Target produksi yang sudah ditetapkan adalah 1.000–3.000 baglog. 

**1.2 — Tidak ada tabel master untuk slot/rak (Tinggi)**
`slot_code` muncul sebagai VARCHAR bebas di tiga tabel berbeda (`batch_slot_assignments`, `baglog_culls`, `harvest_logs`) tanpa tabel referensi tunggal. Akibatnya:
- Tidak ada validasi yang mencegah typo (`B-05-3` vs `B-05-03`) menjadi dua slot berbeda.
- Tidak ada constraint yang mencegah satu slot ditempati dua batch aktif secara bersamaan — padahal ini justru skenario yang ingin dicegah oleh aturan "tidak ada mutasi baglog antar rak".

**Rekomendasi:** Buat tabel `slots` sebagai master data (berisi `slot_code`, kapasitas maksimum, status kosong/terisi), lalu tambahkan foreign key dari tabel-tabel lain ke tabel ini, plus unique constraint pada kombinasi (`slot_code`, status aktif).

---

### 2. Manajemen Siklus Biologis & Event Ledger

**2.1 — Formula kapasitas aktif mengasumsikan slot selalu mulai dari 10 (Sedang)**
`Kapasitas Aktif Slot = 10 - SUM(quantity dari baglog_culls)` hanya valid jika setiap slot memang diisi tepat 10 baglog sejak awal. Ini benar untuk contoh 1.500 baglog ÷ 150 slot, tapi tidak berlaku untuk batch yang jumlahnya tidak habis dibagi rata (misalnya ada baglog reject sebelum masuk kumbung), sehingga slot terakhir bisa terisi kurang dari 10.
**Rekomendasi:** Tambahkan kolom `initial_quantity` pada `batch_slot_assignments`, lalu ubah formula menjadi `initial_quantity - SUM(quantity dari baglog_culls)`.

**2.2 — Badge umur berbasis kalender bisa bertentangan dengan data panen asli (Tinggi)**
Badge status (bagian 2.C) menentukan fase flush murni berdasarkan jumlah hari sejak masuk kumbung (hari ke-45 = Flush 2, dst). Namun `harvest_logs.flush_number` sudah mencatat data flush yang sebenarnya terjadi di lapangan. Kedua sumber ini bisa saling bertentangan — slot yang tumbuh lebih cepat dari rata-rata bisa saja sudah mencapai flush ke-4 secara nyata pada hari ke-45, sementara badge kalender masih menampilkan "Flush 2". Ini berisiko langsung terhadap fungsi utama badge amber, yaitu memberi peringatan dini untuk pemesanan baglog baru.
**Rekomendasi:** Begitu ada minimal satu baris di `harvest_logs` untuk slot tersebut, badge harus menggunakan `MAX(flush_number)` dari data asli sebagai sumber kebenaran. Estimasi berbasis kalender hanya dipakai sebagai default sebelum panen pertama terjadi.

**2.3 — Ledger `baglog_culls` kurang kuat untuk audit garansi (Rendah)**
Dokumen menyatakan tujuan ledger ini termasuk audit garansi ke supplier, tapi hanya mencatat `reason` (enum), tanggal, dan jumlah — tanpa referensi bukti (foto) atau catatan bebas.
**Rekomendasi:** Tambahkan kolom `notes` (opsional) dan pertimbangkan referensi lampiran foto jika proses klaim ke supplier membutuhkan bukti visual.

---

### 3. IoT Failsafe Logic (Misting & Exhaust Fan)

Bagian ini secara teknis paling matang: penggunaan `millis()` non-blocking timer dan mekanisme auto-kembali ke mode AUTO saat timeout atau menerima `RESUME` adalah pola yang tepat untuk mencegah human error. Logika mematikan exhaust fan saat mode panen aktif (mencegah *short-circuiting* aliran udara) juga valid secara prinsip fisika ventilasi.

**3.1 — Hardware satu zona vs data model per-slot (Kritis)**
BOM sistem hanya menyediakan satu pompa diafragma, satu solenoid valve, dan satu exhaust fan untuk seluruh kumbung — artinya kontrol misting bersifat *all-or-nothing* untuk satu zona, bukan per-baris (row). Sementara itu, data model di bagian 1 dan 2 menyimpan status per slot secara independen (Row A bisa berstatus fruiting yang butuh misting aktif, sementara Row B masih inkubasi yang butuh misting mati — dalam waktu bersamaan). Dengan hanya satu pompa dan satu valve, kondisi ini secara fisik tidak bisa dipenuhi.
**Ini adalah pertanyaan desain yang perlu dijawab secara eksplisit:** apakah versi 1 sistem ini memang dirancang single-zone (status per-slot hanya untuk keperluan logging/analitik, bukan untuk mengambil keputusan kontrol aktual)? Jika ya, hal ini perlu dinyatakan eksplisit di PRD agar tidak menimbulkan ekspektasi "kontrol per-slot" yang sebenarnya tidak ada secara fisik. Jika tidak, BOM perlu direvisi untuk menambahkan valve dan relay per row/zona.

---

### 4. Sistem Keuangan, Penjualan, & HPP Dinamis

**4.1 — `laba_bersih_real` sebenarnya margin kontribusi, bukan laba bersih (Tinggi)**
Query menghitung: total omzet dikurangi modal baglog penuh dikurangi biaya operasional variabel (listrik, misting, alkohol, plastik). Perhitungan ini secara aritmatika benar untuk komponen yang dimasukkan, tapi secara istilah akuntansi ini lebih tepat disebut **margin kontribusi**, bukan laba bersih — karena tidak ada alokasi biaya modal maupun depresiasi atas aset infrastruktur (struktur kumbung, rak, hardware IoT). Akibatnya, angka yang ditampilkan akan selalu terlihat lebih menguntungkan dari kondisi riil, karena biaya yang membuat seluruh operasi bisa berjalan tidak pernah dibebankan ke batch manapun.
**Rekomendasi:** Jika dashboard ini akan dipakai untuk mengevaluasi kelayakan ekspansi kumbung, tambahkan kolom alokasi depresiasi per periode/batch, dan ganti nama kolom menjadi sesuatu yang lebih akurat seperti `margin_kontribusi` — reservasikan istilah "laba bersih" untuk perhitungan yang sudah memasukkan depresiasi.

**4.2 — Query tidak membedakan laporan tengah-siklus vs final (Sedang)**
Karena modal baglog dibebankan penuh di awal sementara omzet terkumpul bertahap selama 3,5–4 bulan, batch yang baru berjalan sebulan akan selalu tampak sangat merugi secara struktural — bukan karena gagal, tapi karena baru menutup sebagian kecil dari investasi awal. Tanpa indikator yang jelas, pembaca dashboard di tengah siklus bisa salah menyimpulkan batch tersebut merugi padahal masih dalam progres normal.
**Rekomendasi:** Tambahkan indikator persentase siklus yang sudah berjalan (atau proyeksi berbasis kurva flush historis) di samping angka laba/margin mentah.

**4.3 — Alokasi biaya operasional bersama antar batch belum didefinisikan (Sedang)**
Struktur tabel `operational_expenses` tidak dijelaskan dalam dokumen, khususnya bagaimana biaya yang sifatnya dibagi antar beberapa batch yang berjalan bersamaan (misalnya satu tagihan listrik untuk kumbung yang menjalankan beberapa batch bertumpuk — tersirat dari logika alert PO baru di bagian 2.C) dialokasikan ke masing-masing `batch_id`.
**Rekomendasi:** Tentukan aturan alokasi eksplisit (proporsional terhadap jumlah slot aktif, jumlah hari, atau metode lain) agar `biaya_operasional` per batch tidak bergantung pada input manual yang rawan human error.


## Prioritas Perbaikan

1. **Putuskan dulu** apakah sistem single-zone atau per-zona (temuan 3.1) — ini menentukan apakah konsep "status per-slot" di seluruh data model punya fungsi kontrol nyata atau sekadar logging.
2. **Tentukan rentang grid** berdasarkan target produksi maksimum (temuan 1.1) sebelum banyak data slot diinput ke sistem.
3. Perbaiki skema data (tabel master slot, kolom `initial_quantity`, logic badge berbasis `flush_number` asli) — temuan 1.2, 2.1, 2.2. Bisa menyusul setelah dua poin di atas.
4. Perbaiki definisi dan pelabelan pada modul keuangan (margin kontribusi vs laba bersih, indikator siklus, alokasi biaya bersama) — temuan 4.1–4.3. Relevan begitu data penjualan mulai berjalan.
5. Penguatan ledger audit garansi (temuan 2.3) — nice-to-have, bukan blocker.

