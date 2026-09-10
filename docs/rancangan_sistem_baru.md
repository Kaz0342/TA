# Rancangan Sistem Baru

## 1. Gambaran Umum

Rancangan baru sistem IoT budidaya jamur kuping (*Auricularia*) disusun agar sistem tetap realistis terhadap kondisi kumbung lapangan dan keterbatasan biaya, tetapi memiliki arsitektur kontrol yang cukup kuat untuk kebutuhan pengembangan sistem dan skripsi.

Prinsip utama rancangan:

- Tidak menggunakan sensor CO₂ pada versi utama sistem karena pertimbangan biaya.
- Memisahkan **fase biologis baglog** dari **profil kontrol lingkungan kumbung**.
- Menggunakan tiga fase biologis: **Incubation, Primordia, dan Fruiting**.
- Menggunakan dua profil lingkungan utama untuk pengendalian: **Vegetative dan Generative**.
- Menggunakan minimal dua titik sensor suhu dan kelembapan untuk mengurangi bias akibat perbedaan mikroklimat dalam kumbung.
- Menggunakan filtering, time-based debounce, hysteresis, dan minimum ON time.
- Menjalankan logika keselamatan secara lokal pada ESP32.
- Menjadikan MQTT/HTTP, Laravel, dashboard, dan Telegram sebagai lapisan IoT/application, bukan satu-satunya pengendali aktuator.
- Menyediakan watchdog dan fail-safe untuk menghadapi kegagalan komunikasi atau firmware.

---

# 2. Permasalahan pada Rancangan Sebelumnya

Rancangan sederhana:

```text
DHT22
  ↓
ESP32
  ↓
IF RH > threshold
  ↓
Fan ON
```

memiliki beberapa kelemahan:

1. Threshold bersifat statis.
2. Nilai sensor dapat mengalami noise atau spike.
3. Aktuator dapat mengalami relay chatter.
4. Sistem tidak mempertimbangkan durasi kondisi.
5. Satu sensor belum tentu merepresentasikan seluruh kondisi kumbung.
6. Satu kumbung dapat berisi beberapa batch baglog dengan umur/fase berbeda.
7. Kegagalan MQTT, server, atau koneksi internet tidak boleh membuat sistem kehilangan kendali lokal.
8. CO₂ tidak dapat digunakan sebagai input kontrol apabila sistem tidak memiliki sensor CO₂.

---

# 3. Prinsip Arsitektur Baru

Arsitektur baru dibagi menjadi beberapa lapisan:

```text
                 BATCH MANAGEMENT
                        │
                        ▼
                BIOLOGICAL PHASE
             ┌──────────┼──────────┐
             ▼          ▼          ▼
         Incubation  Primordia  Fruiting
                        │
                        ▼
                ENVIRONMENT PROFILE
             ┌──────────┴──────────┐
             ▼                     ▼
         Vegetative             Generative
                        │
                        ▼
                     SENSORS
              ┌─────────┴─────────┐
              ▼                   ▼
           DHT22 #1            DHT22 #2
          Temp + RH            Temp + RH
              │                   │
              └─────────┬─────────┘
                        ▼
                SIGNAL PROCESSING
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
          Validate      SMA      Comparison
                        │
                        ▼
                 LOCAL CONTROL
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
    Threshold       Duration         Interlock
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                ACTUATOR ARBITER
                 ┌──────┴──────┐
                 ▼             ▼
                Fan        Humidifier
                 │             │
                 └──────┬──────┘
                        ▼
                  LOCAL FAIL-SAFE
                        │
                  Watchdog Timer
                        │
                        ▼
                    IoT LAYER
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
           MQTT      Laravel    Telegram
                        │
                        ▼
                    Dashboard
```

---

# 4. Pemisahan Fase Biologis dan Kontrol Lingkungan

## 4.1 Biological Phase

Sistem menyimpan tiga fase biologis:

```text
INCUBATION
     ↓
PRIMORDIA
     ↓
FRUITING
```

Fase tersebut tidak ditentukan hanya dari sensor.

Sensor hanya mengetahui:

- suhu;
- kelembapan;
- kondisi lingkungan lainnya yang memang dipasang.

Penentuan fase dapat dilakukan berdasarkan:

- batch;
- tanggal inokulasi;
- perkembangan kolonisasi;
- kondisi primordia;
- observasi operator;
- prosedur budidaya.

Dengan demikian:

```text
Sensor ≠ Biological Stage Detector
```

Sistem hanya menggunakan fase yang telah dikonfigurasi untuk menentukan profil lingkungan yang digunakan.

---

# 5. Batch Management

Satu kumbung tidak selalu berarti semua baglog berada pada fase yang sama.

Contoh:

```text
Kumbung 01
│
├── Batch A
│   └── Incubation
│
├── Batch B
│   └── Primordia
│
└── Batch C
    └── Fruiting
```

Sistem harus dapat mencatat fase per batch.

Contoh tabel:

| Batch | Tanggal Masuk | Fase |
|---|---|---|
| B001 | 1 Sep | Fruiting |
| B002 | 15 Sep | Primordia |
| B003 | 30 Sep | Incubation |

Namun apabila seluruh batch berada dalam satu ruangan, sistem tidak boleh mengklaim bahwa setiap batch memperoleh mikroklimat berbeda.

Aktuator seperti satu fan atau satu humidifier bekerja terhadap **lingkungan kumbung secara keseluruhan**.

---

# 6. Environment Profile

Untuk kontrol aktuator, tiga fase biologis dapat dipetakan ke profil lingkungan.

```text
INCUBATION
     ↓
VEGETATIVE PROFILE

PRIMORDIA
     ↓
GENERATIVE TRANSITION PROFILE

FRUITING
     ↓
GENERATIVE PROFILE
```

Tujuan pemisahan ini adalah menghindari asumsi bahwa satu ruangan dapat dikontrol pada kondisi yang berbeda untuk setiap batch.

---

# 7. Sensor

## 7.1 Sensor Utama

Minimal:

```text
DHT22 #1
DHT22 #2
```

Masing-masing mengukur:

```text
Temperature
Relative Humidity
```

Dua titik pengukuran digunakan karena kondisi mikroklimat dapat berbeda berdasarkan:

- ketinggian;
- posisi rak;
- arah aliran udara;
- kedekatan dengan pintu;
- kedekatan dengan sumber air;
- posisi terhadap fan.

---

## 7.2 Posisi Sensor

Contoh konseptual:

```text
             ATAS
        ┌─────────────┐
        │   DHT22 #1  │
        │             │
        │    RAK      │
        │    RAK      │
        │             │
        │   DHT22 #2  │
        └─────────────┘
             BAWAH
```

Posisi sebenarnya harus ditentukan berdasarkan layout kumbung dan distribusi rak.

Sensor tidak ditempatkan terlalu dekat dengan:

- nozzle/mister;
- sumber air;
- exhaust fan;
- lubang udara;
- dinding yang terkena panas matahari langsung.

---

# 8. Sensor Tambahan

## 8.1 Light Sensor

Sensor cahaya bersifat opsional.

Prioritas:

```text
Temperature + RH
        ↓
Prioritas utama

Second DHT22
        ↓
Sangat disarankan

Light Sensor
        ↓
Opsional
```

Jika budget terbatas, sistem tetap dapat berjalan tanpa sensor cahaya.

Cahaya dapat digunakan sebagai parameter monitoring, bukan sebagai parameter utama pengendalian aktuator.

---

## 8.2 CO₂ Sensor

CO₂ **tidak digunakan pada versi utama sistem**.

Alasan:

- biaya sensor relatif tinggi;
- tidak diperlukan untuk membangun MVP;
- sistem dapat melakukan kontrol dasar menggunakan suhu, RH, dan durasi;
- menghindari penambahan kompleksitas hardware yang tidak diperlukan.

CO₂ tetap dapat dibahas pada landasan teori sebagai faktor yang berkaitan dengan pertukaran udara, tetapi **tidak boleh ditampilkan sebagai data sensor atau input controller** jika hardware tersebut tidak dipasang.

---

# 9. Signal Processing

Data sensor mentah tidak langsung digunakan oleh controller.

Alurnya:

```text
Raw Sensor
    ↓
Sensor Validation
    ↓
Moving Average
    ↓
Filtered Value
    ↓
Control Engine
```

## 9.1 Sensor Validation

Sistem memeriksa apakah pembacaan masuk akal.

Contoh:

```text
Jika sensor menghasilkan nilai invalid
        ↓
Jangan gunakan nilai tersebut
        ↓
Gunakan nilai terakhir yang valid
atau masuk ke kondisi fail-safe
```

---

# 10. Simple Moving Average

SMA dapat digunakan untuk mengurangi noise.

```text
RH_filtered =
(RH₁ + RH₂ + ... + RHₙ) / N
```

Contoh:

```text
N = 10 sampel
```

Namun nilai `N` harus disesuaikan dengan interval sampling.

Contoh:

```text
Sampling interval = 30 detik
N = 10

10 × 30 detik
= 5 menit data
```

Dengan demikian, N=10 merupakan konfigurasi awal, bukan nilai universal yang selalu optimal.

---

# 11. Time-Based Debounce

Controller tidak boleh bereaksi terhadap satu pembacaan.

Contoh:

```text
RH > threshold
      ↓
Timer mulai
      ↓
RH tetap > threshold
      ↓
15 menit terpenuhi
      ↓
Evaluasi kondisi lainnya
      ↓
Aktuator boleh bekerja
```

Contoh:

```text
High RH duration ≥ 15 menit
```

Angka 15 menit merupakan parameter awal yang dapat dikalibrasi.

---

# 12. Hysteresis

Gunakan threshold ON dan OFF yang berbeda.

Contoh:

```text
FAN ON
RH ≥ 92%

FAN OFF
RH ≤ 87%
```

Tujuan:

- mencegah switching terlalu sering;
- mengurangi relay chatter;
- menjaga kestabilan kondisi lingkungan.

Jangan menggunakan:

```text
ON  > 90%
OFF < 90%
```

karena sensor yang bergerak di sekitar 90% dapat membuat relay terus berganti status.

---

# 13. Minimum ON Time

Setelah aktuator menyala, berikan waktu minimum sebelum keputusan OFF.

Contoh:

```text
Fan ON
  ↓
Minimum ON Time = 5 menit
  ↓
Evaluasi kembali
  ↓
Fan tetap ON / OFF
```

Nilai 5 menit merupakan parameter awal dan dapat dikalibrasi.

---

# 14. Kontrol Fan Tanpa Sensor CO₂

Karena tidak ada sensor CO₂, kontrol ventilasi menggunakan:

```text
RH
+
Temperature
+
Duration
+
Phase/Profile
```

Contoh:

```text
IF:
    RH_filtered ≥ RH_MAX
    AND high_RH_duration ≥ 15 menit
    AND Temperature > TEMP_MIN

THEN:
    Fan = ON
```

Jika suhu terlalu rendah:

```text
IF:
    Temperature ≤ TEMP_MIN

THEN:
    Continuous Fan = BLOCKED
```

Sistem dapat berpindah ke mode ventilasi siklik sesuai konfigurasi.

---

# 15. Ventilasi Siklik

Contoh konfigurasi:

```text
Pulse ON  = 2 menit
Pulse OFF = 35 menit
```

Nilai tersebut **bukan aturan biologis universal**.

Keduanya harus disimpan sebagai parameter yang dapat dikonfigurasi.

Contoh:

```text
VENTILATION CONFIG

ON Duration:
2 minutes

OFF Duration:
35 minutes

Minimum Temperature:
21°C
```

Nilai dapat diubah berdasarkan hasil pengujian sistem.

---

# 16. Temperature Interlock

Pada malam hari, suhu kumbung dapat turun.

Karena itu:

```text
Temperature rendah
+
RH tinggi
```

tidak otomatis berarti fan harus menyala terus.

Contoh:

```text
IF Temperature < 21°C
    ↓
Continuous Exhaust = DISABLED
    ↓
Gunakan ventilation pulse
atau tunggu kondisi lebih aman
```

Tujuannya adalah menghindari pendinginan berlebihan.

---

# 17. Actuator Conflict Arbitration

Jika sistem memiliki:

- fan;
- humidifier/mister;
- pump;

maka keputusan aktuator harus dikoordinasikan.

Contoh konflik:

```text
RH LOW
    ↓
Humidifier ON

pada saat bersamaan

Ventilation request
    ↓
Fan ON
```

Jika keduanya dijalankan bersamaan tanpa koordinasi:

```text
Humidifier ON
    ↓
RH naik

Fan ON
    ↓
RH turun

Humidifier ON
    ↓
RH naik

Fan ON
    ↓
...
```

Karena itu diperlukan:

```text
CONTROL ENGINE
      ↓
ACTUATOR ARBITRATION
      ↓
Conflict Check
      ↓
Final Actuator Command
```

Prioritas dapat ditentukan berdasarkan kondisi dan fase.

---

# 18. Local Control dan IoT Layer

Sistem dibagi menjadi dua bagian.

## 18.1 Local Control

Berjalan langsung di ESP32:

```text
Sensor
 ↓
Filtering
 ↓
Control Logic
 ↓
Relay
```

Local control tetap bekerja walaupun:

- internet mati;
- MQTT mati;
- Laravel mati;
- dashboard tidak dapat diakses.

---

## 18.2 IoT/Application Layer

Berfungsi untuk:

```text
ESP32
 ↓
MQTT / HTTP
 ↓
Laravel
 ↓
Database
 ↓
Dashboard
```

dan:

```text
Laravel
 ↓
Telegram
```

Lapisan ini berfungsi untuk monitoring, konfigurasi, logging, dan notifikasi.

---

# 19. Watchdog

ESP32 perlu menggunakan watchdog untuk mengatasi firmware yang mengalami hang.

Contoh:

```text
ESP32
  ↓
Firmware hang
  ↓
Watchdog timeout
  ↓
ESP32 restart
  ↓
Local control kembali aktif
```

Watchdog bukan pengganti fail-safe hardware.

---

# 20. Fail-Safe

Sistem harus menentukan kondisi aman untuk setiap aktuator.

Contoh arsitektur:

```text
NORMAL
ESP32 → Control Relay

MQTT DOWN
ESP32 → Local Control

Laravel DOWN
ESP32 → Local Control

Internet DOWN
ESP32 → Local Control

ESP32 FAILURE
        ↓
Predefined Safe State
```

Safe state harus ditentukan berdasarkan fungsi masing-masing aktuator dan risiko lingkungan kumbung.

Jangan mengasumsikan bahwa semua aktuator harus selalu ON atau selalu OFF ketika controller mati.

---

# 21. Dashboard

Dashboard tidak hanya menampilkan nilai sensor.

Contoh:

```text
KUMBUNG 01

Temperature
23.1°C

Humidity
91%

Phase Profile
GENERATIVE

System Status
NORMAL
```

Untuk dua sensor:

```text
TEMPERATURE

Sensor A: 24.0°C
Sensor B: 22.2°C

Average: 23.1°C
Minimum: 22.2°C
Maximum: 24.0°C
```

Hal ini membuat variasi antar-zona terlihat.

---

# 22. Semantik Status Dashboard

Jangan menggunakan:

```text
Status:
Jamur Sedang Berbuah
```

karena sensor tidak mengamati tubuh buah secara langsung.

Gunakan:

```text
Kondisi Ruangan:
Parameter Sesuai Profil Fruiting
```

atau:

```text
Environmental Status:
Within Configured Fruiting Range
```

Status biologis batch tetap berasal dari konfigurasi/operator:

```text
Batch B001
Phase: Fruiting
```

---

# 23. Dynamic Safe Zone

Rentang ideal pada grafik harus mengikuti profile yang aktif.

Contoh:

```text
Profile:
VEGETATIVE
```

maka chart menampilkan safe zone untuk profile tersebut.

Jika:

```text
Profile:
GENERATIVE
```

maka safe zone berubah mengikuti konfigurasi generative.

Jangan menggunakan satu zona hijau yang sama untuk semua fase.

---

# 24. Warning System

Contoh kondisi:

```text
Temperature rendah
+
RH sangat tinggi
```

dapat menghasilkan:

```text
WARNING:
Potential Condensation Risk
```

Sistem tidak langsung menyatakan:

```text
Pseudomonas detected
```

karena sensor lingkungan tidak dapat mendiagnosis penyakit.

---

# 25. Event Logging

Setiap keputusan otomatis dicatat.

Contoh:

```text
08:42
RH exceeded configured threshold

08:57
Condition persisted for 15 minutes

08:57
Temperature within safe ventilation range

08:57
Fan → ON

09:04
RH returned to hysteresis OFF range

09:04
Fan → OFF
```

Event log berguna untuk:

- debugging;
- audit;
- evaluasi sistem;
- analisis performa;
- pembahasan skripsi.

---

# 26. Struktur Data

## batches

```text
id
name
inoculation_date
current_phase
notes
```

## growth_phases

```text
id
batch_id
phase
start_at
end_at
configured_by
```

## sensor_readings

```text
id
timestamp
sensor_id
temperature
humidity
light
```

Jika dua DHT22 digunakan:

```text
sensor_id = DHT22_01
sensor_id = DHT22_02
```

## environmental_profiles

```text
id
name
temperature_min
temperature_max
rh_min
rh_max
fan_on_duration
fan_off_duration
minimum_temperature
```

## control_events

```text
id
timestamp
phase
profile
parameter
condition
action
duration
reason
```

---

# 27. Prioritas Hardware

| Komponen | Prioritas | Fungsi |
|---|---|---|
| ESP32 | Wajib | Controller |
| DHT22 #1 | Wajib | Temperature + RH |
| DHT22 #2 | Sangat disarankan | Monitoring zona kedua |
| Relay | Wajib | Interface aktuator |
| Exhaust Fan | Wajib | Ventilasi |
| Humidifier/Mister | Sesuai kebutuhan | Kontrol RH |
| Water Pump | Opsional | Sistem pengabutan/penyiraman |
| Light Sensor | Opsional | Monitoring cahaya |
| CO₂ Sensor | Tidak digunakan pada MVP | Mengurangi biaya |
| Watchdog | Wajib secara software | Recovery ESP32 |
| Hardware Fail-Safe | Sangat disarankan | Safety aktuator |

---

# 28. Alur Kerja Sistem

```text
START
  ↓
ESP32 Initialization
  ↓
Sensor Check
  ↓
Load Active Profile
  ↓
Read Sensor
  ↓
Validate Data
  ↓
Moving Average
  ↓
Compare Sensor Zones
  ↓
Evaluate Phase/Profile
  ↓
Check Duration
  ↓
Check Hysteresis
  ↓
Check Temperature Interlock
  ↓
Actuator Conflict Check
  ↓
Execute Actuator
  ↓
Log Control Event
  ↓
Send Telemetry
  ↓
Dashboard / Telegram
  ↓
Repeat
```

---

# 29. Contoh Logic Sederhana

```cpp
readSensors();

if (!sensorValid()) {
    enterSafeState();
    return;
}

temperature = getFilteredTemperature();
humidity = getFilteredHumidity();

updateConditionDuration();

if (profile == GENERATIVE) {

    if (humidity >= RH_MAX &&
        highHumidityDuration >= DEBOUNCE_TIME) {

        if (temperature > MIN_SAFE_TEMPERATURE) {
            requestFan();
        } else {
            requestPulsedVentilation();
        }
    }

    if (humidity <= RH_OFF_THRESHOLD &&
        minimumFanOnTimeCompleted()) {

        stopFan();
    }
}
```

Kode di atas merupakan gambaran logika, bukan implementasi final.

---

# 30. Posisi CO₂ dalam Sistem

CO₂ tetap dapat dibahas sebagai:

```text
Parameter biologis:
CO₂
```

tetapi:

```text
Tidak diukur
Tidak dikontrol secara langsung
Tidak ditampilkan sebagai sensor
```

Hal ini harus konsisten antara:

- hardware;
- firmware;
- database;
- dashboard;
- diagram arsitektur;
- metodologi;
- pembahasan skripsi.

---

# 31. Posisi Sistem terhadap Kondisi Lapangan

Sistem dirancang dengan asumsi:

- satu kumbung dapat berisi beberapa batch;
- kondisi lingkungan dapat berbeda antar-zona;
- ventilasi kumbung tradisional dapat terjadi secara pasif;
- biaya perangkat harus diperhatikan;
- koneksi internet dapat mengalami gangguan;
- sensor tidak selalu merepresentasikan seluruh volume ruangan;
- aktuator memiliki keterbatasan fisik.

Dengan demikian, sistem tidak dibuat berdasarkan asumsi bahwa kumbung merupakan ruangan laboratorium yang seluruh parameternya seragam.

---

# 32. Konsep Pengujian

Sistem dapat diuji melalui beberapa skenario.

## Pengujian 1 — Sensor

Memeriksa:

- kestabilan pembacaan;
- validitas data;
- perbedaan antar-sensor.

## Pengujian 2 — Filtering

Bandingkan:

```text
Raw Data
vs
Filtered Data
```

## Pengujian 3 — Debounce

Berikan kondisi RH melewati threshold selama:

```text
5 menit
10 menit
15 menit
20 menit
```

Periksa apakah aktuator hanya aktif setelah durasi yang ditentukan.

## Pengujian 4 — Hysteresis

Periksa apakah fan tidak mengalami switching ketika RH bergerak di sekitar threshold.

## Pengujian 5 — Temperature Interlock

Uji kondisi:

```text
RH tinggi
Temperature normal
```

dan:

```text
RH tinggi
Temperature rendah
```

Pastikan respons berbeda.

## Pengujian 6 — Communication Failure

Putuskan:

```text
Wi-Fi
MQTT
Laravel
```

dan pastikan local control tetap berjalan.

## Pengujian 7 — Watchdog

Simulasikan firmware hang dan periksa apakah ESP32 dapat restart dan kembali ke kondisi aman.

---

# 33. Arsitektur Final

```text
                        ┌───────────────────┐
                        │  BATCH MANAGEMENT │
                        └─────────┬─────────┘
                                  │
                                  ▼
                        ┌───────────────────┐
                        │ BIOLOGICAL PHASE  │
                        │                   │
                        │ Incubation        │
                        │ Primordia         │
                        │ Fruiting          │
                        └─────────┬─────────┘
                                  │
                                  ▼
                        ┌───────────────────┐
                        │ ENVIRONMENT       │
                        │ PROFILE           │
                        │                   │
                        │ Vegetative        │
                        │ Generative        │
                        └─────────┬─────────┘
                                  │
                                  ▼
             ┌────────────────────────────────────┐
             │               SENSORS              │
             │                                    │
             │ DHT22 #1              DHT22 #2     │
             │ Temp + RH              Temp + RH   │
             └──────────────────┬─────────────────┘
                                │
                                ▼
                     ┌────────────────────┐
                     │ SIGNAL PROCESSING  │
                     │                    │
                     │ Validation         │
                     │ Moving Average     │
                     │ Zone Comparison    │
                     └─────────┬──────────┘
                               │
                               ▼
                     ┌────────────────────┐
                     │   LOCAL CONTROL    │
                     │                    │
                     │ Threshold          │
                     │ Duration           │
                     │ Hysteresis         │
                     │ Interlock          │
                     └─────────┬──────────┘
                               │
                               ▼
                     ┌────────────────────┐
                     │ ACTUATOR ARBITER   │
                     │                    │
                     │ Fan                │
                     │ Humidifier         │
                     │ Pump               │
                     └─────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             LOCAL FAIL-SAFE          EVENT LOG
                    │                     │
                 Watchdog                 │
                    │                     │
                    └──────────┬──────────┘
                               │
                               ▼
                         IoT / APP LAYER
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
              MQTT          Laravel       Telegram
                               │
                               ▼
                           Dashboard
```

---

# 34. Kesimpulan

Rancangan baru memprioritaskan **realisme lapangan, efisiensi biaya, dan keandalan kontrol**.

Sistem tidak menggunakan CO₂ sensor pada versi utama. Parameter utama yang dikendalikan adalah:

```text
Temperature
+
Relative Humidity
+
Duration
+
Phase/Profile
```

Sistem menggunakan:

```text
2 titik DHT22
+
Filtering
+
Time-based Debounce
+
Hysteresis
+
Minimum ON Time
+
Temperature Interlock
+
Actuator Arbitration
+
Watchdog
+
Local Fail-Safe
```

Fase biologis tetap terdiri dari:

```text
Incubation
Primordia
Fruiting
```

tetapi kontrol lingkungan tidak dipaksakan berbeda per batch apabila batch berada dalam satu ruangan. Untuk pengendalian kumbung digunakan profil lingkungan yang sesuai dengan kondisi keseluruhan ruangan.

Dengan rancangan tersebut, sistem tetap sederhana dari sisi hardware tetapi memiliki arsitektur software dan kontrol yang cukup kuat untuk dikembangkan menjadi sistem monitoring dan kontrol IoT budidaya jamur kuping yang dapat diuji secara sistematis.
