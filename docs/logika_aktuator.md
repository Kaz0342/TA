# Logika Otomatisasi Aktuator (Misting & Fan) — Firmware v3.6
**Smart Shroom SCM — Tugas Akhir Sistem Informasi**

Dokumen ini menjelaskan alur logika kendali (*control logic*) bagaimana mikrokontroler ESP32 memutuskan kapan harus mengaktifkan dan menonaktifkan Pompa Air (Misting Nozzle), Solenoid Valve, dan Exhaust Fan. Sistem mengimplementasikan kendali umpan-balik tertutup (*closed-loop feedback control*) berbasis **Histeresis Dinamis (Dynamic Hysteresis)**, **P1–P3 Climate Defense Architecture**, **Safety Multi-Tier Protection**, dan **Fluid Dynamics Failsafe Guard** untuk menjamin kestabilan mikroklimat jamur kuping (*Auricularia auricula-judae*).

---

## 1. Sumber Data: Weighted Sensor Fusion (3 Sensor Vertikal)

Kumbung menggunakan **3 sensor suhu & RH SHT30 / SHT31 Probe IP68 Waterproof** (via multiplexer TCA9548A) yang ditempatkan secara **Segitiga Diagonal** untuk memantau stratifikasi mikroklimat (Atas, Tengah, Bawah):
- **Sensor A (Zona Atas, 2.5m, dekat pintu):** Bobot $35\%$ — Area paling panas dan rentan kering akibat udara hangat yang naik (*stack effect*).
- **Sensor B (Zona Tengah, 1.5m, pusat kumbung):** Bobot $40\%$ — Representasi inti ketinggian baglog produktif.
- **Sensor C (Zona Bawah, 0.5m, pojok belakang):** Bobot $25\%$ — Area paling dingin, lembab, dan tempat akumulasi gas $\text{CO}_2$.

$$T_{\text{avg}} = \frac{0.35 \cdot T_A + 0.40 \cdot T_B + 0.25 \cdot T_C}{1.0}, \quad RH_{\text{avg}} = \frac{0.35 \cdot RH_A + 0.40 \cdot RH_B + 0.25 \cdot RH_C}{1.0}$$

Nilai rata-rata tertimbang inilah yang dikirim ke Laravel API dan dievaluasi oleh *decision engine* aktuator setiap 5 detik.

---

## 2. Variabel Batasan (Threshold) & Histeresis Dinamis

Threshold diambil secara berkala (tiap 30 detik) dari Web Dashboard via endpoint `GET /api/thresholds/active`:
- `tempMax`: Batas atas suhu aman (°C) — *Default Fase Fruiting: 32.0°C*
- `tempMin`: Batas bawah suhu (°C) — *Default Fase Fruiting: 24.0°C (toleransi alamiah 20.0°C)*
- `humMin`: Batas bawah kelembaban relatif (%) — *Default Fase Fruiting: 80.0% s.d. 85.0%*
- `humMax`: Batas atas kelembaban relatif (%) — *Default Fase Fruiting: 95.0%*

### Histeresis Misting Stop (Solusi Anti-Lancip & Anti-Timeout)
Target stop misting dirancang dengan kurva histeresis landai adaptif terhadap rentang preset (F-12):
$$\text{rhTriggerLow} = \text{humMin}$$
$$\text{rhTriggerHigh} = \text{humMin} + \min(3.0, \, 0.5 \cdot (\text{humMax} - \text{humMin}))$$

*Contoh Kasus Fase Fruiting (humMin = 85.0%, humMax = 95.0%, Rentang = 10.0%):*
- $\text{rhTriggerHigh} = 85.0 + \min(3.0, 5.0) = 88.0\%$.
- Pompa misting **START** saat $RH < 85.0\%$.
- Pompa misting **STOP** saat $RH \ge 88.0\%$ dan $T \le 32.0^\circ\text{C}$.
- Rentang *deadband* $3.0\%$ memberikan jeda relaksasi 15–25 menit di antara siklus penyemprotan, menghemat masa pakai pompa, menghasilkan kurva kelembapan yang melengkung landai (*smooth parabolic curve*), serta memastikan target tercapai tanpa terjegal *Safety Timeout* (tingkat kegagalan timeout turun dari 97% ke 0%).

---

## 3. Logika Kendali Misting (Pompa & Solenoid Valve)

Misting bertugas meningkatkan kelembaban udara kumbung dan memberikan efek pendinginan evaporatif (*evaporative cooling*).

### A. Kondisi Misting Menyala (ON)
1. **Tier 1 (Normal):** $RH_{\text{avg}} < \text{rhTriggerLow}$ ATAU $T_{\text{avg}} > \text{tempMax}$.
2. **Tier 2 (Safety Override Rak Atas Dinamis — F-11):** 
   Ambang darurat tidak lagi di-hardcode $75\%$, melainkan proporsional terhadap preset fase:
   $$\text{criticalLowRh} = \text{humMin} - 10.0\%$$
   Jika ada sensor lokal yang mengalami kekeringan ekstrem ($\min(RH) < \text{criticalLowRh}$), sistem menjalankan **Pulse Misting (30 detik)** untuk melembabkan rak atas tanpa membanjiri rak bawah.

### B. Proteksi & Interlock Misting (Termasuk P2' & P3)
- **Interlock Kipas:** Misting DILARANG aktif jika Exhaust Fan sedang berputar (mencegah kabut mikro tersedot keluar sebelum mendarat di baglog).
- **Night Misting Guard (P2' — Jeda Wajib 600s):** Di malam hari (17:00 – 06:00 WIB), misting DITAHAN secara ketat. Pengecualian darurat ekstrem hanya boleh aktif jika terjadi dehidrasi parah ($RH_{\text{avg}} < \text{humMin} - 15\%$ dan $\min(RH) < \text{humMin} - 20\%$). Jika aktif, wajib ada **jeda minimal 600 detik (10 menit)** sebelum boleh menyala kembali, mencegah jamur tidur basah kuyup.
- **Pagar RH (P3 — Anti Over-Saturation):**
  - **Hold:** Saat suhu panas ($T > \text{tempMax}$), misting DITAHAN jika kelembaban sudah mendekati jenuh ($RH \ge \text{humMax} - 3.0\%$), karena udara jenuh tidak mampu menyerap uap air lagi untuk pendinginan laten.
  - **Stop:** Misting langsung DIMATIKAN seketika jika $RH \ge \text{humMax} - 1.0\%$ untuk mencegah tetesan air liar di baglog.
- **Critical Temperature Guard (F-10b):** Misting DITAHAN jika salah satu sensor mengalami suhu kritis ($\max(T) > \text{tempMax} + 2.0^\circ\text{C}$) karena kipas pendingin akan langsung memotongnya.
- **Evaporation Cooldown Guard (150 detik):** Setelah misting mati, pompa dikunci selama 2.5 menit untuk memberikan waktu bagi butiran kabut mikro menguap ke udara kumbung sebelum sistem mengevaluasi kembali.
- **Emergency Safety Timeout (90 detik — F-12):** Jika dalam 90 detik sensor belum mencapai target, pompa dimatikan paksa demi mencegah genangan air pada lantai kumbung.

---

## 4. Logika Kendali Exhaust Fan (Sirkulasi & Pendinginan)

Exhaust Fan berfungsi membuang udara panas, meratakan stratifikasi udara (homogenisasi), dan membuang gas $\text{### A. Mode Siang Hari (06:00 - 17:00 WIB — Termasuk P1)
1. **Tier 1 — Pendinginan Siang & Evaluasi Uji Probe 90s (P1):**
   - **START:** $T_{\text{avg}} > \text{tempMax}$ (misal $> 32.0^\circ\text{C}$) dan kipas tidak dalam masa lockout (`isFanUseful()`).
   - **Uji Probe 90s (P1 — Opsi B):** Begitu kipas pendinginan aktif, timer probe 90s berjalan. Jika setelah 90 detik penurunan suhu $\Delta T < 0.2^\circ\text{C}$ (artinya udara luar sama panas/lebih panas dari dalam), kipas **DIMATIKAN** dan dikenakan **Lockout 15 Menit (900s)** agar misting bebas melakukan *evaporative cooling*.
   - **STOP Normal:** $T_{\text{avg}} \le \text{tempMax} - 1.5^\circ\text{C}$ (Histeresis pendinginan $30.5^\circ\text{C}$).
   - **Safety Timeout:** Maksimal 180 detik (3 menit) menyala terus-menerus, dengan *anti-chattering cooldown* 60 detik.
2. **Tier 2 — Safety Override Suhu Kritis (F-10):**
   - Jika $\max(T) > \text{tempMax} + 2.0^\circ\text{C}$ (misal $> 34.0^\circ\text{C}$ di rak atas), fan **DIPAKSA ON** mem-bypass seluruh timer cooldown dan lockout probe. Misting yang sedang berjalan akan langsung dipotong.
   - **Histeresis Stop 24 Jam (F-10a):** Fan baru dimatikan jika $\max(T) \le (\text{criticalThreshold} - 1.0^\circ\text{C})$ dan $T_{\text{avg}} \le \text{tempMax}$. Aturan ini berlaku 24 jam penuh (siang dan malam).
3. **Tier 3 — Homogenisasi Sirkulasi Vertikal:**
   - Jika disparitas kelembaban vertikal $|RH_A - RH_C| > 12.0\%$, fan menyala kilat **30 detik** untuk mengaduk udara dan menyamaratakan mikroklimat.
   - Dilengkapi *cooldown* 15 menit (900 detik) agar tidak mengganggu ketenangan udara kumbung.

### B. Mode Malam Hari (17:00 - 06:00 WIB)
1. **Pemicu 1 — Over-Humidity Purge ($RH \ge 96.0\%$):** Mencegah kondensasi air menetes langsung ke jamur. Durasi 45 detik, cooldown 30 menit.
2. **Pemicu 2 — Periodic $\text{CO}_2$ Flush (Tiap 60 Menit):** Membuang akumulasi gas $\text{CO}_2$ di atas lantai agar sirkulasi $\text{O}_2$ segar terjaga.
3. **Reset Timer Transisi Malam (F-15b):** Saat terjadi transisi siang $\to$ malam (17:00 WIB), timer periodik malam di-reset ke waktu sekarang (`lastNightPeriodicFanTime = now`) untuk mencegah kipas menyala seketika di perbatasan jam.

### C. Settling Delay Guard (60 detik)
Setelah misting mati, fan dilarang menyala selama 60 detik untuk memberi kesempatan kabut mikro mengendap pada permukaan baglog dan tidak terbuang percuma keluar ventilasi.

---

## 5. Ringkasan Matriks Parameter Operasional Pasca-Hardening

| Komponen | Parameter | Nilai Terkini (v3.6 Hardened) | Deskripsi / Tujuan |
| :--- | :--- | :--- | :--- |
| **Misting** | Stop Histeresis Target | $\text{humMin} + \min(3.0, 0.5 \cdot \Delta RH)$ | Kurva landai (88% di Fruiting), timeout 97% $\to$ 0% |
| **Misting** | Emergency Timeout | 90 detik | Memberi ruang dispersi nozzle tanpa memicu genangan |
| **Misting** | Evaporation Cooldown | 150 detik (2.5 mnt) | Waktu evaporasi butiran kabut ke molekul gas RH |
| **Misting** | Settling Delay | 60 detik | Tahan fan setelah misting agar kabut tidak terbuang |
| **Misting** | Pulse Misting (Tier 2) | 30 detik ($\min(RH) < \text{humMin} - 10\%$) | Melembabkan rak atas kering secara proporsional |
| **Misting** | Night Guard Interval (P2') | 600 detik (10 mnt) | Jeda wajib antar-misting darurat malam hari |
| **Misting** | Pagar RH Hold (P3) | $RH \ge \text{humMax} - 3.0\%$ saat $T > \text{tempMax}$ | Tahan semprot jika udara mendekati titik jenuh |
| **Misting** | Pagar RH Stop (P3) | $RH \ge \text{humMax} - 1.0\%$ | Stop seketika cegah genangan air di baglog |
| **Fan** | Probe Siang Durasi (P1) | 90 detik | Durasi uji pendinginan udara luar siang hari |
| **Fan** | Probe Min Drop (P1) | $\ge 0.2^\circ\text{C}$ dalam 90s | Ambang efektifitas pendinginan kipas siang |
| **Fan** | Probe Lockout (P1) | 900 detik (15 mnt) | Kunci kipas jika probe gagal (luar lebih panas) || Kunci kipas jika probe gagal (luar lebih panas) |
| **Fan** | Homogenisasi Durasi | 30 detik | Sirkulasi aduk udara saat disparitas vertikal $> 12\%$ |
| **Fan** | Homogenisasi Cooldown | 900 detik (15 mnt) | Relaksasi sirkulasi udara kumbung |
| **Fan** | Cooling Max Timeout | 180 detik (3 mnt) | Dikecualikan untuk Safety Override suhu kritis |
| **Fan** | Cooling Cooldown | 60 detik | Mencegah relay fan chattering di batas suhu |
| **Fan** | Safety Override | $T > \text{tempMax} + 2.0^\circ\text{C}$ | Bypass cooldown jika sensor atas kritis ($> 34^\circ\text{C}$) |
| **Fan** | Override Hysteresis | $\max(T) \le \text{critical} - 1.0^\circ\text{C}$ | Histeresis stop 24 jam, pangkas chatter 92.4% |
| **Fan** | Night Purge Durasi | 45 detik | Buang uap jenuh malam ($RH \ge 96\%$) |
| **Fan** | Night Purge Cooldown | 1800 detik (30 mnt) | Jeda antar-purge kelembaban jenuh malam |
| **Fan** | Night $\text{CO}_2$ Flush | 3600 detik (60 mnt) | Siklus berkala pembuangan endapan $\text{CO}_2$ lantai |

---

## 6. Logika Failsafe Interupsi Panen (Harvest Pause Mode & Fluid Dynamics Guard)

### A. Alasan Penggunaan Failsafe Timer (`millis()`)
Kontrol jarak jauh untuk mematikan pompa misting dan kipas secara manual **wajib menggunakan timer interupsi berbasis waktu**, bukan tombol switch on/off manual biasa. Hal ini untuk mencegah *human error* fatal di mana petani lupa menyalakan kembali sistem otomasi setelah keluar kumbung. Durasi pause dibatasi maksimal 8 jam (28.800 detik) untuk menjaga keselamatan jamur (F-03).

### B. Polling Cepat Reduksi Latensi (< 8 Detik — F-14)
ESP32 melakukan polling cepat ke endpoint `GET /api/device/command` setiap **8 detik** (`commandInterval = 8000`), terpisah dari polling threshold yang berdurasi 30 detik. Begitu petani mengklik "Mulai Jeda Panen" di dashboard, ESP32 merespons dalam waktu $<8$ detik dan seketika mematikan kipas dan pompa sebelum pintu dibuka.

### C. Fluid Dynamics Guard & Instant-Read
- **Exhaust Fan WAJIB MATI SEKETIKA**: Menghindari fenomena *Short-Circuiting Aliran Udara* di mana udara luar ditarik langsung ke ventilasi tanpa menyapu lorong baglog.
- **Pompa Misting WAJIB MATI**: Melindungi pekerja dari semprotan air kabut bertekanan tinggi saat memetik jamur.
- **Instant-Read Resume**: Saat jeda berakhir, ESP32 seketika melakukan pembacaan instan ketiga sensor SHT30/SHT31 untuk menstabilkan iklim tanpa menunggu siklus 5 detik.

---

## 7. Ketahanan Jaringan & Integritas Firmware (Offline Resilience)

1. **Non-Blocking Loop & WiFi Reconnect (F-07):**
   Loop utama ESP32 tidak lagi tertahan (*freeze*) saat WiFi terputus. Jika sambungan putus, ESP32 mencoba reconnect tiap 15 detik secara asinkron tanpa menahan eksekusi logika kontrol suhu, kelembaban, dan watchdog.
2. **Antrean Log RAM Circular Buffer (F-08):**
   Log aktuator disimpan ke antrean RAM 10 slot (`PendingLog logQ[10]`) saat offline dan dikirim secara bertahap (1 log per 3 detik) begitu internet pulih.
3. **Penyaringan Data Sensor Basi (F-08):**
   Data telemetri hanya dikirim ke server jika sensor berhasil dibaca dalam 15 detik terakhir (`lastValidReadMs < 15000`). Jika semua sensor mati, misting dimatikan demi biosekuriti.
4. **Penanganan Jam NTP Dinamis (F-09):**
   Fungsi `getCurrentHourWIB()` mengembalikan nilai `-1` jika jam NTP belum sinkron, dan aturan malam hanya aktif jika jam valid (`isNightHour(h)`).
5. **Precharge Relay Safe Latch (F-15d):**
   Semua pin kontrol relay di-set `digitalWrite(pin, RELAY_OFF)` **sebelum** `pinMode(pin, OUTPUT)` pada inisialisasi boot untuk mencegah letupan sinyal (*relay glitch pulse*) saat mikrokontroler pertama kali dinyalakan.

