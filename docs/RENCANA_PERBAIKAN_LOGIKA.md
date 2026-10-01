# Rencana Perbaikan Logika — Smart Shroom SCM

- **Basis analisis:** `github.com/Kaz0342/TA`, branch `develop`, commit `8187915` (2026-09-27)
- **Disusun:** 1 Oktober 2026
- **Cakupan:** logika yang salah atau berisiko (kontrol ESP32, kanal command, backend). Kesesuaian dokumen **sengaja ditunda** (lihat §9).
- **File pendamping:** `sim_harness.py` (menghasilkan semua angka bertanda [RUN]; lihat Lampiran C).

---

## 0. Cara baca dokumen ini

Setiap klaim diberi tingkat bukti:

| Tanda | Arti |
|---|---|
| **[RUN]** | Dijalankan di simulator (headless, tanpa network). Angkanya bisa direproduksi dengan `sim_harness.py`. |
| **[CODE]** | Dibaca dari kode, belum dieksekusi. |
| **[ENV]** | Bergantung konfigurasi deploy (env Vercel/Supabase) yang tidak terlihat dari repo. Verifikasi dulu sebelum dianggap pasti. |

**Batas analisis (penting):**
- PHP tidak terpasang dan Arduino tidak bisa dikompilasi di lingkungan analisis. Semua snippet PHP/C++ di dokumen ini **belum dijalankan/dikompilasi**. Uji di lokal dan Wokwi sebelum deploy.
- Simulasi memverifikasi **logika kontrol di dalam model**. Koefisien fisiknya (misting 0,16; fan 0,04/0,08; recovery) adalah asumsi, bukan hasil ukur (Lampiran A).
- Isi dua chat lain ("Analisis celah logika dokumen", "Verifikasi logika simulasi dan firmware ESP32") tidak ikut dianalisis karena tidak terbaca dari sesi ini. Bila ada temuan di sana yang belum tercakup, tambahkan sebagai item F-xx baru.

---

## 1. Ringkasan dan urutan kerja

| ☐ | Fase | ID | Masalah | Prioritas | Effort | Bukti | Temuan lama |
|---|---|---|---|---|---|---|---|
| ☐ | 0 | – | Baseline sebelum mengubah apa pun | – | 30–45 mnt | – | – |
| ☐ | 1 | F-01 | `/migrate-db` publik dengan secret default (2 tempat) | P0 | 20 mnt | CODE, ENV | #3 |
| ☐ | 1 | F-02 | `/register` publik → token worker untuk siapa pun | P0 | 30 mnt | CODE | #3 |
| ☐ | 1 | F-03 | Durasi pause maks 24 jam (seharusnya 8 jam) | P1 | 15 mnt | CODE | #3 |
| ☐ | 2 | F-04 | `CACHE_STORE=array` → PAUSE/RESUME dan rate limiter tidak berfungsi di Vercel | P0 | 45 mnt | CODE, ENV | #1 |
| ☐ | 2 | F-05 | Validator log aktuator `max:600` menolak log panjang | P1 | 10 mnt | RUN, CODE | #6 |
| ☐ | 2 | F-06 | Query grafik tidak punya cabang PostgreSQL | P1 | 45 mnt | CODE, ENV | **baru** |
| ☐ | 3 | F-07 | `loop()` dan `setup()` bergantung WiFi → kontrol dan watchdog mati saat offline | P0 | 1–1,5 jam | CODE | #2 |
| ☐ | 3 | F-08 | HTTP blocking di dalam `stop*()`, log hilang, data sensor basi terkirim | P1 | 1,5–2 jam | CODE | #2 |
| ☐ | 3 | F-09 | Jam tidak valid (NTP) → aturan malam mati diam-diam | P1 | 30 mnt | CODE | #2 |
| ☐ | 4 | F-10 | Safety Override: histeresis stop hanya di jalur siang → chatter relay | P1 | 1 jam | RUN | #6 |
| ☐ | 4 | F-11 | Ambang darurat misting hard-coded (75/70/65) tidak ikut preset | P1 | 30 mnt | RUN | **baru** |
| ☐ | 4 | F-12 | Timeout 60 s menjadi pengontrol misting sebenarnya (deadband) | P1 | 1 jam | RUN | #4 |
| ☐ | 4 | F-13 | Sim mengevaluasi kontrol tiap 1 s, firmware tiap 5 s | P2 | 20 mnt | RUN | #6 |
| ☐ | 4 | F-14 | Latensi PAUSE ±30–40 s vs persyaratan "seketika" | P2 | 45 mnt | CODE | **baru** |
| ☐ | 4 | F-15 | Minor logika (validator RH, timer malam, pin strapping, boot relay) | P3 | 1 jam | CODE | minor |
| ☐ | 5 | F-16 | Data simulator tercampur data ESP32 di grafik; workflow reset tiap jam | P3 | 30 mnt | CODE | minor |
| ☐ | 5 | – | Regresi dan pengumpulan bukti | – | 2 jam | – | – |

**Estimasi total:** ±1,5–2,5 hari kerja.

### Kenapa urutannya begini

1. **Tutup celah sebelum membuka fitur.** F-04 membuat PAUSE benar-benar hidup. Begitu hidup, endpoint yang terlalu permisif (F-01–F-03) menjadi bisa dieksploitasi. Jadi F-01–F-03 dikerjakan lebih dulu.
2. **Backend dulu, baru firmware.** Firmware bergantung pada kontrak API (cache, validator log, grafik). Fase 1 dan 2 bisa satu kali deploy (tetap satu commit per F-xx).
3. **Keselamatan fisik sebelum optimasi.** F-07 (kontrol dan timeout jalan tanpa WiFi) adalah lantai keselamatan. Tuning apa pun di atasnya tidak berarti kalau pompa bisa nyangkut saat WiFi putus.
4. **Bug dulu, baru parameter.** F-10 dan F-11 (bug logika) sebelum F-12 (tuning deadband/timeout). Tuning di atas pengendali yang bug menghasilkan parameter yang salah.
5. **Samakan sim dan firmware (F-13) sebelum mengambil angka final untuk Bab 4.**

---

## 2. Fase 0 — Baseline (sebelum mengubah apa pun)

Tujuan: punya kondisi "sebelum" yang terdokumentasi untuk tabel sebelum–sesudah di skripsi.

```bash
git checkout develop && git pull
git checkout -b fix/logic-hardening

# 1) Tes backend (baseline)
cd backend && php artisan test && cd ..

# 2) Baseline simulator (taruh sim_harness.py di root repo)
mkdir -p docs/evidence
python sim_harness.py --sim iot_simulator.py --suite all > docs/evidence/baseline_sim.txt

# 3) Baseline API deploy (skrip ada di F-04)
SHROOM_EMAIL=... SHROOM_PASS=... python smoke_deploy.py > docs/evidence/baseline_smoke.txt
```

**Gate 0:** tiga file baseline tersimpan dan ter-commit. Aturan selanjutnya: **satu F-xx = satu commit** (`fix(F-04): ...`).

---

## 3. Fase 1 — Tutup celah

### F-01 — Hapus `/migrate-db` (2 tempat) · P0

**Masalah [CODE].** `GET /migrate-db` menjalankan `Artisan::call('migrate', ['--force' => true])` tanpa autentikasi. Satu-satunya penjaga adalah query `?secret=` dengan nilai default yang ada di repo publik (`ta-shroom-migrate-2026`). Endpoint terdaftar **dua kali**:
- `backend/routes/api.php:233` (→ `/api/migrate-db`)
- `backend/routes/web.php:64` (→ `/migrate-db`)

Keduanya berada di luar blok `if (app()->environment('local'))` (api.php L122–230; web.php L32–61). Versi `web.php` juga membocorkan `file` dan `line` exception di respons 500 (L86–87). Perbandingan secret memakai `!==` (bukan perbandingan waktu-konstan).

**Dampak [ENV].** Aman hanya jika `UTILITY_SECRET` di-set ke nilai lain di Vercel. Jika tidak, siapa pun yang membaca repo bisa memicu migrasi di DB produksi. Perintahnya `migrate` (bukan `migrate:fresh`), jadi tidak menghapus data. Risikonya: skema produksi berubah di luar kendali dan endpoint ini jadi pintu probing.

**Perbaikan.**
1. Hapus blok route di kedua file (api.php L233–257 beserta komentar di atasnya; web.php L63–90).
2. Migrasi dari laptop, bukan lewat HTTP:
   ```bash
   cd backend
   cp .env .env.production          # isi DB_CONNECTION=pgsql, DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD dari Supabase
   git check-ignore -v .env.production   # WAJIB terlihat ter-ignore sebelum diisi kredensial
   php artisan migrate --force --env=production
   ```
3. Anggap secret lama sudah bocor; ganti jika dipakai di tempat lain.

**Verifikasi.** `curl -i "https://<host>/migrate-db?secret=x"` dan `.../api/migrate-db?secret=x` → keduanya 404.

### F-02 — `/register` hanya untuk admin · P0

**Masalah [CODE].** `routes/api.php:27` mendaftarkan `POST /register` tanpa autentikasi (throttle 5/menit, yang sebenarnya tidak efektif di Vercel sampai F-04). Endpoint membuat akun `worker` (kuota maks 5 worker dan 1 admin, `AuthController.php:62–69, 82`) dan mengembalikan token. UI tidak memanggilnya (tidak ada pemanggil di `frontend/src`), hanya tes.

**Dampak.** Siapa pun bisa (a) menghabiskan kuota 5 worker sehingga pendaftaran worker asli terkunci, dan (b) mendapat token valid untuk `POST /device/pause`. Begitu F-04 membuat pause berfungsi, ini menjadi jalur sabotase jarak jauh (pompa dan fan mati selama durasi pause).

**Perbaikan.**
```php
// routes/api.php — hapus baris 27 (route publik), lalu taruh di dalam grup admin (mulai L95):
Route::middleware('role:admin')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    // ... route admin yang sudah ada
});
```
- Update 5 pemanggilan tes: `SecurityAuthTest.php` L245, L270, L286 dan `EccComprehensiveTestSuiteTest.php` L693, L714 → autentikasi sebagai admin dulu (`Sanctum::actingAs($admin)`).
- Tambah 2 tes: tanpa token → 401; token worker → 403.
- **Prasyarat:** pastikan akun admin sudah ada di DB produksi sebelum deploy (endpoint ini hanya membuat worker).

**Verifikasi.** `POST /api/register`: tanpa token → 401; token worker → 403; token admin → 201.

### F-03 — Batasi durasi pause · P1

**Masalah [CODE].** `DeviceControlController.php:39`: `'duration_seconds' => 'required|integer|min:60|max:86400'` (24 jam), sementara dokumen menyebut preset 2/4/6/8 jam (`docs/dashboard-documentation.md:129`). Firmware menerima `remaining_seconds` apa adanya (`esp32_firmware.ino:847`).

**Dampak.** Satu request dari worker mana pun bisa mematikan pompa dan fan hingga 24 jam. Selama pause tidak ada pengawasan suhu kritis (lihat §8 #4).

**Perbaikan.**
```php
'duration_seconds' => 'required|integer|min:60|max:28800',   // 8 jam
```
```cpp
// fetchThresholds(), ganti baris 847
unsigned long remSec = min(cmdObj["remaining_seconds"].as<unsigned long>(), 28800UL);
```
Opsional: sertakan nama user pemicu di `reason` (mis. `Auth::user()->name`) agar ada jejak audit.

**Verifikasi.** `POST /device/pause {"duration_seconds": 28801}` → 422.

**Gate 1:** `php artisan test` hijau (setelah tes diperbarui); `/migrate-db` dan `/api/migrate-db` 404; `/api/register` tanpa token 401.

---

## 4. Fase 2 — Backend (boleh deploy bersama Fase 1)

### F-04 — `CACHE_STORE=array`: PAUSE/RESUME dan rate limiter tidak berfungsi · P0

**Masalah [CODE].** `backend/vercel.json:24–25` mengatur `CACHE_STORE` dan `CACHE_DRIVER` = `array`. Perintah pause disimpan lewat `Cache::put` (`DeviceControlService`), dan rate limiter (`throttle:*`) juga memakai cache. Di Vercel setiap request adalah proses PHP baru, sehingga store `array` kosong lagi di request berikutnya.

**Dampak [ENV].**
- `POST /device/pause` mengembalikan sukses, tetapi `GET /thresholds/active` dan `/device/command` berikutnya menjawab `AUTO` → ESP32 tidak pernah pause.
- Semua `throttle` (login 15/mnt, register 5/mnt, device 20/mnt) tidak membatasi apa pun.
- 133 test hijau karena PHPUnit berjalan dalam satu proses dengan store `array` (`phpunit.xml`; tes Phase 4 memakai `Cache::flush()`). Yang dites bukan yang di-deploy.
- Berlaku kecuali env di dashboard Vercel meng-override (tidak terlihat dari repo).

**Perbaikan.**
1. `backend/vercel.json`: ubah `"CACHE_STORE": "array"` → `"database"`; hapus `CACHE_DRIVER` (Laravel 12 hanya membaca `CACHE_STORE`).
2. Vercel dashboard → Settings → Environment Variables: pastikan tidak ada `CACHE_STORE=array` yang menimpa.
3. Pastikan tabelnya ada di Supabase (SQL editor):
   ```sql
   select to_regclass('public.cache'), to_regclass('public.cache_locks');
   ```
   Keduanya harus non-null. Migrasinya sudah ada (`0001_01_01_000001_create_cache_table.php`); jika null, jalankan `php artisan migrate --force --env=production` dari laptop.
4. Redeploy, lalu jalankan smoke test di bawah.
5. Tambah tes penjaga:
   ```php
   public function test_vercel_tidak_memakai_cache_array(): void
   {
       $cfg = json_decode(file_get_contents(base_path('vercel.json')), true);
       $this->assertNotSame('array', $cfg['env']['CACHE_STORE'] ?? null,
           'PAUSE/RESUME dan rate limiter butuh cache persisten di serverless');
   }
   ```

**Smoke test (`smoke_deploy.py`):**
```python
# Jalankan: SHROOM_EMAIL=... SHROOM_PASS=... python smoke_deploy.py
import os, requests
API = os.getenv("API", "https://tugasakhir-lime.vercel.app/api")
tok = requests.post(f"{API}/login", timeout=15,
        json={"email": os.environ["SHROOM_EMAIL"], "password": os.environ["SHROOM_PASS"]}).json()["data"]["token"]
H = {"Authorization": f"Bearer {tok}"}

requests.post(f"{API}/device/pause", headers=H, timeout=15, json={"duration_seconds": 60, "reason": "smoke test"})
print("via /device/command    :", requests.get(f"{API}/device/command", timeout=15).json()["data"]["command"])
print("via /thresholds/active :", requests.get(f"{API}/thresholds/active", timeout=15).json()["data"]["device_command"]["command"])
requests.post(f"{API}/device/resume", headers=H, timeout=15)
print("setelah resume         :", requests.get(f"{API}/device/command", timeout=15).json()["data"]["command"])

codes = [requests.post(f"{API}/sensor-data", json={}, timeout=15).status_code for _ in range(25)]
print("rate limit, jumlah 429 :", codes.count(429))
```
- **Hasil benar:** `PAUSE`, `PAUSE`, `AUTO`, dan jumlah 429 > 0.
- **Sebelum fix (dugaan):** `AUTO`, `AUTO`, `AUTO`, 0.
- Jangan jalankan saat ESP32 fisik aktif: pompa dan fan dimatikan 60 detik dan 2 baris log "Manual Pause" masuk DB. Request `{}` ke `/sensor-data` sengaja tidak valid (422), jadi tidak ada data sampah.

**Jika API sudah benar tetapi ESP32 tetap tidak pause:** lihat Serial Monitor. Jika muncul "Gagal parse JSON threshold", naikkan `StaticJsonDocument<768>` (`ino:825`) menjadi 2048. Payload threshold plus command cukup besar; ukurannya belum diukur, ini hanya petunjuk debug.

**Alternatif lebih robust (opsional):** simpan status pause di tabel DB (`paused_until`, `reason`) alih-alih cache. Tidak bergantung driver cache dan bisa dites PHPUnit (±30 baris).

**Gate 2a:** smoke test menghasilkan `PAUSE / PAUSE / AUTO / 429>0`.

### F-05 — Validator log aktuator `max:600` · P1

**Masalah [CODE].** `StoreSprinklerLogRequest.php:31`: `duration_seconds` `max:600` (komentar "BE-W3 fix"). Log berdurasi >600 s ditolak 422, dan firmware tidak mencoba ulang (`sendSprinklerLog` hanya mencetak error, `ino:929–934`).

**Bukti [RUN].** Di simulasi panas ekstrem ada 2 log fan berdurasi >600 s dalam 2 hari (lihat Lampiran B.3). Setelah F-10 (override tidak lagi dipotong tiap 180 s), log panjang menjadi normal.

**Perbaikan.** `'max:86400'`. (Jalur `DeviceControlService::pause` menulis log langsung, tidak lewat request ini.)

**Verifikasi.** `POST /sprinkler-logs` dengan `duration_seconds: 900` → 201.

### F-06 — Query grafik tidak punya cabang PostgreSQL · P1 (baru)

**Masalah [CODE].** `SensorDataRepository::getLastHours()` hanya memiliki cabang `sqlite` (L81) dan `mysql` (L105). Driver lain jatuh ke `else` (L118–120): `orderBy('recorded_at','asc')->limit(120)` yaitu **120 baris TERLAMA** dalam jendela waktu, tanpa agregasi.

**Dampak [ENV].** Jika DB produksi PostgreSQL (kode menyebut Supabase; `config/database.php` punya `pgsql`), grafik 24 jam/7 hari hanya menampilkan ±2 jam pertama dari jendela (1 baris/menit → 120 baris = 2 jam). Bagian terbaru tidak tampil. Tes tidak menangkapnya karena memakai SQLite. Ini juga memengaruhi gambar grafik yang akan dipakai di Bab 4.

**Verifikasi dulu.** Cek `DB_CONNECTION` di Vercel. Gejala: pilih rentang 24 jam di dashboard → grafik berhenti jauh sebelum "sekarang".

**Perbaikan (primer)** — tambah cabang `pgsql` (Supabase memakai PG ≥14, jadi `date_bin` tersedia):
```php
} elseif ($driver === 'pgsql') {
    $results = \Illuminate\Support\Facades\DB::select("
        SELECT
            ROUND(AVG(temperature)::numeric, 2)     AS temperature,
            ROUND(AVG(humidity)::numeric, 2)        AS humidity,
            ROUND(AVG(co2_level)::numeric, 2)       AS co2_level,
            ROUND(AVG(light_intensity)::numeric, 2) AS light_intensity,
            date_bin(make_interval(mins => ?::int), recorded_at, TIMESTAMP '2000-01-01') AS bucket_time
        FROM sensor_data
        WHERE recorded_at >= ?
        GROUP BY bucket_time
        ORDER BY bucket_time ASC
    ", [$minuteStep, $since->toDateTimeString()]);
}
```
**Uji query ini di Supabase SQL editor lebih dulu** (ganti `?` dengan angka). SQL ini belum dijalankan.

**Alternatif driver-agnostic** (bisa dites PHPUnit di SQLite): ganti `else` dengan agregasi di PHP (ambil baris sejak `$since`, `groupBy(floor(timestamp / (step*60)))`, rata-ratakan). Lebih lambat untuk 7 hari (±10 ribu baris), tetapi aman untuk skala TA.

**Minimal** (jika hanya ingin menghentikan gejalanya): `orderByDesc('recorded_at')->limit(120)->get()->reverse()->values()` (yang terbaru, tanpa agregasi).

**Gate 2b:** dashboard rentang 24 jam menampilkan data sampai "sekarang".

---

## 5. Fase 3 — Firmware tahan offline

### F-07 — `loop()` dan `setup()` bergantung WiFi · P0

**Masalah [CODE].**
- `esp32_firmware.ino:261–270`: jika `WiFi.status() != WL_CONNECTED`, `loop()` mencetak warning, `WiFi.reconnect()`, `delay(1000)`, lalu `return`. Akibatnya **seluruh** pembacaan sensor, kontrol (blok A), dan watchdog D–H (timeout misting 60 s, fan 180 s, homogenisasi, night fan, timer pause) **tidak berjalan** selama WiFi putus.
- `setup()` (L235–239) menunggu WiFi tanpa batas waktu, sehingga boot tanpa WiFi tidak pernah sampai ke `loop()`.

**Dampak.** Pompa, solenoid, atau fan yang sedang ON saat WiFi putus tetap ON tanpa batas (baglog tergenang, motor jalan terus). Satu-satunya pengaman fisik (timeout) ikut mati tepat saat dibutuhkan. WiFi putus adalah kejadian normal.

**Perbaikan.**
```cpp
// ── global
#define DEBUG_FORCE_OFFLINE 0            // 1 = pura-pura WiFi mati (untuk tes di Wokwi)
unsigned long lastWifiRetry = 0;
bool ntpStarted = false;
inline bool wifiUp() { return !DEBUG_FORCE_OFFLINE && WiFi.status() == WL_CONNECTED; }

// ── setup(): ganti L235–255 (while tanpa batas sampai fetchThresholds)
unsigned long t0 = millis();
while (!wifiUp() && millis() - t0 < 15000) { delay(500); Serial.print("."); lcd.print("."); }
if (wifiUp()) {
  Serial.println("\n[WIFI] Terhubung! IP: " + WiFi.localIP().toString());
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov"); ntpStarted = true;
  fetchThresholds();
} else {
  Serial.println("\n[WIFI] Gagal konek 15 dtk -> lanjut OFFLINE dengan threshold default");
}

// ── loop(): ganti L262–270 (blok guard + return)
if (!wifiUp() && millis() - lastWifiRetry >= 15000) {
  lastWifiRetry = millis();
  WiFi.reconnect();                      // non-blocking; tanpa delay, tanpa return
}
if (wifiUp() && !ntpStarted) {           // NTP baru dimulai saat WiFi pertama kali tersedia
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov"); ntpStarted = true;
}
// Blok B (L360) dan C (L368): tambahkan `wifiUp() &&` pada kondisi if-nya.
// Di fetchThresholds/sendSensorData/sendSprinklerLog: ganti `WiFi.status() != WL_CONNECTED` dengan `!wifiUp()`.
```
Jika `WiFi.reconnect()` tidak efektif di versi core yang dipakai, ganti dengan `WiFi.disconnect(); WiFi.begin(ssid, password);`.

**Verifikasi (Wokwi/bench).** Build dengan `DEBUG_FORCE_OFFLINE 1`, paksa RH rendah (klik DHT22, geser slider). Harus terjadi: pompa berhenti di "Safety timeout" (60 s; 90 s setelah F-12), fan siang berhenti di 180 s, pause berakhir oleh timer. Screenshot Serial menjadi bukti Bab 4.

### F-08 — Jaringan non-blocking, antrian log, data basi · P1

**Masalah [CODE].**
- (a) `stopMisting()` (L540) dan `stopFan()` (±L719) memanggil `sendSprinklerLog()` yang melakukan HTTPS blocking (timeout 10 s, L917). `startPauseMode()` memanggil keduanya, sehingga loop bisa macet sampai 20 s. `fetchThresholds()` dan `sendSensorData()` juga blocking 10 s (L820, L882). Watchdog telat sebanyak itu.
- (b) Log yang gagal **hilang**: WiFi mati → langsung `return` (L907); HTTP ≠ 201 → hanya `Serial.printf` (L933). Tidak ada retry.
- (c) Jika semua sensor gagal (L343–349), `lastTemp/lastHum` tetap berisi nilai terakhir, atau default 27,5/85,0 (L165–166), dan blok B (L362) tetap mengirimnya sebagai data baru.

**Dampak.** Watchdog tertunda saat jaringan lambat; riwayat aktuator bolong persis saat jaringan bermasalah; dashboard menampilkan data basi/palsu sebagai data segar.

**Perbaikan.**
1. Timeout HTTP 10000 → 4000 di tiga fungsi (L820, L882, L917).
2. Antrian log di RAM (belum dikompilasi):
   ```cpp
   struct PendingLog { uint32_t dur; time_t startEpoch; char act[8]; char trig[96]; char stop[96]; };
   const uint8_t LOGQ_N = 10;
   PendingLog logQ[LOGQ_N]; uint8_t qHead = 0, qCount = 0;

   void enqueueLog(unsigned long dur, const String& trig, const String& stop, const char* act) {
     if (qCount == LOGQ_N) { qHead = (qHead + 1) % LOGQ_N; qCount--; }     // penuh: buang yang tertua
     PendingLog& e = logQ[(qHead + qCount) % LOGQ_N];
     time_t nowT = time(nullptr);
     e.dur = dur; e.startEpoch = (nowT > 1600000000) ? nowT - dur : 0;     // 0 = jam belum valid
     strlcpy(e.act, act, sizeof(e.act));
     strlcpy(e.trig, trig.c_str(), sizeof(e.trig)); strlcpy(e.stop, stop.c_str(), sizeof(e.stop));
     qCount++;
   }
   ```
   - Ubah `stopMisting`/`stopFan`: panggil `enqueueLog(...)` (bukan `sendSprinklerLog` langsung).
   - Ubah `sendSprinklerLog` menjadi `int postSprinklerLog(const PendingLog& e)` yang mengembalikan kode HTTP. Naikkan `StaticJsonDocument<384>` menjadi `<512>` (dua string 96 byte disalin), dan jika `e.startEpoch != 0` isi `doc["started_at"]` (UTC ISO-8601 via `gmtime_r` + `strftime("%Y-%m-%dT%H:%M:%SZ")`). Backend sudah menerima `started_at` (`StoreSprinklerLogRequest.php:30`); tanpa itu log tertunda tercatat dengan waktu terima. **Cek zona waktu dengan 1 log uji** (`app.timezone`).
   - Di `loop()`, bagian online (setelah blok C):
     ```cpp
     static unsigned long lastLogTry = 0;
     if (wifiUp() && qCount > 0 && millis() - lastLogTry >= 3000) {   // maks 1 log per 3 detik
       lastLogTry = millis();
       PendingLog& e = logQ[qHead];
       int code = postSprinklerLog(e);
       bool permanentReject = (code >= 400 && code < 500 && code != 429);
       if (code == 201 || permanentReject) { qHead = (qHead + 1) % LOGQ_N; qCount--; }
       // selain itu (timeout/5xx/429/-1): tetap di antrian, coba lagi nanti
     }
     ```
3. Data basi (c):
   ```cpp
   unsigned long lastValidReadMs = 0;      // global; set = now di dalam cabang `totalWeight > 0` (±L330)
   // blok B (L362): ganti `if (lastTemp > 0)` dengan
   if (lastValidReadMs > 0 && now - lastValidReadMs < 15000) sendSensorData(lastTemp, lastHum);
   ```
   Opsional: saat semua sensor gagal, matikan pompa dan solenoid (tanpa umpan balik RH, kabut tidak boleh jalan). Kebijakan fan saat sensor mati adalah keputusan desain (§8 #6).

**Verifikasi.** `DEBUG_FORCE_OFFLINE 1` → jalankan 2 siklus misting → kembalikan ke 0 → 2 log muncul di riwayat aktuator dashboard, dan loop tidak macet >4 s saat server sengaja dimatikan.

### F-09 — Jam tidak valid (NTP) · P1

**Masalah [CODE].** `getCurrentHourWIB()` (L187–193) mengembalikan `12` jika NTP belum sinkron. `controlMisting` (L442–443), `controlFan` (L558–559), dan watchdog F (L398–399) memakai hasilnya: tanpa NTP sistem mengira siang, sehingga night lockout dan fan malam **mati diam-diam**. `getLocalTime(&t, 200)` juga menunggu hingga 200 ms per panggilan saat waktu belum valid.

**Perbaikan.**
```cpp
int getCurrentHourWIB() {                 // -1 = waktu belum valid
  struct tm t;
  if (getLocalTime(&t, 0)) return t.tm_hour;   // tunggu ≤ ~10 ms, bukan 200 ms
  return -1;
}
inline bool isNightHour(int h) { return h >= 0 && (h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR); }
// Pemakaian di 3 tempat (L442–443, L558–559, L398–399):
//   bool isNight = isNightHour(getCurrentHourWIB());
```
Tambahkan satu kali `Serial.println("[TIME] Jam belum valid -> aturan malam NONAKTIF")` (flag `timeWarned`) dan tampilkan `NO TIME` di LCD. Perilaku tanpa NTP tetap "aturan malam nonaktif", tetapi sekarang eksplisit dan terlihat. Perbaikan permanen adalah RTC DS3231 (keputusan perangkat keras; ditunda, §9).

**Verifikasi.** Boot dengan `DEBUG_FORCE_OFFLINE 1` → Serial menampilkan peringatan jam sekali; tidak ada jeda 200 ms berulang (loop tetap responsif).

**Gate 3:** tes offline lulus (matriks §7 baris 8 dan 10).

---

## 6. Fase 4 — Logika kontrol

### F-10 — Safety Override: histeresis stop hanya di jalur siang · P1

**Masalah [CODE + RUN].** Di firmware dan sim, histeresis berhenti Safety Override ("suhu kritis teratasi", batas −1°C) hanya ada di jalur **siang** (`ino:653–659`; sim L939–949). Saat **malam**, begitu `maxTemp` ≤ batas kritis, blok Tier-2 tidak lagi `return` dan jalur malam (`ino:587–593`) langsung memanggil `stopFan("Transisi ke Night Mode")` tanpa histeresis. Suhu yang berfluktuasi di sekitar 34°C membuat fan (relay 220 V) start–stop tiap beberapa detik.

**Bukti [RUN]** (`--suite heat`, 2 hari simulasi, cuaca cerah dipaksa, preset Fruiting; tabel lengkap di Lampiran B.3):

| Ambient | Patch | Override start | Toggle fan/hari | Misting dipotong |
|---|---|---|---|---|
| 27–36°C | asli | 603 | 649 | 6 |
| 27–36°C | F-10a | 2 | 49 | 2 |
| 28–39°C | asli | 623 | 661 | 8 |
| 28–39°C | F-10a | 2 | 41 | 2 |

Ambient 27–36/28–39°C sengaja ekstrem. Pada ambient normal jalur ini jarang aktif: bug laten yang muncul justru saat override dibutuhkan.

**Perbaikan.**

**(a) Firmware** — sisipkan tepat setelah blok Tier-2 (setelah L573), sebelum settling guard (L575):
```cpp
  // [F-10a] Histeresis stop Safety Override berlaku 24 jam (siang DAN malam)
  if (isFanActive && isCriticalOverride) {
    if (maxTemp <= (criticalThreshold - 1.0) && avgTemp <= tempMax) {
      stopFan("Suhu kritis teratasi (Max " + String(maxTemp, 1) + "C <= " + String(criticalThreshold - 1.0, 1) + "C)");
    }
    return;   // belum teratasi: jangan biarkan logika siang/malam menyentuh fan ini
  }
```
Blok lama di L653–659 menjadi redundan (hapus atau biarkan).

**(b) Watchdog G (L411):** tambahkan `&& !isCriticalOverride`. Tanpa ini override tetap "putus-sambung": cap 180 s mematikan fan, lalu Tier-2 menyalakannya lagi <5 s kemudian (relay toggle tiap ±185 s tanpa manfaat).

**(c) Guard misting (opsional, dampak kecil)** — sebelum L453 di `controlMisting`:
```cpp
    if (maxSensorTemp > tempMax + CRITICAL_TEMP_OFFSET) return;   // jangan mulai misting yang langsung dipotong override
```
`maxSensorTemp` sudah variabel global (L167). Dampak terukur kecil (misting dipotong 6→2→1), jadi prioritas terendah di F-10.

**(d) Sim:** patch `F10a` dan `F10b` di `sim_harness.py` adalah spesifikasi perubahannya (sisipan sebelum `if is_night:` dan sebelum komentar `# 0. NIGHT LOCKOUT`).

**Kebijakan cap (keputusan).** Default yang disarankan: override tanpa cap (berjalan sampai pulih) + debounce sensor (§8 #3). Konsekuensi terukur [RUN]: pada skenario panas ekstrem RH < humMin selama 34–36% waktu karena interlock fan→misting (§8 #1). Angka ini **sama** dengan dan tanpa patch, jadi patch tidak memperburuknya. Alternatif "jendela bergantian" (mis. ON maks 10–15 menit, istirahat 2–3 menit agar misting punya kesempatan) butuh kalibrasi dan belum diuji.

**Verifikasi.** Matriks §7 baris 5 (siang **dan** malam); sim `--suite heat`: toggle fan ≤ ±50/hari.

### F-11 — Ambang darurat misting hard-coded tidak ikut preset · P1 (baru)

**Masalah [CODE + RUN].** Tier-2 misting ("Sensor Terkering") memakai ambang tetap `criticalLowRh = 75.0` (`ino:441`; sim L662), dan pengecualian night-lockout memakai `70.0` / `65.0` (`ino:456`; sim L688). Angka ini cocok untuk preset Fruiting (humMin 85) tetapi tidak mengikuti preset lain. Pada preset **Inkubasi** (RH 65–75%), rata-rata RH yang berada di tengah rentang target (±70%) sudah di bawah 75, sehingga pulse Tier-2 menyala terus; di malam hari pengecualian (`hum < 70`) juga terbuka di dalam rentang target.

**Bukti [RUN]** (`--suite incubation`, 2 hari, preset Inkubasi 65/75; ambient RH dipaksa 60–72% agar RH rata-rata berada di dalam rentang target):

| Kondisi | Patch | Siklus/hari | Pulse Tier-2/hari | RH rata-rata | RH<humMin | RH>humMax | Pompa mnt/hari |
|---|---|---|---|---|---|---|---|
| Ambient bawaan sim (82–95%) | asli | 0,0 | 0,0 | 89,4 | 0,0% | 100% | 0,0 |
| Ambient kering (60–72%) | asli | 182,8 | **168,8** | 71,6 | 12,2% | 27,2% | 84,5 |
| Ambient kering (60–72%) | F-11 | 80,2 | **3,5** | 69,4 | 11,1% | 13,0% | 38,8 |

Di ambient bawaan sim bug ini laten (RH tidak pernah <75%, misting tidak pernah dibutuhkan). Pada kondisi kering, ambang tetap menghasilkan ±169 pulse/hari dan pompa 2,2× lebih banyak.

**Perbaikan** (identik untuk humMin = 85 → 75/70/65, jadi perilaku Fruiting yang sudah dituning tidak berubah):
```cpp
float criticalLowRh = humMin - 10.0;                          // L441, tadinya 75.0
if (hum >= humMin - 15.0 && minHum >= humMin - 20.0) return;  // L456, tadinya 70.0 / 65.0
```
Sim: dua penggantian string yang sama (`PATCHES["F11"]` di harness). Catatan: untuk default seeder (80/95) Tier-2 bergeser 75 → 70 (lebih longgar).

**Verifikasi.** `--suite incubation`; matriks §7 baris 9.

### F-12 — Timeout 60 s menjadi pengontrol misting (deadband) · P1

**Masalah [RUN].** Stop RH = `min(humMax − 4, humMin + 5)` (`ino:837`; sim L491) dan timeout 60 s (`ino:86`; sim L53). Untuk Fruiting (85/95) target stop 90% hampir tidak pernah tercapai dalam 60 s: **97% siklus berhenti karena "Safety timeout"**, bukan "Target tercapai". Timeout menjadi pengontrol sebenarnya, dan klaim "histeresis kurva landai ±90%" tidak terbukti di model. Preset seeder (80/95): 30% timeout.

Sanity check fisik (Lampiran A): dengan laju menguap yang tersirat di sim, menaikkan RH 5 poin di 122,5 m³ butuh ≥60 s *bahkan tanpa rugi*, dan laju turun saat RH naik. Jadi 60 s memang terlalu pendek untuk deadband 5%.

**Perbaikan.**
```cpp
// fetchThresholds() L837:
rhTriggerHigh = humMin + min(3.0f, 0.5f * (humMax - humMin));   // Fruiting 85/95 -> 88 ; Primordia 85/90 -> 87,5
// konstanta L86:
const unsigned long MAX_MISTING_DURATION_MS = 90000;            // tadinya 60000
```
Sim: `iot_simulator.py:53` (`= 90`) dan `:491`. Edit juga teks "60s"/"60 detik" di log firmware L380–381 dan sim L765 agar tidak menyesatkan.

**Hasil [RUN]** (rata-rata 4 run: bulan 1 dan 7 × seed 1 dan 2; 2 hari/run):

| Preset | Patch | Stop RH | Siklus/hari | Timeout % | Pompa mnt/hari | RH<humMin | RH>humMax |
|---|---|---|---|---|---|---|---|
| Fruiting 85/95 | asli | 90,0 | 36,0 | **97** | 35,9 | 0,1% | 38,1% |
| Fruiting 85/95 | F-11+F-12 | 88,0 | 37,5 | **0** | 33,8 | 0,1% | 38,0% |
| Primordia 85/90 | asli | 86,0 | 51,2 | 2 | 6,5 | 13,2% | 67,9% |
| Primordia 85/90 | F-11+F-12 | 87,5 | 44,0 | 3 | 12,3 | 12,7% | 68,8% |
| Seeder 80/95 | asli | 85,0 | 8,5 | 30 | 8,0 | 0,0% | 37,2% |
| Seeder 80/95 | F-11+F-12 | 83,0 | 12,5 | 0 | 6,2 | 0,0% | 37,1% |

**Yang TIDAK terselesaikan (jujur).** Preset Primordia tetap RH<humMin ±13% waktu. Penyebab terukur bukan deadband: suhu rata-rata > tempMax (28°C) selama 15,6% waktu → fan pendingin ON 17,1% (Fruiting: 1,1%) → interlock fan→misting menahan pompa → RH turun (RH<humMin 12,7% vs 0,1%). Durasi ON minimum 20 s (`F12b`) dicoba dan **tidak membantu** (siklus 44,0 → 43,4; RH<humMin 12,7% → 12,7%), jadi ditolak. Ini keputusan desain (§8 #1 dan #5), bukan bug deadband.

**Sensitivitas terhadap asumsi [RUN]** (`--suite gain`, Fruiting, bulan 7, seed 7, 2 hari):

| Gain (asumsi 0,16) | Timeout % (asli → fix) | Siklus/hari (asli → fix) | Pompa mnt/hari (asli → fix) | RH<humMin (asli → fix) |
|---|---|---|---|---|
| 0,10 | 100 → 78 | 68,0 → 60,0 | 68,0 → 86,4 | 2,0% → 0,4% |
| 0,16 | 100 → 0 | 57,5 → 61,5 | 57,5 → 55,1 | 0,1% → 0,1% |
| 0,25 | 65 → 0 | 48,5 → 68,0 | 47,3 → 34,1 | 0,1% → 0,1% |
| 0,35 | 0 → 0 | 51,0 → 73,0 | 34,6 → 24,5 | 0,1% → 0,1% |

Angka "0% timeout" bergantung pada koefisien 0,16 yang belum pernah diukur. Kalibrasi (Lampiran A) sebelum dijadikan klaim di skripsi.

**Verifikasi.** `--suite misting`: timeout% Fruiting ≈ 0 dan RH<humMin ≤ 0,1%; Wokwi: log misting berhenti dengan "Target tercapai".

**Tulis di skripsi.** Metrik "% siklus berhenti karena target vs timeout"; parameter termodinamika sebagai asumsi beserta analisis sensitivitasnya.

### F-13 — Paritas cadence sim ↔ firmware · P2

**Masalah [CODE + RUN].** Komentar sim L1159 menyebut "setiap tick, seperti firmware", padahal firmware mengevaluasi kontrol tiap 5 s (`sensorInterval` L128) sedangkan sim tiap 1 s (L1160–1161). Jumlah siklus dan respons berbeda.

**Bukti [RUN]** (`--suite cadence`, setelah F-11+F-12): 61,5 siklus/hari (1 s) vs 54,5 (5 s); RH<humMin 0,1% vs 0,3%. Tanpa patch: 57,5 vs 55,0 siklus/hari.

**Perbaikan (sim).**
```python
# iot_simulator.py ±L1159–1161
CONTROL_INTERVAL_S = 5          # samakan dengan sensorInterval firmware (5000 ms)
...
if tick_count % CONTROL_INTERVAL_S == 0:
    control_misting(state)
    control_fan(state)
```
`simulate_tick` tetap dipanggil tiap 1 s. Sekalian koreksi komentarnya.

**Verifikasi.** `--suite cadence` (di harness `eval_every=5` mewakili perilaku baru).

### F-14 — Latensi PAUSE · P2 (baru)

**Masalah [CODE].** Perintah pause sampai ke ESP32 lewat polling `fetchThresholds()` tiap 30 s (`thresholdInterval`, L134) ditambah latensi HTTP (timeout hingga 10 s). PRD FR-4.6 dan README L40 mensyaratkan fan dan misting mati **seketika** saat mode panen. Praktisnya fan bisa berjalan ±30–40 s setelah pintu dibuka, persis kondisi *short-circuit* yang ingin dicegah.

**Perbaikan.**
1. Pisahkan polling perintah dari threshold. `GET /api/device/command` sudah ada, publik, dan ringan (hanya membaca cache; `routes/api.php:39`). Poll tiap 5–10 s; threshold tetap 30–60 s.
2. Ekstrak blok parsing PAUSE/AUTO (L842–857) menjadi `applyDeviceCommand(JsonObject cmdObj)`, dipanggil dari `fetchThresholds()` dan fungsi baru `fetchCommand()`:
   ```cpp
   const unsigned long commandInterval = 8000;     // global
   unsigned long lastCommandFetch = 0;
   // loop(), setelah blok C:
   if (wifiUp() && now - lastCommandFetch >= commandInterval) { lastCommandFetch = now; fetchCommand(); }
   ```
   `fetchCommand()`: GET `/device/command`, `StaticJsonDocument<256>`, ambil `doc["data"]` → `applyDeviceCommand(...)`, timeout HTTP 4 s. Beban ±10.800 request/hari; setelah F-04 tiap request = 1 query cache ke DB (kecil).
3. Opsi perangkat keras murah (hanya jika anggaran dan waktu memungkinkan): reed switch di pintu → GPIO → pause lokal instan, tanpa jaringan dan tanpa bergantung pada pekerja menekan tombol.

**Verifikasi.** Ukur waktu dari klik "Mulai Jeda Panen" sampai fan mati di Serial ≤ 10 s (catat 5 kali).

### F-15 — Minor logika · P3

- **(a) Validator RH.** `UpdateThresholdRequest.php:23` memakai `gte:humidity_min`, sehingga selisih 0 lolos (deadband nol). Tambahkan selisih minimal:
  ```php
  public function withValidator($validator): void
  {
      $validator->after(function ($v) {
          $d = $this->all();
          if (isset($d['humidity_min'], $d['humidity_max']) && ($d['humidity_max'] - $d['humidity_min']) < 4) {
              $v->errors()->add('humidity_max', 'Selisih RH minimal 4 poin agar histeresis bekerja.');
          }
      });
  }
  ```
- **(b) Timer malam tidak di-reset saat masuk malam** (`ino:597–598` hanya menginisialisasi jika 0). Pada sore berikutnya `lastNightPeriodicFanTime` masih bernilai dari semalam, sehingga flush 45 s langsung jalan jam 17:00. Reset saat transisi, taruh setelah `bool isNight = ...` di `controlFan`:
  ```cpp
  static bool wasNight = false;
  if (isNight && !wasNight) { lastNightPeriodicFanTime = now; lastNightPurgeFanTime = now; }
  wasNight = isNight;
  ```
- **(c) Pin strapping.** DHT-B di GPIO15 dan DHT-C di GPIO2 (`ino:64–65`) adalah strapping pin ESP32; pull-up modul DHT dapat mengganggu boot/flash di board fisik (Wokwi tidak menunjukkan). Pindahkan ke GPIO bebas (16/17/18/19/23/27) **jika belum dirakit**.
- **(d) Relay aktif-LOW** (`RELAY_ON = LOW`, L71): tulis `digitalWrite(pin, RELAY_OFF)` **sebelum** `pinMode(pin, OUTPUT)` agar tidak ada denyut LOW saat boot. Urutan saat ini (terverifikasi): `pinMode` di L222–224 baru disusul `digitalWrite(RELAY_OFF)` di L225–227, jadi ada celah sangat singkat di mana pin sudah OUTPUT tetapi masih LOW. Dampak praktis kecil; perbaikannya murah.

---

## 7. Fase 5 — Regresi dan bukti

### F-16 — Data simulator tercampur data ESP32 · P3

**Masalah [CODE].** Sim dan ESP32 memakai endpoint yang sama. `getLastHours()` merata-ratakan **semua** baris (`WHERE recorded_at >= ?`, L101/L114, tanpa filter `device_id`), jadi saat keduanya hidup grafik adalah rata-rata data nyata dan data simulasi. Workflow `iot-simulator.yml` (cron `17 * * * *` L8; `concurrency: cancel-in-progress: true` L16–18) membatalkan run lama tiap jam, sehingga state sim di-reset tiap jam dan grafik melompat.

**Perbaikan.**
1. Cara tercepat: nonaktifkan workflow begitu ESP32 fisik online (Actions → Disable workflow).
2. Atau: `DEVICE_ID=SIM-KUMBUNG-01` **dan** tambah filter `device_id` pada query (`getLastHours(int $hours = 24, ?string $deviceId = null)` → `AND device_id = ?` di raw SQL dan `where('device_id', ...)` di builder). **Mengganti `device_id` saja tidak memisahkan data** karena query tidak memfilternya.
3. Workflow: `cancel-in-progress: false` → run baru antre; restart sim hanya tiap ±5,8 jam (`timeout-minutes: 350`), bukan tiap jam.
4. Di Bab 4, beri label jelas: sumber data simulasi vs nyata.

### Checklist regresi

- [ ] `python sim_harness.py --sim iot_simulator.py --suite all > docs/evidence/after_sim.txt` dan bandingkan dengan `baseline_sim.txt`. Hasil yang diharapkan: lihat tabel F-10, F-11, F-12.
- [ ] `smoke_deploy.py` → `after_smoke.txt` (`PAUSE / PAUSE / AUTO / 429>0`).
- [ ] Matriks uji paritas di bawah: screenshot Serial Wokwi dan hasil sim.
- [ ] `php artisan test` hijau, plus tes baru: register admin-only (2), cache bukan array (1), validator log (1), validator RH (1). Chart pgsql: uji manual di Supabase.
- [ ] Tabel "temuan → commit → bukti" untuk lampiran skripsi.

### Matriks uji paritas (sim dan Wokwi)

| # | Skenario | Yang diharapkan | Uji di |
|---|---|---|---|
| 1 | Siang, tanpa fan, RH < humMin | Misting ON; RH ≥ stop → OFF "Target tercapai" | Sim, Wokwi |
| 2 | RH tidak naik | OFF di timeout (90 s setelah F-12), log "Safety timeout" | Sim, Wokwi |
| 3 | Malam: RH rata-rata 75% (Fruiting) | Misting tetap OFF | Sim, Wokwi |
| 3b | Malam: RH rata-rata 68% atau satu sensor <65% (Fruiting) | Misting ON (pengecualian darurat) | Sim, Wokwi |
| 4 | Fan ON → misting tidak mulai; misting baru OFF → fan ditahan 60 s | Interlock dan settling guard bekerja | Sim, Wokwi |
| 5 | Satu sensor > tempMax+2 (siang **dan** malam) | Override ON, misting dipotong; berhenti saat ≤ tempMax+1 **dan** rata-rata ≤ tempMax; tanpa chatter | Sim, Wokwi |
| 6 | Disparitas RH A–C > 12% | Homogenisasi 30 s; cooldown 15 menit | Sim, Wokwi |
| 7 | PAUSE → pompa dan fan OFF; timer habis atau RESUME → AUTO + instant-read; durasi 28801 s | Pause bekerja; durasi > 8 jam ditolak (422) | API, Wokwi |
| 8 | WiFi putus (`DEBUG_FORCE_OFFLINE 1`) | Sensor, kontrol, dan semua timeout tetap jalan; log antre lalu terkirim setelah WiFi kembali | Wokwi |
| 9 | Preset Inkubasi (65–75), RH rata-rata 70% | Tidak ada pulse Tier-2 | Sim, Wokwi |
| 10 | Waktu belum valid (belum NTP) | Peringatan sekali; tidak ada jeda 200 ms berulang | Wokwi |

---

## 8. Catatan desain terbuka (keputusan, bukan bug)

1. **Interlock fan→misting vs panas.** Fan pendingin/override menahan misting, sehingga RH turun saat panas. [RUN] skenario panas ekstrem: RH<humMin 34–36% waktu; preset Primordia: fan ON 17,1% → RH<humMin 12,7%. Opsi: (A) biarkan dan dokumentasikan; (B) jendela bergantian fan/misting (perlu kalibrasi); (C) biarkan misting berjalan saat override bila sensor tertinggi di bawah ambang yang lebih tinggi (evaporative cooling). Belum diuji.
2. **`humidity_max` bukan batas yang ditegakkan.** Nilainya hanya dipakai untuk menahan misting ("Safety Hold") dan menghitung stop. Satu-satunya aksi terhadap RH tinggi adalah purge malam di 96% yang tetap (`NIGHT_OVER_HUMIDITY_THRESHOLD`, sim L69). [RUN] RH > humMax: Fruiting ±38% waktu, Primordia ±68% (ambient sim 82–95%). Putuskan: apakah dehumidifikasi masuk cakupan, atau ubah makna "batas atas" di dokumen/UI.
3. **Plausibilitas dan debounce sensor.** Override dipicu oleh satu pembacaan satu sensor. Tambahkan pemeriksaan rentang fisik (suhu 0–60°C, RH 0–100%) dan syarat ≥2 pembacaan berturut-turut (±10 s) sebelum override. Tanpa ini, F-10(b) (tanpa cap) memperbesar dampak sensor macet-tinggi (fan terus jalan, misting tertahan).
4. **Pause tanpa pengawasan suhu.** Opsi auto-resume, taruh di `loop()` setelah fusion:
   ```cpp
   static uint8_t hotStrikes = 0;
   if (isPausedMode) {
     hotStrikes = (maxSensorTemp > tempMax + 4.0) ? hotStrikes + 1 : 0;
     if (hotStrikes >= 2) { hotStrikes = 0; endPauseMode("Suhu kritis saat jeda panen (auto-resume)"); }
   }
   ```
   Trade-off: fan menyala saat pintu terbuka. Jika tidak diambil, minimal catat log dan beri alert.
5. **Realisme preset Primordia.** `tempMax` 28°C vs iklim lokasi: di sim suhu rata-rata > 28°C selama 15,6% waktu. Cek suhu nyata lokasi sebelum mengunci preset (naikkan `tempMax`, perbaiki naungan/penempatan sensor, atau terima konsekuensi di #1).
6. **Semua sensor gagal.** Tentukan state aman. Saran minimal: pompa dan solenoid OFF, alarm LCD dan log. Kebijakan fan (mati / ventilasi periodik) adalah keputusan.

---

## 9. Ditunda (kesesuaian dokumen dan hal non-kontrol)

- **Temuan #5:** Blackbox/DS3231/LittleFS, BH1750, MQ-135/MH-Z19B di dokumen vs firmware; `co2_level` di-hardcode 480 (`ino:888`); RAB (SHT30/31 IP68, relay 4-ch) vs firmware (3× DHT22, 3 relay). Pilih sensor as-built. Catatan: SHT3x hanya punya 2 alamat I2C, jadi 3 zona butuh multiplexer atau turun ke 2 zona.
- **Audit #1** (single-zone vs status per-slot) dan **#2** (kapasitas 300 slot vs target produksi): tulis keputusan di PRD/Bab 3.
- **Audit #8** (overhead shared): `marginKontribusi()` membagi rata ke **semua** batch (`COUNT(*)`). Ini logika bisnis, bukan kontrol; kerjakan setelah Fase 4.
- README (kredensial `admin@kumbung.id` vs seeder `admin@smartshroom.test`), komentar `StoreSensorDataRequest` (rate limit per `device_id` padahal `throttle` per IP).
- Keamanan perangkat: device API key dan `setInsecure()`. Tulis sebagai keterbatasan; mitigasi sementara = rate limit (aktif setelah F-04).

---

## Lampiran A — Ukuran kumbung dan perhitungan

### A.1 Jawaban singkat

**Ya, perhitungan berubah bila ukuran kumbung berubah, tetapi hanya sebagian.** Yang tidak berubah: threshold biologis (suhu/RH per fase), struktur logika (histeresis, interlock, night lockout, pause, fusion), seluruh backend WMS/HPP (kecuali kapasitas slot). Yang berubah: semua konstanta waktu dan respons (laju naik RH saat misting, pertukaran udara fan, drift suhu/RH), sehingga durasi dan deadband perlu dihitung ulang.

**Simulator saat ini tidak memakai volume sama sekali.** `122.5 m³` hanya komentar (`iot_simulator.py:562`). Semua laju berupa angka per detik yang ditulis langsung. Mengganti ukuran kumbung tidak mengubah hasil sim kecuali koefisiennya diubah.

### A.2 Apa yang bergantung pada ukuran

| Komponen | Bergantung ukuran? | Skala | Catatan |
|---|---|---|---|
| Threshold biologis | Tidak | – | Kebutuhan jamur, bukan ruangan |
| Struktur logika (histeresis, interlock, pause, fusion) | Tidak | – | Bobot fusion 35/40/25 mengikuti **tinggi** sensor, bukan volume |
| Laju naik RH saat misting | Ya | ∝ ṁ_menguap / V | Nozzle sama di kumbung 2× lebih besar → siklus ±2× lebih lama |
| Timeout dan deadband misting | Ya (turunan) | ∝ V / ṁ_menguap | Turunkan dari tes step (A.5) |
| Pertukaran udara fan | Ya | 1 − e^(−Q·t/V) | Menentukan arti durasi fan 30/45/180 s |
| Drift suhu/RH ke ambient | Ya | ∝ luas selubung / V | Kumbung kecil lebih cepat naik/turun |
| Beban panas atap | Ya | ∝ luas lantai | Bukan volume |
| Stratifikasi dan posisi sensor | Ya | tinggi, panjang | Kumbung memanjang → gradien sepanjang ruang; 3 titik bisa tidak cukup |
| Kapasitas slot/baglog (grid 300) | Ya | luas lantai dan rak | Terkait target produksi |

### A.3 Rumus

- **Ventilasi (ruang well-mixed):** laju `k = Q / V` (1/s). Fraksi udara tergantikan dalam `t` detik: `1 − exp(−Q·t / V)`.
- **Humidifikasi:** massa uap untuk naik `ΔRH` poin: `Δm = ρ_sat(T) · (ΔRH/100) · V`. Waktu ≈ `Δm / ṁ_menguap` (batas bawah; tanpa rugi ke permukaan dan ventilasi).
- `ρ_sat` (g/m³): 22°C = 19,4; 25°C = 23,0; 28°C = 27,1; 30°C = 30,3; 32°C = 33,7 (Magnus + gas ideal).

### A.4 Yang tersirat dari koefisien sim (V = 122,5 m³, 28°C)

**Fan.** Sim memakai `0,04/s` (RH, `sim:576`) dan `0,08/s` (suhu, `sim:573`). Pada model well-mixed, `k = Q/V` sama untuk suhu dan RH, sehingga rasio 2:1 di sim sendiri adalah asumsi. Debit ekuivalennya:

| Koefisien | τ = 1/k | Q ekuivalen = k·V·3600 |
|---|---|---|
| RH 0,04/s | 25 s | ±17.600 m³/jam |
| Suhu 0,08/s | 12,5 s | ±35.300 m³/jam |

Kipas exhaust 10 inci (sesuai RAB kamu) umumnya di kisaran ratusan sampai ±1.000 m³/jam (cek datasheet dan kurva tekanan statik kipas yang dibeli). Jadi fan di sim kemungkinan **puluhan kali lebih efektif** daripada kipas nyata (model well-mixed juga optimistis untuk ruang dengan rak baglog). Dampaknya: sim membuat event pendinginan tampak selesai dalam detik, dan durasi fan 30/45/180 s tampak efektif.

Contoh dengan Q = 700 m³/jam (**angka contoh, bukan spesifikasi kipas kamu**):

| V | 30 s | 45 s | 180 s | k = Q/V (1/s) |
|---|---|---|---|---|
| 61,25 m³ (½×) | 9,1% | 13,3% | 43,5% | 0,0032 |
| 122,5 m³ | 4,7% | 6,9% | 24,9% | 0,0016 |
| 245 m³ (2×) | 2,4% | 3,5% | 13,3% | 0,0008 |

**Misting.** Sim: laju naik RH = `gain × evap_potential` dengan `gain = 0,16` (`sim:568`) dan `evap_potential = max(0,05; (98 − RH)/25)`. Air menguap yang tersirat:

| RH | Laju naik | Air menguap |
|---|---|---|
| 80% | 0,115 %RH/s | 3,83 g/s ≈ 230 g/menit |
| 85% | 0,083 %RH/s | 2,77 g/s ≈ 166 g/menit |
| 88% | 0,064 %RH/s | 2,13 g/s ≈ 128 g/menit |

Waktu untuk +5 poin RH dengan laju konstan 2,77 g/s (tanpa rugi, jadi batas bawah): V = 61,25 m³ → 30 s; 122,5 m³ → 60 s; 245 m³ → 120 s. Untuk 122,5 m³ butuh ±166 g air menguap per +5 poin. Ini menjelaskan mengapa timeout 60 s menjadi pengontrol (F-12). Sanity check dengan RAB kamu (10 nozzle 0,3 mm, pompa 130–160 PSI): estimasi orifice kasar (Cd 0,5–0,7; **belum diverifikasi**, dan tekanan kerja bisa turun saat 10 nozzle jalan bersamaan) memberi ±0,9–1,4 L/menit total. Air menguap tersirat di sim (0,13–0,23 L/menit) berarti ±9–26% dari semburan menguap efektif, sehingga **orde besarnya masuk akal** (berbeda dengan fan di atas). Pada RH tinggi fraksi yang menguap memang kecil dan bervariasi, jadi rentang ketidakpastiannya besar. Itu sebabnya perlu diukur (A.5).

### A.5 Prosedur kalibrasi (±1–2 jam, tanpa hardware tambahan)

Pakai 3 DHT22 yang sudah ada; log ke Serial tiap 5 s.

1. **Tes fan.** Pintu tutup, misting OFF. Log 1 menit sebelum, fan ON 3–5 menit. Fit `ln((RH − RH_luar)/(RH₀ − RH_luar)) = −k·t` → `k`; `Q = k·V`. Masukkan ke sim: ganti `0.04` (L576) dan `0.08` (L573) dengan nilai terukur (per parameter).
2. **Tes misting.** Mulai saat RH 80–85%, fan OFF, pintu tutup; pompa ON 60–90 s. Ambil laju awal `r` (%RH/s) dari 15–20 detik pertama. `gain = r / evap_potential(RH₀)`; ganti `0.16` (L568). Ulangi di 2–3 kondisi RH.
3. **Tes drift.** Semua aktuator OFF 30–60 menit. Fit laju kembali ke ambient → `TEMP_RECOVERY_RATE` (L101) dan `HUM_RECOVERY_RATE` (L102).
4. Jalankan ulang `python sim_harness.py --suite gain` dengan gain terukur, lalu simpan sebagai bukti kalibrasi.

### A.6 Jika ukuran kumbung berubah

1. Hitung ulang `V = P × L × T efektif` dan ubah komentar/konstanta.
2. Cek ulang debit kipas (pada tekanan statik) dan jumlah/debit nozzle; **turunkan** durasi fan dan misting dari rumus A.3, jangan disalin dari kumbung lama.
3. Tinjau ulang penempatan dan bobot sensor untuk tinggi/panjang baru.
4. Bila ingin simulator mengikuti ukuran, parameterkan (contoh; nilai `MIST_EVAP_G_S` dan `FAN_FLOW_M3H` harus dari tes/datasheet):
   ```python
   VOLUME_M3     = 5.0 * 7.0 * 3.5          # 122.5 — ubah di sini saja
   FAN_FLOW_M3H  = 700.0                    # CONTOH; isi dari datasheet kipas
   MIST_EVAP_G_S = 2.8                      # hasil tes misting (g/s menguap efektif)
   RHO_SAT_G_M3  = 27.1                     # @28 °C
   FAN_K     = (FAN_FLOW_M3H / 3600.0) / VOLUME_M3                              # 1/s (suhu dan RH)
   MIST_GAIN = (MIST_EVAP_G_S / (RHO_SAT_G_M3 * VOLUME_M3)) * 100.0 / 0.52      # %RH/s per evap_potential (0.52 = pada RH 85%)
   ```
   Cek: dengan `MIST_EVAP_G_S = 2.77` dan V = 122,5 → `MIST_GAIN ≈ 0,160` (sama dengan nilai sim sekarang).

---

## Lampiran B — Hasil eksperimen lengkap

Semua dijalankan dengan `sim_harness.py` pada `iot_simulator.py` commit `8187915`. Tiap run = 2 hari simulasi, evaluasi kontrol tiap 1 s (kecuali suite cadence).

### B.1 Misting dan deadband (rata-rata 4 run: bulan 1 dan 7 × seed 1 dan 2)
Lihat tabel di F-12.

### B.2 Inkubasi, ambang hard-coded
Lihat tabel di F-11.

### B.3 Panas ekstrem (Fruiting 24–32°C / 85–95%, cuaca cerah dipaksa, bulan 7, seed 11)

| Ambient | Patch | Override start | Toggle fan/hari | Misting dipotong | Fan ON % | Sensor>34°C % | RH<humMin % | Log>600 s |
|---|---|---|---|---|---|---|---|---|
| 27–36°C | asli | 603 | 649 | 6 | 35,7 | 33,8 | 33,7 | 2 |
| 27–36°C | F-10a | 2 | 49 | 2 | 38,5 | 33,8 | 33,7 | 2 |
| 27–36°C | F-10a+F-10b | 2 | 49 | 1 | 38,5 | 33,8 | 33,7 | 2 |
| 28–39°C | asli | 623 | 661 | 8 | 49,1 | 47,3 | 35,6 | 2 |
| 28–39°C | F-10a | 2 | 41 | 2 | 51,6 | 47,4 | 35,6 | 2 |
| 28–39°C | F-10a+F-10b | 2 | 41 | 2 | 51,6 | 47,4 | 35,6 | 2 |

Catatan: "misting dipotong" yang tersisa adalah kasus sah (misting sudah berjalan saat suhu melewati ambang). Fan ON% sedikit naik karena override kini berjalan sampai pulih. Suhu tertinggi dan waktu >34°C tidak berubah: patch menghilangkan chatter, bukan menurunkan suhu.

### B.4 Sensitivitas gain dan B.5 cadence
Lihat tabel gain di F-12. Cadence (Fruiting, bulan 7, seed 7):

| Evaluasi tiap | Patch | Siklus/hari | Timeout % | Pompa mnt/hari | RH<humMin |
|---|---|---|---|---|---|
| 1 s | asli | 57,5 | 100 | 57,5 | 0,1% |
| 1 s | F-11+F-12 | 61,5 | 0 | 55,1 | 0,1% |
| 5 s | asli | 55,0 | 100 | 55,0 | 0,3% |
| 5 s | F-11+F-12 | 54,5 | 0 | 55,6 | 0,3% |

### B.6 Diagnosis Primordia (F-11+F-12, rata-rata 4 run)

| Preset | T rata-rata > tempMax | Fan ON | RH<humMin | Toggle fan/hari |
|---|---|---|---|---|
| Fruiting | 0,0% | 1,1% | 0,1% | 42 |
| Primordia | 15,6% | 17,1% | 12,7% | 121 |

### B.7 Dicoba dan ditolak
Durasi ON misting minimum 20 s (`F12b`), di atas F-11+F-12: Fruiting 37,5 → 37,5 siklus/hari; Primordia 44,0 → 43,4 siklus/hari dan RH<humMin 12,7% → 12,7%; Seeder tidak berubah. Tidak membantu.

---

## Lampiran C — Reproduksi

```bash
# dari root repo (sim_harness.py di root)
python sim_harness.py --sim iot_simulator.py --suite all          # ±5 menit
python sim_harness.py --sim iot_simulator.py --suite heat         # F-10
python sim_harness.py --sim iot_simulator.py --suite incubation   # F-11
python sim_harness.py --sim iot_simulator.py --suite misting      # F-11/F-12
python sim_harness.py --sim iot_simulator.py --suite gain         # sensitivitas
python sim_harness.py --sim iot_simulator.py --suite cadence      # F-13
python sim_harness.py --sim iot_simulator.py --suite misting --fast   # cek cepat
```

- Harness memuat `iot_simulator.py` ke salinan sementara dan menerapkan patch lewat string-replace; **file asli tidak diubah**. Jika kode simulator berubah sehingga anchor tidak cocok, harness berhenti dengan pesan yang jelas (assert).
- `PATCHES` di dalam `sim_harness.py` = spesifikasi perubahan sisi simulator untuk F-10a, F-10b, F-11, F-12 (dan `F12b` yang ditolak).
- Hasil deterministik per seed. Variasi antar seed dan bulan sudah dirata-ratakan di tabel (4 run), kecuali tabel gain/cadence/heat yang memakai 1 seed (kecil, indikatif).
- Model termal/kelembapan di sim adalah model *lumped* dengan koefisien asumsi. Kesimpulan di dokumen ini adalah tentang **logika kontrol**; klaim kuantitatif fisik membutuhkan kalibrasi (A.5).
