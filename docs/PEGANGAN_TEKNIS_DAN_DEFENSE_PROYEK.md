# 🍄 PEDOMAN TEKNIS & PEGANGAN DEFENSE PROYEK AKHIR
**Sistem Otomasi Mikroklimat & Smart SCM/WMS Kumbung Jamur Kuping**
*Lokasi Studi: Muntilan (Salam / Jumoyo, Magelang, Jawa Tengah — ±400 mdpl)*
*Dimensi Kumbung: 5m × 7m × 3.5m (Volume: 122.5 m³, Kapasitas: 3.000 Baglog)*

---

Dokumen ini disusun sebagai **rujukan teknis resmi dan pegangan ilmiah** jika sewaktu-waktu dosen pembimbing atau dosen penguji proyek akhir menanyakan dasar keputusan teknik, fisika termodinamika, biologi jamur, pemilihan sensor, maupun efisiensi air.

---

## 1. STRATEGI FISIK AMPLOP KUMBUNG (PASSIVE COOLING)

Sebelum sistem kontrol IoT bekerja, pertahanan pertama kumbung adalah **amplop bangunan (enclosure)**. Tanpa amplop yang benar, aktuator (kipas/pompa) akan bekerja boros dan sia-sia.

### A. Atap: Asbes + Double-Sided Bubble Foil (Skenario A2/A3)
* **Masalah Asbes Polos (A0):** Asbes memiliki emisivitas tinggi dan menyerap radiasi matahari ($\alpha = 0.60$), menyalurkan panas hingga **$98–102\text{ MJ/hari}$**. Suhu puncak kumbung bisa mencapai **$33.0^\circ\text{C}$** dengan durasi kritis $>30^\circ\text{C}$ selama **7.3 jam** di bulan Oktober.
* **Solusi Bubble Foil:** Dipasang di bawah atap asbes dengan **celah udara (*air gap*) 3–5 cm**.
  * Sisi atas memantulkan radiasi panas balik ke asbes.
  * Sisi bawah memiliki emisivitas radiasi rendah ($\varepsilon \approx 0.05$).
* **Hasil Pengujian Simulasi:**
  * Panas tembus terpangkas hingga **$31\text{ MJ/hari}$ (turun 70%)**.
  * Suhu puncak drop menjadi **$29.4^\circ\text{C}$ (turun $-3.6^\circ\text{C}$)**.
  * Waktu di atas $30^\circ\text{C}$ terpangkas menjadi **0.0 jam (NOL)**.
* **Biaya:** Sangat ekonomis, roll bubble foil lebar 1.2m hanya membutuhkan investasi sekitar **Rp600.000 – Rp1.000.000**.
* **Mitigasi Kondensasi:** Udara lembap kumbung akan mengembun di bawah foil ($\sim 2.8\text{ Liter/hari}$). Foil wajib dipasang dengan kemiringan minimal $15^\circ$ agar tetesan air meluncur ke talang pinggir dan tidak menetes langsung merusak baglog.

### B. Naungan Pohon Alami (Nature's Paranet)
* **Pengaruh Positif:** Bayangan kanopi pohon (~50–65% *shading*) memotong radiasi langsung matahari setara skenario `A5`, menurunkan suhu puncak sekitar **$2.5^\circ\text{C} – 3.0^\circ\text{C}$**.
* **Jebakan Lapangan (Gotcha):**
  1. Daun gugur & kelembapan pohon memicu lumut kerak pada asbes. Asbes berlumut (`A0k`) memiliki koefisien serap panas $\alpha = 0.75$, membuat bagian yang tersengat matahari jam 12:00 siang justru lebih panas ($34.5^\circ\text{C}$).
  2. Pohon menjadi sarang lalat jamur (*Phorid/Sciarid*) dan spora jamur kompetitor (*Trichoderma*).
* **Solusi:** Pohon tetap dimanfaatkan sebagai peneduh luar, dahan tepat di atas atap dipangkas berjarak 2–3 meter, dan Bubble Foil tetap wajib dipasang di sisi dalam plafon.

### C. Dinding Plastik Menggantung (Drainase CO₂ Pasif)
* **Masalah Biologis Jamur:** Jamur kuping bernapas menghasilkan $\text{CO}_2$. Karbondioksida berlebih ($>1.000\text{ ppm}$) menghambat pembentukan tubuh buah dan membuat jamur berkerut/cacat.
* **Prinsip Fisika Massa Jenis Gas:**
  $$\text{Massa Molar }\text{CO}_2 = 44\text{ g/mol} \quad > \quad \text{Massa Molar Udara Bersih} = 29\text{ g/mol}$$
  Gas $\text{CO}_2$ secara alami lebih berat dan **mengendap di permukaan lantai**.
* **Desain Solusi:** Lapisan plastik dalam digantung menyisakan **celah 20–30 cm dari lantai**.
  * $\text{CO}_2$ yang mengendap akan mengalir keluar secara alami melalui celah bawah tanpa perlu menyedot daya kipas 24 jam.
* **Perlindungan Anti-Hama:** Celah 20–30 cm wajib ditutup rapat menggunakan **kassa nyamuk / insect screen (Mesh 30–50)** agar lalat jamur dan serangga tidak bisa menerobos masuk.

---

## 2. KALKULASI & SIMULASI KEBUTUHAN AIR MISTING

Berdasarkan pemodelan psikrometrik Magnus dan neraca massa uap air di kumbung volume $122.5\text{ m}^3$ untuk mempertahankan target ideal ($26^\circ\text{C}$ dan $88\%\text{ RH}$):

### A. Kebutuhan Air Fisika Teoretis (Air Laten Saja)
Laju kehilangan uap air tergantung tingkat kebocoran udara ruangan (*Air Changes per Hour* / ACH):

| Kebocoran Dinding (ACH) | Musim Hujan (Januari, RH 80%) | Musim Kemarau (Juli, RH 70%) | Transisi Terik (Oktober, RH 75%) |
| :--- | :---: | :---: | :---: |
| **1.0 ACH** (Sangat Rapat) | 13 L/hari | 21 L/hari | 14 L/hari |
| **1.5 ACH** (Bambu + Plastik UV) | **20 L/hari** | **31 L/hari** | **21 L/hari** |
| **4.0 ACH** (Anyaman Bambu Biasa) | 52 L/hari | 84 L/hari | 57 L/hari |
| **8.0 ACH** (Bambu Jarang / Bocor) | 105 L/hari | 167 L/hari | 114 L/hari |

> **Takeaway Utama:** Pemasangan dinding plastik UV menekan kebocoran dari 4.0 ACH menjadi 1.5 ACH, yang secara langsung **menghemat kebutuhan air hingga 63% per hari**!

### B. Konsumsi Air Riil Controller & Rekomendasi Hardware
* Simulator menggunakan nozzle kabut mikro dengan debit $\approx 0.2\text{ Liter/menit}$ per nozzle.
* Pada instalasi nyata dengan **4–6 titik nozzle kabut (0.15–0.2mm)**:
  * Debit total nozzle: $\sim 0.8 – 1.2\text{ Liter/menit}$.
  * Pompa beroperasi rata-rata 30–60 menit total per hari (terbagi dalam puluhan siklus pendek 30–60 detik).
  * **Konsumsi air harian di lapangan: 30 – 70 Liter/hari.**
* **Rekomendasi Toren:** Siapkan toren air berkapasitas **minimal 300 – 500 Liter**. Kapasitas ini cukup untuk menopang kebutuhan misting selama 5–7 hari operasional tanpa risiko pompa kering (*dry-running*).

---

## 3. PARAMETER BIOLOGIS & AMUNISI TANYA-JAWAB DOSEN

### Q1: "Kenapa batas bawah suhu di sistem diatur 20°C, bukan 23°C seperti jurnal tertentu?"
* **Jawaban:**
  * Di dataran menengah Muntilan (Salam/Jumoyo, ±400 mdpl), data historis iklim menunjukkan suhu subuh alami bulan Juli–Agustus turun hingga **$18.9^\circ\text{C} – 19.5^\circ\text{C}$**.
  * Jamur kuping (*Auricularia auricula-judae*) pada fase pembentukan tubuh buah (*fruiting*) memiliki rentang toleransi biologis **$20^\circ\text{C} – 28^\circ\text{C}$**. Penurunan suhu subuh (termoperiode) justru merangsang pembentukan primordia.
  * Jika batas bawah dipatok kaku $23^\circ\text{C}$, sistem akan mengalami *false alarm* (notifikasi bahaya palsu) setiap subuh, padahal kondisi tersebut normal dan aman.

### Q2: "Kenapa Exhaust Fan siang hari diuji dulu 60 detik (P1 Trial Probe)?"
* **Jawaban:**
  * Fan menyedot udara dalam keluar, yang berarti udara luar otomatis terhisap masuk lewat celah ventilasi ($Q_{\text{in}} = Q_{\text{out}}$).
  * Jika suhu luar sedang $33^\circ\text{C}$ dan suhu dalam $29^\circ\text{C}$, menyalakan kipas justru akan **memasukkan udara panas luar dan membakar kumbung**.
  * Sistem menguji probe selama 60 detik: jika suhu tidak turun minimal $\ge 0.3^\circ\text{C}$, sistem menyimpulkan udara luar lebih panas/tidak efektif, mematikan kipas, dan mengunci kipas (*lockout*) selama 15 menit agar misting bisa mendinginkan ruangan via pendinginan evaporatif (*evaporative cooling*).

### Q3: "Kenapa ada P3 Pagar RH saat suhu panas?"
* **Jawaban:**
  * Misting menurunkan suhu dengan menyemprotkan air, tapi efek sampingnya menaikkan RH.
  * Jika suhu panas ($T > 32^\circ\text{C}$) tapi udara sudah mendekati jenuh ($RH \ge 92\%$), menyemprotkan air terus-menerus tidak akan mendinginkan udara lagi (udara jenuh tidak bisa menguapkan air).
  * Misting yang dipaksakan hanya akan menciptakan tetesan air liar di baglog yang memicu jamur busuk. Pagar RH menahan misting saat $RH \ge RH_{\max} - 3\%$ dan mematikan saat $RH \ge RH_{\max} - 1\%$.

### Q4: "Kenapa ada jeda 10 menit (P2') pada misting malam hari?"
* **Jawaban:**
  * Malam hari tidak ada radiasi matahari, penguapan sangat lambat, dan respirasi jamur aktif.
  * Misting terus-menerus di malam hari membuat baglog "tidur basah kuyup" dan mengundang bakteri pembusuk. Misting malam hanya diizinkan dalam kondisi darurat ekstrem dengan jeda istirahat wajib minimal 600 detik (10 menit).

### Q5: "Sensor SHT30 IP68 apakah aman dari semprotan misting?"
* **Jawaban:**
  * Casing sinter logam SHT30 memang tahan debu/cipratan, tetapi jika terkena semprotan langsung butiran air nozzle, membran filternya akan tertutup air dan sensor akan membaca $99.9\%\text{ RH}$ secara konstan selama 1–2 jam sampai kering.
  * Solusi pemasangan: setiap sensor dilengkapi pelindung payung mini (*radiation/droplet shield*) agar terlindung dari semprotan vertikal langsung namun tetap mendapatkan sirkulasi udara horizontal secara presisi.

---

## 4. BUKTI EMPIRIS: LOG AKTUATOR DATABASE (`sprinkler_logs`)

Sistem tidak hanya mengontrol, tetapi juga mencatat bukti empiris ke tabel database `sprinkler_logs`:
* `device_id`: ID alat (`ESP32-KUMBUNG-01` / `SIM-KUMBUNG-01`)
* `actuator`: Jenis aktuator (`misting` atau `fan`)
* `duration_seconds`: Durasi riil menyala per siklus
* `trigger_reason`: Alasan menyala (misal: `"Suhu Tinggi (Avg 32.4C > 32.0C)"`, `"Safety Override Rak Terkering"`)
* `stop_reason`: Alasan mati (misal: `"Target tercapai"`, `"Pagar RH tercapai"`, `"Uji probe 60s gagal (Kipas dikunci 15 mnt)"`)

Data ini menjadi bukti konkret dalam evaluasi proyek bahwa kontrol sistem bekerja adaptif berbasis sains fluida dan termodinamika.
