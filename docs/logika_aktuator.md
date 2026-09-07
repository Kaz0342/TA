# Logika Otomatisasi Aktuator (Misting & Fan)
**Smart Shroom SCM - Tugas Akhir**

Dokumen ini menjelaskan alur logika (algoritma) bagaimana ESP32 memutuskan kapan harus menyalakan atau mematikan Pompa Air (Misting) dan Kipas (Exhaust Fan). Logika ini menggunakan sistem **Histeresis (Hysteresis)** untuk mencegah aktuator menyala-mati terlalu cepat (flickering) yang dapat merusak komponen relay dan pompa.

---

## 1. Sumber Data: Rata-rata 3 Sensor (Multi-Sensor Averaging)
Sistem menggunakan **3 sensor DHT22** yang ditempatkan secara **Segitiga Diagonal** di kumbung (Zona Atas, Tengah, Bawah). ESP32 membaca ketiga sensor setiap 5 detik, lalu menghitung **nilai rata-rata** suhu dan kelembaban. Nilai rata-rata inilah yang digunakan untuk semua logika perbandingan threshold di bawah ini. Lihat `docs/penempatan_sensor.md` untuk detail penempatan.

## 2. Variabel Batasan (Threshold)
Sistem mengambil 4 nilai batas dari pengaturan web (Dashboard):
- `tempMax`: Suhu Maksimum (Kritis / Panas)
- `tempMin`: Suhu Minimum (Terlalu Dingin / Batas aman kipas mati)
- `humMin` (`rhTriggerLow`): Kelembaban Minimum (Kering / Batas pompa nyala)
- `humMax` (`rhTriggerHigh`): Kelembaban Maksimum (Basah / Batas pompa mati)

---

## 3. Logika Kipas (Exhaust Fan)
Kipas bertugas membuang udara panas dari dalam kumbung ke luar ruangan.

**Kondisi Kipas MENYALA (ON):**
Kipas akan menyala jika salah satu dari kondisi ini terpenuhi:
1. **Normal (Berdasarkan Rata-rata):** `Suhu Rata-rata` **Lebih Besar (>)** dari `tempMax`.
   *(Contoh: Jika tempMax 30°C, dan suhu rata-rata mencapai 30.1°C, kipas menyala).*
2. **Safety Override (Kondisi Kritis Lokal):** Jika ada minimal SATU sensor yang membaca suhu melewati batas sangat kritis (`tempMax` + 2.0°C), kipas akan **DIPAKSA MENYALA** tanpa mempedulikan nilai rata-rata keseluruhan.
   *(Contoh: Jika tempMax 30°C, namun Sensor A di bagian atas terbaca 32.1°C akibat panas yang menumpuk, kipas otomatis menyala meski Sensor C dan rata-rata masih dalam batas aman. Ini mencegah kerusakan jamur di zona tertentu).*

**Kondisi Kipas MATI (OFF):**
- **Jika** `Suhu Saat Ini` **Lebih Kecil atau Sama Dengan (<=)** dari `tempMin`.
  *(Contoh: Kipas tidak akan mati di suhu 29°C, kipas akan terus menyala membuang panas sampai suhu benar-benar turun ke angka tempMin, misal 23°C. Ini adalah prinsip histeresis agar kipas tidak hidup-mati setiap detiknya).*

---

## 4. Logika Penyiraman (Misting / Pompa & Solenoid)
Misting bertugas menaikkan kelembaban udara (RH) dan memberikan efek pendinginan evaporatif (menurunkan suhu secara perlahan).

**Kondisi Misting MENYALA (ON):**
Misting akan aktif jika **SALAH SATU** dari kondisi ini terpenuhi:
1. `Kelembaban Saat Ini` **Lebih Kecil (<)** dari `humMin` (Kumbung terlalu kering).
2. `Suhu Saat Ini` **Lebih Besar (>)** dari `tempMax` (Kumbung terlalu panas).

**Pengecualian Kritis (Safety Hold):**
Sistem memiliki mekanisme keamanan untuk mencegah jamur membusuk akibat terlalu banyak air.
- **JIKA** Suhu Terlalu Panas (`Suhu` > `tempMax`), **TETAPI** udara di dalam kumbung sudah sangat basah (`Kelembaban` >= `humMax`), maka **MISTING DITAHAN (TIDAK MENYALA)**. 
- *Alasan:* Menyemprotkan air di saat lingkungan sudah sangat basah (RH > 90%) tidak akan mendinginkan ruangan secara efektif (evaporasi gagal), malah akan memicu penyakit dan busuk pada baglog jamur.

**Kondisi Misting MATI (OFF):**
Misting akan mati jika **KEDUA** kondisi ini terpenuhi secara bersamaan:
1. `Kelembaban Saat Ini` sudah mencapai target atau lebih basah (`Kelembaban` >= `humMax`).
2. `Suhu Saat Ini` sudah aman / tidak panas (`Suhu` <= `tempMax`).

**Safety Timeout (Timeout Keamanan):**
Selain logika sensor di atas, sistem memiliki timer keamanan mutlak (Hard Limit).
- Maksimal durasi misting dalam satu siklus adalah **90 Detik**.
- Walaupun sensor belum mencapai target (misal masih panas atau kering), jika pompa sudah menyala selama 90 detik tanpa henti, pompa akan **DIMATIKAN PAKSA**.
- *Alasan:* Mencegah lantai kumbung banjir, mencegah pompa terbakar (overheat), dan mengantisipasi error pada pembacaan sensor DHT22.

---

## 5. Kesimpulan Contoh Kasus

Misal Settingan Web:
- Suhu: `23°C` (Min) - `30°C` (Max)
- Kelembaban: `80%` (Min) - `90%` (Max)

| Suhu | Kelembaban | Kondisi Kipas | Kondisi Misting | Penjelasan |
| :--- | :--- | :--- | :--- | :--- |
| 28°C | 85% | OFF | OFF | Kondisi optimal, semua aman. |
| 31°C | 75% | ON | ON | Sangat panas & kering. Kipas buang panas, Misting naikin kelembaban & turunin suhu. |
| 31°C | 92% | ON | OFF (Hold) | Panas tapi udara sangat basah. Misting ditahan agar jamur tidak busuk, hanya kipas yang bekerja membuang panas. |
| 29°C | 78% | OFF | ON | Suhu aman, tapi kering. Misting nyala untuk menaikkan kelembaban ke 90%. |
| 22°C | 95% | OFF | OFF | Dingin dan sangat basah (Kondisi subuh). Semua mati. |

---
*Dokumen ini digenerate berdasarkan source code C++ pada file `esp32_firmware.ino` dan script simulasi `iot_simulator.py`.*
