# Panduan Hardware & Konsep Blackbox IoT (Smart Shroom)

Dokumen ini berisi daftar belanja (shopping list) komponen elektronik yang riil dan spesifik untuk kebutuhan perakitan alat IoT pada Tugas Akhir, beserta penjelasan konsep "Blackbox".

---

## 1. Daftar Belanja (Shopping List) Hardware

Berikut adalah komponen yang wajib dibeli. Perkiraan harga adalah harga wajar di *marketplace* lokal (Tokopedia/Shopee).

### 🛠️ Komponen Utama (Otak & Waktu)
| Nama Barang | Spesifikasi Rekomendasi | Fungsi | Estimasi Harga |
| :--- | :--- | :--- | :--- |
| **ESP32 DevKit V1** | Versi 30-pin atau 38-pin (Type-C lebih bagus) | Otak utama. Dipilih karena punya Wi-Fi, dual-core, dan RAM lebih besar dari ESP8266 (penting buat Blackbox). | Rp 50.000 - 70.000 |
| **Modul RTC DS3231** | DS3231 (Jangan DS1307 karena kurang akurat) | Real-Time Clock. Menjaga waktu tetap akurat walau ESP32 mati/tanpa Wi-Fi. | Rp 15.000 - 25.000 |
| **Baterai CR2032** | Baterai kancing 3V | Baterai untuk modul RTC agar jam tidak keriset. | Rp 3.000 |

### 🌡️ Modul Sensor (Mata & Telinga)
| Nama Barang | Spesifikasi Rekomendasi | Fungsi | Estimasi Harga |
| :--- | :--- | :--- | :--- |
| **DHT22** | Sensor Suhu & Kelembapan | **Wajib DHT22**, jangan DHT11 (DHT11 terlalu ampas/tidak akurat untuk TA). | Rp 45.000 - 60.000 |
| **BH1750** | Digital Light Sensor (I2C) | Membaca intensitas cahaya (Lux) dengan sangat presisi. Jauh lebih baik dari sensor LDR biasa. | Rp 15.000 - 20.000 |
| **MQ-135** *(Opsi Hemat)* | Gas Sensor Module | Deteksi kualitas udara umum (termasuk CO2 estimasi). Cocok untuk budget mahasiswa. | Rp 20.000 - 30.000 |
| **MH-Z19B** *(Opsi Sultan)* | NDIR CO2 Sensor | Sensor CO2 *true reading*. Sangat akurat tapi lumayan mahal. Kalau budget ada, pakai ini. | Rp 250.000+ |

### ⚡ Komponen Pendukung & Aktuator
| Nama Barang | Spesifikasi Rekomendasi | Fungsi | Estimasi Harga |
| :--- | :--- | :--- | :--- |
| **Relay Module** | 1-Channel atau 2-Channel 5V | Saklar otomatis untuk menyalakan pompa air (Sprinkler) dari ESP32. | Rp 10.000 - 15.000 |
| **Mini Water Pump** | Pompa air celup mini (5V atau 12V) | Simulasi penyiraman otomatis (Aktuator). | Rp 15.000 - 30.000 |
| **Kabel Jumper** | Dupont Female-to-Female & Male-to-Female (20cm) | Menghubungkan pin sensor ke ESP32 tanpa menyolder (untuk tahap *prototyping*). | Rp 15.000 / set |
| **Breadboard** | MB-102 (830 point) | Papan *prototyping* untuk menancapkan ESP32 dan kabel. | Rp 15.000 |
| **Power Supply** | Adaptor 5V 2A (Kabel USB) | Catu daya utama yang stabil untuk ESP32. Jangan pakai charger abal-abal. | Rp 30.000 |

---

## 2. Penjelasan Konsep "Blackbox" IoT

Konsep **Blackbox** dalam IoT terinspirasi dari kotak hitam pesawat terbang: ia merekam seluruh aktivitas penerbangan secara lokal, sehingga jika pesawat jatuh (koneksi terputus), data historis tetap aman.

Dalam TA lu, Blackbox ini memecahkan masalah: **"Apa yang terjadi pada data jamur kalau Wi-Fi di kumbung mati seharian?"**

### 🧠 Cara Kerja Blackbox di ESP32

Sistem Blackbox ini memanfaatkan 3 komponen utama:
1. **ESP32 (Prosesor & Memori Flash)**
2. **RTC DS3231 (Penjaga Waktu)**
3. **SPIFFS / LittleFS (Sistem File internal ESP32)**

**Alur Logikanya (State Machine):**

1. **Reading & Timestaping (Baca & Catat Waktu):**
   Setiap 5 menit, ESP32 membaca DHT22, BH1750, dan MQ-135. Alih-alih langsung dikirim ke internet, ESP32 *nanya* ke modul RTC DS3231: *"Sekarang jam berapa?"*.
   
2. **Writing to Blackbox (Rekam Lokal):**
   ESP32 menggabungkan data sensor dan waktu menjadi format JSON, lalu menyimpannya (append) ke dalam file teks (misal: `datalog.txt`) yang ada di dalam *Flash Memory* ESP32 (SPIFFS). Ini adalah proses "Perekaman Blackbox".

3. **Transmission Attempt (Coba Kirim):**
   ESP32 mencoba melakukan koneksi ke Wi-Fi dan HTTP POST ke backend Laravel (Dashboard).
   
   *   **Skenario A (Wi-Fi Lancar):** Data terkirim, server merespons HTTP `201 Created`. ESP32 kemudian menghapus data tersebut dari `datalog.txt` karena sudah aman di server.
   *   **Skenario B (Wi-Fi Mati/RTO):** Pengiriman gagal. ESP32 *TIDAK* panik. Dia membiarkan data tersebut tertinggal di `datalog.txt` dan kembali tidur (Deep Sleep).

4. **Syncing / Bulk Upload (Sinkronisasi Masal):**
   Katakanlah Wi-Fi mati selama 3 jam (berarti ada 36 baris data ngantre di `datalog.txt`). Begitu Wi-Fi kembali normal, ESP32 menyadari ada tumpukan data di Blackbox. ESP32 akan membaca file tersebut, dan menembakkan semuanya ke server satu per satu. 

### 💡 Kenapa Konsep Ini Sangat Kuat untuk Sidang TA?
*   Menunjukkan bahwa sistem lu **Toleran terhadap Kesalahan (Fault-Tolerant)**.
*   Data lingkungan kumbung yang sangat krusial (suhu/kelembapan) **tidak pernah bolong (missing data)** di grafik Dashboard.
*   Lu mempraktikkan konsep *Edge Computing* murni, di mana perangkat ujung (ESP32) punya kecerdasan dan media penyimpanannya sendiri.
