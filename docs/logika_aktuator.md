# Logika Otomatisasi Aktuator (Misting & Fan) — Firmware v3.5
**Smart Shroom SCM — Tugas Akhir Sistem Informasi**

Dokumen ini menjelaskan alur logika kendali (*control logic*) bagaimana mikrokontroler ESP32 memutuskan kapan harus mengaktifkan dan menonaktifkan Pompa Air (Misting Nozzle), Solenoid Valve, dan Exhaust Fan. Sistem mengimplementasikan kendali umpan-balik tertutup (*closed-loop feedback control*) berbasis **Histeresis Dinamis (Dynamic Hysteresis)** dan **Safety Multi-Tier Protection** untuk mencegah aktuator menyala-mati terlalu sering (*short-cycling / flickering*) yang dapat merusak relay serta membuat fluktuasi mikroklimat tidak stabil.

---

## 1. Sumber Data: Weighted Sensor Fusion (3 Sensor Vertikal)

Kumbung menggunakan **3 sensor DHT22** yang ditempatkan secara **Segitiga Diagonal** untuk memantau stratifikasi mikroklimat (Atas, Tengah, Bawah):
- **Sensor A (Zona Atas, 2.5m, dekat pintu):** Bobot $35\%$ — Area paling panas dan rentan kering akibat udara hangat yang naik (*stack effect*).
- **Sensor B (Zona Tengah, 1.5m, pusat kumbung):** Bobot $40\%$ — Representasi inti ketinggian baglog produktif.
- **Sensor C (Zona Bawah, 0.5m, pojok belakang):** Bobot $25\%$ — Area paling dingin, lembab, dan tempat akumulasi gas $\text{CO}_2$.

$$T_{\text{avg}} = \frac{0.35 \cdot T_A + 0.40 \cdot T_B + 0.25 \cdot T_C}{1.0}, \quad RH_{\text{avg}} = \frac{0.35 \cdot RH_A + 0.40 \cdot RH_B + 0.25 \cdot RH_C}{1.0}$$

Nilai rata-rata tertimbang inilah yang dikirim ke Laravel API dan dievaluasi oleh *decision engine* aktuator setiap 5 detik.

---

## 2. Variabel Batasan (Threshold) & Histeresis Dinamis

Threshold diambil secara berkala (tiap 30 detik) dari Web Dashboard via endpoint `GET /api/thresholds/active`:
- `tempMax`: Batas atas suhu aman (°C) — *Default Fase Fruiting: 32.0°C*
- `tempMin`: Batas bawah suhu (°C) — *Default Fase Fruiting: 24.0°C*
- `humMin`: Batas bawah kelembaban relatif (%) — *Default Fase Fruiting: 80.0% s.d. 85.0%*
- `humMax`: Batas atas kelembaban relatif (%) — *Default Fase Fruiting: 95.0%*

### Histeresis Misting Stop (Solusi Anti-Lancip)
Pada versi awal, target stop misting dipatok terlalu dekat dengan `humMin` ($+2\%$), menyebabkan pompa menyala sebentar lalu mati dalam 25 detik, menghasilkan grafik gerigi lancip (*sawtooth wave*). Pada v3.5, sistem menerapkan formula histeresis kurva landai:
$$\text{rhTriggerLow} = \text{humMin}$$
$$\text{rhTriggerHigh} = \min(\text{humMax} - 4.0, \, \text{humMin} + 5.0)$$

*Contoh Kasus Fase Fruiting (humMin = 85.0%, humMax = 95.0%):*
- Pompa misting **START** saat $RH < 85.0\%$.
- Pompa misting **STOP** saat $RH \ge 90.0\%$ dan $T \le 32.0^\circ\text{C}$.
- Rentang *deadband* $5.0\%$ memberikan jeda relaksasi 15–25 menit di antara siklus penyemprotan, menghemat masa pakai pompa dan menghasilkan kurva kelembapan yang melengkung landai (*smooth parabolic curve*).

---

## 3. Logika Kendali Misting (Pompa & Solenoid Valve)

Misting bertugas meningkatkan kelembaban udara kumbung dan memberikan efek pendinginan evaporatif (*evaporative cooling*).

### A. Kondisi Misting Menyala (ON)
1. **Tier 1 (Normal):** $RH_{\text{avg}} < \text{rhTriggerLow}$ ATAU $T_{\text{avg}} > \text{tempMax}$.
2. **Tier 2 (Safety Override Rak Atas):** Jika ada sensor lokal yang mengalami kekeringan ekstrem ($\min(RH) < 75.0\%$), sistem menjalankan **Pulse Misting (30 detik)** untuk melembabkan rak atas tanpa membanjiri rak bawah.

### B. Proteksi & Interlock Misting
- **Interlock Kipas:** Misting DILARANG aktif jika Exhaust Fan sedang berputar (mencegah kabut mikro tersedot keluar sebelum mendarat di baglog).
- **Night Lockout (17:00 - 06:00 WIB):** Misting DITAHAN di malam hari. Udara malam secara alami sudah dingin dan lembab ($RH > 90\%$). Menyiram di malam hari akan membuat baglog tergenang air dingin dan memicu pembusukan miselium. (Kecuali kondisi anomali ekstrem $RH < 70\%$).
- **Safety Hold (RH Tinggi):** Jika $T > \text{tempMax}$ namun $RH \ge \text{humMax}$ ($95\%$), misting DITAHAN karena kelembaban jenuh menggagalkan evaporasi.
- **Evaporation Cooldown Guard (150 detik):** Setelah misting mati, pompa dikunci selama 2.5 menit untuk memberikan waktu bagi butiran kabut mikro menguap ke udara kumbung sebelum sistem mengevaluasi kembali.
- **Emergency Safety Timeout (60 detik):** Jika dalam 60 detik sensor belum mencapai target, pompa dimatikan paksa demi mencegah genangan air pada lantai kumbung.

---

## 4. Logika Kendali Exhaust Fan (Sirkulasi & Pendinginan)

Exhaust Fan berfungsi membuang udara panas, meratakan stratifikasi udara (homogenisasi), dan membuang gas $\text{CO}_2$ yang mengendap di lantai.

### A. Mode Siang Hari (06:00 - 17:00 WIB)
1. **Tier 1 — Pendinginan Siang:**
   - **START:** $T_{\text{avg}} > \text{tempMax}$ (misal $> 32.0^\circ\text{C}$).
   - **STOP:** $T_{\text{avg}} \le \text{tempMax} - 1.5^\circ\text{C}$ (Histeresis pendinginan $30.5^\circ\text{C}$).
   - **Safety Timeout:** Maksimal 180 detik (3 menit) menyala terus-menerus, dengan *anti-chattering cooldown* 60 detik agar tidak menguras kelembaban kumbung.
2. **Tier 2 — Safety Override Suhu Kritis:**
   - Jika $\max(T) > \text{tempMax} + 2.0^\circ\text{C}$ (misal $> 34.0^\circ\text{C}$ di rak atas dekat atap seng), fan **DIPAKSA ON** mem-bypass seluruh timer cooldown. Misting yang sedang berjalan akan langsung dipotong.
3. **Tier 3 — Homogenisasi Sirkulasi Vertikal:**
   - Jika disparitas kelembaban vertikal $|RH_A - RH_C| > 12.0\%$, fan menyala kilat **30 detik** untuk mengaduk udara dan menyamaratakan mikroklimat.
   - Dilengkapi *cooldown* 15 menit (900 detik) agar tidak mengganggu ketenangan udara kumbung.

### B. Mode Malam Hari (17:00 - 06:00 WIB)
Pada malam hari, jamur bernapas mengeluarkan gas $\text{CO}_2$ berat yang mengendap di lantai (zona sensor C), sementara kelembaban udara naik mendekati titik jenuh ($> 95\%$). Kipas beroperasi dengan durasi presisi **45 detik**:
1. **Pemicu 1 — Over-Humidity Purge ($RH \ge 96.0\%$):**
   - Mencegah kondensasi air menetes langsung ke tubuh buah jamur. Cooldown 30 menit.
2. **Pemicu 2 — Periodic $\text{CO}_2$ Flush (Tiap 60 Menit):**
   - Membuang akumulasi gas $\text{CO}_2$ di atas lantai agar sirkulasi $\text{O}_2$ segar terjaga.
3. **Sinkronisasi Timer (Interlock):**
   - Saat Over-Humidity Purge terjadi, timer Periodic $\text{CO}_2$ Flush otomatis di-reset ke 60 menit ke depan, karena aliran udara 45 detik saat purge sudah sekaligus membuang gas $\text{CO}_2$. Hal ini mencegah fan menyala bertubi-tubi dalam 1 jam yang sama.

### C. Settling Delay Guard (60 detik)
Setelah misting mati, fan dilarang menyala selama 60 detik untuk memberi kesempatan kabut mikro mengendap pada permukaan baglog dan tidak terbuang percuma keluar ventilasi.

---

## 5. Ringkasan Matriks Parameter Operasional

| Komponen | Parameter | Nilai v3.5 | Deskripsi / Tujuan |
| :--- | :--- | :--- | :--- |
| **Misting** | Stop Histeresis Target | $\min(\text{humMax}-4, \text{humMin}+5)$ | Menghasilkan kurva landai (target stop ~90%), cegah grafik lancip |
| **Misting** | Emergency Timeout | 60 detik | Mencegah lantai becek jika pipa/sensor bermasalah |
| **Misting** | Evaporation Cooldown | 150 detik (2.5 mnt) | Waktu evaporasi butiran kabut ke molekul gas RH |
| **Misting** | Settling Delay | 60 detik | Tahan fan setelah misting agar kabut tidak terbuang |
| **Misting** | Pulse Misting (Tier 2) | 30 detik | Melembabkan rak atas kering ($RH < 75\%$) |
| **Misting** | Night Lockout | 17:00 – 06:00 WIB | Mencegah jamur tidur basah kuyup di suhu dingin |
| **Fan** | Homogenisasi Durasi | 30 detik | Sirkulasi aduk udara saat disparitas vertikal $> 12\%$ |
| **Fan** | Homogenisasi Cooldown | 900 detik (15 mnt) | Relaksasi sirkulasi udara kumbung |
| **Fan** | Cooling Max Timeout | 180 detik (3 mnt) | Mencegah fan terus hidup saat cuaca luar panas |
| **Fan** | Cooling Cooldown | 60 detik | Mencegah relay fan chattering di batas suhu |
| **Fan** | Safety Override | $T > \text{tempMax} + 2.0^\circ\text{C}$ | Bypass cooldown jika sensor atas kritis ($> 34^\circ\text{C}$) |
| **Fan** | Night Purge Durasi | 45 detik | Buang uap jenuh malam ($RH \ge 96\%$) |
| **Fan** | Night Purge Cooldown | 1800 detik (30 mnt) | Jeda antar-purge kelembaban jenuh malam |
| **Fan** | Night $\text{CO}_2$ Flush | 3600 detik (60 mnt) | Siklus berkala pembuangan endapan $\text{CO}_2$ lantai |

---
*Dokumen ini merupakan spesifikasi resmi algoritma kendali firmware ESP32 (`esp32_firmware.ino`) dan model simulasi IoT (`iot_simulator.py`) Smart Shroom SCM.*
