# Spesifikasi Sequence Diagram — Smart Shroom SCM 🍄

**Judul Tugas Akhir:** *Sistem Informasi Supply Chain Management dan Spasial WMS pada Kumbung Jamur Terintegrasi dengan Otomasi dan Monitoring Mikroklimat IoT*  
**Dokumen:** Spesifikasi Interaksi Sekuensial Sistem (UML Sequence Diagrams)  
**Referensi Terkait:** [docs/use_case.md](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/use_case.md) | [docs/dfd.md](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/dfd.md) | [docs/PRD.md](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/PRD.md) | [docs/erd.md](file:///d:/DevTools/Antigravity/Projects/TA_vio/docs/erd.md)  
**Penyusun:** Benedictus Vio  
**Standar Rekayasa:** Ponytail Lean Spec (Zero-Bloat, Anti-Bab 1-5 Skripsi, 100% Pure Architecture & Code Lifelines)

---

## 1. Arsitektur Komponen & Lifeline UML

Seluruh sequence diagram dalam dokumen ini menggunakan interaksi antar-lifeline berikut:

| Komponen Lifeline | Entitas Nyata dalam Kode | Peran & Tanggung Jawab |
|---|---|---|
| `Actor` | Admin / Worker / ESP32 | Pengguna fisik atau mikrokontroler di kumbung. |
| `FE` (Frontend UI) | React 18, Vite, Tailwind, Zustand, TanStack Query | Antarmuka pengguna, form validation, optimistic state, modal dialog. |
| `API` (Laravel Router) | `routes/api.php`, Sanctum Middleware, RateLimiter | Endpoint router, token authentication, RBAC guard (`role:admin`). |
| `Controller` | `App\Http\Controllers\Api\*` | Validasi payload request (`Validator`), orkestrasi business logic. |
| `DB` (Database Server) | MySQL / SQLite, Eloquent ORM | Transaksi data atomik (`DB::transaction`), isolasi state, foreign key integrity. |
| `Cache` | Cache Memory / Redis / File | Penyimpanan state volatil cepat (status `command` jeda panen, temporary config). |
| `IoT` (Firmware ESP32) | ESP32 C++ Firmware, SHT30 I2C, Relay Modul | Edge computing, closed-loop actuator control, failsafe hardware. |

---

## 2. Modul A: Autentikasi & Otorisasi Pengguna

### SD-01: Alur Autentikasi Login (UC-01)
Interaksi autentikasi kredensial pengguna, penerbitan token Bearer Sanctum, dan persistensi state pada Zustand store.

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (Admin/Worker)
    participant FE as React UI (Zustand AuthStore)
    participant API as Laravel Routing (RateLimiter)
    participant Ctrl as AuthController
    participant DB as Database (users table)

    User->>FE: Input email & password, klik tombol "Masuk"
    FE->>FE: Validasi form lokal (email valid & min 6 karakter)
    FE->>API: POST /api/login {email, password}
    Note over API: Throttle Middleware (15 req/menit)
    API->>Ctrl: login(Request $request)
    Ctrl->>DB: User::where('email', $email)->first()
    alt Email Tidak Ditemukan / Password Hash Mismatch
        DB-->>Ctrl: null / false
        Ctrl-->>FE: HTTP 422 / 401 Unauthorized {message: "Kredensial tidak valid"}
        FE-->>User: Tampilkan Toast Error Merah
    else Kredensial Valid
        DB-->>Ctrl: User instance (id, name, email, role)
        Ctrl->>DB: $user->createToken('auth-token')->plainTextToken
        DB-->>Ctrl: plainTextToken
        Ctrl-->>FE: HTTP 200 OK {token, user: {id, name, role}}
        FE->>FE: Simpan token ke localStorage & Zustand AuthStore
        FE-->>User: Redirect ke Dashboard Utama (/dashboard)
    end
```

---

### SD-02: Registrasi Akun Pekerja Baru dengan Kuota RBAC (UC-02)
Pendaftaran akun baru oleh Admin dengan validasi kuota worker dan otorisasi Sanctum `role:admin`.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin (Owner)
    participant FE as Modal Registrasi Worker
    participant API as Route Middleware (auth:sanctum & role:admin)
    participant Ctrl as AuthController
    participant DB as Database (users table)

    Admin->>FE: Buka modal "Tambah Pekerja", isi form
    FE->>API: POST /api/register {name, email, password, role: 'worker'}
    API->>API: Verifikasi Sanctum Token & Cek Role == 'admin'
    alt Bukan Role Admin
        API-->>FE: HTTP 403 Forbidden {error: "Hanya Admin yang dapat mendaftarkan akun"}
        FE-->>Admin: Tampilkan Toast Error Hak Akses
    else Terverifikasi Admin
        API->>Ctrl: register(Request $request)
        Ctrl->>DB: User::where('role', 'worker')->count()
        DB-->>Ctrl: count = 5 (misal kuota penuh)
        alt Kuota Worker Telah Penuh (Maks 5)
            Ctrl-->>FE: HTTP 422 Unprocessable {error: "Batas kuota pekerja telah tercapai"}
            FE-->>Admin: Notifikasi Kuota Maksimum
        else Kuota Tersedia
            Ctrl->>DB: User::create([name, email, password_hash, role])
            DB-->>Ctrl: User baru tersimpan
            Ctrl-->>FE: HTTP 201 Created {user}
            FE-->>Admin: Modal tutup & Tabel Akun Refresh
        end
    end
```

---

## 3. Modul B: Pemantauan Iklim Mikro & Early Warning System (EWS)

### SD-03: Alur Polling Telemetri & Evaluasi EWS Real-Time (UC-04, UC-06)
Frontend secara berkala mengambil data fusi sensor vertikal terbaru dan mendeteksi kondisi anomali iklim mikro.

```mermaid
sequenceDiagram
    autonumber
    actor User as Admin / Worker
    participant FE as Dashboard UI (React Query)
    participant API as Laravel Routing (auth:sanctum)
    participant Ctrl as SensorDataController
    participant DB as Database (sensor_data table)

    FE->>API: GET /api/sensor-data/latest (Polling interval 5-10s)
    API->>Ctrl: latest()
    Ctrl->>DB: SensorData::latest('created_at')->first()
    DB-->>Ctrl: Record telemetri {temp_top, temp_mid, temp_bottom, humidity_avg, heat_index}
    Ctrl-->>FE: HTTP 200 OK {data: {...}}
    FE->>FE: Update Gauge Dial Animasi & Evaluasi Batas Threshold
    alt Nilai Melewati Threshold (Suhu > 32°C atau RH < 80%)
        FE->>FE: Aktifkan Status Banner EWS (Kuning / Merah Berkedip)
        FE-->>User: Tampilkan Peringatan Audio/Visual "Anomali Iklim Kumbung!"
    else Kondisi Normal (Optimal)
        FE->>FE: Render Indikator Hijau "Optimal"
        FE-->>User: Tampilan Normal
    end
```

---

## 4. Modul C: Spasial WMS 3D & Manajemen Siklus Rak

### SD-04: Alur Alokasi Batch Baglog ke Koordinat Slot Rak Spasial (UC-19)
Admin memetakan bibit jamur dari batch logistik ke slot denah rak fisik (3D Grid) secara massal (*bulk allocation*).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin
    participant FE as WMS Modal / Drag-Select Grid
    participant API as Laravel API (auth:sanctum, role:admin)
    participant Ctrl as BatchSlotAssignmentController
    participant DB as Database (MySQL Transaction)

    Admin->>FE: Pilih Batch Baglog, pilih koordinat slot (misal: R1-S1, R1-S2), isi Qty
    FE->>API: POST /api/batch-slot-assignments {baglog_batch_id, assigned_at, slots: [...]}
    API->>Ctrl: store(Request $request)
    Ctrl->>Ctrl: Validasi payload & cek duplikasi kode slot
    Ctrl->>DB: DB::beginTransaction()
    Ctrl->>DB: Slot::whereIn('slot_code', ...)->lockForUpdate()
    loop Untuk Setiap Slot
        Ctrl->>DB: Cek kapasitas: slot.active_capacity + new_qty <= max_capacity (10)
        alt Kapasitas Terlampaui
            Ctrl->>DB: DB::rollBack()
            Ctrl-->>FE: HTTP 422 {error: "Slot R1-S1 melebihi kapasitas!"}
            FE-->>Admin: Alert pesan kapasitas slot penuh
        end
        Ctrl->>DB: BatchSlotAssignment::create([batch_id, slot_code, current_status: 'FRUITING', active_capacity: qty])
        Ctrl->>DB: Slot::update([current_status: 'OCCUPIED'])
    end
    Ctrl->>DB: DB::commit()
    Ctrl-->>FE: HTTP 201 Created {message: "Alokasi WMS berhasil"}
    FE->>FE: Invalidate Query 'slots' & update warna kotak denah (Hijau Aktif)
    FE-->>Admin: Denah Spasial ter-update seketika
```

---

### SD-05: Alur Tutup Siklus Kamar Rak & Auto-Cull WMS (UC-29)
Penyelesaian masa tanam pada rak yang telah melewati batas panen produktif, memutasikan sisa baglog menjadi afkir secara atomik.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin
    participant FE as Denah Grid / Modal Detail Slot
    participant API as Laravel API (auth:sanctum, role:admin)
    participant Ctrl as BatchSlotAssignmentController
    participant DB as Database (MySQL Transaction)

    Admin->>FE: Klik tombol "Tutup Siklus / Selesai Rak"
    FE-->>Admin: Dialog konfirmasi: sisa N baglog otomatis jadi afkir HABIS_PRODUKSI
    Admin->>FE: Konfirmasi "Ya, Selesaikan Siklus"
    FE->>API: POST /api/batch-slot-assignments/{id}/complete {reason}
    API->>Ctrl: completeCycle($id)
    Ctrl->>DB: DB::beginTransaction()
    Ctrl->>DB: BatchSlotAssignment::findOrFail($id)->lockForUpdate()
    DB-->>Ctrl: Assignment {id, active_capacity: 4, slot_code: 'R2-S3'}
    alt Sisa Baglog Aktif > 0
        Ctrl->>DB: BaglogCull::create([assignment_id, quantity: 4, cull_reason: 'HABIS_PRODUKSI'])
        Ctrl->>DB: Assignment::update([active_capacity: 0, current_status: 'COMPLETED', completed_at: now()])
    else Sisa Baglog == 0
        Ctrl->>DB: Assignment::update([current_status: 'COMPLETED', completed_at: now()])
    end
    Ctrl->>DB: Slot::where('slot_code', 'R2-S3')->update([current_status: 'AVAILABLE'])
    Ctrl->>DB: DB::commit()
    Ctrl-->>FE: HTTP 200 OK {message: "Siklus slot selesai"}
    FE->>FE: State denah berubah jadi abu-abu (Siap diisi batch baru)
    FE-->>Admin: Toast sukses & denah rak bebas alokasi
```

---

## 5. Modul D: Manajemen Mutasi Afkir & Biosekuriti

### SD-06: Pencatatan Afkir Baglog (UC-21) & Pembatalan Void Afkir (UC-28)
Worker/Admin mencatat jamur rusak/terkontaminasi (mengurangi kapasitas aktif slot), dan Admin membatalkan entri (*void*) dengan pengembalian kapasitas rak otomatis.

```mermaid
sequenceDiagram
    autonumber
    actor User as Worker / Admin
    participant FE as UI Detail Slot / Afkir Form
    participant API as Laravel Routing (auth:sanctum)
    participant Ctrl as BaglogCullController
    participant DB as Database (MySQL Transaction)

    Note over User, DB: FASE 1: Pencatatan Mutasi Afkir (UC-21)
    User->>FE: Input form afkir {slot_code, quantity: 2, cull_reason: 'TRICHODERMA'}
    FE->>API: POST /api/baglog-culls
    API->>Ctrl: store(Request $request)
    Ctrl->>DB: DB::beginTransaction()
    Ctrl->>DB: BatchSlotAssignment::whereActive()->lockForUpdate()
    alt Quantity > Active Capacity Slot
        Ctrl->>DB: DB::rollBack()
        Ctrl-->>FE: HTTP 422 {error: "Jumlah afkir melebihi baglog aktif pada slot"}
    else Valid
        Ctrl->>DB: BaglogCull::create([assignment_id, quantity: 2, reason: 'TRICHODERMA'])
        Ctrl->>DB: Assignment::decrement('active_capacity', 2)
        Ctrl->>DB: DB::commit()
        Ctrl-->>FE: HTTP 201 Created
        FE-->>User: Tampilkan sukses, kapasitas slot berkurang
    end

    Note over User, DB: FASE 2: Pembatalan Afkir / Void Cull (UC-28, Admin Only)
    actor Admin as Admin
    Admin->>FE: Klik "Batalkan Afkir (Void)" pada baris riwayat
    FE-->>Admin: Modal input alasan void (min 3 karakter)
    Admin->>FE: Submit alasan: "Salah lapor rak R1-S2, harusnya R1-S3"
    FE->>API: POST /api/baglog-culls/{id}/void {void_reason}
    API->>API: Cek Role Admin
    API->>Ctrl: void($id, Request $request)
    Ctrl->>DB: DB::beginTransaction()
    Ctrl->>DB: BaglogCull::findOrFail($id)->lockForUpdate()
    Ctrl->>DB: BatchSlotAssignment::findOrFail(assignment_id)->lockForUpdate()
    Ctrl->>DB: Cek status assignment != 'COMPLETED'
    Ctrl->>DB: Assignment::increment('active_capacity', 2)
    Ctrl->>DB: BaglogCull::update([voided_at: now(), void_reason: '...', void_by: admin_id])
    Ctrl->>DB: DB::commit()
    Ctrl-->>FE: HTTP 200 OK {message: "Void afkir berhasil"}
    FE->>FE: Baris tabel dicoret (line-through), kapasitas slot pulih
    FE-->>Admin: Notifikasi sukses void
```

---

## 6. Modul E: Rantai Pasok Panen & Penjualan

### SD-07: Pencatatan Panen Multi-Flush (UC-11) & Void Panen (UC-26)
Pencatatan hasil timbangan harian per slot rak dan pembatalan (*void audit trail*) tanpa penghapusan data fisik.

```mermaid
sequenceDiagram
    autonumber
    actor Worker as Worker / Admin
    participant FE as Modal Input Panen
    participant API as Laravel API (auth:sanctum)
    participant Ctrl as HarvestController
    participant DB as Database (harvests table)

    Worker->>FE: Pilih Slot (R1-S2), Flush #1, Bobot 1.85 KG, Kualitas 'SUPER'
    FE->>API: POST /api/harvests {slot_code, flush_number: 1, weight_kg: 1.85, quality_grade: 'SUPER'}
    API->>Ctrl: store(Request $request)
    Ctrl->>DB: Cek alokasi aktif slot -> dapatkan batch_id & assignment_id
    Ctrl->>DB: Harvest::create([assignment_id, batch_id, flush_number, weight_kg: 1.85, ...])
    DB-->>Ctrl: Harvest ID #104 tersimpan
    Ctrl-->>FE: HTTP 201 Created {data: harvest}
    FE->>FE: Update Kartu Total Panen Hari Ini & Chart Tren 14 Hari
    FE-->>Worker: Tampilkan Toast Sukses Input Panen

    Note over Worker, DB: Admin Melakukan Void Panen (UC-26)
    actor Admin as Admin
    Admin->>FE: Temukan baris panen salah, klik "Void"
    FE-->>Admin: Dialog konfirmasi: Alasan void wajib diisi
    Admin->>FE: Masukkan alasan: "Timbangan belum ditera / salah ketik 18.5kg"
    FE->>API: POST /api/harvests/104/void {void_reason: "..."}
    API->>API: Validasi role:admin
    API->>Ctrl: void($id)
    Ctrl->>DB: Harvest::whereNull('voided_at')->findOrFail(104)
    Ctrl->>DB: Harvest::update([voided_at: now(), void_reason: "...", void_by: admin_id])
    DB-->>Ctrl: Success
    Ctrl-->>FE: HTTP 200 OK {message: "Panen berhasil dibatalkan"}
    FE->>FE: Baris panen menjadi abu-abu tercoret, total KG panen otomatis berkurang
    FE-->>Admin: Audit trail tercatat aman
```

---

### SD-08: Transaksi Penjualan & Void Sales (UC-13, UC-27)
Pencatatan penjualan ke pasar/tengkulak serta pembatalan transaksi dengan re-kalkulasi instan pada omzet dan HPP.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin
    participant FE as Halaman Penjualan (React Query)
    participant API as Laravel API (auth:sanctum, role:admin)
    participant Ctrl as SaleController
    participant DB as Database (sales table)

    Admin->>FE: Input Form Penjualan: Pembeli 'Pasar Induk', Qty 25 KG, Harga Rp 28.000/KG
    FE->>API: POST /api/sales {buyer_name, quantity_kg: 25, price_per_kg: 28000, payment_method}
    API->>Ctrl: store(Request $request)
    Ctrl->>Ctrl: Hitung total_amount = 25 * 28000 = Rp 700.000
    Ctrl->>DB: Sale::create([...])
    DB-->>Ctrl: Record Penjualan tersimpan
    Ctrl-->>FE: HTTP 201 Created
    FE->>FE: Refresh Tabel Penjualan & Summary Omzet
    FE-->>Admin: Toast sukses transaksi

    Note over Admin, DB: Pembatalan Transaksi Penjualan (UC-27)
    Admin->>FE: Klik "Batalkan (Void)" pada transaksi penjualan
    FE->>API: POST /api/sales/{id}/void {void_reason: "Pembeli membatalkan pesanan di tempat"}
    API->>Ctrl: void($id)
    Ctrl->>DB: Sale::findOrFail($id)->update([voided_at: now(), void_reason: '...'])
    DB-->>Ctrl: Updated
    Ctrl-->>FE: HTTP 200 OK
    FE->>FE: Rekapitulasi omzet dan kalkulasi margin laba HPP otomatis terpotong
    FE-->>Admin: Transaksi ditandai VOID
```

---

## 7. Modul F: Akuntansi Biaya Manajerial & HPP Dinamis

### SD-09: Kalkulasi HPP Dinamis & Margin Kontribusi (UC-22, UC-23)
Sistem mengagregasikan biaya bibit baglog, proporsi beban operasional kumbung (listrik, air, tenaga kerja), dan total bobot panen bersih (*net harvest excluding voids*).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin
    participant FE as Tab Analisis HPP & Keuangan
    participant API as Laravel Routing (auth:sanctum)
    participant Ctrl as BaglogBatchController
    participant DB as Database (baglog_batches, harvests, expenses)

    Admin->>FE: Membuka Halaman Analisis HPP
    FE->>API: GET /api/baglogs/hpp-summary
    API->>Ctrl: hppSummary()
    Ctrl->>DB: Query Batch Baglog Aktif + Total Pengadaan (Bibit)
    Ctrl->>DB: Query Total Panen Bersih: SUM(weight_kg) WHERE voided_at IS NULL
    Ctrl->>DB: Query Beban Operasional: SUM(amount) periode batch
    DB-->>Ctrl: Data finansial mentah
    Ctrl->>Ctrl: Hitung HPP per KG = (Biaya Bibit + Beban Operasional) / Total Panen KG
    Ctrl->>Ctrl: Hitung Margin Kontribusi = Rata-rata Harga Jual - HPP per KG
    Ctrl-->>FE: HTTP 200 OK {summary: {total_harvest_kg, hpp_per_kg, contribution_margin, profit_margin_pct}}
    FE->>FE: Render Kartu Metrik Finansial & Diagram Donat Biaya
    FE-->>Admin: Tampilan Dashboard HPP siap dianalisis
```

---

## 8. Modul G: Kontrol Interupsi & Mode Panen (Failsafe)

### SD-10: Alur Mode Jeda Panen & Resume AUTO (UC-24, UC-25)
Interupsi manual saat pekerja masuk ke kumbung untuk mencegah sprayer menyemprot air ke tubuh pekerja dan jamur siap petik.

```mermaid
sequenceDiagram
    autonumber
    actor Worker as Pekerja / Admin
    participant FE as Widget Mode Panen (Failsafe)
    participant API as Laravel API (auth:sanctum)
    participant Ctrl as DeviceControlController
    participant Cache as Memory / System Cache
    participant DB as Database (sprinkler_logs table)
    participant IoT as Mikrokontroler ESP32

    Worker->>FE: Klik Tombol Jeda Panen [Preset 4 Jam]
    FE->>API: POST /api/device/pause {duration_seconds: 14400}
    API->>Ctrl: pause(Request $request)
    Ctrl->>Cache: Cache::put('device_command', 'PAUSE', 14400)
    Ctrl->>DB: SprinklerLog::create([actuator_type: 'MISTING', action: 'FORCE_OFF', trigger_reason: 'PAUSE_HARVEST_MODE'])
    Ctrl-->>FE: HTTP 200 OK {status: 'PAUSED', expires_at: '...'}
    FE->>FE: Start Countdown Timer 4 Jam di UI

    Note over IoT, Cache: ESP32 Polling Interval 10 Detik
    IoT->>API: GET /api/device/command (Polling Edge)
    API->>Ctrl: status()
    Ctrl->>Cache: Cache::get('device_command')
    Cache-->>Ctrl: 'PAUSE'
    Ctrl-->>IoT: HTTP 200 OK {command: 'PAUSE'}
    IoT->>IoT: Matikan Relay Sprinkler & Fan seketika (Failsafe Active)

    Note over Worker, IoT: Pekerja Selesai Panen Lebih Cepat (UC-25)
    Worker->>FE: Klik "Akhiri Jeda & Kembali ke AUTO"
    FE->>API: POST /api/device/resume
    API->>Ctrl: resume()
    Ctrl->>Cache: Cache::put('device_command', 'AUTO')
    Ctrl-->>FE: HTTP 200 OK {status: 'AUTO'}
    FE->>FE: Timer reset, badge kembali hijau AUTO
    IoT->>API: GET /api/device/command
    API-->>IoT: HTTP 200 OK {command: 'AUTO'}
    IoT->>IoT: Kembali ke mode histeresis otomatis sensorik
```

---

## 9. Modul H: Edge Computing & Closed Loop IoT Engine

### SD-11: Alur Pengiriman Telemetri & Polling Edge ESP32 (UC-16, UC-17, UC-18)
Siklus telemetri berkala (fusi 3 sensor SHT30 vertikal), eksekusi histeresis lokal pada firmware ESP32, dan pelaporan log aktuator ke cloud.

```mermaid
sequenceDiagram
    autonumber
    participant SHT as Sensor Vertikal (3x SHT30)
    participant ESP as Firmware ESP32 (FreeRTOS)
    participant Relay as Modul Relay (Sprinkler & Fan)
    participant API as Laravel Device Endpoints (RateLimiter)
    participant Ctrl as SensorData & SprinklerLog Controller
    participant DB as Database (telemetry & logs)

    loop Setiap 30 Detik (Loop Siklus Utama)
        ESP->>SHT: Baca I2C Suhu & Kelembapan (Top, Mid, Bottom)
        SHT-->>ESP: Raw Data SHT30 [T1, H1], [T2, H2], [T3, H3]
        ESP->>ESP: Kalkulasi Fusi Sensor (Avg Humidity & Heat Index)
        ESP->>API: POST /api/sensor-data {temp_top, temp_mid, temp_bottom, humidity_avg, heat_index}
        API->>Ctrl: store()
        Ctrl->>DB: SensorData::create([...])
        DB-->>Ctrl: Inserted
        Ctrl-->>ESP: HTTP 201 Created

        Note over ESP, API: Polling Threshold & Status Perintah (Interval 30-60s)
        ESP->>API: GET /api/thresholds/active
        API-->>ESP: HTTP 200 OK {temp_min: 24, temp_max: 30, humidity_min: 85, humidity_max: 95}
        
        ESP->>ESP: Evaluasi Rule Engine Histeresis Lokal
        alt Kelembapan < 85% & Suhu > 30°C (Kering & Panas)
            ESP->>Relay: DigitalWrite(RELAY_PUMP, LOW) [Nyalakan Misting]
            Relay-->>ESP: Pompa Aktif
            ESP->>API: POST /api/sprinkler-logs {actuator_type: 'MISTING', action: 'ON', duration_seconds: 60, trigger_reason: 'AUTO_LOW_HUMIDITY'}
            API->>Ctrl: store()
            Ctrl->>DB: SprinklerLog::create([...])
        else Parameter Kembali Optimal (Kelembapan >= 90%)
            ESP->>Relay: DigitalWrite(RELAY_PUMP, HIGH) [Matikan Misting]
            Relay-->>ESP: Pompa Padam
        end
    end
```

---

## 10. Matriks Relasi Use Case vs Sequence Diagram

Untuk memastikan integritas analisis perangkat lunak tanpa celah fungsional (*zero orphaned use case*), berikut matriks keterlacakan (*traceability matrix*):

| Modul | Kode Use Case | Nama Use Case | Nomor Sequence Diagram | Sifat Transaksi / Operasi |
|---|---|---|---|---|
| **Modul A** | UC-01 | Melakukan Login | **SD-01** | Sanctum Token Issuance |
| | UC-02 | Registrasi Akun Baru | **SD-02** | RBAC Guard & Quota Validation |
| | UC-03 | Melakukan Logout | **SD-01** (Variant) | Token Revocation (`currentAccessToken()->delete()`) |
| **Modul B** | UC-04 | Memantau Iklim Real-Time | **SD-03** | Polling Interval React Query |
| | UC-05 | Analisis Grafik Multirentang | **SD-03** (Variant) | Aggregation Query Range |
| | UC-06 | Peringatan Dini EWS | **SD-03** | Edge & Frontend Evaluation |
| | UC-07 | Memantau Log Aktuator | **SD-11** | Historical Actuator Audit |
| **Modul C** | UC-08 | Tambah Batch Baglog | **SD-04** (Precondition)| Master Data Procurement |
| | UC-19 | Alokasi Batch ke Slot WMS 3D | **SD-04** | Atomic DB Lock & Bulk Insert |
| | UC-20 | Memantau Heatmap Grid | **SD-04** | Spasial Coordinates Query |
| | UC-29 | Tutup Siklus & Auto-Cull | **SD-05** | Atomic DB Transaction & Cull Generation |
| **Modul D** | UC-21 | Mencatat Jurnal Mutasi Afkir | **SD-06** (Fase 1) | Decrement `active_capacity` Slot |
| | UC-28 | Membatalkan Catatan Afkir | **SD-06** (Fase 2) | Atomic Void Rollback Capacity |
| **Modul E** | UC-11 | Mencatat Panen Harian | **SD-07** (Fase 1) | Multi-Flush Slot Attribution |
| | UC-26 | Membatalkan Catatan Panen | **SD-07** (Fase 2) | Void Audit Trail Ledger |
| | UC-13 | Mencatat Transaksi Penjualan | **SD-08** (Fase 1) | Sales Order Processing |
| | UC-27 | Membatalkan Penjualan | **SD-08** (Fase 2) | Void Audit Trail & Omzet Reversal |
| | UC-14 | Rekap Mingguan & Stok | **SD-08** | Stock Accumulation |
| **Modul F** | UC-22 | Beban Biaya Operasional | **SD-09** | Ledger Expense Accounting |
| | UC-23 | Analisis HPP Dinamis | **SD-09** | Dynamic Batch Costing Formula |
| **Modul G** | UC-24 | Aktifkan Mode Jeda Panen | **SD-10** | Failsafe Cache Command Override |
| | UC-25 | Akhiri Mode Jeda Panen | **SD-10** | Immediate Resume to AUTO |
| **Modul H** | UC-16 | Pengiriman Telemetri Sensor | **SD-11** | Non-Blocking IoT Push Telemetry |
| | UC-17 | Polling Threshold & Command | **SD-11** | Edge Sync Execution |
| | UC-18 | Pengiriman Log Aktuator | **SD-11** | Hardware Event Auditing |

---

## 11. Karakteristik Ketahanan Sistem (System Resilience & Edge Cases)

1. **Idempotensi & Void Safety**:  
   Seluruh operasi pembatalan (`/void`) pada Panen, Penjualan, dan Afkir tidak pernah menjalankan perintah SQL `DELETE`. Sistem menerapkan *soft immutable audit trail* dengan mengisikan `voided_at`, `void_reason`, dan `void_by` untuk menjamin tidak ada manipulasi data terselubung oleh pengguna.
2. **Atomic Capacity Recovery**:  
   Pada `SD-06` (Void Cull), pengembalian kapasitas aktif (`active_capacity`) dilindungi pengecekan status alokasi. Jika slot sudah ditutup siklusnya (`COMPLETED`), pembatalan ditolak untuk mencegah anomali *ghost capacity* pada rak kosong.
3. **Edge IoT Autonomous Failsafe**:  
   Jika koneksi internet atau server backend mati, ESP32 tetap menjalankan logika histeresis mandiri menggunakan batas threshold terakhir yang tersimpan di flash memory (NVS), memastikan kumbung jamur tidak mengalami gagal panen akibat dehidrasi.
