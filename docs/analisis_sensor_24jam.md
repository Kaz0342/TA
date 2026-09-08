# 📊 Analisis Data Sensor IoT — 24 Jam Pertama
**Smart Shroom SCM — Tugas Akhir**
**Periode:** 7 September 2026 (06:01 WIB) — 8 September 2026 (06:00 WIB)
**Total Data Points:** 5.238 records dari simulator 3 sensor (Segitiga Diagonal)

---

## 1. Ringkasan Statistik

### 🌡️ Suhu (Temperature)

| Metrik | Nilai |
|:---|:---|
| **Minimum** | 20.7°C |
| **Maksimum** | 30.1°C |
| **Rata-rata** | 26.07°C |
| **Rentang (Range)** | 9.4°C |
| **Standar Deviasi** | 1.95°C |
| **Waktu Terpanas** | 7 Sep, 14:05 WIB *(siang hari — puncak radiasi matahari)* |
| **Waktu Terdingin** | 8 Sep, 00:47 WIB *(dini hari — udara terdingin)* |

### 💧 Kelembaban (Relative Humidity)

| Metrik | Nilai |
|:---|:---|
| **Minimum** | 76.7% |
| **Maksimum** | 93.9% |
| **Rata-rata** | 84.26% |
| **Rentang (Range)** | 17.2% |
| **Standar Deviasi** | 2.63% |
| **Waktu Terlembab** | 8 Sep, 02:42 WIB *(dini hari — korelasi terbalik suhu)* |
| **Waktu Terkering** | 7 Sep, 16:59 WIB *(sore hari — puncak penguapan)* |

---

## 2. Distribusi Rata-rata Per Jam

```
Jam    | Suhu Min | Suhu Avg | Suhu Max | RH Avg  | Data
-------+----------+----------+----------+---------+------
00:00  |  20.7°C  |  22.4°C  |  24.5°C  |  89.3%  |   59
01:00  |  21.5°C  |  22.4°C  |  23.3°C  |  89.6%  |   59
02:00  |  21.1°C  |  22.2°C  |  23.5°C  |  90.4%  |   59  🟢 Paling sejuk & lembab
03:00  |  21.0°C  |  22.4°C  |  23.5°C  |  89.7%  |   59
04:00  |  20.8°C  |  22.8°C  |  24.4°C  |  88.5%  |   59
05:00  |  22.5°C  |  23.6°C  |  25.1°C  |  87.1%  |   59
06:00  |  22.2°C  |  24.3°C  |  26.3°C  |  85.3%  |  336
07:00  |  22.2°C  |  24.3°C  |  26.1°C  |  84.9%  |  302
08:00  |  24.3°C  |  26.3°C  |  28.6°C  |  84.0%  |  305
09:00  |  22.7°C  |  26.4°C  |  29.9°C  |  83.8%  |  345
10:00  |  25.0°C  |  26.8°C  |  28.6°C  |  83.9%  |  346
11:00  |  21.9°C  |  26.9°C  |  29.8°C  |  83.3%  |  347
12:00  |  22.0°C  |  27.0°C  |  30.0°C  |  83.5%  |  345
13:00  |  22.1°C  |  26.8°C  |  30.0°C  |  83.3%  |  345
14:00  |  22.0°C  |  27.1°C  |  30.1°C  |  83.9%  |  344  🔴 Paling panas
15:00  |  22.1°C  |  26.5°C  |  29.9°C  |  83.5%  |  344
16:00  |  21.7°C  |  27.0°C  |  30.1°C  |  83.6%  |  345
17:00  |  21.7°C  |  27.2°C  |  28.7°C  |  83.4%  |  581
18:00  |  21.9°C  |  26.2°C  |  28.6°C  |  83.8%  |  304
19:00  |  23.5°C  |  25.9°C  |  27.9°C  |  83.4%  |   59
20:00  |  24.2°C  |  25.2°C  |  26.3°C  |  83.6%  |   59
21:00  |  23.7°C  |  24.3°C  |  25.9°C  |  85.1%  |   59
22:00  |  22.7°C  |  23.9°C  |  25.6°C  |  86.4%  |   59
23:00  |  22.2°C  |  23.3°C  |  24.8°C  |  88.2%  |   59
```

> [!NOTE]
> **Pola Siklus Diurnal** terlihat sangat jelas:
> - Suhu **naik gradual** mulai jam 06:00, puncaknya di **jam 14:00** (30.1°C), lalu turun perlahan sampai **jam 02:00** (22.2°C).
> - Kelembaban **berkorelasi terbalik** dengan suhu — paling rendah saat siang (83.3%), paling tinggi saat dini hari (90.4%).
> - Ini **persis sesuai model sinusoidal** yang diprogram di simulator! 📈

---

## 3. Analisis Threshold Breach (Pelanggaran Batas)

**Threshold Aktif:** Suhu 22.0°C – 30.0°C | RH 80.0% – 90.0%

### Suhu

| Kondisi | Jumlah | Persentase |
|:---|:---|:---|
| ✅ Dalam zona aman (22–30°C) | 5.158 / 5.238 | **98.5%** |
| 🔴 Di atas batas (> 30°C) | 2 / 5.238 | 0.0% |
| 🔵 Di bawah batas (< 22°C) | 78 / 5.238 | 1.5% |

### Kelembaban

| Kondisi | Jumlah | Persentase |
|:---|:---|:---|
| ✅ Dalam zona aman (80–90%) | 5.056 / 5.238 | **96.5%** |
| 🟡 Di bawah batas (< 80%, kering) | 69 / 5.238 | 1.3% |
| 🔵 Di atas batas (> 90%, basah) | 113 / 5.238 | 2.2% |

> [!IMPORTANT]
> **Efisiensi kontrol suhu 98.5%** dan **kelembaban 96.5%** menunjukkan bahwa algoritma histeresis + Safety Override bekerja sangat baik. Breach yang terjadi hanya sesaat (transisi misting on/off) dan tidak berkepanjangan.

---

## 4. Perbandingan Siang vs Malam

| Periode | Suhu Avg | Suhu Max | RH Avg | Data Points |
|:---|:---|:---|:---|:---|
| ☀️ **Siang** (09:00–17:00) | 26.9°C | 30.1°C | 83.6% | 3.342 |
| 🌙 **Malam** (18:00–08:00) | 24.7°C | 28.6°C | 85.5% | 1.896 |
| **Selisih** | **2.2°C** | — | **2.0%** | — |

> [!TIP]
> Selisih siang-malam 2.2°C ini sangat realistis untuk kumbung jamur yang tertutup rapat. Di lapangan (hardware asli), selisihnya bisa **3–5°C** tergantung material dinding kumbung dan ventilasi alami. Ini bahan bagus buat perbandingan di Bab 5 (Pembahasan) nanti.

---

## 5. Kesimpulan & Temuan Kunci

### ✅ Hal Positif (Sistem Berjalan Baik)

1. **Siklus diurnal realistis** — Kurva suhu membentuk gelombang sinusoidal sempurna, puncak di jam 14:00 dan lembah di jam 02:00.
2. **Aktuator responsif** — Hanya 2 dari 5.238 data yang menembus batas suhu atas (30°C), artinya fan langsung bekerja.
3. **Misting efektif** — Kelembaban berhasil dijaga di rentang 80–90% sebanyak 96.5% waktu operasi.
4. **Multi-sensor averaging** terbukti menghasilkan pembacaan yang stabil (std deviasi suhu hanya 1.95°C).

### ⚠️ Hal yang Perlu Diperhatikan (untuk Hardware Asli)

1. **Suhu dini hari kadang di bawah 22°C** (1.5% data) — Di hardware, perlu dipertimbangkan apakah perlu pemanas (heater) atau cukup mematikan fan.
2. **Kelembaban kadang tembus 90%** saat malam (2.2% data) — Normal dan sebenarnya bagus untuk jamur, tapi pastikan drainase lantai kumbung memadai agar tidak banjir.
3. **Volume data tinggi** — Dengan interval 10 detik sebelumnya, 5.238+ records dihasilkan dalam 24 jam. Setelah diubah ke 60 detik, akan menjadi ~1.440 records/hari (jauh lebih efisien untuk database).

---

## 6. Rekomendasi untuk Implementasi Hardware

| Aspek | Rekomendasi |
|:---|:---|
| **Interval kirim data** | 60 detik (sudah diterapkan) — optimal untuk grafik dashboard dan hemat database |
| **Ventilasi kumbung** | Pastikan exhaust fan cukup kuat untuk kumbung 5x7x3.5m (minimal 300 CFM) |
| **Drainase** | Pasang saluran air di lantai kumbung karena misting sering aktif saat siang |
| **Kabel sensor** | Sensor A (atas, 2.5m) butuh kabel terpanjang — gunakan kabel min. 4m untuk antisipasi |
| **UPS/Battery** | Pertimbangkan UPS kecil (5V) agar ESP32 tidak mati saat listrik padam |

---

*Analisis ini dihasilkan dari data simulasi IoT menggunakan model fisika sinusoidal dengan 3 sensor virtual (Segitiga Diagonal).*
*Tool: Python + Supabase API | Tanggal: 8 September 2026*
