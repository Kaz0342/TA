# Arsitektur & Spesifikasi IoT: Smart Shroom SCM

Dokumen teknis ini menjelaskan spesifikasi perangkat keras (hardware) dan arsitektur aliran data (data flow) dari sistem IoT yang digunakan pada kumbung jamur pintar (Smart Shroom). Dokumen ini disusun sesuai standar penyusunan bab perancangan sistem untuk Tugas Akhir (TA).

## 1. Spesifikasi Perangkat Keras (Hardware)

Sistem IoT ini berpusat pada mikrokontroler yang terhubung ke jaringan internet dan bertugas membaca beberapa sensor iklim secara real-time.

### 1.1 Mikrokontroler
*   **Komponen:** ESP32 (NodeMCU / Wemos D1 Mini)
*   **Fungsi:** Bertindak sebagai otak utama (edge device) yang membaca data dari seluruh sensor, memformatnya menjadi JSON, dan mengirimkannya ke server backend via HTTP POST. ESP32 dipilih karena memiliki modul Wi-Fi terintegrasi.

### 1.2 Sensor Suhu & Kelembapan
*   **Komponen:** DHT22 atau BME280
*   **Fungsi:** Mengukur suhu ruangan (derajat Celsius) dan tingkat kelembapan relatif udara (persentase). DHT22 lebih direkomendasikan daripada DHT11 karena jangkauan bacaan yang lebih luas dan presisi yang lebih tinggi, sangat krusial untuk pertumbuhan miselium jamur tiram (suhu optimal 20-30°C, kelembaban 70-90%).

### 1.3 Sensor Kadar CO2
*   **Komponen:** MQ-135 (General Air Quality) atau MH-Z19 (NDIR CO2 Sensor)
*   **Fungsi:** Mengukur konsentrasi karbon dioksida di dalam kumbung dalam satuan ppm (parts per million). Jamur bernapas dengan menghirup O2 dan mengeluarkan CO2. Kadar CO2 yang berlebihan akan menyebabkan batang jamur panjang namun payungnya kerdil.

### 1.4 Sensor Intensitas Cahaya
*   **Komponen:** BH1750 (Digital Light Sensor) atau modul LDR (Light Dependent Resistor)
*   **Fungsi:** Mengukur intensitas paparan cahaya di dalam kumbung (dalam satuan Lux). Cahaya yang berlebihan dapat menghambat pertumbuhan jamur tiram, sehingga data ini diperlukan untuk menjaga kumbung tetap teduh.

---

## 2. Arsitektur Komunikasi & Alur Data

Sistem tidak menggunakan protokol MQTT, melainkan memanfaatkan protokol HTTP/HTTPS berbasis **REST API** (*stateless*). Pendekatan ini menyederhanakan arsitektur karena tidak memerlukan *Message Broker* tambahan.

### 2.1 Skema Aliran Data
1.  **Reading (Pembacaan):** ESP32 secara periodik membaca nilai dari keempat sensor (contoh: setiap 5 menit).
2.  **Serialization:** ESP32 merakit data tersebut menjadi struktur JSON tunggal.
3.  **Transmission:** ESP32 melakukan request `HTTP POST` ke endpoint publik server: `POST /api/sensor-data`.
4.  **Validation:** Laravel Backend menerima payload dan memvalidasinya menggunakan `FormRequest`. Proses ini mencegah injeksi data kotor (misal: suhu berupa teks alih-alih angka, atau batas data yang tidak masuk akal).
5.  **Storage:** Jika data lolos validasi, backend menyimpannya secara *immutable* ke dalam database (MySQL/PostgreSQL) dengan presisi `DECIMAL(5,2)` agar tidak terjadi *floating-point error*.

### 2.2 Format Payload (JSON)

ESP32 wajib mengirimkan body request dalam format `application/json` seperti berikut:

```json
{
  "device_id": "ESP32-KUMBUNG-01",
  "temperature": 27.50,
  "humidity": 82.00,
  "co2_level": 450.50,
  "light_intensity": 120.50,
  "recorded_at": "2026-08-17T09:00:00Z"
}
```

*Catatan Tipe Data:*
*   `device_id`: String (Max 50 karakter). Digunakan untuk identifikasi multi-kumbung.
*   `temperature`, `humidity`, `co2_level`, `light_intensity`: Float/Decimal.
*   `recorded_at`: String (Format ISO 8601 Timestamp). (Opsional, jika kosong server akan memakai waktu request diterima).

---

## 3. Keamanan & Penanganan Eror (Security & Error Handling)

### 3.1 Rate Limiting (Anti-DDoS)
Endpoint IoT bersifat publik (tidak menggunakan Authentication Token agar meringankan kerja mikrokontroler). Untuk mencegah serangan *DDoS* atau *spamming* akibat malfungsi sensor, backend menerapkan middleware **Throttle**.
*   **Limit:** Maksimal 20 request per 1 menit per `device_id` (IP Address).
*   **Response:** Jika melebihi batas, server akan menolak request dengan HTTP Status `429 Too Many Requests`.

### 3.2 Data Integrity
Sistem memegang prinsip *Immutability*. Data sensor yang telah masuk ke database tidak akan pernah diubah (`UPDATED_AT` dinonaktifkan). Jika terdapat anomali data, perbaikan dilakukan di sisi algoritma filter, bukan dengan memanipulasi *raw data* di database.

### 3.3 Mekanisme Fail-Safe & Caching Lokal (Network Outage)
Mengingat lokasi kumbung jamur seringkali berada di area dengan koneksi Wi-Fi yang tidak stabil, ESP32 dilengkapi dengan mekanisme *fail-safe* (toleransi kegagalan) menggunakan metode **Local Caching**.

*   **Skenario Normal:** ESP32 membaca data → NTP Sync Waktu → Kirim HTTP POST → Server menerima (Status 201).
*   **Skenario Disconnect (Wi-Fi Mati):** 
    1. Jika request HTTP gagal (Timeout/Error), ESP32 tidak membuang data tersebut.
    2. Data di-serialize menjadi JSON yang dilengkapi dengan `recorded_at` (berdasarkan RTC internal ESP32 yang sebelumnya sudah sinkron dengan NTP).
    3. Payload JSON disimpan ke dalam *buffer lokal*. Dalam implementasi TA ini, digunakan **Ring Buffer (FIFO) di RAM ESP32** yang sanggup menampung hingga 24 payload terakhir (setara dengan 2 jam *offline* jika interval baca 5 menit). Jika ingin lebih permanen, bisa menggunakan **SPIFFS (SPI Flash File System)**.
    4. Saat modul Wi-Fi berhasil melakukan *reconnect*, ESP32 akan melakukan iterasi (looping) pada antrean buffer tersebut dan mengirim ulang (resend) semua data *cached* ke server secara sekuensial.
    5. Server menerima data *cached* tersebut dan menyimpannya berdasarkan timestamp asli (`recorded_at`), sehingga grafik visualisasi di Dashboard tetap berurutan dan tidak melompat.
