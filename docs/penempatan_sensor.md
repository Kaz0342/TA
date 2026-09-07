# Strategi Penempatan Sensor DHT22 (Multi-Sensor)
**Smart Shroom SCM — Tugas Akhir**

Dokumen ini menjelaskan strategi penempatan 3 sensor DHT22 di kumbung jamur tiram
berukuran **5m × 7m × 3.5m** (Volume: 122.5 m³) dan alasan teknis di balik keputusan desain.

---

## 1. Kenapa 3 Sensor? Kenapa Bukan 1?

Dalam kumbung jamur, distribusi suhu dan kelembaban **tidak seragam** di seluruh ruangan.
Fenomena fisik yang menyebabkan perbedaan ini antara lain:

| Fenomena | Penjelasan |
|:---|:---|
| **Konveksi Alami** | Udara panas naik ke atas, udara dingin turun ke bawah. Rak atas bisa 2-4°C lebih panas dari rak bawah. |
| **Intrusi Udara Luar** | Saat pintu dibuka, udara luar (panas/kering) masuk dan memengaruhi zona dekat pintu secara signifikan. |
| **Dead Zone (Zona Mati)** | Sudut kumbung yang jauh dari kipas dan ventilasi memiliki sirkulasi udara yang buruk, menyebabkan suhu dan kelembaban stagnan. |
| **Efek Misting Lokal** | Nozzle misting menyemprotkan air di titik tertentu, menyebabkan zona dekat nozzle lebih basah dan dingin sementara zona jauh belum terdampak. |

Dengan 1 sensor, sistem hanya membaca **1 titik** dan mengasumsikan seluruh kumbung memiliki kondisi yang sama.
Ini bisa menyebabkan:
- **False Trigger:** Sensor di zona panas memicu misting, padahal keseluruhan kumbung masih aman.
- **False Negative:** Sensor di zona dingin tidak mendeteksi rak atas yang sudah kepanasan.

---

## 2. Layout Penempatan: Segitiga Diagonal

Strategi penempatan menggunakan formasi **segitiga diagonal** yang menangkap variasi
suhu/kelembaban secara **vertikal (atas-bawah)** dan **horizontal (depan-belakang)** sekaligus.

```
Denah Kumbung (Tampak Atas) — 5m x 7m
┌──────────────────────────────────┐
│                                  │
│          [Sensor A]              │  ← Dekat pintu, TINGGI (2.5m)
│           ↗ Zona paling fluktuatif
│                                  │
│                                  │
│              [Sensor B]          │  ← Tengah kumbung, SEDANG (1.5m)
│               ↗ Zona referensi utama
│                                  │
│                                  │
│                     [Sensor C]   │  ← Pojok belakang, RENDAH (0.5m)
│                      ↗ Zona paling stagnan
│                                  │
└──────────────────────────────────┘
  PINTU
```

### Detail Penempatan Per Sensor

| ID | Label | Posisi Horizontal | Ketinggian | GPIO ESP32 | Apa yang Dideteksi |
|:---|:---|:---|:---|:---|:---|
| **A** | Zona Atas (Dekat Pintu) | ~1.5m dari pintu | 2.5m | GPIO 4 | Udara panas atas + gangguan dari pintu terbuka |
| **B** | Zona Tengah (Pusat) | Tengah kumbung | 1.5m | GPIO 15 | Kondisi rata-rata, zona rak produksi utama |
| **C** | Zona Bawah (Pojok Belakang) | Pojok terjauh dari pintu | 0.5m | GPIO 2 | Udara dingin bawah + deteksi dead zone |

### Jarak Kabel

Jarak diagonal terjauh dalam kumbung 5×7×3.5m:
```
d = √(5² + 7² + 3.5²) = √(25 + 49 + 12.25) = √86.25 ≈ 9.3 meter
```
DHT22 menggunakan protokol digital 1-wire dan berfungsi **reliabel hingga jarak kabel ~20 meter**.
Jarak 9.3m masih jauh di bawah batas, sehingga **tidak diperlukan modul signal booster/extender**.

---

## 3. Logika Penggabungan Data (Averaging)

ESP32 membaca ketiga sensor secara berurutan setiap 5 detik, lalu menghitung **rata-rata aritmatika**:

```
Suhu_Final = (Suhu_A + Suhu_B + Suhu_C) / 3
RH_Final   = (RH_A   + RH_B   + RH_C)   / 3
```

Nilai rata-rata inilah yang:
1. **Dikirim ke API** (`POST /api/sensor-data`) untuk ditampilkan di Dashboard.
2. **Dipakai oleh logika aktuator** (Misting & Fan) untuk mengambil keputusan.

### Penanganan Sensor Rusak / Error

Jika salah satu sensor mengembalikan nilai `NaN` (kabel lepas, sensor rusak), firmware akan:
1. **Mengabaikan sensor yang error** dan hanya menghitung rata-rata dari sensor yang valid.
2. **Tetap beroperasi normal** selama minimal 1 sensor masih berfungsi.
3. **Menampilkan peringatan** di LCD dan Serial Monitor bahwa ada sensor yang bermasalah.

Contoh: Jika Sensor A rusak, maka:
```
Suhu_Final = (Suhu_B + Suhu_C) / 2
```

---

## 4. Skenario Perbandingan: 1 Sensor vs 3 Sensor

### Skenario: Pintu Kumbung Dibuka Siang Hari

| Sensor | Sebelum Pintu Dibuka | Sesudah Pintu Dibuka |
|:---|:---|:---|
| A (Dekat pintu, atas) | 28°C / 82% | **33°C / 65%** ← terkena langsung |
| B (Tengah) | 27°C / 85% | 28°C / 82% ← sedikit terpengaruh |
| C (Pojok belakang) | 26°C / 88% | 26°C / 87% ← hampir tidak terpengaruh |
| **Rata-rata 3 Sensor** | **27°C / 85%** | **29°C / 78%** |

**Jika hanya menggunakan 1 sensor di dekat pintu:**
Sistem membaca 33°C/65% → langsung trigger misting + fan secara agresif.
Padahal kumbung secara keseluruhan masih relatif aman di 29°C.

**Dengan rata-rata 3 sensor:**
Sistem membaca 29°C/78% → fan belum nyala (belum lewat 30°C), misting mungkin nyala ringan karena RH turun di bawah 80%.
Keputusan yang **jauh lebih proporsional dan stabil**.

### Skenario: Siang Terik, Suhu Kritis

| Sensor | Suhu | RH |
|:---|:---|:---|
| A (Atas) | **32.1°C** | 72% |
| B (Tengah) | 30.4°C | 76% |
| C (Bawah) | 28.8°C | 81% |
| **Rata-rata** | **30.4°C** | **76.3%** |

Keputusan: Fan **ON** (30.4 > 30), Misting **ON** (30.4 > 30 DAN 76.3 < 90).
Dengan 1 sensor di bawah (28.8°C), sistem **tidak akan mendeteksi** bahwa rak atas sudah kritis.

---

## 5. Rekomendasi Pemasangan Fisik

1. **Kabel:** Gunakan kabel UTP Cat5e (twisted pair) untuk jalur data sensor. Murah dan tahan interferensi.
2. **Proteksi:** Bungkus konektor sensor dengan heat-shrink tube atau isolasi untuk melindungi dari kelembaban tinggi.
3. **Penandaan:** Beri label "A", "B", "C" pada setiap sensor dan kabelnya untuk memudahkan troubleshooting.
4. **Hindari:** Jangan tempatkan sensor tepat di bawah nozzle misting (bisa kena cipratan air langsung).

---

*Dokumen ini didasarkan pada analisis ukuran kumbung 5m × 7m × 3.5m dan spesifikasi sensor DHT22.*
*Referensi GPIO: `esp32_firmware.ino` | Referensi Simulasi: `iot_simulator.py`*
