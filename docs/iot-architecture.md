# Arsitektur & Spesifikasi IoT: Smart Shroom SCM

Dokumen teknis ini menjelaskan spesifikasi perangkat keras (hardware) dan arsitektur aliran data (data flow) dari sistem IoT yang digunakan pada kumbung jamur pintar (Smart Shroom). Dokumen ini disusun sesuai standar penyusunan bab perancangan sistem untuk Tugas Akhir (TA).

## 1. Spesifikasi Perangkat Keras (Hardware)

Sistem IoT ini berpusat pada mikrokontroler yang terhubung ke jaringan internet dan bertugas membaca beberapa sensor iklim secara real-time.

### 1.1 Mikrokontroler
*   **Komponen:** ESP32 (NodeMCU / Wemos D1 Mini / DevKit V1)
*   **Fungsi:** Bertindak sebagai otak utama (edge device) yang membaca data dari seluruh sensor, memformatnya menjadi JSON, dan mengirimkannya ke server backend via HTTP POST. ESP32 dipilih karena memiliki prosesor Dual-Core 240MHz dan modul Wi-Fi terintegrasi.

### 1.2 Sensor Suhu & Kelembapan (3 Unit — Segitiga Diagonal)
*   **Komponen:** 3x SHT30 / SHT31 Probe IP68 Waterproof + 1x Modul I2C Multiplexer TCA9548A
*   **Penempatan:** Formasi Segitiga Diagonal di kumbung 5m × 7m × 3.5m:
    *   **Sensor A** (TCA Channel 0, I2C `0x44`): Zona Atas, dekat pintu, ketinggian 2.5m — mendeteksi udara panas dan gangguan pintu (Bobot 35%).
    *   **Sensor B** (TCA Channel 1, I2C `0x44`): Zona Tengah, pusat kumbung, ketinggian 1.5m — referensi inti rak produksi (Bobot 40%).
    *   **Sensor C** (TCA Channel 2, I2C `0x44`): Zona Bawah, pojok belakang, ketinggian 0.5m — mendeteksi dead zone & udara dingin (Bobot 25%).
*   **Logika:** ESP32 membaca ketiga sensor secara sekuensial melalui seleksi kanal TCA9548A dan menghitung **Weighted Sensor Fusion**:
    $$T_{\text{avg}} = 0.35 \cdot T_A + 0.40 \cdot T_B + 0.25 \cdot T_C$$
    $$RH_{\text{avg}} = 0.35 \cdot RH_A + 0.40 \cdot RH_B + 0.25 \cdot RH_C$$
    Jika salah satu sensor mengalami kegagalan baca (NaN), firmware secara otomatis menormalisasi ulang bobot dari sensor yang masih valid.
*   **Fungsi & Keunggulan:** Mengukur suhu ruangan (°C) dan kelembapan relatif (%). SHT30/SHT31 dipilih karena memiliki presisi tinggi (±2% RH, ±0.2°C) dengan enkapsulasi probe logam berpori mikron (IP68) serta fitur *on-chip internal heater* yang kebal terhadap *condensation saturation* pada kelembaban tinggi (85–95% RH), jauh lebih andal dan tahan lama dibanding DHT22 yang rentan drift dan rusak di lingkungan basah kumbung jamur.
*   **Referensi:** Lihat `docs/penempatan_sensor.md`, `docs/rancangan_hardware_kumbung.md`, dan `docs/logika_aktuator.md` untuk detail komprehensif.

### 1.3 Sensor Kadar CO2 & Intensitas Cahaya
*   **Komponen CO2:** MQ-135 (General Air Quality) atau MH-Z19 (NDIR CO2 Sensor).
*   **Komponen Cahaya:** BH1750 (Digital Light Sensor) atau modul LDR (Light Dependent Resistor).

### 1.4 Aktuator Pengendali Mikroklimat
*   **Pompa Misting High-Pressure 12V DC:** Pompa diafragma 130–160 PSI disambungkan ke 14 nozzle brass 0.3mm untuk menaikkan kelembapan dan pendinginan evaporatif tanpa membasahi lantai secara berlebihan.
*   **Solenoid Valve 12V DC Kuningan (Drat 1/2"):** Katup pemutus aliran air seketika (*anti-drip*) saat pompa mati.
*   **Exhaust Fan 10 Inch AC 220V:** Membuang akumulasi gas CO2 di lantai dan menarik udara segar dari luar.
*   **Relay Modul 4-Channel 5V Optocoupler:** Driver saklar berisolasi optocoupler (jumper JD-VCC dilepas untuk isolasi penuh) untuk pompa misting, solenoid valve, dan exhaust fan.

---

## 2. Arsitektur Komunikasi & Alur Data

Sistem memanfaatkan protokol HTTP/HTTPS berbasis **REST API** (*stateless*). Pendekatan ini menyederhanakan arsitektur karena tidak memerlukan *Message Broker* tambahan.

### 2.1 Skema Aliran Data
1.  **Multi-Sensor Reading:** ESP32 secara periodik membaca nilai dari ketiga sensor SHT30/SHT31 via multiplexer TCA9548A (setiap 5 detik).
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
Sistem memisahkan jalur polling konfigurasi dengan jalur eksekusi perintah darurat:
1. **Konfigurasi Ambang Batas (Tiap 30 Detik):** ESP32 melakukan request `GET /api/thresholds/active` untuk menyinkronkan batas suhu, kelembaban, dan mode fase pertumbuhan.
2. **Polling Cepat Perintah Jeda Panen (Tiap 8 Detik — F-14):** ESP32 memanggil `GET /api/device/command` dengan timeout 4 detik untuk mereduksi latensi interupsi panen dari 30s ke $<8$ detik.
```json
{
  "success": true,
  "data": {
    "command": "PAUSE",
    "is_paused": true,
    "duration_seconds": 7200,
    "remaining_seconds": 7150,
    "reason": "Panen Raya Lorong B"
  }
}
```
*   Jika `command == "PAUSE"`, ESP32 mengaktifkan mode jeda (Misting & Fan mati seketika).
*   Jika `command == "AUTO"` atau `remaining_seconds <= 0`, ESP32 mengakhiri masa jeda dan seketika melakukan *instant-read* sensor untuk menstabilkan iklim.

---

## 3. Keamanan & Penanganan Eror (Security & Error Handling)

### 3.1 Rate Limiting (Anti-DDoS)
Endpoint IoT publik dilindungi middleware **Throttle** (maksimal 20 request per 1 menit per IP/device). Melebihi batas akan menerima respons HTTP `429 Too Many Requests`.

### 3.2 Data Integrity
Sistem memegang prinsip *Immutability*. Data sensor yang telah masuk ke database tidak memiliki `updated_at`. Isolasi data per-device didukung via query `?device_id=...` (F-16).

### 3.3 Mekanisme Fail-Safe & Ketahanan Jaringan (Offline Resilience — F-07 & F-08)
1. **Non-Blocking WiFi Loop:** Jika koneksi Wi-Fi putus, loop utama mikrokontroler tidak membeku (*freeze*). ESP32 mencoba reconnect tiap 15 detik secara asinkron tanpa menahan fungsi watchdog aktuator dan proteksi suhu.
2. **Antrean Log RAM (10 Slot):** Riwayat durasi aktuator (misting/fan) saat offline disimpan ke ring buffer RAM (`PendingLog logQ[10]`) dan otomatis di-drain (1 log per 3 detik) begitu internet pulih.
3. **Penyaringan Data Sensor Basi:** Data hanya ditransmisikan jika pembacaan sensor berhasil dalam 15 detik terakhir (`lastValidReadMs < 15000`), mencegah transmisi angka kadaluarsa saat sensor rusak.
4. **Fallback Jam NTP (-1):** Jika sinkronisasi NTP belum berhasil, sistem mengembalikan `-1` dan menahan aturan malam untuk mencegah penyemprotan salah waktu.

