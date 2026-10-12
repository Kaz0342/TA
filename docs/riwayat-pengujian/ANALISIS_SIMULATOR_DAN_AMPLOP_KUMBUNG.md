# Analisis Simulator `iot_simulator.py` dan Rekomendasi Atap & Dinding Kumbung — Smart Shroom SCM

- **Basis analisis:** `github.com/Kaz0342/TA`, branch `develop`, commit `33a22b2` (2026-10-03), `iot_simulator.py` v3.5 (1.251 baris). **File asli tidak diubah**; semua tambalan dijalankan pada salinan sementara di memori.
- **Disusun:** 8 Oktober 2026
- **Cakupan:** (1) logika di dalam `iot_simulator.py`; (2) pilihan bahan atap dan dinding kumbung 5 × 7 m (3.000 baglog) di koordinat −7,60555 / 110,31122, memakai `analisis_iklim_jamur_kuping_koordinat_-7_60555_110_31122.md`. Firmware, backend, dan frontend di luar cakupan, kecuali yang disebut eksplisit.
- **File pendamping:**
  - `simulasi_amplop_kumbung.py` — model amplop kumbung (atap, dinding, massa baglog, neraca uap/air) dan semua suite pengujian.
  - `validasi_simulator_vs_iklim.py` — validasi ambient simulator terhadap tabel iklim dan pembuat patch S1.
  - `S1_ambient.patch` — perbaikan ambient (`patch -p1 < S1_ambient.patch`); `iot_simulator_S1.py` adalah hasil tambalannya (untuk dibandingkan).
- **Hubungan dengan dokumen sebelumnya:** `RENCANA_PERBAIKAN_LOGIKA.md` (F-01…F-16) disusun di atas commit `8187915`. Commit `33a22b2` sudah memuat sebagian perbaikannya di simulator (F-10a/b, F-11, F-12, F-13 tertulis di komentar kode), dan seluruh angka di dokumen ini dihitung di atas versi tersebut.

---

## 0. Ringkasan (baca bagian ini dulu)

### 0.1 Kenapa simulasinya "tidak bagus"

Penyebabnya empat, dan tiga di antaranya tidak bisa diperbaiki dengan tuning parameter.

1. **Udara luar di simulator salah dibanding data iklim lokasi** [RUN-SIM]. Suhu maksimum simulator 31,3 °C untuk semua bulan (data: 27,8–29,0 °C; selisih rata-rata +2,9 K) dan RH rata-rata 89,8–93,5 % (data: 70–81 %; selisih rata-rata +16 %). Penyebabnya konstanta `AMBIENT_*` (L93–96) ditulis sebagai kondisi *dalam kumbung* (komentarnya: "kumbung jamur kuping lebih hangat", "butuh kelembaban tinggi"), lalu dipakai sebagai kondisi *luar*. → **S-01 s.d. S-04**. Sudah ada patch (`S1_ambient.patch`): setelah patch selisihnya −0,5 K (Tmin), +0,4 K (Tmax), +0,2 % (RH).
2. **Di dalam simulator tidak ada "kumbung"** [RUN-SIM]. Ruangan hanya relaksasi menuju udara luar dengan konstanta waktu 200 s (suhu) dan 125 s (RH): kondisi dalam = kondisi luar tertinggal ±3 menit. Tidak ada atap, dinding, massa baglog, beban matahari, maupun metabolisme. Akibatnya **simulator tidak bisa menjawab pertanyaan atap/dinding sama sekali** (asbes polos dan panel sandwich memberi hasil identik). → **S-05**. Karena itu pertanyaan bahan dijawab dengan model terpisah (§5).
3. **Aktuator tidak realistis** [RUN-SIM]/[CODE]. Kipas mengganti udara 144–288 kali/jam (kipas 300 CFM di dokumen: 4,2 kali/jam); kabut menambah RH tanpa neraca air dan tanpa batas jenuh; kipas hanya bisa mendinginkan, tidak pernah memanaskan sehingga masalah "kipas menyedot udara luar yang lebih panas" tidak mungkin muncul. → **S-06, S-07, S-08**.
4. **Logika kontrol punya empat masalah nyata** yang muncul di dua "dunia" berbeda (model amplop dan dunia simulator sendiri dengan ambient S1), jadi bukan artefak asumsi fisika saya: night lockout membiarkan RH malam < 85 % sepanjang malam; kipas + interlock + override menahan kipas hampir terus-menerus saat panas sambil mematikan kabut; jalur Tier 1 malam tidak pernah tercapai; margin Safety Override (2,0 K) nyaris sama dengan offset sensor A (+1,8 K). → **S-09 s.d. S-12**.

### 0.2 Atap dan dinding: rekomendasi singkat

Angka di bawah dari model amplop [RUN-MODEL]: **urutan antar opsi tahan terhadap perubahan parameter (26 dari 26 variasi), tetapi angka °C mutlak punya ketidakpastian ±1–1,5 K** (§5.4, §11). Ukuran: suhu udara maksimum (Ta maks) hari terik Juli, aktuator mati, dinding bambu rapat.

| Tahap | Tindakan | Ta maks (Δ vs asbes polos) | Biaya kasar* |
|---|---|---:|---|
| Pembanding | Asbes polos (rencana sekarang) | 30,5 °C | ±Rp1,7–2,0 jt (±30 lembar, bukan tambahan) |
| **0 — sekarang, atap asbes sementara** | Cat putih reflektif **atau** paranet 65 % dipasang ≥ 20–30 cm di atas atap | 28,5 °C / 28,4 °C (−2,0 / −2,1 K) | cat Rp1,5–1,8 jt; paranet Rp0,23–0,28 jt (+ rangka) |
| **1 — tambahan** | Cat putih **+** bubble foil di bawah atap dengan celah udara | 27,2 °C (−3,3 K) | + Rp0,6–1,0 jt (foil) |
| **2 — saat asbes dibuang** | Panel sandwich 50 mm (EPS/PU) | 27,0 °C (−3,5 K) | ±Rp16 jt (EPS 50 mm, tanpa rangka) |
| Dinding (semua tahap) | Pertahankan bambu, **rapatkan + lapisi plastik di sisi dalam**, pintu dua lapis | ±0,2 K (+0,2 di bawah atap asbes, −0,2 di bawah atap putih + foil); jam pompa dan air kabut turun ±2× (±3–4× dibanding dinding berangin) | plastik ±Rp1,0–1,1 jt (grade UV; grade biasa belum ada sumber harga) |
| Dinding (nanti, jika dana ada) | Bata ringan 10 cm dicat putih | −0,9 K (atap asbes) s.d. −1,8 K (atap putih + foil) | bata saja Rp3,8–5,1 jt (tanpa mortar/plester/kolom/upah) |

\* Harga dari listing toko/vendor 2024–2026, bukan penawaran resmi (§9.1).

Catatan keselamatan yang tidak boleh dilewatkan:
- **Asbes:** menurut Badan Kebijakan Kemenkes tidak ada batas aman paparan; panduan Western Australia menyebut atap utuh yang tidak diganggu kecil kemungkinan berisiko, tetapi melapuk seiring cuaca. "Sementara" berarti: tidak dipotong/dibor di lokasi, tidak disikat kering, tidak disemprot tekanan tinggi (§9.4).
- **Dinding rapat → CO₂.** Pada ≤ 1,5 kali pertukaran udara per jam, estimasi kasar saya menaikkan CO₂ ratusan ppm di atas udara luar. CO₂ **tidak** dimodelkan di simulasi mana pun. Perlu rencana ventilasi/sensor CO₂ (§7.3).
- **Klaim label cat "peredam panas" (tertulis −10 s.d. −30 °C) jangan dipercaya.** Satu studi lapangan yang saya baca (cat putih matte berbasis air pada seng) hanya mendapat −0,85 K suhu permukaan dan 0 K saat mendung (§9.3). Ukur sendiri (§10).

### 0.3 Logika kontrol: apa yang berubah kalau diperbaiki

Tiga perubahan (semuanya diuji hanya di model, belum dipasang di firmware): **P1** kipas hanya jalan jika udara luar lebih sejuk (butuh 1 sensor suhu luar), **P2** night lockout dihapus (atau dibatasi, P2′), **P3** pagar RH untuk kabut pendingin.

| Skenario (hari terik) | Ta maks Jul | % OK Jul | Ta maks Okt | % OK Okt |
|---|---:|---:|---:|---:|
| Rencana awal: asbes polos + bambu rapat, controller asli | 29,9 | 5 | 32,1 | 14 |
| Hanya logika (P1+P2+P3) | 28,9 | 24 | 31,0 | 34 |
| Hanya atap dicat putih, controller asli | 27,9 | 8 | 29,9 | 16 |
| Atap dicat putih + logika | 27,4 | 32 | 29,0 | 47 |
| Atap putih + foil, dinding + plastik, controller asli | 26,6 | 29 | 28,3 | 41 |
| Atap putih + foil, dinding + plastik, **+ logika** | 26,6 | **63** | 28,1 | **68** |

"% OK" = persentase waktu sehari dengan suhu 23–27 °C **dan** RH 85–95 %. Dua hal yang harus dibaca bersama angka ini: (a) perbaikan atap saja hanya menaikkan % OK sedikit (Jul: 5 → 8 % dengan cat putih) karena RH tetap tidak terjaga (siang kering, malam kering); perbaikan logika saja memberi 5 → 24 %; baru kombinasi atap + dinding rapat + logika mencapai 63 %; (b) sisa "tidak OK" pada skenario terbaik hampir seluruhnya **suhu malam < 23 °C**, bukan panas. Dengan rentang literatur 20–28 °C, skenario terbaik mencapai 97–100 % (§8.7). Jadi % OK sangat bergantung pada definisi rentang target, bukan hanya kualitas kumbung.

### 0.4 Urutan kerja yang disarankan

| Fase | Pekerjaan | Perkiraan effort |
|---|---|---|
| A | Terapkan `S1_ambient.patch` ke `iot_simulator.py`, jalankan ulang regresi dan `validasi_simulator_vs_iklim.py --part ambient --days 6 --seeds 4` pada file yang sudah ditambal (§4.3) | 20–30 menit |
| B | Putuskan tiga hal desain: kebijakan misting malam (P2 / P2′ / tetap), rentang target suhu (23–27 vs 20–28 °C), strategi ventilasi untuk dinding rapat (§8.6) | diskusi |
| C | Pasang logger dan jalankan protokol 2 minggu (§10); ini data yang mengkalibrasi model | ±½ hari pasang + 14 hari |
| D | Atap/dinding tahap 0 (§9) | 1–2 hari kerja [ASUMSI] |
| E | Porting P1–P3 ke simulator dan firmware (+ sensor suhu luar), uji di Wokwi/lokal | 3–5 jam simulator, 3–5 jam firmware [ASUMSI] |
| F | Porting fisika amplop ke simulator (S-05…S-08); referensi implementasi: kelas `Model` di `simulasi_amplop_kumbung.py` | 1–2 hari [ASUMSI] |
| G | Kalibrasi model dengan data logger; hitung ulang tuning F-12 dan konstanta lain | ½–1 hari [ASUMSI] |

Fase A bisa dikerjakan hari ini dan tidak bergantung pada apa pun. Fase E sebaiknya menunggu keputusan B.

### 0.5 Batas yang paling penting

- Semua parameter fisik model amplop adalah **asumsi bertanda [ASUMSI]**, bukan hasil ukur. Urutan opsi stabil; angka mutlak tidak. Kalibrasi lapangan (§10) adalah langkah yang mengubah ini dari "perkiraan" menjadi "terukur".
- Data cuaca adalah **hari sintetis dari normal bulanan Muntilan** (proksi Salam/Jumoyo), bukan data per jam di lokasi.
- Yang **tidak** dijalankan: PHP, kompilasi Arduino/ESP32, dan browser. Perubahan P1–P3 belum menyentuh firmware.
- Angka tuning di `RENCANA_PERBAIKAN_LOGIKA.md` Lampiran B dihasilkan di atas ambient yang salah (S-01). Temuan logikanya tetap berlaku, tetapi nilai numerik (mis. timeout F-12) perlu dihitung ulang setelah S1 dan setelah ada fisika amplop (§11).

---

## 1. Cara baca dokumen ini

| Tanda | Arti |
|---|---|
| **[RUN-SIM]** | Dijalankan pada dinamika `iot_simulator.py` asli (jam dipercepat dengan jam palsu, tanpa network). Direproduksi dengan `validasi_simulator_vs_iklim.py`. |
| **[RUN-MODEL]** | Dijalankan pada model amplop kumbung dengan `control_misting()` dan `control_fan()` **asli** dari simulator yang dieksekusi tiap 5 detik di atas model. Direproduksi dengan `simulasi_amplop_kumbung.py`. |
| **[CODE]** | Dibaca dari kode, tidak dieksekusi sebagai bukti tersendiri. |
| **[DOC]** | Berasal dari dokumen proyek (mis. `docs/analisis_sensor_24jam.md`, file analisis iklim). |
| **[SUMBER]** | Dari sumber luar (tautan di Lampiran C). Tingkat keandalan disebut. |
| **[ASUMSI]** | Nilai yang saya tetapkan; bukan ukuran. Dicantumkan dalam tabel asumsi (§5.2). |

**Batas analisis:**
- Model amplop berbentuk **dua simpul termal** (udara + massa) yang disederhanakan. Ini alat perbandingan opsi, bukan prediksi cuaca kumbung yang sebenarnya.
- Hari "rata-rata", "terik" (±P90) dan "mendung" dibangun dari tabel bulanan Muntilan. Open-Meteo dan PVGIS tidak dapat diakses dari lingkungan analisis (daftar akses jaringan dibatasi), sehingga tidak ada data per jam sungguhan.
- Model foil dan paranet sederhana (§5.3). Pada versi pertama model, paranet terlihat terlalu bagus karena menghilangkan dua efek; sudah dikoreksi dan seluruh simulasi yang terdampak dijalankan ulang (§6.4).
- Skrip dan angka dibangun ulang di lingkungan ini; `iot_simulator.py` asli hanya dibaca.

---

## 2. Data iklim: apa yang dipakai dan apa batasnya

### 2.1 Tabel yang dipakai

Kolom 2–5 adalah tabel pengguna (normal 1991–2020 Muntilan sebagai proksi Salam/Jumoyo, ±400 mdpl; RH dari sumber sekunder di file iklim). Kolom 6–10 adalah **rekonstruksi saya** dari kolom 2–5 [ASUMSI]: titik embun dianggap hampir konstan sepanjang hari (amplitudo 1 K) dan dipilih sedemikian rupa sehingga RH rata-rata harian sama dengan tabel.

| Bulan | Tmin (°C) | Tmax (°C) | RH rata-rata (%) | Hujan (mm) | Musim | Td rekonstruksi (°C) | RH min siang (%) | RH maks subuh (%) | Jam RH < 85 % | Jam RH < 70 % |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Jan | 20,2 | 27,9 | 80 | 400 | basah | 19,6 | 61 | 97 | 13,8 | 7,0 |
| Feb | 20,1 | 28,2 | 81 | 390 | basah | 19,9 | 61 | 99 | 13,5 | 6,8 |
| Mar | 20,4 | 28,6 | 79 | 399 | basah | 19,8 | 59 | 96 | 14,2 | 7,8 |
| Apr | 20,8 | 28,7 | 77 | 297 | basah | 19,7 | 58 | 93 | 15,5 | 8,2 |
| Mei | 20,6 | 28,7 | 72 | 193 | pancaroba | 18,5 | 54 | 88 | 19,2 | 10,5 |
| Jun | 19,7 | 28,6 | 71 | 117 | kering | 17,7 | 52 | 88 | 19,0 | 11,2 |
| Jul | 18,9 | 28,0 | 70 | 50 | kering | 16,7 | 50 | 87 | 19,8 | 11,8 |
| Agu | 18,9 | 28,2 | 70 | 37 | kering | 16,8 | 50 | 88 | 19,5 | 11,8 |
| Sep | 19,7 | 28,5 | 71 | 66 | kering | 17,6 | 52 | 88 | 19,2 | 11,2 |
| Okt | 20,6 | 29,0 | 75 | 157 | pancaroba | 19,2 | 56 | 92 | 16,5 | 9,5 |
| Nov | 20,6 | 28,4 | 79 | 314 | basah | 19,9 | 60 | 95 | 14,5 | 7,5 |
| Des | 20,3 | 27,8 | 80 | 406 | basah | 19,7 | 61 | 96 | 13,8 | 6,8 |

Musim menurut hujan memakai ambang praktis: basah ≥ 250 mm, kering < 130 mm, selainnya pancaroba [ASUMSI].

### 2.2 Yang tidak ada di tabel, dan cara saya mengisinya

| Kebutuhan | Cara | Tag |
|---|---|---|
| Kurva suhu harian | Tmin pukul 06:00, Tmax pukul 14:00; naik cosinus, turun lebih lambat | [ASUMSI] |
| Kurva RH harian | Dari titik embun hampir konstan (amplitudo 1 K): RH turun siang, naik malam secara fisik | [ASUMSI]; sensitivitas titik embun konstan atau amplitudo 2 K tidak mengubah kesimpulan (§5.4) |
| Radiasi surya | Langit cerah Haurwitz × indeks kecerahan dari hujan bulanan (0,42 jika ≥ 300 mm; 0,50 jika ≥ 150; 0,58 jika ≥ 80; 0,66 selainnya) | [ASUMSI] |
| Hari "terik" (±P90) | Langit cerah, Tmax +2 K, Tmin +0,5 K dari normal | [ASUMSI] |
| Hari "mendung" | Indeks kecerahan 0,30, Tmax −1,5 K | [ASUMSI] |
| Angin | Tidak ada; dikodekan sebagai koefisien film luar `h_o` (15 W/m²K; dibuat bervariasi 10–25 di uji ketahanan) | [ASUMSI] |

### 2.3 Konsekuensi untuk perancangan

1. **Udara luar berada di bawah RH 85 % selama 13,8–19,8 jam sehari** (Juli 19,8 jam; di bawah 70 % selama 11,8 jam). Dengan target 85–95 %, kumbung harus **dihumidifikasi hampir sepanjang hari**, dan ventilasi dengan udara luar siang hari justru menurunkan RH. Dinding yang rapat adalah penghemat air, bukan sekadar penahan angin (§7).
2. **Tmax luar 27,8–29,0 °C sudah menyentuh batas atas target 27 °C.** Ruang yang hanya sebaik udara luar sudah di tepi; panas atap dan radiasi yang menambah 2–4 K di atasnyalah yang melewati 30 °C. Karena itu atap dominan untuk suhu (§6).
3. **Tmin 18,9–20,8 °C berada di bawah batas bawah target 23 °C.** Tanpa pemanas, malam Juli di bawah 23 °C tidak bisa dihindari. Ini bukan kegagalan kumbung, melainkan konsekuensi definisi rentang (§8.7).

### 2.4 Rentang target: konflik yang perlu diputuskan

File iklim sendiri menyatakan (§4–§5) rentang literatur fase buah "sekitar 20–25 °C sampai 23–28 °C, bergantung spesies" dan menyebut 23–27 °C / 85–95 % sebagai "target operasional awal, bukan klaim bahwa semua strain harus persis di kisaran tersebut". Dokumen ini memakai **23–27 °C / 85–95 %** sebagai definisi "% OK" utama (mengikuti dokumen) dan **20–28 °C / 85–95 %** sebagai pembanding (§8.7). Ini keputusan yang menentukan seberapa "buruk" tampak malam yang sejuk, jadi perlu diputuskan secara sadar (§8.6).

---

## 3. Temuan pada `iot_simulator.py`

Urut menurut dampak terhadap kemampuan simulator menjawab pertanyaan proyek. Tingkat: **Tinggi** = mengubah kesimpulan; **Sedang** = mengubah angka secara material; **Rendah** = kualitas/kemudahan.

| ID | Tingkat | Ringkas | Bukti | Lokasi |
|---|---|---|---|---|
| S-01 | Tinggi | Ambient salah kalibrasi: Tmax +2,9 K, RH +16 % vs data | RUN-SIM | L93–96 |
| S-02 | Sedang | Titik embun tidak fisik: bergeser 4,9 K per hari | RUN-SIM | L466–481 |
| S-03 | Sedang | State cuaca diundi ulang tiap 45–360 s (400–510 kali/hari) | RUN-SIM, CODE | L146–201 |
| S-04 | Rendah–Sedang | Pemetaan musim dari kalender salah di 4 bulan | RUN-SIM | L270–275 |
| S-05 | Tinggi | Kumbung = udara luar tertinggal 3 menit; tidak ada atap/dinding/massa | RUN-SIM | L594–595 |
| S-06 | Tinggi | Koefisien kipas/relaksasi 6–69× terlalu kuat vs 300 CFM | RUN-SIM, DOC | L573–578 |
| S-07 | Sedang–Tinggi | Kabut tanpa neraca air; RH naik tanpa batas jenuh fisik | RUN-SIM, CODE | L563–570 |
| S-08 | Tinggi | Kipas hanya mendinginkan; tidak pernah memanaskan/mengeringkan lebih dari udara luar | CODE | L574 |
| S-09 | Tinggi | Night lockout: RH malam < 85 % sepanjang malam | RUN-MODEL ×2 plant | L691–695 |
| S-10 | Tinggi | Kipas hampir terus-menerus saat panas + interlock mematikan kabut | RUN-MODEL | L684–685, L806–828, L969–1006 |
| S-11 | Sedang | Jalur Tier 1 malam tidak pernah tercapai; malam hanya pulsa 30 s | CODE, RUN-MODEL | L664, L694, L707–718 |
| S-12 | Sedang | Margin Safety Override 2,0 K ≈ offset sensor A +1,8 K | CODE | L59, L120, L806 |
| S-13 | Rendah | Hanya real-time (`time.sleep(1)`, timer jam dinding) | CODE | L1236 |
| S-14 | Kesesuaian (ditunda) | Default `tempMax` 32 dan preset fruiting 24–32 vs dokumen 23–27/alarm 30 | CODE, RUN-MODEL | L428–433; `Settings.tsx` L52–83 |

### Kelompok A — udara luar

#### S-01 — Ambient salah kalibrasi · Tinggi

**Masalah [RUN-SIM].** `AMBIENT_TEMP_MIN/MAX = 22,0 / 29,5` dan `AMBIENT_HUM_MIN/MAX = 82 / 95` (L93–96) dipakai sebagai kondisi **udara luar** (`_get_ambient_temp/_hum`, L436–481), padahal komentarnya menggambarkan kondisi **dalam kumbung** ("kumbung jamur kuping lebih hangat", "butuh kelembaban tinggi"). Satu kurva dipakai untuk 12 bulan; yang membedakan bulan hanyalah pergeseran cuaca acak. Perbandingan 6 hari × 4 seed per bulan terhadap tabel iklim:

| Besaran | Data iklim | Simulator | Selisih |
|---|---:|---:|---:|
| Tmin | 18,9–20,8 °C | 18,6–19,8 °C | −0,9 K rata-rata (kisaran −1,6 … +0,9) |
| Tmax | 27,8–29,0 °C | 31,3 °C (semua bulan) | **+2,9 K** rata-rata (kisaran +2,3 … +3,5) |
| RH rata-rata | 70–81 % | 89,8–93,5 % | **+16,0 %** rata-rata (kisaran +12,2 … +20,2) |
| RH minimum harian | 50–61 % (rekonstruksi) | 76 % | +15 … +26 % |

**Dampak.** Seluruh tuning yang pernah dilakukan di simulator terjadi di udara luar yang 3 K terlalu panas dan 16 % terlalu lembap. Pada lokasi nyata udara luar siang hanya 50–61 % RH; di simulator hampir selalu di atas 76 %. Misting terlihat "cukup" padahal di lapangan harus bekerja jauh lebih keras. Apa pun arti `AMBIENT_*` (luar atau dasar dalam), simulator tidak bisa menjawab pertanyaan atap/dinding.

**Perbaikan.** Terapkan `S1_ambient.patch` (§4): suhu dari Tmin/Tmax bulanan, RH dari titik embun, musim dari hujan. Sesudah patch: Tmin −0,5 K, Tmax +0,4 K, RH +0,2 % (rata-rata 12 bulan).

#### S-02 — Titik embun tidak fisik · Sedang

**Masalah [RUN-SIM].** `_get_ambient_hum` (L466–481) memakai faktor harian yang sama dengan suhu, dicerminkan: RH turun mengikuti naiknya suhu dengan amplitudo tetap 13 %. Dihitung balik, titik embun udara luar berayun **21,2 → 26,1 °C (4,9 K)** dalam sehari dan kelembapan absolut 18,4 → 24,2 g/m³. Selisih 5,8 g/m³ × 122,5 m³ = **0,71 kg air "muncul" dari udara luar** antara subuh dan siang tanpa sumber (hujan tidak dihitung). Di daerah tropis lembap titik embun biasanya hampir konstan (±1–2 K) sehingga RH justru **jatuh tajam** saat siang.

**Dampak.** Simulator tidak pernah mengalami siang yang kering (RH 50–61 %) yang menjadi alasan utama pompa bekerja di kumbung nyata.

**Perbaikan.** Hitung RH dari titik embun (sudah ada di S1).

#### S-03 — State cuaca diundi ulang tiap 45–360 detik · Sedang

**Masalah [CODE][RUN-SIM].** Durasi state 45–360 s (L146–201). Terukur **400–510 undian per hari**, dan 180–348 di antaranya benar-benar berganti state. Share waktu hujan 36 % pada Januari, 36 % pada Februari. Cuaca nyata berskala jam.

**Dampak.** Controller melihat derau ±2–15 % RH yang berganti tiap beberapa menit, bukan cuaca. Respons histeresis, cooldown, dan timeout diuji terhadap gangguan yang tidak ada di dunia nyata.

**Perbaikan.** Durasi berskala jam (S1: 12–16 undian/hari), anomali berpusat nol agar rata-rata bulanan tidak bergeser, `hum_shift` dinyatakan sebagai anomali titik embun (K) bukan RH.

#### S-04 — Pemetaan musim dari kalender · Rendah–Sedang

**Masalah [RUN-SIM].** L270–275: Des–Feb = hujan, Jun–Agu = kemarau, selainnya pancaroba. Dibanding hujan data (ambang §2.1): **Maret (399 mm), April (297 mm), November (314 mm)** dipetakan pancaroba padahal basah; **September (66 mm)** dipetakan pancaroba padahal kemarau.

**Perbaikan.** Musim dari curah hujan bulanan (S1: 12 dari 12 bulan cocok).

### Kelompok B — fisika plant

#### S-05 — Kumbung = udara luar tertinggal 3 menit · Tinggi

**Masalah [CODE L594–595][RUN-SIM].** Kondisi dalam hanya relaksasi menuju udara luar: `TEMP_RECOVERY_RATE = 0,005` /s dan `HUM_RECOVERY_RATE = 0,008` /s (L103–104). Dengan V = 122,5 m³ itu setara **18 dan 29 kali pertukaran udara per jam** (10 saat permukaan basah), konstanta waktu 200 s dan 125 s. Uji free-float (aktuator mati, cuaca cerah dipaksa, hari ke-2 dan ke-3):

| Besaran | Simulator | Kumbung nyata (baglog ≈ 11 MJ/K + dinding menyimpan panas) |
|---|---|---|
| Dalam − luar (suhu rata-rata) | +0,26 K | atap panas menambah beberapa K siang, metabolisme baglog menambah malam |
| Rasio amplitudo harian (suhu / RH) | 1,00 / 0,95 | < 1 (redaman oleh massa) |
| Keterlambatan (suhu / RH) | 3 menit / −2 menit | jam |

Tidak ada atap, dinding, massa baglog (3.000 × 1,2 kg × 3.100 J/kgK ≈ 11 MJ/K), beban radiasi, metabolisme, ataupun sumber uap biologis.

**Dampak.** Kesimpulan paling penting: **simulator tidak punya variabel yang bisa dipengaruhi pilihan atap/dinding.** Mengganti asbes polos dengan panel sandwich menghasilkan keluaran identik. Sistem kontrol "dibuktikan" bekerja pada plant yang 18–29 ACH mengikuti udara luar, jauh lebih mudah dikendalikan daripada kumbung tertutup yang menyimpan panas.

**Perbaikan.** Porting fisika amplop (dua simpul termal + neraca uap) ke `simulate_tick` menggantikan blok L563–595. Referensi implementasi: `Model.step` dan `Model.surfaces` di `simulasi_amplop_kumbung.py` (±120 baris).

#### S-06 — Koefisien kipas dan relaksasi terlalu kuat · Tinggi

**Masalah [RUN-SIM][DOC].** L573–578: kipas menarik suhu ke ambient dengan 0,08 /s dan RH dengan 0,04 /s, yakni **288 dan 144 pertukaran udara per jam** (35.280 dan 17.640 m³/jam). Dokumen proyek (`docs/analisis_sensor_24jam.md:135`) menyebut "minimal 300 CFM" = 510 m³/jam = **4,2 kali/jam**. Rasio simulator terhadap spesifikasi dokumen: **35–69×**. Kipas dinding 25–40 cm di dunia nyata sekitar 500–3.000 m³/jam (4–25 ACH) [ASUMSI; cek datasheet], jadi koefisien simulator **6–69×** terlalu kuat tergantung kipas yang dibeli.

Ilustrasi yang konkret: "CO₂ flush malam" (`NIGHT_FAN_DURATION` 45 s tiap 3.600 s, L68–69) di simulator menukar 1,8–3,6 konstanta waktu, yakni 83–97 % udara. Pada 510 m³/jam, 45 s hanya memindahkan 6,4 m³ = **5 %** volume kumbung (0,05 ACH). Logika yang tampak efektif di simulator tidak berarti apa-apa di lapangan.

**Dampak.** Semua parameter yang bergantung dinamika kipas (timeout 180 s, cooldown 60 s, homogenisasi 30 s/15 menit, flush malam) tidak punya arti kuantitatif sebelum S-06 diperbaiki. Catatan: pada model amplop, ukuran kipas yang realistis (510 sampai 2.040 m³/jam) hampir tidak mengubah hasil siang hari (§5.4), karena udara luar sudah mendekati udara dalam; ini sendiri temuan bahwa kipas bukan tuas pendingin utama.

**Perbaikan.** Ganti dengan pertukaran udara berbasis debit: `x += (x_luar − x) · (Q/V) · dt` untuk suhu dan **kelembapan absolut** (bukan RH) dengan `Q` dari spesifikasi kipas.

#### S-07 — Kabut tanpa neraca air dan energi · Sedang–Tinggi

**Masalah [CODE L563–570][RUN-SIM].** `RH += 0,16 · evap_potential · dt` dan suhu turun `0,025 · evap_potential · …`, dengan `evap_potential = max(0,05; (98 − RH)/25)`; satu-satunya batas atas adalah klem `HUM_MAX_PHYSICAL = 99`. Tidak ada air yang tersisa di lantai/baglog selain proksi `surface_moisture` (L547–552), tidak ada pembukuan liter, dan tidak ada jenuh yang membatasi uap. Uji konsistensi pada 25 °C / RH 85 %: kenaikan RH 0,083 %/s setara **0,14 L/menit** (wajar untuk 1–2 nozzle), kalor laten yang diperlukan **5,7 kW**, batas atas penurunan suhu udara bila semua kalor laten diambil dari udara 0,039 K/s, sedangkan simulator memberi **0,013 K/s** (±1/3 batas). Tidak ada massa termal di simulator yang menjelaskan selisih itu, jadi pendinginan kabut tidak dijaga konsisten secara energi.

**Dampak.** Simulator tidak bisa menjawab pertanyaan paling praktis untuk kumbung: **berapa liter air per hari** dan **kapan udara jenuh sehingga air jadi genangan** (risiko busuk/kontaminasi).

**Perbaikan.** Neraca uap + air permukaan seperti pada model amplop (§5.1).

#### S-08 — Kipas tidak pernah memanaskan · Tinggi

**Masalah [CODE L574].** `temp_excess = max(0,0, T − T_ambient)`: kipas hanya bisa mendinginkan menuju ambient. Kipas pembuang di kumbung nyata mengganti udara dalam dengan udara luar; bila luar 30 °C dan dalam 28 °C, kipas **menaikkan** suhu dan menurunkan RH.

**Dampak.** Menyembunyikan S-10. Pada simulator kipas selalu "aman" dihidupkan; di lapangan tidak.

**Perbaikan.** Pertukaran udara dua arah (S-06) + aturan kegunaan kipas (P1, §8.3).

### Kelompok C — logika kontrol

Empat temuan ini diperiksa pada **dua plant berbeda**: model amplop (§5) dan dunia `simulate_tick` dengan ambient S1 (§8.8). Arah temuannya sama di keduanya, jadi ini soal logika, bukan asumsi fisika.

#### S-09 — Night lockout membiarkan RH malam < 85 % · Tinggi

**Masalah [CODE L691–695].** Antara 17:00 dan 06:00, misting dilarang kecuali `hum < hum_min − 15` **atau** `min_hum < hum_min − 20`. Dengan `hum_min = 85`: harus ≤ 70 % (rata-rata) atau ≤ 65 % (satu sensor) baru boleh. Di bawah 85 % sudah alarm RH rendah di dokumen iklim, tetapi pompa baru mau jalan 15–20 poin kemudian.

**Bukti.**

| Plant | Jam malam (21–05) dengan RH < 85 %, controller asli | Lockout dihapus* |
|---|---|---|
| Model amplop, Juli (A0/A1/A3, hari rata-rata dan terik) | **100 %** | 0–3 % |
| Model amplop, Oktober terik | 60–73 % | 0–7 % |
| Model amplop, Januari | 56–79 % | 0 % |
| Dunia simulator + ambient S1 (Jan / Jul / Okt) | 24 / 60 / 38 % | 1 / 7 / 2 % |

\* Model amplop: varian `usulan` (P1+P2+P3); dunia simulator: varian `malam_bebas` (hanya lockout dihapus). Varian dijelaskan di §8.3.

**Dampak.** Tubuh buah mengering semalaman; kontradiksi dengan target 85–95 % di dokumen iklim. Maksud lockout ("jamur tidak tidur basah kuyup") sah, tetapi kendalinya terlalu kasar: melarang semua misting, bukan membatasi basahnya.

**Perbaikan.** Tiga opsi, dengan data, di §8.5 (lockout dihapus / dibatasi jeda 600 s / tetap). Ini keputusan desain, bukan murni bug.

#### S-10 — Kipas hampir terus-menerus saat panas, interlock mematikan kabut · Tinggi

**Masalah [CODE][RUN-MODEL].**
- L969–1006: kipas pendingin Tier 1 menyala bila suhu rata-rata > `tempMax`, dibatasi watchdog 180 s lalu cooldown 60 s: duty ±75 %.
- L684–685: **interlock** — kabut tidak boleh mulai selama kipas ON. Jadi selama duty kipas 75 %, kabut praktis tidak pernah mendapat giliran.
- L806–828, L969: **Safety Override** (satu sensor > `tempMax + 2`) tidak punya timeout ("tidak berlaku untuk Safety Override") dan menghentikan kabut yang sedang berjalan.
- Tidak ada pemeriksaan apakah udara luar benar-benar lebih sejuk dari udara dalam.

**Bukti [RUN-MODEL].** Hari terik Juli, atap asbes polos + dinding bambu rapat, controller asli (§8.2): kipas ON **54–60 menit per jam dari 12:00 sampai ±20:00**, pompa 0–2 menit per jam pada jam yang sama. Pada 12:00–14:00 udara luar (29,1–29,9 °C) **sama atau lebih hangat** dari udara dalam (27,5–29,7 °C), jadi kipas memasukkan udara yang lebih panas dan lebih kering; sesudah 15:00 udara luar hanya 0,8–1,7 K lebih sejuk. Selama itu RH jatuh ke 58 % dan Ta naik dari 27,5 ke 29,9 °C.

**Dampak.** Satu-satunya mekanisme pendingin yang efektif, yaitu evaporasi, dimatikan oleh interlock tepat saat paling dibutuhkan. Hasil di lapangan akan berlawanan dengan niat desain.

**Perbaikan.** P1 (§8.3): kipas pendingin hanya jika udara luar lebih sejuk (histeresis 1 K), dan bila kipas tidak berguna, kabut dibiarkan bekerja. Dengan `usulan` (P1+P2+P3; pada siang hanya P1 dan P3 yang berperan) pada trace yang sama: kipas ≈ 0, kabut 22 menit/jam pada 13:00–15:00, Ta maks 28,5 °C, RH 85–90 %.

#### S-11 — Jalur Tier 1 malam tidak pernah tercapai · Sedang

**Masalah [CODE].** `critical_low_rh = hum_min − 10` (L664) dan Tier 2 aktif bila `min_hum < critical_low_rh` (L707). Pengecualian night lockout (`hum < hum_min − 15` atau `min_hum < hum_min − 20`, L694) **lebih ketat** daripada Tier 2. Karena sensor A selalu ±4 poin lebih kering dari tengah, setiap kali lockout terbuka Tier 2 pasti sudah benar. Akibatnya di malam hari misting hanya mungkin berupa **pulsa 30 detik** (L744–753) dengan cooldown 150 s: duty maksimum 30/(30+150) = **16,7 %**. Cabang Tier 1 (sampai 90 s, berhenti di `rh_trigger_high`) tidak bisa tercapai di malam hari.

**Bukti [RUN-MODEL].** Menit pompa pada 17:00–06:00 dengan controller asli: 0–10 menit per malam pada semua kasus uji (§8.5).

**Perbaikan.** Ikut keputusan S-09. Bila lockout diganti pembatas jeda, jalur ini hidup kembali.

#### S-12 — Margin Safety Override ≈ offset sensor A · Sedang

**Masalah [CODE].** `CRITICAL_TEMP_OFFSET = 2,0` (L59) sedangkan `temp_offset` sensor A = +1,8 (L120). Override menyala saat sensor A > `tempMax + 2` ⇔ suhu **tengah** > `tempMax + 0,2`. Tier 1 memakai rata-rata tertimbang (offset efektif +0,255 K), jadi menyala saat suhu tengah > `tempMax − 0,255`. Selisih kedua pemicu hanya **0,45 K**. "Override darurat" praktis menjadi pemicu normal yang melewati cooldown dan timeout.

Penghentian override (L856–864): sensor maks ≤ `tempMax + 1,0` **dan** rata-rata ≤ `tempMax`, praktis suhu tengah ≤ `tempMax − 0,8`: kipas bertahan lama setelah suhu normal.

**Dampak.** Memperparah S-10 (override tanpa timeout).

**Perbaikan.** Definisikan override terhadap suhu tengah (kompensasi offset zona) atau naikkan marginnya, mis. `tempMax + 3,0` [IDE, belum diuji]. Tuning ini harus diuji setelah S-05 karena bergantung pada dinamika plant yang benar.

### Kelompok D — lainnya

#### S-13 — Hanya real-time · Rendah

**Masalah [CODE L1236].** `time.sleep(1)` dan timer berbasis jam dinding; simulasi 24 jam butuh 24 jam. Cadence kontrol 5 s sudah benar (F-13, `CONTROL_INTERVAL_S`, L63 dan L1176–1179).

**Perbaikan.** Untuk regresi jangka panjang pakai jam palsu seperti `FakeClock` di `validasi_simulator_vs_iklim.py` (mengganti `time.time` dan `get_wib_now`), sehingga satu hari simulasi selesai jauh lebih cepat dari real-time. Alternatif: opsi `--speed` pada `main()` [IDE, belum diuji].

#### S-14 — Default dan preset vs dokumen iklim · Kesesuaian (ditunda)

**Catatan [CODE].** Default `temp_max = 32`, `hum_min = 80` (L428–433; juga `ThresholdSettingFactory.php:23–26` dan `DatabaseSeeder.php:61–64`), preset fruiting 24–32 °C / 85–95 % (`Settings.tsx` L52–83). Dokumen iklim: zona kerja 23–27 °C, alarm ≥ 30 °C. Konsekuensi terukur [RUN-MODEL]: dengan preset 24–32, kipas hanya jalan ±10 menit/hari (flush malam; pendinginan tidak pernah aktif) karena `tempMax` 32 berada di atas suhu yang pernah dicapai; kondisi "OK" dinilai terhadap rentang yang jauh lebih longgar (% OK 10 vs 5 pada kasus dasar atap asbes polos + bambu rapat). Kesesuaian dokumen **ditunda** sesuai instruksi; dicatat di sini agar tidak hilang.

---

## 4. Patch S1 — memperbaiki udara luar di simulator

`S1_ambient.patch` (260 baris, diff terhadap `iot_simulator.py` di commit `33a22b2`) hanya menyentuh **input** simulator, yaitu udara luar. Plant dan controller tidak disentuh.

### 4.1 Isi perubahan

1. `CLIMATE_MONTHLY`: tabel Tmin, Tmax, RH rata-rata, hujan per bulan (data pengguna) menggantikan `AMBIENT_TEMP_*/HUM_*` untuk perhitungan ambient. Konstanta lama tetap ada di file tetapi tidak dipakai.
2. Suhu = Tmin + (Tmax − Tmin) × kurva harian (minimum 06:00, maksimum 14:00 [ASUMSI]; sebelumnya 05:30/13:30).
3. RH diturunkan dari **titik embun hampir konstan** yang dicari per bulan agar RH rata-rata harian sama dengan data (`dewpoint_for_month`). RH turun siang secara fisik.
4. State cuaca berskala jam (siang 10 menit–3 jam, malam 30 menit–5 jam); anomali suhu kecil (−1,5 … +0,6 K) dan anomali titik embun dalam K; **anomali dipusatkan** (rata-rata berbobot waktu = 0) agar normal bulanan tidak bergeser (`_centering`).
5. Musim dari curah hujan bulanan (`season_from_rain`): ≥ 250 mm basah, < 130 mm kering [ASUMSI]; bobot state siang/malam disesuaikan.
6. `KumbungState.__init__` dan `simulate_tick` memakai `weather_gen.ambient(now)` menggantikan `_get_ambient_temp/_hum` + pergeseran.

### 4.2 Hasil sebelum dan sesudah [RUN-SIM]

6 hari × 4 seed per bulan, 12 bulan, controller asli tidak diubah.

| Besaran | Asli | Setelah S1 |
|---|---:|---:|
| Tmin simulator − data (rata-rata 12 bulan) | −0,9 K | **−0,5 K** |
| Tmax simulator − data | **+2,9 K** | **+0,4 K** |
| RH rata-rata simulator − data | **+16,0 %** | **+0,2 %** |
| RH minimum harian simulator (data rekonstruksi: 50–61 %) | 76 % | 48–58 % |
| Undian state cuaca per hari | 400–510 | 12–16 |
| Share waktu hujan | 3,7–36,2 % | 1,1–13,3 % |
| Bulan dengan musim cocok data hujan | 8 dari 12 | 12 dari 12 |

### 4.3 Cara menerapkan dan memeriksa

```bash
cd TA                                        # root repo, branch develop @ 33a22b2
patch -p1 --dry-run < S1_ambient.patch       # periksa dulu; harus tanpa "FAILED" (alternatif: git apply --check S1_ambient.patch)
patch -p1 < S1_ambient.patch
# ukur ambient file yang sudah ditambal (beberapa menit); hasilnya harus sama dengan kolom "Setelah S1" di §4.2:
python validasi_simulator_vs_iklim.py --sim iot_simulator.py --part ambient --days 6 --seeds 4
```

Skrip mendeteksi sendiri apakah file sudah memuat S1 (`WeatherGenerator.ambient`) dan mengukur jalur ambient yang benar-benar dipakai `simulate_tick()`; pada file yang belum ditambal, perintah yang sama mengukur kolom "Asli". Default `--days 2 --seeds 2` cukup untuk cek cepat, tetapi angkanya bergeser (mis. share waktu hujan April 18 % pada 3 hari × 2 seed dibanding 13,3 % pada 6 × 4).

Bila file sudah berubah sejak `33a22b2` sehingga patch gagal, bangkitkan ulang dari file terbaru (jangkar string harus masih ada):

```bash
python validasi_simulator_vs_iklim.py --sim iot_simulator.py --emit-s1 iot_simulator_S1.py
diff -u iot_simulator.py iot_simulator_S1.py   # periksa sebelum menimpa
```

Pada file yang **belum** ditambal, `--part patched` menambal di memori dan menjalankan perbandingan yang sama tanpa menyentuh file.

### 4.4 Yang S1 tidak perbaiki

- S-05 s.d. S-08 (plant) dan S-09 s.d. S-12 (controller) tetap ada. Setelah S1, kumbung di simulator tetap **sama dengan udara luar** (tertinggal 3 menit), sehingga siang hari RH di dalam turun sampai ±50 %: hasilnya lebih jujur terhadap iklim tetapi **terlalu pesimistis** terhadap kumbung bertutup. Itu normal; plant belum diperbaiki.
- Anomali cuaca (±0,2–1,5 K) adalah nilai saya [ASUMSI]. Kecil karena normal bulanan sudah merata-ratakan cuaca; hari ekstrem (terik/mendung) tidak terwakili dan dimodelkan terpisah di model amplop (§2.2).
- Hasil tuning lama (RENCANA Lampiran B, F-12, dst.) dihitung di ambient lama dan harus dihitung ulang (§11).

---

## 5. Model amplop kumbung (alat untuk pertanyaan atap dan dinding)

Karena simulator tidak punya amplop (S-05), pertanyaan bahan dijawab dengan model terpisah. **Controller yang dijalankan di atasnya adalah `control_misting()` dan `control_fan()` asli** dari `iot_simulator.py` (dimuat dari salinan sementara), dievaluasi tiap 5 detik. Hanya plant yang diganti.

### 5.1 Struktur

- **Geometri:** 5 × 7 m, dinding 3 m, bubungan 4 m (atap pelana ±22°); V = 122,5 m³ (sama dengan angka di simulator), A_atap = 37,7 m², A_dinding = 77 m².
- **Dua simpul termal:** udara (C = 1.207 × V ≈ 148 kJ/K) dan massa (baglog 3.000 × 1,2 kg × 3.100 J/kgK ≈ 11,2 MJ/K + rak/lantai/lapisan dalam dinding 3 MJ/K).
- **Atap dan dinding:** suhu sol-air kuasi-statis (radiasi surya terserap, pelepasan gelombang panjang ke langit, film luar), konduksi lewat lapisan, lalu fluks ke udara (konveksi) dan ke massa (radiasi permukaan dalam). Foil diwakili emisivitas permukaan dalam yang rendah dan tahanan celah udara; paranet diwakili fraksi radiasi yang diblok.
- **Ventilasi:** kebocoran dinding (ACH tetap per jenis dinding) + kipas 510 m³/jam saat ON (300 CFM, [DOC]).
- **Uap dan air:** neraca kelembapan absolut udara dengan kabut nozzle (0,2 L/menit saat pompa ON), sebagian menguap langsung (bergantung RH), sisanya menjadi air permukaan; penguapan dari permukaan basah; **sumber uap biologis** dari baglog/tubuh buah (`A_bio`); kondensasi pada permukaan dalam atap/dinding yang dingin; batas jenuh (kelebihan uap menjadi embun dan melepas kalor laten); air permukaan di atas 20 kg ditiriskan.
- **Luar:** hari sintetis dari tabel iklim (§2.2): suhu, titik embun, radiasi horizontal, faktor langit cerah.

### 5.2 Tabel asumsi

| Parameter | Nilai | Tag | Catatan |
|---|---|---|---|
| Jumlah baglog | 3.000 | [CODE] | `SlotSeeder.php`: 300 slot × 10 baglog |
| Massa / kalor jenis baglog | 1,2 kg / 3.100 J/kgK | [ASUMSI] | baglog 1,0–1,5 kg; serbuk kayu ±60 % air |
| Luas permukaan baglog | 450 m² | [ASUMSI] | 0,15 m² per baglog |
| Massa lain (rak, lantai, lapisan dinding) | 3 MJ/K | [ASUMSI] | diuji 1,5 dan 6 MJ/K |
| Metabolisme baglog `q_met` | 0,10 W/kg | [ASUMSI] | literatur kompos/spawn-run 0–0,3; diuji 0 dan 0,3 |
| Sumber uap biologis `A_bio` | 7 m² efektif | [ASUMSI] | ≈ 2 g air/hari/baglog pada RH 85–88 %; diuji 0, 3,5, 14 |
| Debit kipas | 510 m³/jam | [DOC] | `docs/analisis_sensor_24jam.md:135`; diuji 1.020 dan 2.040 |
| Debit nozzle | 0,2 L/menit | [ASUMSI] | setara 0,14–0,25 L/menit di simulator; diuji 0,1 dan 0,4 |
| Film luar `h_o` | 15 W/m²K | [ASUMSI] | ASHRAE musim panas 17; diuji 10 dan 25 (**parameter paling berpengaruh**) |
| Defisit radiasi gelombang panjang atap | 63 W/m² | [SUMBER] | ASHRAE langit cerah; diuji 30 dan 80 |
| Konveksi bawah atap / dinding | 1,2 / 2,7 W/m²K | [ASUMSI] | diuji 0,8 dan 2,0 (atap) |
| Konveksi baglog–udara | 4 (kipas ON: 7) W/m²K | [ASUMSI] | diuji 2 dan 6 |
| Konduksi lantai ke tanah | 100 W/K, tanah 24,4 °C | [ASUMSI] | rata-rata tahunan |
| Absorptansi asbes baru / tua | 0,60 / 0,75 | [SUMBER]/[ASUMSI] | 0,60 dari tabel IESVE (asbes alami); 0,75 tua/berlumut = asumsi |
| Absorptansi cat putih baru / ±1–2 tahun / kotor | 0,15–0,20 / 0,30 / 0,45 | [SUMBER]/[ASUMSI] | 0,15–0,20 mengacu Berdahl & Bretz 1997; sisanya asumsi (menua, debu, jamur) |
| Foil di bawah atap | ε dalam 0,05 (kering) / 0,60 (berembun/berdebu); tahanan atap+celah 0,162 m²K/W | [ASUMSI] | sederhana; lihat §5.3 |
| Paranet 65 % | memblok 65 % radiasi | [ASUMSI] | dengan koreksi §6.4 |
| Atap daun sagu/alang-alang | α 0,70; R 1,0 m²K/W | [ASUMSI] | **R tidak diukur**; ±7 cm tebal |
| Panel sandwich 50 mm | α 0,35; R 2,1 m²K/W | [ASUMSI] | 0,05 m / 0,025 W/mK |
| Kebocoran dinding (ACH) | bambu rapat 4; bambu berangin 8; sangat rapat + lis 2; bambu + plastik dalam 1,5; bata ringan 1 | [ASUMSI] | **tidak diukur**; ini yang paling perlu dikalibrasi lapangan (tes jejak CO₂/asap) |
| Bata ringan 10 cm | α 0,30 (cat putih); R 0,70; massa +4,6 MJ/K | [ASUMSI] | |
| Hari terik | langit cerah, Tmax +2 K, Tmin +0,5 K | [ASUMSI] | ±P90 |

### 5.3 Penyederhanaan yang disengaja

- **Foil** diwakili dua angka (emisivitas dalam dan tahanan celah). Tidak ada model celah udara yang berventilasi, penurunan kinerja karena debu/embun dimodelkan lewat kasus A2w (ε dalam 0,60), bukan proses.
- **Paranet** diwakili pemblokan radiasi, ditambah dua koreksi (§6.4).
- **Dinding** hanya menerima fraksi 0,15 radiasi horizontal; tidak ada geometri matahari rinci per sisi.
- **Satu zona udara** (tanpa stratifikasi atas–bawah); offset sensor A/B/C dikembalikan lewat `write_to_state` (A +1,8/−4, B 0, C −1,5/+5), sehingga controller melihat sensor yang sama dengan simulator.
- **CO₂ tidak dimodelkan.**
- Hujan hanya muncul sebagai faktor langit dan titik embun harian; tidak ada air hujan pada atap.

### 5.4 Uji konsistensi dan ketidakpastian

**Uji konsistensi** [RUN-MODEL] (`--suite selftest`, semua OK):
- Fluks atap pada 13:00 hari terik untuk A0, A1, A2, A3, A5 sama dengan hitungan tangan dari rumus sol-air (mis. A0: 127,8 W/m²; A5: 51,7 W/m²).
- Kotak tertutup dengan kalor metabolik 360 W: ΔT 24 jam model 2,172 K vs prediksi 2,174 K.
- Neraca air 2 hari: sisa −0,0000 kg (kabut 120 kg + biologis 8 kg = ventilasi 122 kg + simpanan 6 kg).
- Kabut terus 1 jam tanpa ventilasi: RH maksimum 100,00 % (tidak melewati jenuh).

**Ketahanan urutan atap** [RUN-MODEL] (`--suite sensfree`): urutan terdingin → terpanas **S1 < A3 < T1 < A5 < A1 < A0** identik pada **26 dari 26** kombinasi (13 variasi parameter × Juli dan Oktober terik): langit lembap/kering, `h_o` 10/25, konveksi atap, massa lain, metabolisme 0/0,3, konveksi baglog. Tabel penuh di Lampiran A.

**Ketidakpastian angka mutlak.** `h_o` adalah pengaruh terbesar: Ta maks A0 pada Juli terik berkisar **29,2 °C (berangin) sampai 31,9 °C (tanpa angin)** terhadap nilai dasar 30,5 °C. Metabolisme 0,3 W/kg menaikkan Ta 0,7–1,1 K. Karena itu angka mutlak dibaca dengan **±1–1,5 K**; selisih antar opsi dan urutannya jauh lebih dapat dipercaya daripada angka tunggal.

**Parameter yang tidak berpengaruh** pada hasil harian (Juli terik, A0+W0 dan A3+W1): debit kipas (510, 1.020, 2.040 m³/jam), debit nozzle (0,1/0,2/0,4 L/menit: jam pompa berubah, **liter air tidak**, karena dikendalikan oleh kebutuhan RH), amplitudo titik embun (0/1/2 K), seed acak.

**Parameter yang berpengaruh sedang:** `A_bio` 0 → 14 m² menggeser RH rata-rata 69,9 → 77,8 % (A0+W0) dan 79,1 → 86,1 % (A3+W1) dan kebutuhan air 11 → 6 L/hari (A0+W0); kesimpulan arah tidak berubah.

---

## 6. Atap

Semua tabel di §6 dan §7 adalah [RUN-MODEL] dengan dinding bambu rapat (4 ACH) kecuali disebut lain. "Ta maks" = suhu udara maksimum hari itu. Kolom MJ/hari = kalor yang masuk lewat atap sepanjang hari. Kode atap: A0 asbes polos, A0k asbes tua/berlumut, A1 + cat putih, A1b cat putih kotor/berjamur, A2 + foil kering, A2w + foil berembun/berdebu, A3 cat putih + foil, A4 = A3 + paranet 65 %, A5 asbes + paranet 65 %, A6 cat putih + paranet 65 %, T1 daun sagu/alang-alang, S1 panel sandwich 50 mm.

### 6.1 Free-float (kipas dan kabut mati): efek murni atap

| Atap | Jul rata: Ta maks | Jul rata: atap MJ/hari | Jul terik: Ta maks | Jul terik: MJ/hari | Okt terik: Ta maks | Okt terik: MJ/hari | Jan rata: Ta maks | Jan rata: MJ/hari |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A0 asbes polos | 28,9 | 67 | 30,5 | 74 | 32,7 | 102 | 29,0 | 68 |
| A0k asbes tua/kotor | 29,9 | 93 | 31,5 | 102 | 33,9 | 138 | 29,7 | 89 |
| A1 asbes + cat putih | 27,1 | 15 | 28,5 | 16 | 30,2 | 30 | 27,5 | 26 |
| A1b asbes + cat putih kotor | 28,0 | 41 | 29,5 | 45 | 31,4 | 66 | 28,3 | 47 |
| A2 asbes + foil (kering) | 26,5 | 21 | 27,9 | 23 | 29,5 | 31 | 27,0 | 21 |
| A2w asbes + foil basah/berdebu | 27,4 | 39 | 28,9 | 43 | 30,7 | 60 | 27,7 | 40 |
| A3 asbes + cat putih + foil | 25,9 | 5 | 27,2 | 5 | 28,7 | 9 | 26,5 | 8 |
| A4 A3 + paranet 65% | 25,7 | 1 | 27,0 | 2 | 28,4 | 3 | 26,3 | 2 |
| A5 asbes + paranet 65% | 26,9 | 21 | 28,4 | 25 | 30,0 | 36 | 27,3 | 21 |
| A6 cat putih + paranet 65% | 26,3 | 3 | 27,6 | 5 | 29,1 | 11 | 26,8 | 6 |
| T1 atap daun sagu/ilalang | 26,3 | 20 | 27,7 | 21 | 29,2 | 29 | 26,8 | 19 |
| S1 panel sandwich PU 50 mm | 25,7 | 3 | 27,0 | 3 | 28,4 | 5 | 26,3 | 4 |

Jam suhu udara di atas 27 °C dan 30 °C pada hari terik:

| Atap | Jul terik: jam >27 | Jul terik: jam >30 | Okt terik: jam >27 | Okt terik: jam >30 |
|---|---:|---:|---:|---:|
| A0 asbes polos | 8,5 | 2,7 | 11,7 | 6,6 |
| A0k asbes tua/kotor | 9,4 | 4,5 | 12,6 | 7,9 |
| A1 asbes + cat putih | 5,8 | 0,0 | 9,5 | 1,9 |
| A1b asbes + cat putih kotor | 7,3 | 0,0 | 10,7 | 4,9 |
| A2 asbes + foil (kering) | 4,8 | 0,0 | 9,4 | 0,0 |
| A2w asbes + foil basah/berdebu | 6,8 | 0,0 | 10,6 | 3,6 |
| A3 asbes + cat putih + foil | 2,5 | 0,0 | 8,1 | 0,0 |
| A4 A3 + paranet 65% | 0,0 | 0,0 | 7,6 | 0,0 |
| A5 asbes + paranet 65% | 5,8 | 0,0 | 9,7 | 0,0 |
| A6 cat putih + paranet 65% | 4,2 | 0,0 | 8,5 | 0,0 |
| T1 atap daun sagu/ilalang | 4,4 | 0,0 | 9,2 | 0,0 |
| S1 panel sandwich PU 50 mm | 0,0 | 0,0 | 7,6 | 0,0 |

Bacaan utama:
1. **Atap menentukan suhu.** Dari A0 ke S1, kalor harian lewat atap turun 74 → 3 MJ/hari (Juli terik) dan Ta maks turun 3,5 K. Pada Oktober terik asbes polos melewati 30 °C selama **6,6 jam** dan 32 °C selama 3,0 jam.
2. **Menua dan kotor mahal.** Asbes tua/berlumut (A0k) menambah ±1 K dibanding asbes baru (31,5 vs 30,5 °C); cat putih yang kotor atau berjamur (A1b) kehilangan separuh keuntungannya (29,5 vs 28,5 °C). Atap yang "dicat putih sekali" tidak tetap putih.
3. **Foil bergantung kering atau basah.** Foil kering (A2) 27,9 °C; foil berembun/berdebu (A2w) 28,9 °C. Di kumbung yang dikabuti, bagian bawah atap akan lembap; angka A2w lebih realistis daripada A2 bila tidak dirawat.
4. **Paranet sendirian ≈ cat putih** (A5 28,4 vs A1 28,5 °C), lebih murah, tetapi umur dan ketahanan angin tidak dimodelkan.
5. **Kombinasi bekerja:** cat putih + foil (A3) 27,2 °C (−3,3 K); cat putih + paranet (A6) 27,6 °C; A3 + paranet (A4) 27,0 °C hanya 0,2 K lebih baik dari A3, jadi menambah paranet di atas A3 hampir tidak berarti.
6. **Daun sagu/alang-alang (T1)** 27,7 °C (−2,8 K) lewat tahanan termal [ASUMSI R = 1,0], bukan pemantulan. Nilai R ini belum diukur; di sisi lain bahan organik di atas ruang lembap memunculkan masalah umur, kebersihan, dan api yang tidak dimodelkan.

### 6.2 Dengan controller asli di atas model

Suhu dan RH yang akan dialami kumbung bila controller **tidak diubah** (preset dokumen 23–27 °C / 85–95 %). Kolom "kipas" dan "pompa" dalam menit per hari.

**Juli, hari terik**

| Atap (dinding bambu rapat) | Ta maks °C | % waktu T>27 | jam >30 °C | kipas mnt/hari | pompa mnt/hari | RH rata-rata % | % OK |
|---|---:|---:|---:|---:|---:|---:|---:|
| A0 asbes polos (rencana awal) | 29,9 | 30 | 0,0 | 479 | 41 | 74 | 5 |
| A0k asbes tua/berlumut | 30,8 | 34 | 3,2 | 533 | 38 | 73 | 4 |
| A1 asbes + cat putih | 27,9 | 18 | 0,0 | 318 | 49 | 77 | 8 |
| A5 asbes + paranet 65% | 27,7 | 16 | 0,0 | 303 | 55 | 77 | 8 |
| A3 asbes + cat putih + bubble foil | 26,2 | 0 | 0,0 | 10 | 78 | 81 | 15 |
| A4 A3 + paranet 65% | 26,0 | 0 | 0,0 | 10 | 75 | 80 | 17 |
| T1 atap daun sagu/ilalang | 26,6 | 0 | 0,0 | 10 | 85 | 80 | 16 |
| S1 panel sandwich PU 50 mm | 25,9 | 0 | 0,0 | 10 | 74 | 80 | 19 |

**Oktober, hari terik**

| Atap (dinding bambu rapat) | Ta maks °C | % waktu T>27 | jam >30 °C | kipas mnt/hari | pompa mnt/hari | RH rata-rata % | % OK |
|---|---:|---:|---:|---:|---:|---:|---:|
| A0 asbes polos (rencana awal) | 32,1 | 44 | 5,5 | 687 | 17 | 76 | 14 |
| A0k asbes tua/berlumut | 33,1 | 47 | 6,7 | 720 | 18 | 74 | 13 |
| A1 asbes + cat putih | 29,9 | 35 | 0,0 | 561 | 22 | 79 | 16 |
| A5 asbes + paranet 65% | 29,7 | 36 | 0,0 | 566 | 21 | 78 | 18 |
| A3 asbes + cat putih + bubble foil | 28,4 | 28 | 0,0 | 480 | 28 | 80 | 23 |
| A4 A3 + paranet 65% | 28,1 | 26 | 0,0 | 465 | 25 | 80 | 26 |
| T1 atap daun sagu/ilalang | 29,0 | 33 | 0,0 | 536 | 23 | 78 | 24 |
| S1 panel sandwich PU 50 mm | 28,1 | 26 | 0,0 | 455 | 26 | 80 | 27 |

Hal yang perlu dibaca di sini:
- Controller asli menurunkan Ta maks sedikit (A0: 30,5 → 29,9 °C) lewat kabut, tetapi **% OK tetap ≤ 27 % pada semua atap**, karena yang gagal adalah RH (siang kering, malam kering; S-09, S-10), bukan suhu. Atap yang baik tidak memperbaiki RH tanpa perbaikan logika (§8).
- Pada **Juli terik**, atap yang baik (A3, A4, T1, S1) membuat kipas praktis berhenti (10 menit/hari = flush malam saja) karena suhu tidak pernah melewati `tempMax`; S-10 tidak muncul. Pada **Oktober terik** tidak begitu: kipas tetap menyala 455–536 menit/hari bahkan pada atap yang baik (26–33 % waktu di atas 27 °C), jadi S-10 hanya hilang sendiri pada hari yang tidak terlalu panas. Pada atap asbes polos kipas menyala 479 menit/hari (Juli terik) sampai 687 menit/hari (Oktober terik).

### 6.3 Ketahanan urutan dan kepekaan terhadap absorptansi

Urutan **S1 < A3 < T1 < A5 < A1 < A0** (terdingin → terpanas) tidak berubah pada **26 dari 26** variasi parameter fisik (Lampiran A). Angka mutlaknya yang bergeser: Ta maks A0 pada Juli terik berkisar 29,2–31,9 °C.

Kepekaan terhadap absorptansi surya asbes/cat (hari terik):

| alfa surya | keterangan | Jul terik: Ta maks | atap MJ/hari | Okt terik: Ta maks | atap MJ/hari |
|---:|---|---:|---:|---:|---:|
| 0,15 | cat putih BARU (Berdahl&Bretz) | 27,5 | -12 | 29,0 | -6 |
| 0,20 | putih baru, kualitas biasa | 27,8 | -3 | 29,4 | 6 |
| 0,30 | putih ~1-2 th (A1) | 28,5 | 16 | 30,2 | 30 |
| 0,40 | putih mulai kotor | 29,1 | 35 | 31,0 | 54 |
| 0,45 | putih kotor/berjamur (A1b) | 29,5 | 45 | 31,4 | 66 |
| 0,60 | asbes polos baru (A0) | 30,5 | 74 | 32,7 | 102 |
| 0,75 | asbes tua/berlumut (A0k) | 31,5 | 102 | 33,9 | 138 |

Setiap +0,1 pada absorptansi menambah ±0,6–0,7 K Ta maks. Ini menjelaskan mengapa **umur dan kebersihan permukaan** lebih menentukan daripada pilihan merek. Asbes polos sendiri 0,60 (baru) sampai 0,75 (tua).

### 6.4 Paranet dan foil: catatan model

**Koreksi model paranet.** Versi pertama model memperlakukan paranet hanya sebagai penahan radiasi. Hasilnya terlalu bagus: A5 tampak 27,9 °C (Juli terik) dengan fluks atap −1 MJ/hari, yaitu atap menjadi "pendingin" yang mustahil. Dua efek yang hilang ditambahkan:
1. paranet menutupi pandangan atap ke langit sehingga pendinginan radiasi gelombang panjang berkurang (faktor 1 − 0,9 × fraksi blokir);
2. paranet yang kena matahari sedikit lebih hangat dari udara (+0,005 K per W/m²) dan meradiasikan panas itu ke atap.

Setelah koreksi A5 = **28,4 °C dengan 25 MJ/hari**. Seluruh suite yang terdampak dijalankan ulang dan semua tabel di dokumen ini memakai versi terkoreksi. Uji konsistensi diperluas dengan kasus A5 (§5.4).

Kepekaan terhadap fraksi radiasi yang diblok (asbes polos, hari terik):

| fraksi radiasi diblok paranet | Jul terik: Ta maks | atap MJ/hari | Okt terik: Ta maks | atap MJ/hari |
|---:|---:|---:|---:|---:|
| 0,00 | 30,5 | 74 | 32,7 | 102 |
| 0,30 | 29,5 | 51 | 31,4 | 71 |
| 0,50 | 28,8 | 36 | 30,6 | 51 |
| 0,65 | 28,4 | 25 | 30,0 | 36 |
| 0,75 | 28,0 | 18 | 29,6 | 26 |
| 0,90 | 27,5 | 7 | 29,0 | 10 |

Paranet 65 % ≈ 0,65 pada tabel. Menaikkan ke 90 % memberi 27,5 °C, tetapi paranet 90 % sangat gelap dan terang di bawahnya berkurang; tidak ada sumber di sesi ini tentang kebutuhan cahaya jamur kuping, jadi jangan dipakai sebelum diputuskan.

Asumsi praktis yang **tidak dimodelkan** dan harus dipikirkan sendiri: jarak paranet ke atap (saya asumsikan ≥ 20–30 cm dengan celah berventilasi), beban angin, umur UV paranet, dan sambungan rangka.

**Foil.** Dimodelkan dengan emisivitas permukaan dalam 0,05 dan celah udara. Tanpa celah udara (foil menempel pada atap) manfaat reflektif hilang menurut prinsip umum [ASUMSI/umum]; ikuti panduan produk. Kondensasi: pada atap yang dingin di bawah (A3+W1) model memberi hingga **2,8 L/hari** (Juli–Oktober; 0 pada Januari) air terkondensasi pada permukaan dalam atap/dinding (0,0–1,0 L/hari pada A0, §7.2): perlu kemiringan/talang agar tidak menetes ke baglog.

### 6.5 Perawatan

Pada model, "baru" dan "tua" berbeda sampai 1 K (asbes) dan 1 K (cat). Konsekuensinya: cat putih dan foil adalah **perawatan berkala** (bersihkan lumut/debu, cat ulang), bukan investasi sekali. Untuk atap asbes, pembersihan memiliki aturan keselamatan khusus (§9.4): tanpa semprotan tekanan tinggi, tanpa sikat kering.

---

## 7. Dinding

### 7.1 Free-float: efek murni dinding (hari terik)

Pada atap A0 (asbes polos) dan A3 (cat putih + foil). Angka: Ta maks (°C) | RH rata-rata (%) | RH minimum (%).

| Dinding | A0 Jul: Ta maks | A0 Jul: RH rata / min | A0 Okt: Ta maks | A3 Jul: Ta maks | A3 Jul: RH rata / min | A3 Okt: Ta maks |
|---|---:|---:|---:|---:|---:|---:|
| Bambu berangin / celah besar (8 ACH) | 30,4 | 69,5 / 54,4 | 32,4 | 27,5 | 72,1 / 61,9 | 28,9 |
| Bambu rapat (4 ACH) | 30,5 | 70,8 / 57,2 | 32,7 | 27,2 | 73,7 / 65,4 | 28,7 |
| Bambu sangat rapat + lis (2 ACH) | 30,7 | 73,9 / 62,0 | 32,9 | 27,1 | 76,8 / 69,8 | 28,6 |
| Bambu + plastik di sisi dalam (1,5 ACH) | 30,7 | 75,6 / 64,5 | 33,0 | 27,0 | 78,5 / 72,1 | 28,5 |
| Bata ringan 10 cm, cat putih (1 ACH) | 29,6 | 76,6 / 70,6 | 32,0 | 25,4 | 81,0 / 79,1 | 26,6 |

Bacaan:
- **Rapat atau berangin hanya menggeser suhu ≤ 0,6 K** dari 8 ke 1,5 ACH: sedikit lebih hangat di bawah atap panas (A0: +0,3 K Juli, +0,6 K Oktober) dan sedikit lebih sejuk di bawah atap yang baik (A3: −0,5 K Juli, −0,4 K Oktober). Panas utamanya datang dari atap dan metabolisme baglog, bukan dari udara luar.
- **Rapat mengubah RH nyata:** RH rata-rata naik 70,8 → 75,6 % (A0) dan 73,7 → 78,5 % (A3) dari 4 ke 1,5 ACH tanpa menambah air.
- **Bata ringan** menurunkan Ta maks (terhadap bambu rapat) 0,9 K (A0) sampai 1,8 K (A3) pada Juli terik, dan 0,7 K sampai 2,1 K pada Oktober terik, berkat massa termal +4,6 MJ/K dan tahanan dinding; di bawah atap yang buruk manfaatnya tidak menolong (A0 + bata ringan tetap 29,6 °C).

### 7.2 Dengan controller asli (atap asbes polos): jam pompa dan air kabut

| Dinding (atap asbes polos, controller asli) | Jul terik: Ta maks | pompa mnt | air kabut L | RH rata % | Okt terik: Ta maks | pompa mnt | air kabut L | RH rata % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| bambu berangin/celah besar (8 ACH) | 29,8 | 64 | 13 | 74 | 31,8 | 27 | 5 | 75 |
| bambu rapat (4 ACH) | 29,9 | 41 | 8 | 74 | 32,1 | 17 | 3 | 76 |
| bambu sangat rapat + lis (2 ACH) | 30,1 | 23 | 5 | 76 | 32,2 | 11 | 2 | 76 |
| bambu + plastik UV sisi dalam (1,5 ACH) | 30,1 | 18 | 4 | 76 | 32,3 | 9 | 2 | 77 |
| bata ringan 10 cm, cat putih (1 ACH) | 29,0 | 16 | 3 | 76 | 31,1 | 9 | 2 | 76 |

Neraca air harian pada hari terik dengan controller usulan (§8.3), yaitu air yang benar-benar dipakai untuk mencapai RH 85–90 % (L/hari; "keluar lewat ventilasi" = uap yang dibawa keluar kebocoran dinding):

| Skenario | Juli: kabut | biologis | keluar lewat ventilasi | kondensasi | Oktober: kabut | biologis | keluar lewat ventilasi | kondensasi |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A0 + bambu rapat | 40,8 | 6,4 | 47,2 | 0,7 | 25,6 | 13,2 | 38,9 | 1,0 |
| A1 + bambu rapat | 29,6 | 6,4 | 36,0 | 0,6 | 30,4 | 5,5 | 35,9 | 0,9 |
| A3 + bambu + plastik | 10,1 | 6,1 | 16,2 | 2,3 | 10,3 | 5,2 | 15,4 | 2,8 |

Pesan utamanya: **sebagian besar air kabut keluar bersama kebocoran dinding.** Pada A3 + W1, kebocoran 1,5 ACH membawa keluar 16 L/hari dibanding 47 L/hari pada A0 + W0 (4 ACH, atap panas), yaitu sepertiganya. Dinding yang rapat dan atap yang dingin mengurangi air kabut dari 41 ke 10 L/hari dan jam pompa dari ±204 ke ±50 menit/hari pada Juli terik.

Kebutuhan air dihitung langsung (hanya kalor laten ventilasi) untuk menahan 26 °C / 88 % RH **sepanjang hari** (batas atas; simulasi tertutup memakai lebih sedikit karena malam lebih dingin dan sumber biologis ikut menyumbang uap):

| ACH | Januari (RH luar 80 %) | Juli (70 %) | Oktober (75 %) |
|---:|---:|---:|---:|
| 1,0 | 13 L/hari | 21 | 14 |
| 1,5 | 20 | 31 | 21 |
| 2,0 | 26 | 42 | 28 |
| 4,0 | 52 | 84 | 57 |
| 8,0 | 105 | 167 | 114 |
| 12,0 | 157 | 251 | 171 |

Angka ini belum memasukkan air yang menetes ke lantai atau terkondensasi di atap. Konsekuensi praktis: pada 4–8 ACH di Juli batas atas kebutuhan air **84–167 L/hari** dan pompa bekerja berjam-jam; pada 1,5–2 ACH **31–42 L/hari**, yaitu seperempat sampai seperlima dari 8 ACH.

### 7.3 Harga dinding rapat: CO₂ dan ventilasi

Dinding rapat bukan gratis. **Perkiraan saya sendiri (urutan besaran; CO₂ tidak dimodelkan di simulasi mana pun):** dengan panas metabolik `q_met` 0,1 W/kg × 3.600 kg = 360 W dan kalor respirasi ±10,6 MJ per kg CO₂, produksi CO₂ ≈ 68 L/jam. Kenaikan CO₂ di atas udara luar pada keadaan tunak (campur sempurna):

| Pertukaran udara (ACH) | `q_met` 0,1 W/kg | `q_met` 0,3 W/kg |
|---:|---:|---:|
| 1,0 | +554 ppm | +1.663 ppm |
| 1,5 | +370 | +1.109 |
| 2,0 | +277 | +832 |
| 4,0 | +139 | +416 |
| 8,0 | +69 | +208 |

Catatan: (a) `q_met` tidak diukur (0–0,3 W/kg di literatur kompos); (b) ambang CO₂ yang dapat diterima jamur kuping tidak diverifikasi di sesi ini; pakai literatur strain Anda; (c) fase buah lebih aktif daripada spawn-run, jadi nilai atas tidak mustahil. Konsekuensi:
- **Dinding rapat butuh rencana ventilasi, bukan hanya kipas jadwal.** "CO₂ flush" malam 45 s tiap jam di simulator setara hanya ±0,05 ACH pada kipas 300 CFM (S-06); tidak ada artinya terhadap 1,5–4 ACH kebocoran.
- Ventilasi menurunkan RH (§2.3). Ventilasi CO₂ sebaiknya **pendek, terjadwal, dan diperhitungkan sebagai beban air**, bukan dibuka terus.
- **Tambahkan sensor CO₂** (atau minimal ukur ACH dengan uji peluruhan, §10) sebelum merapatkan dinding sampai ≤ 1,5 ACH. Dengan target ΔCO₂ ≤ 500 ppm di atas udara luar (angka ilustrasi), ACH minimum ±1,1 pada `q_met` 0,1 dan ±3,3 pada 0,3.

### 7.4 Praktik

- Pertahankan anyaman bambu sebagai kulit luar (murah, melindungi dari hujan dan angin); **rapatkan celah** (lis, lapisan kedua) dan **lapisi plastik di sisi dalam**. Kesalahan umum: plastik di luar menahan hujan tetapi menaikkan beban radiasi dinding dan sulit dirawat [ASUMSI/umum].
- **Pintu dua lapis** (ruang antara) untuk mengurangi kebocoran saat keluar-masuk.
- Sediakan **bukaan ventilasi yang bisa ditutup** (louver gable atau bubungan) untuk pelepasan CO₂ dan panas bila perlu.
- Kondensasi pada plastik dalam: perhatikan tetesan dan kebersihan; plastik yang kotor dan lembap adalah tempat kontaminan [ASUMSI/umum].
- Bata ringan menurunkan 0,9–1,8 K tetapi biayanya bukan prioritas selama atap belum diperbaiki.

---

## 8. Controller di atas model amplop

### 8.1 Varian yang diuji

Semua varian ditambal ke **salinan sementara** `iot_simulator.py` di memori; file asli tidak pernah diubah. Daftar tambalan (diff lengkap di Lampiran D).

| Varian | Isi | Catatan |
|---|---|---|
| `asli` | Controller commit `33a22b2` tanpa perubahan | pembanding |
| `malam_bebas` | Hanya night lockout dihapus (P2) | untuk melihat efek lockout saja, bukan usulan |
| `malam_longgar` | Ambang pengecualian malam dilonggarkan ke `hum_min − 5` / `− 10` | hanya di uji kepekaan: malam tetap kering |
| `kipas_pintar` | **P1** + **P3** (lockout tidak diubah) | |
| `usulan` | **P1 + P2 + P3** | batas atas manfaat |
| `usulan_aman` | **P1 + P3 + P2′** (lockout diganti jeda ≥ 600 s antar siklus) | lihat §8.5 |

**P1 — kipas hanya jika berguna.** Butuh satu sensor suhu luar (`state.outdoor_temp`). Kipas pendingin (Tier 1 dan Safety Override) boleh menyala bila `T_luar < T_dalam − 1,0 K` dan harus mati bila `T_luar > T_dalam` (histeresis 1 K; tanpa itu kipas "chattering": 130–221 siklus/hari pada versi pertama saya, kini 13–31). Bila kipas tidak berguna, pemblokir F-10b dilewati sehingga kabut (pendinginan evaporatif) bekerja.
**P2 — night lockout dihapus** (atau **P2′**: diganti jeda minimum 600 s antar siklus misting, sehingga duty malam ≤ 13 %).
**P3 — pagar RH untuk kabut pendingin:** kabut karena suhu tidak boleh mendorong RH melewati `humMax` (tahan mulai `humMax − 3`, berhenti di `humMax − 1`). Tanpa P3, versi pertama P1 membuat RH > 95 % pada amplop rapat; dengan P3 kejadiannya 0 %.

### 8.2 Jejak sehari: bukti S-10

Hari terik Juli, atap asbes polos + dinding bambu rapat. "T dalam-atap" = suhu permukaan sisi dalam atap (model). Kolom `asli` = controller asli, `usulan` = P1+P2+P3.

| Jam | T luar | T dalam-atap (asli) | Ta asli | Ta usulan | RH asli | RH usulan | pompa mnt asli | pompa mnt usulan | kipas mnt asli | kipas mnt usulan |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 06 | 19,5 | 20,1 | 20,6 | 20,3 | 86 | 87 | 1 | 0 | 0 | 0 |
| 07 | 20,3 | 26,9 | 21,0 | 20,7 | 86 | 86 | 2 | 1 | 0 | 0 |
| 08 | 21,8 | 33,8 | 21,8 | 21,6 | 86 | 86 | 4 | 4 | 0 | 0 |
| 09 | 23,7 | 40,0 | 23,0 | 22,9 | 86 | 86 | 7 | 7 | 0 | 0 |
| 10 | 25,7 | 44,8 | 24,4 | 24,3 | 85 | 86 | 10 | 9 | 0 | 0 |
| 11 | 27,6 | 47,9 | 25,9 | 25,8 | 84 | 85 | 12 | 12 | 3 | 0 |
| 12 | 29,1 | 48,9 | 27,5 | 27,1 | 70 | 85 | 2 | 16 | 54 | 0 |
| 13 | 29,9 | 47,7 | 28,8 | 28,0 | 60 | 87 | 0 | 22 | 60 | 0 |
| 14 | 29,8 | 44,2 | 29,7 | 28,5 | 58 | 88 | 0 | 22 | 60 | 0 |
| 15 | 29,1 | 38,7 | 29,9 | 28,5 | 58 | 90 | 0 | 22 | 60 | 0 |
| 16 | 28,2 | 31,9 | 29,5 | 28,0 | 59 | 90 | 0 | 21 | 60 | 5 |
| 17 | 27,2 | 25,8 | 28,7 | 27,1 | 61 | 88 | 0 | 12 | 60 | 6 |
| 18 | 26,2 | 24,4 | 27,8 | 26,3 | 63 | 86 | 0 | 10 | 60 | 1 |
| 19 | 25,1 | 23,4 | 26,8 | 25,5 | 66 | 86 | 1 | 10 | 54 | 1 |
| 20 | 24,2 | 22,5 | 25,9 | 24,8 | 72 | 86 | 2 | 8 | 1 | 1 |
| 21 | 23,2 | 21,6 | 25,3 | 24,1 | 72 | 86 | 0 | 7 | 1 | 1 |
| 22 | 22,4 | 20,8 | 24,6 | 23,5 | 72 | 86 | 0 | 6 | 1 | 1 |
| 23 | 21,7 | 20,1 | 23,9 | 22,9 | 74 | 86 | 0 | 5 | 1 | 1 |
| 00 | 21,0 | 19,5 | 23,3 | 22,4 | 76 | 86 | 0 | 4 | 1 | 1 |
| 01 | 20,5 | 18,9 | 22,7 | 21,9 | 78 | 86 | 0 | 2 | 1 | 1 |
| 02 | 20,0 | 18,4 | 22,1 | 21,4 | 80 | 86 | 0 | 1 | 1 | 1 |
| 03 | 19,7 | 18,1 | 21,6 | 21,0 | 82 | 86 | 0 | 1 | 1 | 1 |
| 04 | 19,5 | 17,8 | 21,2 | 20,7 | 83 | 86 | 0 | 0 | 1 | 1 |
| 05 | 19,4 | 17,6 | 20,8 | 20,4 | 84 | 86 | 0 | 0 | 1 | 1 |

Bacaan:
- Controller asli: dari 12:00 sampai ±20:00 kipas ON 54–60 menit/jam; pompa 0–2 menit/jam. Ta naik dari 27,5 °C (12:00) ke 29,9 °C (15:00) dan RH jatuh ke 58 %. Udara luar maksimum hanya 29,9 °C; kipas tidak punya kapasitas pendingin yang berarti, tetapi interlock memblokir satu-satunya mekanisme yang bekerja.
- Usulan: kipas ≈ 0 pada siang; pompa 16–22 menit/jam pada 12:00–16:00; Ta maks 28,5 °C (−1,4 K); RH 85–90 %. Pada malam, pompa 0–8 menit/jam menahan RH di 86 %, sedangkan controller asli membiarkan RH 72 % pada 20:00 dan baru mencapai 84 % pada 05:00 karena udara luar yang melembap.
- Suhu permukaan bawah atap asbes polos mencapai **48,9 °C pukul 12:00** (model) dan berada di atas 40 °C dari ±09:00 sampai ±15:00: itulah beban radiasi ke baglog yang tidak mungkin dilihat simulator.

### 8.3 Perubahan kode yang diuji

Ringkasan P1–P3 ada di §8.1; diff literal terhadap `iot_simulator.py` ada di Lampiran D (79 baris). Hal yang perlu diperhatikan saat memindahkannya:
- Simulator perlu mengisi `state.outdoor_temp` (di model dilakukan oleh `write_to_state`). Di `simulate_tick`, setelah baris yang menghitung `ambient_temp`, tambahkan `self.outdoor_temp = ambient_temp` [belum dijalankan; di harness bidang ini diisi model].
- Firmware menirukan logika yang sama (komentar "mirror firmware" di kode). **Perubahan harus dilakukan di kedua tempat** agar paritas simulator–firmware tetap terjaga. Firmware tidak dibuka/diubah di sesi ini.
- Sensor suhu luar: satu sensor ternaungi dan berventilasi (bukan di bawah atap/terkena matahari langsung). Akurasi ±0,5 K cukup karena histeresis 1 K.
- Alternatif tanpa sensor luar [IDE, belum diuji]: uji coba kipas 60 detik; bila suhu rata-rata tidak turun ≥ 0,3 K, hentikan dan kunci kipas 15 menit.

### 8.4 Efek gabungan atap + dinding + logika

Hari terik. `Ta maks` = suhu udara maksimum; `% OK` = persen waktu sehari dengan T 23–27 °C **dan** RH 85–95 %. Kolom kipas/pompa dalam menit per hari; air kabut L/hari.

**Juli, hari terik**

| Skenario | Ta maks °C | jam >30 °C | RH rata-rata % | % waktu RH<85 | % jam malam RH<85 | kipas mnt/hari | pompa mnt/hari | air kabut L/hari | % waktu T>27 | % waktu T<23 | % OK |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Rencana awal: atap asbes polos + bambu rapat, controller asli | 29,9 | 0,0 | 74 | 80 | 100 | 479 | 41 | 8 | 30 | 36 | 5 |
| Logika saja: + sensor luar, kipas berhisteresis, pagar RH, tanpa night lockout | 28,9 | 0,0 | 86 | 15 | 2 | 20 | 204 | 41 | 22 | 43 | 24 |
| Atap asbes dicat putih, controller asli | 27,9 | 0,0 | 77 | 73 | 100 | 318 | 49 | 10 | 18 | 40 | 8 |
| Atap asbes dicat putih + logika usulan | 27,4 | 0,0 | 86 | 21 | 1 | 10 | 148 | 30 | 6 | 47 | 32 |
| Atap putih+foil, dinding bambu+plastik UV, controller asli | 26,6 | 0,0 | 83 | 52 | 100 | 10 | 29 | 6 | 0 | 33 | 29 |
| Atap putih+foil, dinding bambu+plastik UV + logika usulan | 26,6 | 0,0 | 86 | 0 | 0 | 10 | 50 | 10 | 0 | 37 | 63 |

**Oktober, hari terik**

| Skenario | Ta maks °C | jam >30 °C | RH rata-rata % | % waktu RH<85 | % jam malam RH<85 | kipas mnt/hari | pompa mnt/hari | air kabut L/hari | % waktu T>27 | % waktu T<23 | % OK |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Rencana awal: atap asbes polos + bambu rapat, controller asli | 32,1 | 5,5 | 76 | 70 | 73 | 687 | 17 | 3 | 44 | 16 | 14 |
| Logika saja: + sensor luar, kipas berhisteresis, pagar RH, tanpa night lockout | 31,0 | 4,0 | 82 | 30 | 7 | 388 | 128 | 26 | 42 | 20 | 34 |
| Atap asbes dicat putih, controller asli | 29,9 | 0,0 | 79 | 63 | 69 | 561 | 22 | 4 | 35 | 20 | 16 |
| Atap asbes dicat putih + logika usulan | 29,0 | 0,0 | 88 | 2 | 0 | 10 | 152 | 30 | 27 | 25 | 47 |
| Atap putih+foil, dinding bambu+plastik UV, controller asli | 28,3 | 0,0 | 82 | 55 | 60 | 495 | 12 | 2 | 29 | 4 | 41 |
| Atap putih+foil, dinding bambu+plastik UV + logika usulan | 28,1 | 0,0 | 89 | 0 | 0 | 10 | 51 | 10 | 24 | 8 | 68 |

Bacaan:
1. **Logika dan atap saling melengkapi.** Logika saja menaikkan % OK 5 → 24 (Juli) dan 14 → 34 (Oktober); atap saja 5 → 8 dan 14 → 16; kombinasi atap + dinding + logika 63 dan 68 %.
2. **Dinding rapat + atap dingin memotong air dan pompa** sekitar 3× pada Juli terik (A1+W0 → A3+W1 dengan logika usulan: pompa 148 → 50 menit, air 30 → 10 L/hari) dan sekitar 4× dibanding A0+W0 (204 menit; 41 L/hari).
3. **Malam adalah tempat controller asli paling buruk:** 100 % jam malam RH < 85 % pada Juli pada ketiga amplop, 60–73 % pada Oktober; dengan logika usulan 0–7 %.
4. **Sisa "tidak OK" pada skenario terbaik** didominasi suhu malam < 23 °C: 37 % (Juli) dan 8 % (Oktober) dari waktu (kolom `% waktu T<23`).
5. Pada Oktober terik, bahkan skenario terbaik masih 24 % waktu di atas 27 °C dan 0 jam di atas 30 °C. **Asbes polos + controller asli** melewati 30 °C selama 5,5 jam.

Rincian lengkap keempat kasus uji (Juli rata-rata, Juli terik, Oktober terik, Januari rata-rata) × varian controller × tiga amplop ada di Lampiran B.

### 8.5 Night lockout: tiga pilihan dengan data

Kolom: `RH malam` = rata-rata RH 21:00–05:00; `% jam malam < 85` = persen jam malam dengan RH < 85 %; `pompa` = menit pompa ON per hari; `p. malam` = menit pompa pada 17:00–06:00; `air` = L kabut per hari.

**Juli, hari terik**

| Amplop | Varian | RH malam (%) | % jam malam < 85 | Pompa (mnt/hari) | Pompa malam (mnt) | Air (L/hari) | % OK |
|---|---|---:|---:|---:|---:|---:|---:|
| A0+W0 asbes polos + bambu | `asli` | 74,3 | 100 | 41 | 4 | 8,1 | 5 |
| A0+W0 asbes polos + bambu | `usulan_aman` | 83,2 | 61 | 166 | 27 | 33,2 | 7 |
| A0+W0 asbes polos + bambu | `usulan` | 86,5 | 2 | 204 | 66 | 40,8 | 24 |
| A1+W0 asbes + cat putih | `asli` | 77,4 | 100 | 49 | 4 | 9,8 | 8 |
| A1+W0 asbes + cat putih | `usulan_aman` | 83,1 | 59 | 115 | 28 | 23,0 | 14 |
| A1+W0 asbes + cat putih | `usulan` | 85,9 | 1 | 148 | 62 | 29,6 | 32 |
| A3+W1 putih + foil + bambu + plastik | `asli` | 82,9 | 100 | 29 | 0 | 5,9 | 29 |
| A3+W1 putih + foil + bambu + plastik | `usulan_aman` | 85,9 | 13 | 48 | 19 | 9,6 | 48 |
| A3+W1 putih + foil + bambu + plastik | `usulan` | 86,3 | 0 | 50 | 22 | 10,1 | 63 |

**Oktober, hari terik**

| Amplop | Varian | RH malam (%) | % jam malam < 85 | Pompa (mnt/hari) | Pompa malam (mnt) | Air (L/hari) | % OK |
|---|---|---:|---:|---:|---:|---:|---:|
| A0+W0 asbes polos + bambu | `asli` | 75,5 | 73 | 17 | 0 | 3,4 | 14 |
| A0+W0 asbes polos + bambu | `usulan_aman` | 82,0 | 38 | 123 | 12 | 24,7 | 24 |
| A0+W0 asbes polos + bambu | `usulan` | 82,5 | 7 | 128 | 18 | 25,6 | 34 |
| A1+W0 asbes + cat putih | `asli` | 78,7 | 69 | 22 | 0 | 4,3 | 16 |
| A1+W0 asbes + cat putih | `usulan_aman` | 87,4 | 26 | 140 | 26 | 27,9 | 30 |
| A1+W0 asbes + cat putih | `usulan` | 88,3 | 0 | 152 | 38 | 30,4 | 47 |
| A3+W1 putih + foil + bambu + plastik | `asli` | 81,5 | 60 | 12 | 0 | 2,4 | 41 |
| A3+W1 putih + foil + bambu + plastik | `usulan_aman` | 88,4 | 0 | 49 | 11 | 9,7 | 67 |
| A3+W1 putih + foil + bambu + plastik | `usulan` | 88,8 | 0 | 51 | 14 | 10,3 | 68 |

Pembacaan:
- **Amplop bocor/panas (A0 + W0):** `usulan_aman` (jeda 600 s) hanya separuh memperbaiki malam. Juli terik: jam malam < 85 % turun 100 → 61 % (dengan lockout dihapus: 2 %); Oktober terik: 73 → 38 % (lockout dihapus: 7 %). Imbalannya: pompa malam hanya 27 menit (Juli) dibanding 66 menit bila lockout dihapus, jadi pembatas memangkas pompa malam ±60 %.
- **Amplop rapat dan dingin (A3 + W1):** `usulan_aman` 13 % (Juli) dan 0 % (Oktober) jam malam < 85 %; lockout dihapus 0 % dan 0 %. Selisih pompa malam kecil (19 vs 22 menit di Juli; 11 vs 14 di Oktober) karena kebutuhan airnya memang kecil: bahkan tanpa lockout, pompa malam hanya ±2–3 % dari 13 jam.
- **Kesimpulan:** semakin rapat dan dingin amplopnya, semakin kecil harga mengambil jalur yang menjaga RH malam. Pada amplop yang bocor tidak ada jalur yang sekaligus menghindari malam kering dan membatasi malam basah; di situ lockout dihapus memberi RH malam yang benar, sedangkan pembatas memangkas pompa malam ±60 % tetapi membiarkan 38–61 % jam malam di bawah 85 % (A0 + W0, Juli/Oktober terik).
- Pelonggaran ambang (`malam_longgar`) tidak menyelesaikan masalah: jam malam < 85 % tetap 93–99 % (sensitivitas Juli terik), karena malam hanya boleh pulsa 30 s (S-11).

Risiko yang tidak diukur oleh model: **berapa lama permukaan baglog/rak basah** dan apakah itu memicu kontaminan atau busuk. Model hanya menghitung air; tidak ada model kebasahan permukaan atau pertumbuhan mikroba. Karena itu `usulan` (P2 penuh) adalah **batas atas manfaat**, bukan rekomendasi default.

### 8.6 Keputusan yang perlu Anda ambil

| # | Keputusan | Pilihan | Rekomendasi saya |
|---|---|---|---|
| 1 | Kebijakan misting malam | tetap (lockout) / P2′ (jeda ≥ 600 s) / P2 (tanpa lockout) | Mulai dari **P2′** sebagai langkah hati-hati; naikkan ke P2 bila log RH malam (§10) menunjukkan RH < 85 % lebih dari beberapa jam per malam. Jangan mempertahankan lockout asli: model menunjukkan malam kering pada semua amplop. |
| 2 | Rentang target suhu | 23–27 °C (dokumen) / 20–28 °C (literatur di dokumen yang sama) | Bergantung strain; **jangan mengukur kualitas kumbung dengan 23–27 °C bila malam Juli memang 19–20 °C di luar**. Pakai 23–27 sebagai target kendali dan 20–28 sebagai batas alarm hingga strain terkalibrasi. |
| 3 | Ventilasi untuk dinding rapat | bukaan manual / bukaan terkontrol / sensor CO₂ + kipas | Tambahkan **sensor CO₂** sebelum merapatkan ≤ 1,5 ACH (§7.3). |
| 4 | Sensor suhu luar untuk P1 | beli 1 sensor ternaungi / jalur tanpa sensor (uji kipas) | Beli satu sensor (biaya kecil, tidak ada sumber harga yang saya cek); jalur tanpa sensor belum diuji. |
| 5 | Kalibrasi Safety Override | margin 2,0 K vs offset sensor A 1,8 K (S-12) | Tunda sampai ada plant yang benar (S-05) dan data lapangan. |

### 8.7 Kepekaan terhadap definisi rentang target

Rentang literatur (20–28 °C / 85–95 %) dibanding rentang dokumen (23–27 °C / 85–95 %). Kolom `%T<20`, `%T>28`: persen waktu di luar batas literatur.

**Catatan metode:** kolom rentang 20–28 berasal dari run dengan preset `literatur` (controller memakai `tempMax` 28; `Ta maks` di tabel ini dari run itu sehingga sedikit berbeda dari §8.4), sedangkan kolom pembanding 23–27 diambil dari run preset dokumen (§8.4, Lampiran B). Jadi perbedaan antar kolom mencampur **definisi rentang** dan **ambang kendali**; arah dan besarnya (malam sejuk) tetap terbaca.

| Kasus | Amplop [varian] | Ta maks | %T<20 | %T>28 | %RH<85 | %RH>95 | %OK rentang 20-28 | %OK rentang 23-27 (pembanding) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Jul, hari rata-rata | A0+W0 [asli] | 27,7 | 1 | 0 | 76 | 0 | 23 | 5 |
| Jul, hari rata-rata | A0+W0 [usulan] | 27,6 | 9 | 0 | 27 | 0 | 64 | 16 |
| Jul, hari rata-rata | A1+W0 [asli] | 26,1 | 2 | 0 | 68 | 0 | 30 | 12 |
| Jul, hari rata-rata | A1+W0 [usulan] | 26,0 | 12 | 0 | 21 | 0 | 67 | 22 |
| Jul, hari rata-rata | A3+W1 [asli] | 25,5 | 0 | 0 | 54 | 0 | 46 | 26 |
| Jul, hari rata-rata | A3+W1 [usulan] | 25,4 | 0 | 0 | 0 | 0 | 100 | 51 |
| Jul, hari terik | A0+W0 [asli] | 29,8 | 0 | 22 | 78 | 0 | 22 | 5 |
| Jul, hari terik | A0+W0 [usulan] | 29,1 | 0 | 14 | 29 | 0 | 65 | 24 |
| Jul, hari terik | A1+W0 [asli] | 27,4 | 0 | 0 | 66 | 0 | 34 | 8 |
| Jul, hari terik | A1+W0 [usulan] | 27,4 | 0 | 0 | 21 | 0 | 79 | 32 |
| Jul, hari terik | A3+W1 [asli] | 26,6 | 0 | 0 | 52 | 0 | 48 | 29 |
| Jul, hari terik | A3+W1 [usulan] | 26,6 | 0 | 0 | 0 | 0 | 100 | 63 |
| Okt, hari terik | A0+W0 [asli] | 32,0 | 0 | 36 | 69 | 0 | 31 | 14 |
| Okt, hari terik | A0+W0 [usulan] | 31,1 | 0 | 34 | 29 | 0 | 58 | 34 |
| Okt, hari terik | A1+W0 [asli] | 29,7 | 0 | 25 | 61 | 0 | 39 | 16 |
| Okt, hari terik | A1+W0 [usulan] | 29,1 | 0 | 17 | 6 | 0 | 80 | 47 |
| Okt, hari terik | A3+W1 [asli] | 28,2 | 0 | 9 | 49 | 0 | 51 | 41 |
| Okt, hari terik | A3+W1 [usulan] | 28,1 | 0 | 3 | 0 | 0 | 97 | 68 |
| Jan, hari rata-rata | A0+W0 [asli] | 28,2 | 0 | 8 | 61 | 0 | 39 | 14 |
| Jan, hari rata-rata | A0+W0 [usulan] | 28,1 | 0 | 7 | 21 | 0 | 79 | 42 |
| Jan, hari rata-rata | A1+W0 [asli] | 26,9 | 0 | 0 | 46 | 0 | 54 | 23 |
| Jan, hari rata-rata | A1+W0 [usulan] | 26,9 | 0 | 0 | 6 | 0 | 94 | 60 |
| Jan, hari rata-rata | A3+W1 [asli] | 26,3 | 0 | 0 | 35 | 0 | 65 | 49 |
| Jan, hari rata-rata | A3+W1 [usulan] | 26,3 | 0 | 0 | 0 | 0 | 100 | 82 |

Perbedaan besar antara dua kolom % OK adalah **definisi rentang**, bukan kualitas kumbung: pada A3+W1 + usulan, % OK 51–82 % untuk 23–27 °C naik menjadi 97–100 % untuk 20–28 °C, karena yang tersisa hanyalah malam yang sejuk (suhu 20–23 °C). Panas di atas 28 °C relevan terutama pada atap asbes polos: 14–22 % waktu pada Juli terik dan 34–36 % pada Oktober terik; dengan atap putih + foil + dinding rapat ≤ 9 % (controller asli) atau ≤ 3 % (usulan).

### 8.8 Cek silang di dunia simulator sendiri

Controller yang sama dijalankan pada `simulate_tick` dengan ambient S1 (bukan model amplop): 3 hari per run, hari ke-2 dan ke-3 dianalisis, 2 seed. Ini memeriksa bahwa S-09 dan S-10 bukan artefak asumsi fisika saya.

| Bulan | Varian | RH rata-rata | RH min | % RH < 85 | % jam malam < 85 | % T > 27 | Pompa (mnt) | Kipas (mnt) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Jan | asli | 82,0 | 55 | 50 | 24 | 13 | 83 | 202 |
| Jan | malam_bebas | 84,0 | 55 | 33 | 1 | 13 | 155 | 202 |
| Jan | usulan | 86,1 | 69 | 32 | 1 | 12 | 192 | 10 |
| Jul | asli | 74,5 | 47 | 70 | 60 | 18 | 104 | 275 |
| Jul | malam_bebas | 76,8 | 47 | 52 | 7 | 18 | 184 | 275 |
| Jul | usulan | 79,9 | 60 | 52 | 7 | 12 | 229 | 10 |
| Okt | asli | 77,6 | 51 | 59 | 38 | 25 | 61 | 381 |
| Okt | malam_bebas | 79,6 | 51 | 43 | 2 | 25 | 130 | 380 |
| Okt | usulan | 83,2 | 64 | 43 | 3 | 20 | 192 | 10 |

Arah temuannya sama dengan di model amplop: lockout membuat 24–60 % jam malam di bawah 85 % (turun menjadi 1–7 % tanpa lockout), dan controller asli menjalankan kipas 202–381 menit/hari. Di dunia simulator, **P1 mematikan kipas hampir seluruhnya (10 menit/hari)**, karena di dunia itu udara dalam selalu hanya ±0,3 K di atas udara luar: kipas tidak pernah punya manfaat pendinginan. Ini juga menunjukkan S-05 dari sisi lain: di simulator kipas "bekerja" (menarik suhu ke ambient) tetapi ambient sudah sama dengan dalam.

### 8.9 Risiko dan batas pada bagian ini

1. P1–P3 diuji **hanya di model** dengan plant buatan saya. Mereka belum menyentuh firmware, belum ada uji Wokwi/perangkat keras.
2. `% OK` terkena penalti malam sejuk; jangan membaca 63 % sebagai "37 % gagal".
3. P2 (tanpa lockout) belum punya bukti keamanan biologis; hanya menghitung air.
4. Kipas pada model 510 m³/jam; kipas lebih besar mengubah keseimbangan (kabut + kipas) dan perlu uji ulang.
5. Interaksi dengan mode panen/jeda (`is_paused`), homogenisasi, dan alarm tidak diuji.
6. Hasil bergantung pada asumsi §5.2; terutama kebocoran dinding (ACH) yang belum diukur.

---

## 9. Rekomendasi bahan bertingkat, biaya, dan keselamatan asbes

### 9.1 Biaya kasar

Harga di bawah dari **listing toko/vendor dan artikel harga** (bukan penawaran). Tanggal halaman dicantumkan; harga lokal Magelang/Yogyakarta bisa berbeda. Luas yang dipakai: atap ±45 m² (termasuk overhang; luas geometris 37,7 m²), dinding 77 m².

| Komponen | Harga listing | Kebutuhan | Perkiraan | Sumber |
|---|---|---|---|---|
| Asbes gelombang 180 × 105 cm | Rp57–67 rb/lembar | ±30 lembar (asumsi 1,5 m² efektif/lembar) | Rp1,7–2,0 jt (rencana awal, bukan tambahan) | builder.id (1 Jun 2026) |
| Cat reflektif "peredam panas" untuk asbes | HeatGard 4 L Rp292 rb (klaim 4 m²/L); 20 L Rp1,51–1,76 jt | 2 lapis × 45 m² = 90 m² ≈ 22 L | Rp1,5–1,8 jt | harga.web.id (30 Mar 2025) |
| Cat putih eksterior biasa | belum ada sumber harga | idem | kemungkinan jauh lebih murah; cek toko lokal [ASUMSI] | — |
| Paranet 65 % (lebar 3 m) | Rp11,5–14 rb/m | ±20 m (60 m²) | Rp0,23–0,28 jt, **belum termasuk rangka/pengikat** | ikhwanalim.com (22 Agu 2025) |
| Bubble foil dua sisi (lebar 1,2 m) | Rp15–25 rb/m; roll Rp0,9–1,5 jt+ | ±41 m (45 m² + tumpang tindih) | Rp0,6–1,0 jt | gnetindonesia.com (30 Jul 2025) |
| Plastik UV 200 µ (14 % UV, lebar 3–4 m) | Rp40–58,5 rb/m | 77 m² | ±Rp1,0–1,1 jt (grade UV; untuk lapisan **dalam** mungkin tidak perlu grade UV, tetapi tidak ada sumber harga plastik biasa) | store.goldenfarm99.com |
| Anyaman bambu / gedek | Rp20–80 rb/m² (tipikal 30–50 rb) | 77 m² | Rp1,5–6 jt (tipikal Rp2,3–3,9 jt) | listing marketplace (biggo.id) |
| Panel sandwich EPS 50 mm (lebar 1,05 m) | Rp371 rb/m' ≈ Rp353 rb/m² | ±45 m² | **±Rp16 jt**, tanpa rangka dan pemasangan | sandwpanel.com (22 Jun 2024) |
| Bata ringan 60 × 20 × 10 cm | Rp6–8 rb/biji ≈ Rp50–67 rb/m² | 77 m² | Rp3,8–5,1 jt hanya bata (tanpa mortar, plester, kolom, upah, pondasi) | jualbataringanmurah.com |

Catatan penting soal panel: model memakai panel **PU 50 mm** (R = 2,1 m²K/W). Harga yang ada sumbernya adalah **EPS 50 mm**, yang konduktivitasnya lebih tinggi (R ≈ 1,3 [ASUMSI k ≈ 0,038 W/mK]). Efek EPS 50 mm kira-kira di antara T1 (R = 1,0; 27,7 °C) dan S1 (R = 2,1; 27,0 °C). Harga PU/PIR 50 mm belum diperoleh.

### 9.2 Tahapan yang direkomendasikan

Efek diukur sebagai penurunan Ta maks (hari terik Juli, aktuator mati, dinding bambu rapat) terhadap asbes polos 30,5 °C.

| Tahap | Tindakan | Ta maks | Δ | Jam > 30 °C (Okt terik) | Biaya kasar | Rp per K* |
|---|---|---:|---:|---:|---|---|
| Pembanding | Asbes polos | 30,5 | — | 6,6 | — | — |
| 0a | + paranet 65 % (A5) | 28,4 | −2,1 | 0,0 | Rp0,23–0,28 jt + rangka | Rp0,11–0,13 jt |
| 0b | + cat putih reflektif (A1) | 28,5 | −2,0 | 1,9 | Rp1,5–1,8 jt | Rp0,75–0,9 jt |
| 0c | cat putih + paranet (A6) | 27,6 | −2,9 | 0,0 | jumlah keduanya | — |
| 1 | cat putih + bubble foil (A3) | 27,2 | −3,3 | 0,0 | cat + Rp0,6–1,0 jt | foil saja: Rp0,46–0,77 jt/K tambahan (A1 → A3: −1,3 K) |
| 2 | Panel sandwich (S1: PU; EPS lebih lemah) | 27,0 | −3,5 | 0,0 | ±Rp16 jt (EPS) | ±Rp4,6 jt (±Rp4 jt bila asbes tidak jadi dibeli) |
| Alternatif lokal | Daun sagu/alang-alang (T1) | 27,7 | −2,8 | 0,0 | belum ada sumber harga | R = 1,0 [ASUMSI] |

\* kasar; harga tanpa rangka/pasang; paranet punya umur pendek (tidak dimodelkan).

**Tahap 0 (sekarang; asbes sementara).**
1. **Pilih satu dari paranet atau cat putih.** Paranet paling murah per kelvin, tetapi umur UV, ketahanan angin, dan rangka belum dihitung. Cat putih lebih tahan angin dan bisa sekaligus berfungsi sebagai pelapis permukaan asbes (lihat §9.4; apakah cat biasa memenuhi fungsi pelapis tidak diverifikasi; tanyakan pemasok pelapis/encapsulant asbes). **Cat harus dirawat**: cat putih kotor/berjamur kehilangan separuh manfaat (A1b).
2. **Dinding:** pertahankan bambu, rapatkan celah, lapisi plastik di sisi dalam, pintu dua lapis. Efek: pompa dan air kabut turun ±2×, suhu ±0,2 K (§7).
3. **Controller:** P1 (sensor suhu luar) + P3 + P2′ (§8). Ini murah dan tidak bergantung pada bahan.
4. **Logger 2 minggu** (§10) sebelum membeli bahan mahal.
5. **Sensor CO₂** bila dinding ≤ 1,5 ACH (§7.3).

**Tahap 1.** Tambah bubble foil dengan celah udara di bawah atap (dengan cat putih = A3). Hasil −3,3 K dan nol jam > 30 °C pada Juli dan Oktober terik. Risikonya: foil berembun/berdebu kehilangan separuh manfaat (A2w, §6.1), dan kondensasi hingga 2,8 L/hari perlu talang/kemiringan.

**Tahap 2 (saat asbes dibuang).** Panel sandwich 50 mm memberi hasil tertinggi (−3,5 K) **dan menghilangkan masalah asbes**; itulah alasan utama membelinya, bukan sekadar suhu. Sebagai pembanding harga, selisih A3 → S1 hanya 0,2 K dengan biaya ±Rp11–12 jt lebih tinggi (±Rp16 jt untuk panel EPS vs ±Rp4,3 jt untuk asbes + cat + foil); jadi **bila asbes tetap dipakai, A3 adalah titik yang efisien**; bila asbes akan dibuang, panel (atau atap berinsulasi lain) adalah tujuannya.

**Dinding (bertahap).** Bambu + plastik (W1) dahulu; bata ringan (W3) hanya bila dana ada: −0,9 K (atap asbes) sampai −1,8 K (atap putih + foil) dengan biaya bata Rp3,8–5,1 jt dan banyak biaya lain; prioritas rendah selama atap belum diperbaiki.

**Catatan kontekstual.** Panduan Dinas LH Banten "Budidaya Jamur Tiram" (2020; **jamur tiram, bukan kuping**; fruiting 22–28 °C / 90–95 %) menyebut dinding kumbung dari "bilik bambu atau tembok permanen" dan atap "genteng, asbes atau rumbia". Itu menunjukkan praktik umum, bukan bukti kinerja.

### 9.3 Klaim label cat dan studi lapangan

- Label produk di halaman harga (Reflecto, HeatGard, Agatha, dan lain-lain) mengklaim penurunan "10–15 °C" sampai "27–30 °C". Pada model saya, mengubah absorptansi 0,60 → 0,15 (cat putih baru ideal) hanya menurunkan **suhu udara** kumbung 3,0 K (30,5 → 27,5 °C; §6.3). Klaim label adalah suhu **permukaan** pada sinar langsung dan umumnya tidak menyertakan penuaan; jangan dipakai untuk memperkirakan kumbung.
- Satu studi lapangan (Revista Arquis, Universidad de Costa Rica): cat putih matte berbasis air, dua lapis pada seng galvanis dengan kuas, memberi selisih rata-rata harian suhu permukaan **0,85 K** (31,0 vs 31,9 °C; p = 0,037), 0,9 K saat langit cerah dan **0 K saat mendung**. Penulis tidak dapat memisahkan efek reflektansi dan emitansi, tidak meneliti penuaan/kotor/jamur, dan menyebut hasilnya "jauh lebih rendah" daripada studi sebelumnya (4–23 °C) yang mungkin karena finishing matte dan pengecatan kuas dibanding semprot glossy. **Pelajaran:** efek cat di lapangan bisa jauh lebih kecil dari model saya. Itu salah satu alasan §10 ada.

### 9.4 Asbes: status hukum dan keselamatan

**Status hukum dan data.**
- Menurut Badan Kebijakan Kemenkes (14 Nov 2025): asbes putih (krisotil) **masih diperbolehkan**, sedangkan jenis lain dilarang; **tidak ada batas aman pajanan**; ±**1.600 kematian per tahun** di Indonesia terkait penyakit akibat asbes; tujuan "Indonesia Bebas Asbes 2035".
- CNN Indonesia (3 Agu 2026): ±13 % rumah tangga masih memakai atap asbes dan ±150.000 ton diimpor per tahun. IBAS (25 Jun 2026): Indonesia mengimpor ±87.600 ton pada 2025. Dua angka ini berbeda sumber dan tahun; keduanya hanya menunjukkan bahwa asbes masih dipakai luas.
- builder.id (1 Jun 2026, **sumber vendor**) menyatakan sebagian besar produk bernama "asbes" kini fiber cement non-krisotil. **Tidak diverifikasi.** Periksa label atau lembar data keselamatan (SDS) produk yang akan dibeli; jangan berasumsi.

**Panduan teknis (Western Australia Dept of Health, 2016; atap asbes-semen).** Atap non-friable yang **utuh dan tidak diganggu** "kecil kemungkinan menimbulkan risiko"; **pelapukan menggerus matriks semen dan membuat serat lebih mudah lepas**; penyegelan/pelapisan permukaan (dioles kuas/roller atau disemprot volume tinggi tekanan rendah) disebut sebagai tindakan pengendalian; pencucian bertekanan tinggi, penyikatan kering, dan alat listrik **tidak boleh** dipakai pada permukaan tersebut; penggantian lebih disukai ("dilepas dan diganti bila praktis atau perlu"). Isi panduan ini dibaca ulang langsung dari dokumennya pada 8 Okt 2026.

**Konsekuensi untuk "asbes sementara" (ringkasan saya dari panduan di atas; bukan nasihat hukum atau medis):**
1. Beli lembar sesuai ukuran; **hindari memotong dan mengebor di lokasi** (debu). Bila harus, minta pemasok memotong di tempat lain atau gunakan metode basah dan masker/respirator yang sesuai.
2. **Jangan menyikat kering, jangan semprot tekanan tinggi, jangan alat listrik** pada permukaan lapuk. Cat atau pelapis dioles dengan kuas/roller.
3. Periksa lembar secara berkala dan ganti yang retak atau rapuh; permukaan yang menua (A0k) juga paling panas.
4. Karena orang bekerja berjam-jam **di bawah** atap itu (panen, pembersihan), jaga agar tidak ada serpihan yang jatuh ke ruang kerja.
5. Tetapkan **tanggal** penggantian ke atap bebas asbes di rencana TA.
6. Kewajiban hukum setempat (Kabupaten Magelang) tidak diperiksa; tanyakan ke dinas terkait.

Dua pernyataan di atas berbeda penekanan: Kemenkes menekankan "tidak ada batas aman", panduan WA menekankan kondisi utuh dan tidak terganggu. Keduanya konsisten dengan keputusan **"hindari asbes baru bila ada alternatif; bila terpaksa, minimalkan gangguan dan jadwalkan penggantian."**

### 9.5 Tidak direkomendasikan atau tidak dimodelkan

- **Menambah debit kipas untuk mendinginkan.** Pada model, kipas 510–2.040 m³/jam hampir tidak mengubah suhu hari terik (§5.4); S-10 menunjukkan kipas justru memblokir kabut.
- **Seng/galvalum polos tanpa insulasi:** tidak dimodelkan; jangan berasumsi lebih baik dari asbes tanpa pengukuran.
- **Foil menempel tanpa celah udara:** manfaat reflektif hilang [ASUMSI/umum]; tidak dimodelkan.
- **Percaya klaim label cat** (§9.3).
- **Merapatkan dinding tanpa memikirkan CO₂** (§7.3).
- **Menghapus night lockout tanpa pemantauan** (§8.5).
- **Plastik bening di atap** (efek rumah kaca): tidak dimodelkan, tidak direkomendasikan [ASUMSI/umum].

### 9.6 Tiga paket anggaran

| Paket | Isi | Biaya tambahan kasar | Ta maks Juli terik (model) |
|---|---|---|---|
| **Hemat** | Atap asbes + paranet 65 % (A5), dinding bambu + plastik dalam (W1), controller P1+P3+P2′, logger, sensor suhu luar | ±Rp1,2–1,4 jt + rangka paranet (paranet Rp0,23–0,28 + plastik Rp1,0–1,1) | 28,3 [A5 + W1] |
| **Menengah** | Atap asbes + cat putih + bubble foil (A3), dinding W1, controller, logger, sensor CO₂ | ±Rp3,1–3,9 jt + sensor CO₂ (cat 1,5–1,8 + foil 0,6–1,0 + plastik 1,0–1,1) | 27,0 [A3 + W1] |
| **Jangka panjang** | Atap panel sandwich (tanpa asbes), dinding W1, controller | ±Rp17 jt + rangka dan upah (panel 16 + plastik 1,0–1,1) | 26,7 [S1 + W1; model PU] |

Ta maks pada kolom terakhir: model free-float, hari terik Juli, aktuator mati (dihitung dengan dinding W1). Pada Oktober terik: A5 + W1 30,0 °C (0 jam > 30 °C), A3 + W1 28,5 °C, S1 + W1 28,1 °C.

---

## 10. Protokol lapangan 2 minggu: mengubah model dari perkiraan menjadi terukur

Tujuan: mengkalibrasi tiga parameter yang paling menentukan dan paling tidak pasti: **penyerapan/pelepasan panas atap** (`α`, `h_o`), **kebocoran dinding** (ACH), dan **sumber uap/panas baglog** (`A_bio`, `q_met`). Tanpa data ini, keputusan bahan didasarkan pada urutan yang tahan uji (§5.4), bukan pada angka.

### 10.1 Alat

- 3 sensor suhu/RH yang sudah ada (A/B/C).
- **+1 sensor suhu/RH luar**, ternaungi dan berventilasi (juga dipakai P1).
- **+1–2 sensor suhu** untuk permukaan bawah atap (dan opsional permukaan baglog).
- Pencatat penggunaan air: meter air kecil atau ember berskala (liter kabut per hari) dan log menit pompa ON.
- **Sensor CO₂** (disarankan; wajib bila dinding ≤ 1,5 ACH).
- Interval catat 1 menit; simpan mentah (bukan hanya rata-rata).

### 10.2 Urutan

| Hari | Kondisi | Yang dicatat | Dipakai untuk |
|---|---|---|---|
| 1–3 | **Free-float 48–72 jam**: pompa dan kipas dimatikan (tanpa baglog bila baglog belum ada; ulangi dengan baglog) | T luar, T dalam A/B/C, RH, T bawah atap | `α`·`h_o` atap (bandingkan Ta maks dengan prediksi A0/A1/...), amplitudo dan keterlambatan |
| 4 | Uji peluruhan CO₂ (§10.3) | CO₂ | ACH dinding |
| 5–10 | **Controller asli** | semuanya + menit pompa/kipas + liter air | pembanding (S-09, S-10 di lapangan) |
| 11–14 | **Controller usulan** (P1+P3+P2′), **selang-seling hari** dengan asli bila memungkinkan (ABAB) untuk mengendalikan cuaca | idem | efek logika |

### 10.3 Pengukuran → parameter

| Parameter model | Cara ukur |
|---|---|
| ACH dinding | Peluruhan CO₂: tutup kumbung; beberapa orang berada di dalam 20–30 menit untuk menaikkan CO₂ (ratusan ppm; aman), lalu keluar dan catat peluruhan; ACH = −d ln(ΔCO₂)/dt dalam 1/jam [IDE, belum diuji]. Ulangi dengan pintu/bukaan tertutup dan terbuka. |
| `α` atap, `h_o` | Selisih Ta maks dan T bawah atap terhadap T luar pada hari cerah, dibandingkan prediksi model untuk atap yang dipasang; bila selisih > 1,5 K, geser `α`/`h_o` hingga cocok. |
| `A_bio` | Timbang 10 baglog tiap minggu; kehilangan bobot ≈ air yang menguap (asumsi model ±2 g/hari/baglog). |
| `q_met` | Selisih T dalam − T luar pukul 02:00–05:00 saat aktuator mati dan atap/dinding sudah dingin. |
| Kebutuhan air | Liter per hari vs prediksi model (10–41 L/hari pada skenario usulan, §8.4). |

### 10.4 Kalibrasi sensor RH

DHT22 memiliki ketelitian terbatas dan dapat menyimpang di RH tinggi dan setelah terkena percikan kabut [ASUMSI/umum]. Uji sederhana dengan larutan garam jenuh dalam wadah tertutup 6 jam atau lebih pada suhu stabil: NaCl jenuh ≈ 75 % RH dan K₂SO₄ jenuh ≈ 97 % RH pada ±25 °C [pengetahuan umum; tidak diverifikasi di sesi ini]. Catat selisih tiap sensor sebelum menafsirkan data RH 85–95 %.

### 10.5 Kriteria memakai model

Model dipakai untuk keputusan bahan bila, pada hari cerah: Ta maks dalam ±1,5 K dari prediksi, RH rata-rata ±5 %, dan liter air per hari ±30 % [ASUMSI]. Bila tidak, kalibrasi dahulu sebelum membeli bahan di atas Tahap 0.

---

## 11. Batas, risiko, dan pertanyaan terbuka

**Model dan data**
1. Seluruh parameter fisik adalah **[ASUMSI]**; urutan opsi tahan uji (26 dari 26), angka mutlak ±1–1,5 K. Parameter yang paling tidak pasti dan paling berpengaruh: `h_o`, ACH dinding, `q_met`, `A_bio`, absorptansi atap yang menua.
2. Hari sintetis dari normal bulanan Muntilan (proksi); tidak ada data per jam di lokasi, tidak ada angin, hujan, dan variasi harian nyata.
3. Foil dan paranet disederhanakan; paranet dikoreksi setelah ketahuan terlalu optimis (§6.4). Harga panel yang ada sumbernya adalah EPS, bukan PU yang dimodelkan.
4. **CO₂ tidak dimodelkan**; angka §7.3 hanyalah urutan besaran.
5. Kebasahan permukaan dan risiko kontaminasi tidak dimodelkan; P2 hanya dinilai dari air.

**Kode**
6. P1–P3 diuji hanya di model; **firmware tidak diubah/diuji**; PHP, kompilasi Arduino, dan browser tidak dijalankan di sesi ini.
7. S1 diterapkan pada **salinan**; `iot_simulator.py` di repo tidak berubah. Patch diperiksa dengan `patch -p1 --dry-run` dan `git apply --check` pada file commit `33a22b2`; hasil tambalan identik byte-per-byte dengan `iot_simulator_S1.py`, dan `--part ambient --days 6 --seeds 4` pada file tertambal mereproduksi tabel §4.2 persis. Smoke test 6 jam simulasi dengan `control_misting`/`control_fan` pada file tertambal berjalan tanpa error.
8. Angka tuning `RENCANA_PERBAIKAN_LOGIKA.md` Lampiran B (mis. F-12) dihitung di ambient lama; temuan logikanya tetap berlaku tetapi **nilai numeriknya harus dihitung ulang** setelah S1 dan setelah S-05 diperbaiki.

**Harga dan hukum**
9. Harga dari listing vendor; tanggal 2024–2026; tidak ada penawaran resmi. Harga plastik non-UV, cat putih eksterior biasa, sensor, panel PU/PIR, dan daun sagu tidak diperoleh.
10. Status hukum asbes dari media dan Badan Kebijakan Kemenkes; teks regulasi tidak diverifikasi.

**Pertanyaan terbuka**
- Lima keputusan WMS dari `ANALISIS_ALUR_BAGLOG_WMS.md` belum dijawab (di luar dokumen ini).
- Strain dan kebutuhan cahaya jamur kuping (relevan untuk paranet gelap) tidak diverifikasi.
- Ambang CO₂ budidaya jamur kuping tidak diverifikasi.
- Apakah malam harus RH 85–95 % (P2/P2′) atau boleh lebih longgar; membutuhkan data lapangan dan keputusan.

---

## Lampiran A — Ketahanan urutan atap (26 variasi)

Ta maks (°C), aktuator mati, dinding bambu rapat. Urutan terdingin → terpanas identik pada seluruh baris.

| Kasus | Variasi parameter | A0 | A1 | A5 | A3 | T1 | S1 | urutan terdingin → terpanas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Juli hari terik | dasar | 30,5 | 28,5 | 28,4 | 27,2 | 27,7 | 27,0 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | langit lembap (dR_roof 30 W/m²) | 31,1 | 29,0 | 28,7 | 27,6 | 28,0 | 27,3 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | langit kering (dR_roof 80 W/m²) | 30,2 | 28,2 | 28,2 | 27,0 | 27,5 | 26,8 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | film luar h_o 10 (tanpa angin) | 31,9 | 29,0 | 28,9 | 27,5 | 28,2 | 27,2 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | film luar h_o 25 (berangin) | 29,2 | 27,9 | 27,9 | 27,0 | 27,2 | 26,8 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | hc_roof 0,8 W/m²K | 30,3 | 28,4 | 28,3 | 27,1 | 27,7 | 27,0 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | hc_roof 2,0 W/m²K | 30,9 | 28,6 | 28,5 | 27,4 | 27,7 | 27,0 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | massa lain 1,5 MJ/K | 30,9 | 28,8 | 28,6 | 27,5 | 27,9 | 27,2 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | massa lain 6 MJ/K | 29,9 | 27,9 | 27,9 | 26,8 | 27,2 | 26,6 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | metabolisme 0 | 30,1 | 28,1 | 28,0 | 26,8 | 27,2 | 26,5 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | metabolisme 0,3 W/kg | 31,3 | 29,3 | 29,1 | 28,2 | 28,6 | 27,9 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | hc_bag 2 W/m²K | 30,8 | 28,8 | 28,7 | 27,7 | 28,0 | 27,3 | S1 < A3 < T1 < A5 < A1 < A0 |
| Juli hari terik | hc_bag 6 W/m²K | 30,3 | 28,3 | 28,2 | 27,0 | 27,4 | 26,7 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | dasar | 32,7 | 30,2 | 30,0 | 28,7 | 29,2 | 28,4 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | langit lembap (dR_roof 30 W/m²) | 33,3 | 30,8 | 30,4 | 29,1 | 29,6 | 28,7 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | langit kering (dR_roof 80 W/m²) | 32,4 | 29,9 | 29,8 | 28,5 | 29,1 | 28,2 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | film luar h_o 10 (tanpa angin) | 34,5 | 31,0 | 30,8 | 29,1 | 30,0 | 28,7 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | film luar h_o 25 (berangin) | 31,0 | 29,4 | 29,3 | 28,3 | 28,6 | 28,1 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | hc_roof 0,8 W/m²K | 32,5 | 30,1 | 29,9 | 28,6 | 29,2 | 28,4 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | hc_roof 2,0 W/m²K | 33,1 | 30,4 | 30,1 | 28,9 | 29,3 | 28,4 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | massa lain 1,5 MJ/K | 33,1 | 30,5 | 30,3 | 28,9 | 29,5 | 28,6 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | massa lain 6 MJ/K | 32,0 | 29,7 | 29,5 | 28,3 | 28,8 | 28,0 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | metabolisme 0 | 32,3 | 29,8 | 29,6 | 28,2 | 28,8 | 27,9 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | metabolisme 0,3 W/kg | 33,5 | 31,0 | 30,8 | 29,6 | 30,2 | 29,3 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | hc_bag 2 W/m²K | 33,0 | 30,5 | 30,3 | 29,1 | 29,6 | 28,7 | S1 < A3 < T1 < A5 < A1 < A0 |
| Oktober hari terik | hc_bag 6 W/m²K | 32,5 | 30,0 | 29,8 | 28,5 | 29,0 | 28,2 | S1 < A3 < T1 < A5 < A1 < A0 |

## Lampiran B — Rincian varian controller (tiga amplop × empat kasus)

Tiga amplop: A0+W0 (asbes polos + bambu rapat), A1+W0 (asbes + cat putih), A3+W1 (cat putih + foil + bambu + plastik). Kolom: `%mlm<85` = % jam malam 21–05 dengan RH < 85; `pompa` dan `kipas` = menit/hari; `air` = L kabut/hari; `#mist`/`#fan` = jumlah siklus per hari.

| Kasus | Amplop [varian] | Ta maks | %T>27 | RH rata | %RH<85 | %mlm<85 | pompa | kipas | air L | #mist | #fan | %OK |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Jul, hari rata-rata | A0+W0 [asli] | 28,1 | 17 | 75,8 | 78 | 100 | 64 | 310 | 13 | 144 | 22 | 5 |
| Jul, hari rata-rata | A0+W0 [malam_bebas] | 28,1 | 17 | 80,8 | 38 | 5 | 117 | 296 | 23 | 290 | 21 | 14 |
| Jul, hari rata-rata | A0+W0 [kipas_pintar] | 27,7 | 12 | 78,5 | 75 | 100 | 100 | 140 | 20 | 186 | 21 | 8 |
| Jul, hari rata-rata | A0+W0 [usulan] | 27,6 | 12 | 83,2 | 34 | 3 | 151 | 141 | 30 | 333 | 17 | 16 |
| Jul, hari rata-rata | A1+W0 [asli] | 26,1 | 0 | 80,5 | 68 | 100 | 89 | 10 | 18 | 194 | 14 | 12 |
| Jul, hari rata-rata | A1+W0 [malam_bebas] | 26,0 | 0 | 85,9 | 21 | 0 | 146 | 10 | 29 | 363 | 13 | 22 |
| Jul, hari rata-rata | A1+W0 [kipas_pintar] | 26,1 | 0 | 80,5 | 68 | 100 | 89 | 10 | 18 | 194 | 14 | 12 |
| Jul, hari rata-rata | A1+W0 [usulan] | 26,0 | 0 | 85,9 | 21 | 0 | 146 | 10 | 29 | 363 | 13 | 22 |
| Jul, hari rata-rata | A3+W1 [asli] | 25,5 | 0 | 82,5 | 54 | 100 | 29 | 10 | 6 | 103 | 13 | 26 |
| Jul, hari rata-rata | A3+W1 [malam_bebas] | 25,4 | 0 | 86,2 | 0 | 0 | 51 | 10 | 10 | 187 | 13 | 51 |
| Jul, hari rata-rata | A3+W1 [kipas_pintar] | 25,5 | 0 | 82,5 | 54 | 100 | 29 | 10 | 6 | 103 | 13 | 26 |
| Jul, hari rata-rata | A3+W1 [usulan] | 25,4 | 0 | 86,2 | 0 | 0 | 51 | 10 | 10 | 187 | 13 | 51 |
| Jul, hari terik | A0+W0 [asli] | 29,9 | 30 | 74,3 | 80 | 100 | 41 | 479 | 8 | 97 | 17 | 5 |
| Jul, hari terik | A0+W0 [malam_bebas] | 29,9 | 30 | 77,8 | 44 | 8 | 78 | 479 | 16 | 202 | 16 | 16 |
| Jul, hari terik | A0+W0 [kipas_pintar] | 29,0 | 23 | 81,4 | 61 | 100 | 148 | 56 | 30 | 179 | 31 | 7 |
| Jul, hari terik | A0+W0 [usulan] | 28,9 | 22 | 86,5 | 15 | 2 | 204 | 20 | 41 | 323 | 19 | 24 |
| Jul, hari terik | A1+W0 [asli] | 27,9 | 18 | 77,4 | 73 | 100 | 49 | 318 | 10 | 116 | 17 | 8 |
| Jul, hari terik | A1+W0 [malam_bebas] | 27,8 | 16 | 81,7 | 32 | 2 | 97 | 298 | 19 | 245 | 23 | 22 |
| Jul, hari terik | A1+W0 [kipas_pintar] | 27,4 | 6 | 80,9 | 66 | 100 | 93 | 10 | 19 | 180 | 13 | 14 |
| Jul, hari terik | A1+W0 [usulan] | 27,4 | 6 | 85,9 | 21 | 1 | 148 | 10 | 30 | 329 | 13 | 32 |
| Jul, hari terik | A3+W1 [asli] | 26,6 | 0 | 82,9 | 52 | 100 | 29 | 10 | 6 | 102 | 14 | 29 |
| Jul, hari terik | A3+W1 [malam_bebas] | 26,6 | 0 | 86,3 | 0 | 0 | 50 | 10 | 10 | 176 | 13 | 63 |
| Jul, hari terik | A3+W1 [kipas_pintar] | 26,6 | 0 | 82,9 | 52 | 100 | 29 | 10 | 6 | 102 | 14 | 29 |
| Jul, hari terik | A3+W1 [usulan] | 26,6 | 0 | 86,3 | 0 | 0 | 50 | 10 | 10 | 176 | 13 | 63 |
| Okt, hari terik | A0+W0 [asli] | 32,1 | 44 | 75,5 | 70 | 73 | 17 | 687 | 3 | 47 | 14 | 14 |
| Okt, hari terik | A0+W0 [malam_bebas] | 32,0 | 44 | 76,9 | 49 | 12 | 34 | 683 | 7 | 97 | 15 | 32 |
| Okt, hari terik | A0+W0 [kipas_pintar] | 31,0 | 42 | 80,9 | 52 | 71 | 111 | 391 | 22 | 117 | 24 | 14 |
| Okt, hari terik | A0+W0 [usulan] | 31,0 | 42 | 82,5 | 30 | 7 | 128 | 388 | 26 | 168 | 19 | 34 |
| Okt, hari terik | A1+W0 [asli] | 29,9 | 35 | 78,7 | 63 | 69 | 22 | 561 | 4 | 57 | 18 | 16 |
| Okt, hari terik | A1+W0 [malam_bebas] | 29,9 | 35 | 80,2 | 41 | 2 | 38 | 564 | 8 | 108 | 16 | 36 |
| Okt, hari terik | A1+W0 [kipas_pintar] | 29,0 | 30 | 85,2 | 38 | 65 | 114 | 11 | 23 | 146 | 16 | 18 |
| Okt, hari terik | A1+W0 [usulan] | 29,0 | 27 | 88,3 | 2 | 0 | 152 | 10 | 30 | 250 | 13 | 47 |
| Okt, hari terik | A3+W1 [asli] | 28,3 | 29 | 81,5 | 55 | 60 | 12 | 495 | 2 | 35 | 20 | 41 |
| Okt, hari terik | A3+W1 [malam_bebas] | 28,3 | 29 | 82,6 | 34 | 0 | 19 | 493 | 4 | 55 | 21 | 59 |
| Okt, hari terik | A3+W1 [kipas_pintar] | 28,1 | 28 | 86,5 | 30 | 59 | 38 | 73 | 8 | 102 | 20 | 42 |
| Okt, hari terik | A3+W1 [usulan] | 28,1 | 24 | 88,8 | 0 | 0 | 51 | 10 | 10 | 153 | 14 | 68 |
| Jan, hari rata-rata | A0+W0 [asli] | 28,4 | 23 | 79,6 | 63 | 79 | 30 | 394 | 6 | 78 | 21 | 14 |
| Jan, hari rata-rata | A0+W0 [malam_bebas] | 28,4 | 23 | 82,2 | 30 | 0 | 60 | 389 | 12 | 169 | 21 | 40 |
| Jan, hari rata-rata | A0+W0 [kipas_pintar] | 28,0 | 21 | 81,8 | 54 | 77 | 66 | 239 | 13 | 118 | 23 | 16 |
| Jan, hari rata-rata | A0+W0 [usulan] | 28,0 | 21 | 84,4 | 22 | 0 | 96 | 238 | 19 | 206 | 24 | 42 |
| Jan, hari rata-rata | A1+W0 [asli] | 26,9 | 0 | 83,3 | 51 | 74 | 55 | 67 | 11 | 128 | 32 | 23 |
| Jan, hari rata-rata | A1+W0 [malam_bebas] | 26,8 | 0 | 86,3 | 10 | 0 | 88 | 61 | 18 | 238 | 30 | 56 |
| Jan, hari rata-rata | A1+W0 [kipas_pintar] | 26,9 | 0 | 83,6 | 46 | 73 | 54 | 10 | 11 | 147 | 15 | 27 |
| Jan, hari rata-rata | A1+W0 [usulan] | 26,9 | 0 | 86,5 | 6 | 0 | 88 | 10 | 18 | 258 | 13 | 60 |
| Jan, hari rata-rata | A3+W1 [asli] | 26,3 | 0 | 85,1 | 35 | 56 | 14 | 10 | 3 | 48 | 13 | 49 |
| Jan, hari rata-rata | A3+W1 [malam_bebas] | 26,3 | 0 | 86,5 | 0 | 0 | 22 | 10 | 4 | 82 | 13 | 82 |
| Jan, hari rata-rata | A3+W1 [kipas_pintar] | 26,3 | 0 | 85,1 | 35 | 56 | 14 | 10 | 3 | 48 | 13 | 49 |
| Jan, hari rata-rata | A3+W1 [usulan] | 26,3 | 0 | 86,5 | 0 | 0 | 22 | 10 | 4 | 82 | 13 | 82 |

Perbandingan `usulan` dengan `usulan_aman` pada keempat kasus (tiga amplop):

**Jul, hari rata-rata**

| Amplop | Varian | RH malam (%) | % jam malam < 85 | Pompa (mnt/hari) | Pompa malam (mnt) | Air (L/hari) | % OK |
|---|---|---:|---:|---:|---:|---:|---:|
| A0+W0 asbes polos + bambu | `asli` | 75,8 | 100 | 64 | 10 | 12,8 | 5 |
| A0+W0 asbes polos + bambu | `usulan_aman` | 80,4 | 77 | 119 | 31 | 23,9 | 8 |
| A0+W0 asbes polos + bambu | `usulan` | 83,2 | 3 | 151 | 66 | 30,2 | 16 |
| A1+W0 asbes + cat putih | `asli` | 80,5 | 100 | 89 | 4 | 17,8 | 12 |
| A1+W0 asbes + cat putih | `usulan_aman` | 83,1 | 69 | 116 | 32 | 23,1 | 12 |
| A1+W0 asbes + cat putih | `usulan` | 85,9 | 0 | 146 | 64 | 29,3 | 22 |
| A3+W1 putih + foil + bambu + plastik | `asli` | 82,5 | 100 | 29 | 0 | 5,8 | 26 |
| A3+W1 putih + foil + bambu + plastik | `usulan_aman` | 85,8 | 14 | 48 | 21 | 9,7 | 36 |
| A3+W1 putih + foil + bambu + plastik | `usulan` | 86,2 | 0 | 51 | 23 | 10,1 | 51 |

**Jul, hari terik**

| Amplop | Varian | RH malam (%) | % jam malam < 85 | Pompa (mnt/hari) | Pompa malam (mnt) | Air (L/hari) | % OK |
|---|---|---:|---:|---:|---:|---:|---:|
| A0+W0 asbes polos + bambu | `asli` | 74,3 | 100 | 41 | 4 | 8,1 | 5 |
| A0+W0 asbes polos + bambu | `usulan_aman` | 83,2 | 61 | 166 | 27 | 33,2 | 7 |
| A0+W0 asbes polos + bambu | `usulan` | 86,5 | 2 | 204 | 66 | 40,8 | 24 |
| A1+W0 asbes + cat putih | `asli` | 77,4 | 100 | 49 | 4 | 9,8 | 8 |
| A1+W0 asbes + cat putih | `usulan_aman` | 83,1 | 59 | 115 | 28 | 23,0 | 14 |
| A1+W0 asbes + cat putih | `usulan` | 85,9 | 1 | 148 | 62 | 29,6 | 32 |
| A3+W1 putih + foil + bambu + plastik | `asli` | 82,9 | 100 | 29 | 0 | 5,9 | 29 |
| A3+W1 putih + foil + bambu + plastik | `usulan_aman` | 85,9 | 13 | 48 | 19 | 9,6 | 48 |
| A3+W1 putih + foil + bambu + plastik | `usulan` | 86,3 | 0 | 50 | 22 | 10,1 | 63 |

**Okt, hari terik**

| Amplop | Varian | RH malam (%) | % jam malam < 85 | Pompa (mnt/hari) | Pompa malam (mnt) | Air (L/hari) | % OK |
|---|---|---:|---:|---:|---:|---:|---:|
| A0+W0 asbes polos + bambu | `asli` | 75,5 | 73 | 17 | 0 | 3,4 | 14 |
| A0+W0 asbes polos + bambu | `usulan_aman` | 82,0 | 38 | 123 | 12 | 24,7 | 24 |
| A0+W0 asbes polos + bambu | `usulan` | 82,5 | 7 | 128 | 18 | 25,6 | 34 |
| A1+W0 asbes + cat putih | `asli` | 78,7 | 69 | 22 | 0 | 4,3 | 16 |
| A1+W0 asbes + cat putih | `usulan_aman` | 87,4 | 26 | 140 | 26 | 27,9 | 30 |
| A1+W0 asbes + cat putih | `usulan` | 88,3 | 0 | 152 | 38 | 30,4 | 47 |
| A3+W1 putih + foil + bambu + plastik | `asli` | 81,5 | 60 | 12 | 0 | 2,4 | 41 |
| A3+W1 putih + foil + bambu + plastik | `usulan_aman` | 88,4 | 0 | 49 | 11 | 9,7 | 67 |
| A3+W1 putih + foil + bambu + plastik | `usulan` | 88,8 | 0 | 51 | 14 | 10,3 | 68 |

**Jan, hari rata-rata**

| Amplop | Varian | RH malam (%) | % jam malam < 85 | Pompa (mnt/hari) | Pompa malam (mnt) | Air (L/hari) | % OK |
|---|---|---:|---:|---:|---:|---:|---:|
| A0+W0 asbes polos + bambu | `asli` | 79,6 | 79 | 30 | 0 | 6,1 | 14 |
| A0+W0 asbes polos + bambu | `usulan_aman` | 83,5 | 31 | 84 | 19 | 16,9 | 26 |
| A0+W0 asbes polos + bambu | `usulan` | 84,4 | 0 | 96 | 30 | 19,1 | 42 |
| A1+W0 asbes + cat putih | `asli` | 83,3 | 74 | 55 | 0 | 11,0 | 23 |
| A1+W0 asbes + cat putih | `usulan_aman` | 85,7 | 25 | 78 | 25 | 15,7 | 39 |
| A1+W0 asbes + cat putih | `usulan` | 86,5 | 0 | 88 | 35 | 17,6 | 60 |
| A3+W1 putih + foil + bambu + plastik | `asli` | 85,1 | 56 | 14 | 0 | 2,7 | 49 |
| A3+W1 putih + foil + bambu + plastik | `usulan_aman` | 86,5 | 0 | 22 | 9 | 4,5 | 82 |
| A3+W1 putih + foil + bambu + plastik | `usulan` | 86,5 | 0 | 22 | 9 | 4,5 | 82 |

## Lampiran C — Sumber

Keandalan: **A** = lembaga/jurnal/panduan resmi; **B** = media/organisasi; **C** = vendor/listing/artikel harga (informatif saja).

| Topik | Sumber | Tanggal halaman | Keandalan |
|---|---|---|---|
| Data iklim | `analisis_iklim_jamur_kuping_koordinat_-7_60555_110_31122.md` (StatsClimat/WorldClim/CRU TS 1991–2020 Muntilan; Weather Atlas RH) | — | A–B |
| Asbes: status dan risiko | Badan Kebijakan Kemenkes — https://www.badankebijakan.kemkes.go.id/saatnya-indonesia-menghirup-udara-bersih-tanpa-asbes-mengakhiri-bahaya-yang-tak-terlihat/ | 14 Nov 2025 | A |
| Asbes: penggunaan | CNN Indonesia — https://www.cnnindonesia.com/gaya-hidup/20260803064902-255-1387830/ancaman-mematikan-di-balik-atap-murah-kenapa-asbes-berbahaya | 3 Agu 2026 | B |
| Asbes: impor | IBAS — https://ibasecretariat.org/lka-indonesia-s-campaign-to-eradicate-asbestos-mortality-2026-update.php | 25 Jun 2026 | B |
| Asbes-semen atap: panduan teknis | Western Australia Dept of Health, *Guidance Note on Asbestos Cement Roofs* — https://www.health.wa.gov.au/~/media/Files/Corporate/general-documents/Asbestos/PDF/GuidanceNoteonAsbestosCementRoofs20162-1.pdf | 2016 | A |
| Cat putih dingin: studi lapangan | Revista Arquis, Universidad de Costa Rica — https://revistas.ucr.ac.cr/index.php/revistarquis/article/download/40232/41088 | — | A |
| Harga asbes | https://www.builder.id/harga-asbes/ | 1 Jun 2026 | C |
| Harga cat peredam panas | https://harga.web.id/harga-cat-peredam-panas-untuk-asbes-all-merek.info | 30 Mar 2025 | C |
| Harga paranet | https://ikhwanalim.com/harga-paranet-1-roll-dan-per-meter/ | 22 Agu 2025 | C |
| Harga bubble foil | https://gnetindonesia.com/blogs/harga-aluminium-foil-atap | 30 Jul 2025 | C |
| Harga plastik UV | https://store.goldenfarm99.com/harga-plastik-uv-per-meter/ | — | C |
| Harga anyaman bambu | https://biggo.id/s/Gedek%20Bambu ; https://www.tokopedia.com/find/gedek-bambu | — | C |
| Harga panel sandwich EPS | https://sandwpanel.com/harga-atap-sandwich-panel-insulatech/ | 22 Jun 2024 | C |
| Harga bata ringan | https://jualbataringanmurah.com/harga-bata-ringan-hebel-yogyakarta/ | — | C |
| Kumbung tiram (konteks) | Dinas LH Banten, *Budidaya Jamur Tiram* — https://dlhk.bantenprov.go.id/storage/dlhk/upload/article/2020/Budidaya_Jamur_Tiram.pdf | 2020 | B |
| Absorptansi material | Tabel IESVE (asbes alami 0,6); Berdahl & Bretz 1997 (cat putih baru 0,15–0,20) | — | A [nilai diingat/dikutip dari catatan kode; tidak dibuka ulang di sesi ini] |

Halaman `nguliday.com`, `taninusantara.id`, dan `bermutu.id` tidak dipakai: dua yang terakhir menolak akses otomatis (robots), yang pertama mengarahkan ke domain lain yang tidak terkait; tidak dicari jalan memutar.

## Lampiran D — Diff controller yang diuji

`usulan` (P1+P2+P3) terhadap `iot_simulator.py` commit `33a22b2` (79 baris). Untuk `usulan_aman` (P1+P3+P2′), hunk lockout diganti blok berikut (menggantikan blok `if is_night:` yang dihapus pada diff di bawah):

```python
        if is_night:
            # [USULAN] malam: histeresis normal berlaku, tapi jeda minimal 600 s antar siklus misting (batasi duty malam)
            if state.misting_last_stop_time > 0 and (time.time() - state.misting_last_stop_time) < 600.0:
                return
```

```diff
--- a/iot_simulator.py
+++ b/iot_simulator.py
@@ -653,4 +653,20 @@
 # ============================================================
 
+FAN_ON_DELTA, FAN_OFF_DELTA = 1.0, 0.0   # [USULAN] K
+
+
+def _fan_useful(state, temp):
+    t_out = getattr(state, 'outdoor_temp', None)
+    if t_out is None:
+        return True
+    ok = getattr(state, '_fan_ok', True)
+    if ok and t_out > temp - FAN_OFF_DELTA:
+        ok = False
+    elif (not ok) and t_out < temp - FAN_ON_DELTA:
+        ok = True
+    state._fan_ok = ok
+    return ok
+
+
 def control_misting(state: KumbungState):
     """
@@ -686,12 +702,8 @@
 
         # [F-10b] Jangan mulai misting saat kondisi kritis (override fan akan langsung memotongnya)
-        if state.get_max_temp() > state.temp_max + CRITICAL_TEMP_OFFSET:
+        if state.get_max_temp() > state.temp_max + CRITICAL_TEMP_OFFSET and _fan_useful(state, temp):
             return
 
         # 0. NIGHT LOCKOUT (17:00 - 06:00 WIB): Misting DILARANG nyala agar jamur tidak tidur basah kuyup
-        if is_night:
-            # Pengecualian darurat ekstrem: hanya boleh nyala jika terjadi dehidrasi parah (relatif terhadap hum_min)
-            if hum >= state.hum_min - 15.0 and min_hum >= state.hum_min - 20.0:
-                return
 
         # Cooldown guard: cegah short-cycling sebelum kabut dari siklus sebelumnya evaporasi penuh
@@ -721,5 +733,5 @@
         if hum < state.rh_trigger_low or temp > state.temp_max:
             # Safety: jangan nyiram kalau RH udah tinggi banget
-            if temp > state.temp_max and hum >= state.hum_max:
+            if temp > state.temp_max and hum >= state.hum_max - 3.0:
                 print(f"   ⚠️  [HOLD] Suhu panas ({temp}°C) TAPI RH tinggi ({hum}%). Pompa DITAHAN!")
                 return
@@ -754,5 +766,5 @@
 
         # Kondisi normal: trigger mati
-        target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max)
+        target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max) or hum >= state.hum_max - 1.0
         if target_reached:
             state.is_misting_active = False
@@ -804,5 +816,5 @@
 
     # 1. Tier 2: Safety Override Suhu Kritis Atas (BYPASS SEMUA DELAY & COOLDOWN!)
-    if max_temp > critical_threshold:
+    if max_temp > critical_threshold and _fan_useful(state, temp):
         # Jika misting sedang aktif, potong/matikan misting agar tidak bentrok dengan kipas darurat
         # (BUG FIX #2: Cleanup lengkap + kirim API log, sama seperti firmware stopMisting())
@@ -855,5 +867,5 @@
     # [F-10a] Histeresis stop Safety Override berlaku 24 jam (siang DAN malam)
     if state.is_fan_active and getattr(state, 'is_critical_override', False):
-        if max_temp <= (critical_threshold - 1.0) and temp <= state.temp_max:
+        if (max_temp <= (critical_threshold - 1.0) and temp <= state.temp_max) or not _fan_useful(state, temp):
             state.is_fan_active = False
             state.is_critical_override = False
@@ -979,5 +991,5 @@
 
     temp_stop_threshold = state.temp_max - TEMP_HYSTERESIS
-    if temp > state.temp_max:
+    if temp > state.temp_max and _fan_useful(state, temp):
         if not state.is_fan_active and not state.is_misting_active:
             can_cool = True
@@ -996,5 +1008,5 @@
                 state.fan_trigger_reason = f"Suhu Tinggi (Avg {temp}°C > {state.temp_max}°C)"
                 print(f"   🌀 [FAN ON] Exhaust Fan AKTIF (Suhu avg {temp}°C > {state.temp_max}°C)")
-    elif temp <= temp_stop_threshold:
+    elif temp <= temp_stop_threshold or not _fan_useful(state, temp):
         if state.is_fan_active and not is_homo and not getattr(state, 'is_night_fan', False):
             state.is_fan_active = False
```

## Lampiran E — Reproduksi

```bash
# dari folder yang berisi iot_simulator.py, simulasi_amplop_kumbung.py, validasi_simulator_vs_iklim.py (Python >= 3.9, hanya stdlib)
python validasi_simulator_vs_iklim.py --sim iot_simulator.py --part all           # (file asli) S-01..S-07, validasi ambient, koefisien, S1 di memori
python validasi_simulator_vs_iklim.py --sim iot_simulator.py --part ambient --days 6 --seeds 4   # §4.2; pada file yang sudah ditambal S1 mengukur S1
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite selftest        # 4 cek konsistensi model
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite roof            # §6.1 (free-float; 12 atap x 4 hari)
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite wall            # §7.1
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite water           # §7.2 tabel kebutuhan air
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite ctl2            # §6.2, §7.2, §8.4, Lampiran B
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite break           # neraca air dan rincian waktu di luar rentang
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite safe            # §8.5 (usulan_aman)
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite lit             # §8.7
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite cross           # §8.8
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite sens            # §5.4 kepekaan
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite sensfree        # §6.3, Lampiran A
python simulasi_amplop_kumbung.py --sim iot_simulator.py --suite trace --trace A0 W0 7 terik --variant usulan   # §8.2
```

Suite berjalan paralel (`--procs`), dan sebagian memerlukan puluhan menit. Seed acak tetap; hasil reproduksi mestinya sama sampai pembulatan.
