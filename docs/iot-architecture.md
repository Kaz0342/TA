# Arsitektur & Spesifikasi IoT: Smart Shroom SCM

Dokumen teknis ini menjelaskan spesifikasi perangkat keras (hardware) dan arsitektur aliran data (data flow) dari sistem IoT yang digunakan pada kumbung jamur pintar (Smart Shroom). Dokumen ini disusun sesuai standar penyusunan bab perancangan sistem untuk Tugas Akhir (TA).

## 1. Spesifikasi Perangkat Keras (Hardware)

Sistem IoT ini berpusat pada mikrokontroler yang terhubung ke jaringan internet dan bertugas membaca beberapa sensor iklim secara real-time.

### 1.1 Mikrokontroler
*   **Komponen:** ESP32 (NodeMCU / Wemos D1 Mini / DevKit V1)
*   **Fungsi:** Bertindak sebagai otak utama (edge device) yang membaca data dari seluruh sensor, memformatnya menjadi JSON, dan mengirimkannya ke server backend via HTTP POST. ESP32 dipilih karena memiliki prosesor Dual-Core 240MHz dan modul Wi-Fi terintegrasi.

### 1.2 Sensor Suhu & Kelembapan (3 Unit — Segitiga Diagonal)
*   **Komponen:** 3x DHT22
*   **Penempatan:** Formasi Segitiga Diagonal di kumbung 5m × 7m × 3.5m:
    *   **Sensor A** (GPIO 4): Zona Atas, dekat pintu, ketinggian 2.5m — mendeteksi udara panas dan gangguan pintu (Bobot 35%).
    *   **Sensor B** (GPIO 15): Zona Tengah, pusat kumbung, ketinggian 1.5m — referensi inti rak produksi (Bobot 40%).
    *   **Sensor C** (GPIO 2): Zona Bawah, pojok belakang, ketinggian 0.5m — mendeteksi dead zone & udara dingin (Bobot 25%).
*   **Logika:** ESP32 membaca ketiga sensor dan menghitung **Weighted Sensor Fusion**:
    $$T_{\text{avg}} = 0.35 \cdot T_A + 0.40 \cdot T_B + 0.25 \cdot T_C$$
    $$RH_{\text{avg}} = 0.35 \cdot RH_A + 0.40 \cdot RH_B + 0.25 \cdot RH_C$$
    Jika salah satu sensor mengalami kegagalan baca (NaN), firmware secara otomatis menormalisasi ulang bobot dari sensor yang masih valid.
*   **Fungsi:** Mengukur suhu ruangan (°C) dan kelembapan relatif (%). DHT22 dipilih karena jangkauan bacaan yang lebih luas dan presisi yang lebih tinggi dibanding DHT11, sangat krusial untuk pertumbuhan miselium jamur kuping (suhu optimal 24-32°C, kelembaban 85-95%).
*   **Referensi:** Lihat `docs/penempatan_sensor.md` dan `docs/logika_aktuator.md` untuk detail komprehensif.

### 1.3 Sensor Kadar CO2 & Intensitas Cahaya
*   **Komponen CO2:** MQ-135 (General Air Quality) atau MH-Z19 (NDIR CO2 Sensor).
*   **Komponen Cahaya:** BH1750 (Digital Light Sensor) atau modul LDR (Light Dependent Resistor).

### 1.4 Aktuator Pengendali Mikroklimat
*   **Pompa Misting High-Pressure 12V DC:** Disambungkan ke nozzle pengabut 0.15mm untuk menaikkan kelembapan dan pendinginan evaporatif tanpa membasahi lantai secara berlebihan.
*   **Exhaust Fan 12V / 220V AC:** Membuang akumulasi gas CO2 di lantai dan menarik udara segar dari luar.
*   **Relay Modul 3-Channel:** Driver saklar berisolasi optocoupler untuk pompa misting, solenoid valve, dan exhaust fan.

---

## 2. Arsitektur Komunikasi & Alur Data

Sistem memanfaatkan protokol HTTP/HTTPS berbasis **REST API** (*stateless*). Pendekatan ini menyederhanakan arsitektur karena tidak memerlukan *Message Broker* tambahan.

### 2.1 Skema Aliran Data
1.  **Multi-Sensor Reading:** ESP32 secara periodik membaca nilai dari ketiga sensor DHT22 (setiap 5 detik).
2.  **Weighted Sensor Fusion:** ESP32 menghitung nilai rata-rata tertimbang (A=35%, B=40%, C=25%). Sensor error otomatis diabaikan.
3.  **Local Closed-Loop Decision Engine:** Firmware v3.5 mengevaluasi histeresis misting/fan, Universal Guard, interlock keselamatan, dan cooldown sebelum memutuskan aktivasi relay.
4.  **Transmission:** ESP32 melakukan request `HTTP POST` ke endpoint publik server: `POST /api/sensor-data`.
5.  **Validation:** Laravel Backend menerima payload dan memvalidasinya menggunakan `StoreSensorDataRequest`.
6.  **Storage:** Backend menyimpan data secara *immutable* ke dalam database (`DECIMAL(5,2)`).

### 2.2 Format Payload Sensor (JSON)
```json
{
  "device_id": "ESP32-KUMBUNG-01",
  "temperature": 27.50,
  "humidity": 88.00,
  "co2_level": 450.50,
  "light_intensity": 120.50,
  "recorded_at": "2026-09-27T09:00:00Z"
}
```

### 2.3 Sinkronisasi Konfigurasi & Perintah Jeda Panen
ESP32 melakukan polling berkala (tiap 30 detik) ke `GET /api/thresholds/active` untuk mengambil ambang batas dan perintah interupsi:
```json
{
  "success": true,
  "data": {
    "temp_min": "24.00",
    "temp_max": "32.00",
    "humidity_min": "85.00",
    "humidity_max": "95.00",
    "phase_mode": "fruiting",
    "device_command": {
      "command": "PAUSE",
      "is_paused": true,
      "duration_seconds": 7200,
      "remaining_seconds": 7150,
      "reason": "Panen Raya Lorong B"
    }
  }
}
```
*   Jika `command == "PAUSE"`, ESP32 mengaktifkan mode jeda (Misting & Fan mati seketika).
*   Jika `command == "AUTO"` atau `remaining_seconds <= 0`, ESP32 mengakhiri masa jeda dan seketika melakukan *instant-read* sensor untuk menstabilkan iklim.

---

## 3. Keamanan & Penanganan Eror (Security & Error Handling)

### 3.1 Rate Limiting (Anti-DDoS)
Endpoint IoT publik dilindungi middleware **Throttle** (maksimal 20 request per 1 menit per IP). Melebihi batas akan menerima respons HTTP `429 Too Many Requests`.

### 3.2 Data Integrity
Sistem memegang prinsip *Immutability*. Data sensor yang telah masuk ke database tidak memiliki `updated_at`.

### 3.3 Mekanisme Fail-Safe & Caching Lokal (Network Outage)
Jika koneksi Wi-Fi terputus, ESP32 menyimpan data ke **Ring Buffer (FIFO) di RAM** (kapasitas 24 record atau setara 2 jam) dengan timestamp RTC internal. Saat koneksi pulih, antrean data dikirim ulang secara sekuensial (*bulk upload*) ke server.
