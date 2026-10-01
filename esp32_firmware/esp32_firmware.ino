/**
 * ============================================================
 * Smart Shroom Controller (SSC) — ULTIMATE VERSION v3.5
 * ============================================================
 * 
 * Firmware ESP32 untuk monitoring & kontrol otomatis 
 * mikroklimat kumbung budidaya JAMUR KUPING (Auricularia auricula-judae).
 * Kumbung: 5m x 7m x 3.5m (Volume: 122.5 m³)
 * 
 * FITUR UTAMA:
 * [IoT]       WiFi + HTTP POST data sensor ke Laravel API
 * [IoT]       Fetch threshold dinamis dari Web Dashboard
 * [Hardware]  3x DHT22 (Segitiga Diagonal), LCD I2C 16x2, 3x Relay Module
 * [Fusion]    Weighted Sensor Fusion (35% Atas, 40% Tengah, 25% Bawah)
 * [Control]   Dual Cooldown Guard (Misting 150s & Fan Homogenisasi 900s)
 * [Safety]    Pulse Misting (30s) untuk Rak Atas kering kritis
 * [Safety]    Safety Override: Suhu Kritis (>34°C) paksa Fan ON (Bypass Cooldown)
 * [Safety]    Safety Hold: Tahan misting jika RH >= 95% cegah jamur busuk
 * [Safety]    Timeout darurat misting maks 60 detik per siklus (cegah baglog menggenang)
 * [Design]    Non-blocking millis() — ESP32 stabil 24/7 tanpa freeze
 * 
 * PIN ASSIGNMENT (3 Sensor DHT22 — Segitiga Diagonal):
 *   GPIO 4   → DHT22-A (Zona Atas, dekat pintu, 2.5m)
 *   GPIO 15  → DHT22-B (Zona Tengah, pusat kumbung, 1.5m)
 *   GPIO 2   → DHT22-C (Zona Bawah, pojok belakang, 0.5m)
 *   GPIO 26  → Relay Pompa Misting (12V)
 *   GPIO 25  → Relay Solenoid Valve (12V)
 *   GPIO 33  → Relay Exhaust Fan (220V)
 *   GPIO 21  → SDA (LCD I2C 16x2)
 *   GPIO 22  → SCL (LCD I2C 16x2)
 * 
 * API CONTRACT (Laravel Backend):
 *   POST /api/sensor-data      → { device_id, temperature, humidity, co2_level }
 *   POST /api/sprinkler-logs   → { device_id, actuator, duration_seconds, trigger_reason, stop_reason }
 *   GET  /api/thresholds/active → response.data.{ temp_max, temp_min, humidity_min, humidity_max }
 * 
 * @see docs/penempatan_sensor.md untuk detail strategi penempatan
 * @see iot_simulator.py untuk verifikasi model termodinamika
 * @version 3.5.0 (Weighted Fusion + Dual Cooldown + Homogenisasi)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHT.h"
#include <ArduinoJson.h>

// ============================================================
// KONFIGURASI JARINGAN & BACKEND
// ============================================================
const char* ssid     = "Wokwi-GUEST";   // Ganti sesuai SSID WiFi kumbung
const char* password = "";              // Ganti sesuai password WiFi

// API Base URL (Gunakan link cloud Vercel / Ngrok lokal saat testing Wokwi)
String apiBaseUrl = "https://tugasakhir-lime.vercel.app/api";
String deviceId   = "ESP32-KUMBUNG-01";

#define DEBUG_FORCE_OFFLINE 0            // 1 = simulasi WiFi mati (untuk testing offline Wokwi)
unsigned long lastWifiRetry = 0;
bool ntpStarted = false;
inline bool wifiUp() { return !DEBUG_FORCE_OFFLINE && WiFi.status() == WL_CONNECTED; }

// ============================================================
// PIN ASSIGNMENT
// ============================================================
const int PIN_DHT_A          = 4;   // GPIO 4  → DHT22-A (Zona Atas, 2.5m)
const int PIN_DHT_B          = 15;  // GPIO 15 → DHT22-B (Zona Tengah, 1.5m)
const int PIN_DHT_C          = 2;   // GPIO 2  → DHT22-C (Zona Bawah, 0.5m)
const int PIN_RELAY_PUMP     = 26;  // GPIO 26 → Pompa Misting (12V)
const int PIN_RELAY_SOLENOID = 25;  // GPIO 25 → Solenoid Valve (12V)
const int PIN_RELAY_FAN      = 33;  // GPIO 33 → Exhaust Fan (220V)

// Relay Active LOW (umum untuk modul relay optocoupler ESP32)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

const int NUM_SENSORS = 3;

// ============================================================
// BOBOT SENSOR FUSION (Opsi 3: Stratifikasi Vertikal)
// ============================================================
const float WEIGHT_SENSOR_A = 0.35;  // Zona Atas (paling panas & kering)
const float WEIGHT_SENSOR_B = 0.40;  // Zona Tengah (referensi inti kumbung)
const float WEIGHT_SENSOR_C = 0.25;  // Zona Bawah (paling dingin & lembab)

// ============================================================
// KONSTANTA JEDA & SAFETY TIMEOUT (Anti Short-Cycling & Night Mode)
// ============================================================
const unsigned long MAX_MISTING_DURATION_MS     = 60000;   // 60 detik timeout darurat misting (cegah baglog menggenang/becek)
const unsigned long PULSE_MISTING_DURATION_MS   = 30000;   // 30 detik pulse misting sensor kering
const unsigned long MISTING_COOLDOWN_MS         = 150000;  // 150 detik (2.5 menit) jeda evaporasi kabut
const unsigned long POST_MISTING_FAN_DELAY_MS   = 60000;   // 60 detik jeda kabut mengendap sebelum fan boleh ON
const unsigned long FAN_HOMOGENIZE_DURATION_MS  = 30000;   // 30 detik durasi fan homogenisasi siang
const unsigned long FAN_HOMOGENIZE_COOLDOWN_MS  = 900000;  // 15 menit (900 detik) jeda relaksasi sirkulasi siang
const unsigned long NIGHT_FAN_DURATION_MS       = 45000;   // 45 detik durasi pasti fan malam
const unsigned long NIGHT_FAN_PERIODIC_MS       = 3600000; // 60 menit (1 jam) siklus berkala flush CO2 malam
const unsigned long NIGHT_FAN_COOLDOWN_MS       = 1800000; // 30 menit cooldown over-humidity purge malam
const float NIGHT_OVER_HUMIDITY_THRESHOLD       = 96.0;    // Batas RH malam pemicu purge (96.0%)
const float HUM_DISPARITY_THRESHOLD             = 12.0;    // Disparitas RH > 12.0% pemicu homogenisasi (baseline alami ~9%)
const float CRITICAL_TEMP_OFFSET                = 2.0;     // Offset suhu kritis: tempMax + 2.0°C
const unsigned long MAX_FAN_COOLING_DURATION_MS = 180000;  // 180 detik (3 menit) timeout maksimal fan pendinginan siang (cegah dehidrasi)
const unsigned long FAN_COOLING_COOLDOWN_MS     = 60000;   // 60 detik (1 menit) cooldown anti-chattering fan pendinginan siang
const float TEMP_HYSTERESIS                     = 1.5;     // Histeresis stop fan pendinginan (tempMax - 1.5°C)
const int NIGHT_START_HOUR                      = 17;      // 17:00 WIB
const int NIGHT_END_HOUR                        = 6;       // 06:00 WIB

// ============================================================
// INISIALISASI SENSOR & LCD
// ============================================================
DHT dhtA(PIN_DHT_A, DHT22);
DHT dhtB(PIN_DHT_B, DHT22);
DHT dhtC(PIN_DHT_C, DHT22);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============================================================
// THRESHOLD DEFAULT — JAMUR KUPING (Di-overwrite via API)
// ============================================================
float tempMax  = 32.0;   // Batas atas suhu (°C)
float tempMin  = 24.0;   // Batas bawah suhu (°C)
float humMin   = 80.0;   // Batas bawah RH (%)
float humMax   = 95.0;   // Batas atas RH (%)

// Histeresis lokal
float rhTriggerLow  = 80.0;  // = humMin
float rhTriggerHigh = 90.0;  // Histeresis stop realistis (misal 85 + 5 = 90.0%, deadband 5% kurva landai)

// ============================================================
// TIMER NON-BLOCKING (millis)
// ============================================================
unsigned long lastSensorReadTime     = 0;
const unsigned long sensorInterval   = 5000;   // Baca sensor tiap 5 detik

unsigned long lastApiSendTime        = 0;
const unsigned long apiSendInterval  = 60000;  // Kirim data ke API tiap 60 detik (1 menit)

unsigned long lastThresholdFetch     = 0;
const unsigned long thresholdInterval = 30000; // Fetch threshold tiap 30 detik

// ============================================================
// STATE AKTUATOR & COOLDOWN TRACKING
// ============================================================
bool isMistingActive = false;
bool isPulseMisting  = false;
bool isFanActive     = false;
bool isHomogenizing  = false;
bool isNightFan      = false;
bool isCriticalOverride = false; // Flag apakah fan sedang running mode Safety Override suhu kritis

// MODE PANEN / JEDA KONTROL (PAUSE & RESUME) — PRD SECTION 3
bool isPausedMode               = false;   // Mode jeda manual (Panen / pintu terbuka)
unsigned long pauseStartTime    = 0;
unsigned long pauseDurationMs   = 0;       // Durasi jeda dalam milidetik (non-blocking millis)
String pauseReason              = "Mode Panen";

unsigned long mistingStartTime           = 0;
unsigned long mistingLastStopTime        = 0;
unsigned long fanStartTime               = 0;
unsigned long fanLastStopTime            = 0;
unsigned long fanCoolingLastStopTime     = 0;  // Tracking cooldown anti-chattering fan pendinginan siang (60s)
unsigned long lastNightPeriodicFanTime   = 0;
unsigned long lastNightPurgeFanTime      = 0;
unsigned long lastNightFanStopTime       = 0;  // Timestamp terakhir night fan berhenti (independen dari cooldown homogenisasi)

String mistingTriggerReason = "";
String fanTriggerReason     = "";

// Cache pembacaan sensor terakhir
float lastTemp       = 27.5;
float lastHum        = 85.0;
float maxSensorTemp  = 27.5;
float minSensorHum   = 85.0;
float humDisparity   = 0.0;
unsigned long lastValidReadMs = 0; // Timestamp pembacaan sensor valid terakhir

// ============================================================
// STRUKTUR ANTRIAN LOG AKTUATOR (RAM RING BUFFER TAHAN OFFLINE)
// ============================================================
struct PendingLog {
  uint32_t dur;
  time_t startEpoch;
  char act[16];
  char trig[96];
  char stop[96];
};
const uint8_t LOGQ_N = 10;
PendingLog logQ[LOGQ_N];
uint8_t qHead  = 0;
uint8_t qCount = 0;

void enqueueLog(unsigned long dur, const String& trig, const String& stop, const char* act) {
  if (qCount == LOGQ_N) {
    qHead = (qHead + 1) % LOGQ_N; // Jika antrian penuh, geser head & buang yang tertua
    qCount--;
  }
  PendingLog& e = logQ[(qHead + qCount) % LOGQ_N];
  time_t nowT = time(nullptr);
  e.dur = dur;
  e.startEpoch = (nowT > 1600000000) ? (nowT - dur) : 0; // 0 jika jam belum tersinkronisasi NTP
  strlcpy(e.act, act, sizeof(e.act));
  strlcpy(e.trig, trig.c_str(), sizeof(e.trig));
  strlcpy(e.stop, stop.c_str(), sizeof(e.stop));
  qCount++;
}

// ============================================================
// FORWARD DECLARATIONS & TIME HELPER
// ============================================================
void startMisting(String reason, bool isPulse);
void stopMisting(String stopReason);
void startFan(String reason, bool homogenize, bool nightMode, bool criticalOverride = false);
void stopFan(String stopReason);
void startPauseMode(unsigned long durationSec, String reason = "Mode Panen");
void endPauseMode(String reason);
void controlMisting(float temp, float hum, float minHum);
void controlFan(float avgTemp, float maxTemp, float disparity, float currentHum);
void updateLCD(float temp, float hum, bool misting, bool fan);
void fetchThresholds();
void sendSensorData(float temp, float hum);
int postSprinklerLog(const PendingLog& e);

bool timeWarned = false;

int getCurrentHourWIB() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 0)) {
    return timeinfo.tm_hour;
  }
  if (!timeWarned) {
    Serial.println("[TIME] ⚠️ Jam NTP belum sinkron! Fallback: aturan malam dinonaktifkan sementara.");
    timeWarned = true;
  }
  return -1; // -1 = waktu belum valid (NTP belum sinkron)
}

inline bool isNightHour(int h) {
  return (h >= 0) && (h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR);
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n============================================================");
  Serial.println("  🍄 Smart Shroom Controller (SSC) v3.5");
  Serial.println("  Hardware: ESP32 + 3x DHT22 + LCD 16x2 + 3x Relay");
  Serial.println("  Logika: Weighted Fusion + Dual Cooldown Guard");
  Serial.println("============================================================\n");

  // Inisialisasi LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Shroom SCM");
  lcd.setCursor(0, 1);
  lcd.print("ESP32 v3.5 Ready");
  delay(2000);
  lcd.clear();

  // Inisialisasi Sensor DHT22
  dhtA.begin();
  dhtB.begin();
  dhtC.begin();

  // Inisialisasi Relay (Semua OFF saat cold start)
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_SOLENOID, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_OFF);
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);

  // Koneksi WiFi (Non-blocking timeout 15 detik)
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi.");
  Serial.print("[WIFI] Menghubungkan ke ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  unsigned long t0 = millis();
  while (!wifiUp() && millis() - t0 < 15000) {
    delay(500);
    Serial.print(".");
    lcd.print(".");
  }

  if (wifiUp()) {
    Serial.println("\n[WIFI] Terhubung! IP: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected! ");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1000);
    lcd.clear();

    // Sinkronisasi Waktu NTP (WIB = UTC+7)
    configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    ntpStarted = true;
    Serial.println("[NTP] Menyelaraskan jam operasional WIB...");

    // Fetch threshold pertama kali saat boot
    fetchThresholds();
  } else {
    Serial.println("\n[WIFI] ⚠️ Gagal konek 15 dtk -> lanjut OFFLINE dengan threshold default");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Offline!   ");
    lcd.setCursor(0, 1);
    lcd.print("Default Thresh  ");
    delay(1500);
    lcd.clear();
  }
}

// ============================================================
// LOOP UTAMA (NON-BLOCKING)
// ============================================================
void loop() {
  // Guard non-blocking: coba rekoneksi WiFi berkala tiap 15 detik tanpa menghentikan kontrol
  if (!wifiUp() && millis() - lastWifiRetry >= 15000) {
    lastWifiRetry = millis();
    Serial.println("[WARN] WiFi terputus! Mencoba rekoneksi di background...");
    WiFi.reconnect();
  }

  if (wifiUp() && !ntpStarted) {
    configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    ntpStarted = true;
    Serial.println("[NTP] WiFi tersambung kembali, sinkronisasi NTP...");
  }

  unsigned long now = millis();

  // ── A. BACA 3 SENSOR & WEIGHTED SENSOR FUSION (Tiap 5 Detik) ──
  if (now - lastSensorReadTime >= sensorInterval) {
    lastSensorReadTime = now;

    float tA = dhtA.readTemperature();
    float hA = dhtA.readHumidity();
    float tB = dhtB.readTemperature();
    float hB = dhtB.readHumidity();
    float tC = dhtC.readTemperature();
    float hC = dhtC.readHumidity();

    // Validasi pembacaan sensor
    bool validA = !isnan(tA) && !isnan(hA);
    bool validB = !isnan(tB) && !isnan(hB);
    bool validC = !isnan(tC) && !isnan(hC);

    if (validA) Serial.printf("   [A] Atas (Pintu):   T=%.1f°C | RH=%.1f%%\n", tA, hA);
    else Serial.println("   [A] Atas (Pintu):   ⚠️ ERROR (NaN)!");

    if (validB) Serial.printf("   [B] Tengah (Pusat): T=%.1f°C | RH=%.1f%%\n", tB, hB);
    else Serial.println("   [B] Tengah (Pusat): ⚠️ ERROR (NaN)!");

    if (validC) Serial.printf("   [C] Bawah (Pojok):  T=%.1f°C | RH=%.1f%%\n", tC, hC);
    else Serial.println("   [C] Bawah (Pojok):  ⚠️ ERROR (NaN)!");

    // Hitung Weighted Fusion dinamis (normalisasi jika ada sensor rusak)
    float totalWeight = 0.0;
    float weightedT   = 0.0;
    float weightedH   = 0.0;

    maxSensorTemp = -999.0;
    minSensorHum  = 999.0;

    if (validA) {
      totalWeight += WEIGHT_SENSOR_A;
      weightedT   += tA * WEIGHT_SENSOR_A;
      weightedH   += hA * WEIGHT_SENSOR_A;
      if (tA > maxSensorTemp) maxSensorTemp = tA;
      if (hA < minSensorHum)  minSensorHum  = hA;
    }
    if (validB) {
      totalWeight += WEIGHT_SENSOR_B;
      weightedT   += tB * WEIGHT_SENSOR_B;
      weightedH   += hB * WEIGHT_SENSOR_B;
      if (tB > maxSensorTemp) maxSensorTemp = tB;
      if (hB < minSensorHum)  minSensorHum  = hB;
    }
    if (validC) {
      totalWeight += WEIGHT_SENSOR_C;
      weightedT   += tC * WEIGHT_SENSOR_C;
      weightedH   += hC * WEIGHT_SENSOR_C;
      if (tC > maxSensorTemp) maxSensorTemp = tC;
      if (hC < minSensorHum)  minSensorHum  = hC;
    }

    if (totalWeight > 0.0) {
      lastTemp = weightedT / totalWeight;
      lastHum  = weightedH / totalWeight;
      lastValidReadMs = now; // Catat waktu pembacaan valid terbaru

      // Disparitas kelembaban vertikal (|A - C|)
      if (validA && validC) {
        humDisparity = abs(hA - hC);
      } else {
        humDisparity = (maxSensorTemp > -900.0 && minSensorHum < 900.0) ? (lastHum - minSensorHum) : 0.0;
      }

      Serial.printf("[FUSION] Rata-rata Tertimbang: T=%.1f°C | RH=%.1f%% | Disparitas RH=%.1f%%\n", 
                    lastTemp, lastHum, humDisparity);

      // ── EVALUASI KONTROL MISTING & FAN ────────────────────────
      controlMisting(lastTemp, lastHum, minSensorHum);
      controlFan(lastTemp, maxSensorTemp, humDisparity, lastHum);
      updateLCD(lastTemp, lastHum, isMistingActive, isFanActive);
    } else {
      Serial.println("[FATAL] SEMUA sensor DHT22 gagal membaca! Matikan misting cegah kebanjiran.");
      if (isMistingActive) {
        stopMisting("Safety: Semua sensor DHT22 gagal membaca");
      }
      lcd.setCursor(0, 0);
      lcd.print("ALL SENSOR ERR! ");
      lcd.setCursor(0, 1);
      lcd.print("Check Wiring    ");
    }
  }

  // ── B. KIRIM DATA KE LARAVEL API (Tiap 60 Detik, Cegah Data Basi) ────────────
  if (wifiUp() && (now - lastApiSendTime >= apiSendInterval)) {
    lastApiSendTime = now;
    if (lastValidReadMs > 0 && (now - lastValidReadMs < 15000)) {
      sendSensorData(lastTemp, lastHum);
    } else {
      Serial.println("[WARN] Data sensor basi (>15s tidak terbaca). Pengiriman API ditahan.");
    }
  }

  // ── C. FETCH THRESHOLD DARI WEB (Tiap 30 Detik) ────────────
  if (wifiUp() && (now - lastThresholdFetch >= thresholdInterval)) {
    lastThresholdFetch = now;
    fetchThresholds();
  }

  // ── KONSUMEN ANTRIAN LOG AKTUATOR (Kirim 1 log tiap 3 detik saat online) ──
  static unsigned long lastLogTry = 0;
  if (wifiUp() && qCount > 0 && (now - lastLogTry >= 3000)) {
    lastLogTry = now;
    PendingLog& e = logQ[qHead];
    int code = postSprinklerLog(e);
    bool permanentReject = (code >= 400 && code < 500 && code != 429);
    if (code == 201 || permanentReject) {
      qHead = (qHead + 1) % LOGQ_N;
      qCount--;
    }
  }

  // ── D. SAFETY WATCHDOG: MISTING TIMEOUT (60s / 30s) ────────
  if (isMistingActive) {
    unsigned long elapsed = now - mistingStartTime;
    if (isPulseMisting && elapsed >= PULSE_MISTING_DURATION_MS) {
      Serial.println("[SAFETY] 🛑 Pulse Misting selesai (30s). Mematikan pompa...");
      stopMisting("Pulse misting selesai (30s)");
    } else if (!isPulseMisting && elapsed >= MAX_MISTING_DURATION_MS) {
      Serial.println("[SAFETY] 🛑 Misting TIMEOUT (60s)! Mematikan pompa secara paksa.");
      stopMisting("Safety timeout (60 detik)");
    }
  }

  // ── E. WATCHDOG: FAN HOMOGENISASI (30s) ────────────────────
  if (isFanActive && isHomogenizing) {
    unsigned long elapsed = now - fanStartTime;
    if (elapsed >= FAN_HOMOGENIZE_DURATION_MS) {
      Serial.println("[HOMO] 🌀 Siklus sirkulasi homogenisasi (30s) selesai.");
      stopFan("Homogenisasi selesai 30s (Disparitas: " + String(humDisparity, 1) + "%)");
    }
  }

  // ── F. WATCHDOG: NIGHT FAN & MORNING TRANSITION (45s / 06:00 WIB) ──
  // Timer night fan independen + failsafe transisi pagi agar flag isNightFan tidak nyangkut.
  if (isFanActive && isNightFan && !isHomogenizing) {
    unsigned long elapsed = now - fanStartTime;
    bool isStillNight = isNightHour(getCurrentHourWIB());
    if (elapsed >= NIGHT_FAN_DURATION_MS || !isStillNight) {
      String reason = (!isStillNight && elapsed < NIGHT_FAN_DURATION_MS)
        ? "Transisi ke Pagi Hari (06:00 WIB)"
        : "Night ventilation selesai 45s (RH: " + String(lastHum, 1) + "%)";
      Serial.println("[NIGHT] 🌙 " + reason);
      stopFan(reason);
    }
  }

  // ── G. WATCHDOG: FAN PENDINGINAN SIANG / BIASA (180s) ────
  // Cegah exhaust fan running tanpa henti jika suhu luar ruangan panas.
  // Safety override suhu kritis TIDAK dipotong 180s (berjalan sampai suhu pulih).
  if (isFanActive && !isHomogenizing && !isNightFan && !isCriticalOverride) {
    unsigned long elapsed = now - fanStartTime;
    if (elapsed >= MAX_FAN_COOLING_DURATION_MS) {
      Serial.println("[SAFETY] 🛑 Fan pendinginan siang TIMEOUT (180s)! Mematikan fan cegah dehidrasi.");
      stopFan("Safety timeout fan pendinginan (180s, cegah dehidrasi baglog)");
    }
  }

  // ── H. WATCHDOG: MODE PANEN JEDA TIMEOUT (NON-BLOCKING millis) ────
  // Failsafe otomatis: jika waktu habis, kembali ke AUTO & instant-read sensor.
  if (isPausedMode) {
    unsigned long elapsed = now - pauseStartTime;
    if (elapsed >= pauseDurationMs) {
      endPauseMode("Timer Failsafe Selesai (Otomatis Kembali ke AUTO)");
    }
  }
}

// ============================================================
// LOGIKA KONTROL MISTING (DENGAN COOLDOWN GUARD 150s)
// ============================================================

void controlMisting(float temp, float hum, float minHum) {
  // GUARD MODE PANEN / JEDA MANUAL (PRD Section 3)
  if (isPausedMode) {
    if (isMistingActive) stopMisting("Mode Panen Aktif (Jeda Manual)");
    return;
  }

  unsigned long now = millis();
  float criticalLowRh = humMin - 10.0f; // Batas darurat dehidrasi rak tunggal proporsional terhadap humMin (F-11)
  bool isNight = isNightHour(getCurrentHourWIB());

  if (!isMistingActive) {
    // MUTUAL EXCLUSION (INTERLOCK):
    // Jika Exhaust Fan sedang aktif, Misting DILARANG nyala!
    // Mencegah kabut mikro disedot langsung keluar dan terbuang sia-sia.
    if (isFanActive) {
      return;
    }

    // [F-10b] Jangan mulai misting saat kondisi kritis (override fan akan langsung memotongnya)
    if (maxSensorTemp > tempMax + CRITICAL_TEMP_OFFSET) {
      return;
    }

    // 0. NIGHT LOCKOUT (17:00 - 06:00 WIB): Misting DILARANG nyala agar jamur tidak tidur basah kuyup
    if (isNight) {
      // Pengecualian darurat ekstrem: hanya boleh nyala jika terjadi dehidrasi parah (relatif terhadap humMin)
      if (hum >= (humMin - 15.0f) && minHum >= (humMin - 20.0f)) {
        return;
      }
    }

    // 1. COOLDOWN GUARD: Cegah short-cycling sebelum kabut selesai evaporasi (150 detik)
    if (mistingLastStopTime > 0 && (now - mistingLastStopTime < MISTING_COOLDOWN_MS)) {
      unsigned long remainingSec = (MISTING_COOLDOWN_MS - (now - mistingLastStopTime)) / 1000;
      if (remainingSec % 30 == 0) {
        Serial.printf("   ⏳ [COOLDOWN MISTING] Pompa istirahat... %lu detik tersisa (evaporasi kabut)\n", remainingSec);
      }
      return;
    }

    // 2. TIER 2: Safety Override (Sensor Terkering / Rak Atas Kritis)
    if (minHum < criticalLowRh) {
      if (hum >= humMax) {
        Serial.printf("   ⚠️  [HOLD] Sensor kritis (%.1f%%) TAPI rata-rata kumbung basah (%.1f%%). Pompa DITAHAN!\n", minHum, hum);
        return;
      }
      String reason = "Safety Override: Sensor Terkering (" + String(minHum, 1) + "% < " + String(criticalLowRh, 1) + "%)";
      startMisting(reason, true);  // Pulse misting 30 detik
      return;
    }

    // 3. TIER 1: Kondisi Normal (Rata-rata tertimbang di bawah batas)
    if (hum < rhTriggerLow || temp > tempMax) {
      if (temp > tempMax && hum >= humMax) {
        Serial.printf("   ⚠️  [HOLD] Suhu panas (%.1f°C) TAPI RH tinggi (%.1f%%). Pompa DITAHAN!\n", temp, hum);
        return;
      }

      String reason = "";
      if (hum < rhTriggerLow && temp > tempMax) {
        reason = "RH Rendah (" + String(hum, 1) + "% < " + String(rhTriggerLow, 1) + "%) & Suhu Panas (" + String(temp, 1) + "C > " + String(tempMax, 1) + "C)";
      } else if (hum < rhTriggerLow) {
        reason = "Kelembaban Rendah (" + String(hum, 1) + "% < " + String(rhTriggerLow, 1) + "%)";
      } else {
        reason = "Suhu Panas (" + String(temp, 1) + "C > " + String(tempMax, 1) + "C)";
      }

      startMisting(reason, false);  // Normal misting
    }
  } else {
    // 4. CEK TARGET TERCAPAI (Histeresis Stop)
    if (!isPulseMisting) {
      bool targetReached = (hum >= rhTriggerHigh && temp <= tempMax);
      if (targetReached) {
        String stopReason = "Target tercapai (RH:" + String(hum, 1) + "% T:" + String(temp, 1) + "C)";
        stopMisting(stopReason);
      }
    }
  }
}

void startMisting(String reason, bool isPulse) {
  mistingTriggerReason = reason;
  isPulseMisting = isPulse;

  Serial.print("   💦 [MISTING ON] ");
  if (isPulse) Serial.print("[PULSE 30s] ");
  Serial.println("Pemicu: " + reason);

  digitalWrite(PIN_RELAY_SOLENOID, RELAY_ON);  // Buka solenoid valve air
  delay(200);                                   // Stabilisasi tekanan
  digitalWrite(PIN_RELAY_PUMP, RELAY_ON);       // Nyalakan pompa misting

  isMistingActive  = true;
  mistingStartTime = millis();
}

void stopMisting(String stopReason) {
  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);      // Matikan pompa dulu
  delay(200);
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_OFF);   // Tutup solenoid valve

  unsigned long duration = (millis() - mistingStartTime) / 1000;
  isMistingActive     = false;
  isPulseMisting      = false;
  mistingLastStopTime = millis();  // Mulai masa cooldown 150 detik

  Serial.printf("   🛑 [MISTING OFF] Durasi: %lu detik — %s\n", duration, stopReason.c_str());

  // Enqueue riwayat aktivasi ke antrian log aktuator
  enqueueLog(duration, mistingTriggerReason, stopReason, "misting");
}

// ============================================================
// LOGIKA KONTROL EXHAUST FAN (DENGAN HOMOGENISASI & COOLDOWN 120s)
// ============================================================

void controlFan(float avgTemp, float maxTemp, float disparity, float currentHum) {
  // FLUID DYNAMICS GUARD (PRD Section 3.B):
  // Jika mode Panen / Jeda Misting diaktifkan (pintu kumbung terbuka lebar),
  // Exhaust Fan WAJIB dimatikan untuk mencegah Short-Circuiting sirkulasi udara.
  if (isPausedMode) {
    if (isFanActive) stopFan("Mode Panen Aktif (Fluid Dynamics Guard — Pintu Terbuka)");
    return;
  }

  unsigned long now = millis();
  float criticalThreshold = tempMax + CRITICAL_TEMP_OFFSET;
  bool isNight = isNightHour(getCurrentHourWIB());

  // 1. TIER 2: Safety Override Suhu Kritis (BYPASS SEMUA DELAY & COOLDOWN!)
  if (maxTemp > criticalThreshold) {
    if (isMistingActive) {
      stopMisting("Dipotong Safety Override Kipas (Suhu Kritis)");
    }
    if (!isFanActive || isHomogenizing || isNightFan) {
      String reason = "Safety Override (Sensor Max " + String(maxTemp, 1) + "C > " + String(criticalThreshold, 1) + "C)";
      startFan(reason, false, false, true);
      Serial.printf("   🚨 [SAFETY OVERRIDE] Fan PAKSA ON! Sensor tertinggi %.1f°C > batas kritis %.1f°C\n", 
                    maxTemp, criticalThreshold);
    }
    return;  // Tahan fan ON selama ada zona kritis
  }

  // [F-10a] Histeresis stop Safety Override berlaku 24 jam (siang DAN malam)
  if (isFanActive && isCriticalOverride) {
    if (maxTemp <= (criticalThreshold - 1.0) && avgTemp <= tempMax) {
      stopFan("Suhu kritis teratasi (Max " + String(maxTemp, 1) + "C <= " + String(criticalThreshold - 1.0, 1) + "C)");
    }
    return;  // Belum teratasi: jangan biarkan logika siang/malam mematikan fan ini
  }

  // 2. SETTLING DELAY GUARD: Fan dilarang nyala jika misting baru mati < 60 detik lalu
  if (mistingLastStopTime > 0 && (now - mistingLastStopTime < POST_MISTING_FAN_DELAY_MS)) {
    return; // Tunggu kabut mengendap
  }

  // 3. NIGHT MODE FAN INTERLOCK
  // Jika night fan sedang aktif (berjalan 45s atau menyeberang pagi), tahan agar tidak dievaluasi logika siang.
  // Watchdog Section F di loop() yang bertanggung jawab penuh mematikan fan saat 45s selesai atau transisi jam 06:00 WIB.
  if (isFanActive && isNightFan) {
    return;
  }

  if (isNight) {
    // Failsafe 2: Jika ada fan siang yang masih aktif saat transisi jam 17:00, matikan segera!
    if (isFanActive && !isNightFan) {
      Serial.println("[NIGHT] 🌙 Transisi ke Night Mode: Mematikan sisa fan siang...");
      stopFan("Transisi ke Night Mode (17:00 WIB)");
      return;
    }

    if (!isFanActive && !isMistingActive) {
      // Inisialisasi awal timer malam saat boot/transisi agar tidak langsung trigger mendadak
      if (lastNightPeriodicFanTime == 0) lastNightPeriodicFanTime = now;
      if (lastNightPurgeFanTime == 0) lastNightPurgeFanTime = now;

      // Universal Guard: Kipas malam DILARANG nyala jika baru saja mati < 30 menit lalu (cegah over-ventilation malam)
      if (lastNightFanStopTime > 0 && (now - lastNightFanStopTime < NIGHT_FAN_COOLDOWN_MS)) {
        return;
      }

      // Pemicu Malam 1: Over-Humidity Purge (RH >= 96.0%, Cooldown 30 menit)
      if (currentHum >= NIGHT_OVER_HUMIDITY_THRESHOLD) {
        if (now - lastNightPurgeFanTime >= NIGHT_FAN_COOLDOWN_MS) {
          lastNightPurgeFanTime = now;
          // Sinkronisasi Timer: Purge sudah membuang uap jenuh & akumulasi gas CO2 di lantai secara total.
          // Tunda jadwal CO2 flush 60 menit ke depan agar fan tidak nyala tumpang tindih dalam 1 jam!
          lastNightPeriodicFanTime = now;
          String reason = "Night Over-Humidity Purge (RH " + String(currentHum, 1) + "% >= " + String(NIGHT_OVER_HUMIDITY_THRESHOLD, 1) + "%)";
          startFan(reason, false, true);
          return;
        }
      }

      // Pemicu Malam 2: Periodic CO2 Flush (Tiap 60 Menit sebagai fallback jika RH < 96%)
      if (now - lastNightPeriodicFanTime >= NIGHT_FAN_PERIODIC_MS) {
        lastNightPeriodicFanTime = now;
        // Sinkronisasi Timer: CO2 flush sudah menyegarkan udara kumbung, beri cooldown purge 30 menit
        lastNightPurgeFanTime = now;
        String reason = "Night Periodic CO2 Flush (Siklus 60 Menit)";
        startFan(reason, false, true);
        return;
      }
    }
    return; // Di malam hari tidak menjalankan logika suhu/homogenisasi siang
  }

  // 4. DAYTIME LOGIC (06:00 - 17:00 WIB)
  // A. Tier 3: Homogenisasi Mikroklimat (Disparitas RH > 12.0%)
  if (!isFanActive && !isMistingActive && disparity > HUM_DISPARITY_THRESHOLD) {
    // Cooldown Guard khusus homogenisasi (15 menit / 900 detik)
    bool canHomogenize = true;
    if (fanLastStopTime > 0 && (now - fanLastStopTime < FAN_HOMOGENIZE_COOLDOWN_MS)) {
      canHomogenize = false;
      unsigned long rem = (FAN_HOMOGENIZE_COOLDOWN_MS - (now - fanLastStopTime)) / 1000;
      if (rem % 60 == 0) {
        Serial.printf("   ⏳ [FAN COOLDOWN] Kipas istirahat... %lu detik tersisa (relaksasi sirkulasi)\n", rem);
      }
    }

    if (canHomogenize) {
      String reason = "Homogenisasi Sirkulasi (Disparitas RH " + String(disparity, 1) + "% > " + String(HUM_DISPARITY_THRESHOLD, 1) + "%)";
      startFan(reason, true, false);
      return;
    }
  }

  // B. Tier 1: Logika Normal (Buang Panas via Rata-rata Tertimbang)
  // Cek jika Safety Override aktif dan suhu sudah kembali normal
  if (isFanActive && !isHomogenizing && !isNightFan && isCriticalOverride) {
    if (maxTemp <= (criticalThreshold - 1.0) && avgTemp <= tempMax) {
      String stopReason = "Suhu kritis teratasi (Max " + String(maxTemp, 1) + "C <= " + String(criticalThreshold - 1.0, 1) + "C)";
      stopFan(stopReason);
      return;
    }
  }

  float tempStopThreshold = tempMax - TEMP_HYSTERESIS; // Histeresis stop: misal 32.0 - 1.5 = 30.5°C
  if (avgTemp > tempMax) {
    if (!isFanActive && !isMistingActive) {
      // Cooldown anti-chattering fan pendinginan siang (60s)
      if (fanCoolingLastStopTime > 0 && (now - fanCoolingLastStopTime < FAN_COOLING_COOLDOWN_MS)) {
        unsigned long rem = (FAN_COOLING_COOLDOWN_MS - (now - fanCoolingLastStopTime)) / 1000;
        if (rem % 15 == 0) {
          Serial.printf("   ⏳ [COOLDOWN FAN] Kipas istirahat... %lu detik tersisa (anti-chattering)\n", rem);
        }
        return;
      }
      String reason = "Suhu Tinggi (Avg " + String(avgTemp, 1) + "C > " + String(tempMax, 1) + "C)";
      startFan(reason, false, false);
    }
  } else if (avgTemp <= tempStopThreshold) {
    if (isFanActive && !isHomogenizing && !isNightFan) {
      String stopReason = "Suhu normal (Avg " + String(avgTemp, 1) + "C <= " + String(tempStopThreshold, 1) + "C)";
      stopFan(stopReason);
    }
  }
}

void startFan(String reason, bool homogenize, bool nightMode, bool criticalOverride) {
  fanTriggerReason   = reason;
  isHomogenizing     = homogenize;
  isNightFan         = nightMode;
  isCriticalOverride = criticalOverride;

  digitalWrite(PIN_RELAY_FAN, RELAY_ON);
  isFanActive  = true;
  fanStartTime = millis();

  Serial.print("   🌀 [FAN ON] ");
  if (criticalOverride) Serial.print("[SAFETY OVERRIDE] ");
  else if (nightMode) Serial.print("[NIGHT PURGE 45s] ");
  else if (homogenize) Serial.print("[HOMOGENISASI 30s] ");
  Serial.println("Pemicu: " + reason);
}

void stopFan(String stopReason) {
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);

  unsigned long duration = (millis() - fanStartTime) / 1000;
  if (isHomogenizing) {
    fanLastStopTime = millis();        // Masa cooldown homogenisasi 900 detik (15 menit)
  } else if (!isNightFan) {
    fanCoolingLastStopTime = millis(); // Masa cooldown anti-chattering fan pendinginan siang 60 detik
  } else {
    lastNightFanStopTime = millis();   // Timestamp terakhir night fan berhenti (independen)
  }
  isFanActive        = false;
  isHomogenizing     = false;
  isNightFan         = false;
  isCriticalOverride = false;          // Centralized reset flag Safety Override

  Serial.printf("   🌀 [FAN OFF] Durasi: %lu detik — %s\n", duration, stopReason.c_str());

  // Enqueue riwayat aktivasi ke antrian log aktuator
  enqueueLog(max((unsigned long)1, duration), fanTriggerReason, stopReason, "fan");
}

// ============================================================
// LOGIKA JEDA PANEN (PAUSE & RESUME) — PRD SECTION 3
// ============================================================

void startPauseMode(unsigned long durationSec, String reason) {
  if (isMistingActive) stopMisting("Mode Panen Dimulai (" + reason + ")");
  if (isFanActive) stopFan("Mode Panen Dimulai (Fluid Dynamic Guard)");

  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_OFF);
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);

  isPausedMode = true;
  pauseStartTime = millis();
  pauseDurationMs = durationSec * 1000UL;
  pauseReason = reason;

  Serial.printf("\n============================================================\n");
  Serial.printf("   ⏸️  [MODE PANEN DIAKTIFKAN]\n");
  Serial.printf("   Durasi Jeda : %lu detik (%lu jam %lu menit)\n", durationSec, durationSec / 3600, (durationSec % 3600) / 60);
  Serial.printf("   Status Fisik: Pompa, Valve, dan Exhaust Fan dipaksa OFF!\n");
  Serial.printf("   Fisika Udara: Mencegah short-circuiting udara saat pintu terbuka.\n");
  Serial.printf("============================================================\n\n");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("MODE PANEN JEDA ");
  lcd.setCursor(0, 1);
  lcd.printf("PAUSE %02luh %02lum  ", durationSec / 3600, (durationSec % 3600) / 60);
}

void endPauseMode(String reason) {
  isPausedMode = false;
  pauseDurationMs = 0;
  pauseStartTime = 0;

  Serial.printf("\n============================================================\n");
  Serial.println("   ▶️  [RESUME -> MODE AUTO] " + reason);
  Serial.println("   ⚡  [INSTANT-READ] Segera membaca sensor DHT22 untuk stabilisasi mikroklimat...");
  Serial.printf("============================================================\n\n");

  // PRD 3.A: ESP32 otomatis masuk mode AUTO dan langsung melakukan instant-read sensor DHT22
  lastSensorReadTime = 0;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("RESUMED -> AUTO ");
  lcd.setCursor(0, 1);
  lcd.print("Instant Read... ");
}

// ============================================================
// LCD DISPLAY
// ============================================================
void updateLCD(float temp, float hum, bool misting, bool fan) {
  if (isPausedMode) {
    unsigned long elapsed = millis() - pauseStartTime;
    unsigned long rem = (pauseDurationMs > elapsed) ? (pauseDurationMs - elapsed) / 1000UL : 0;
    lcd.setCursor(0, 0);
    lcd.print("PAUSE MODE PANEN");
    lcd.setCursor(0, 1);
    lcd.printf("Sisa: %02luh %02lum %02lus", rem / 3600, (rem % 3600) / 60, rem % 60);
    return;
  }

  lcd.setCursor(0, 0);
  lcd.printf("T:%.1fC  H:%.1f%%", temp, hum);

  lcd.setCursor(0, 1);
  if (misting && fan) {
    lcd.print("MIST:ON  FAN:ON ");
  } else if (misting) {
    lcd.print("MIST:ON  FAN:OFF");
  } else if (fan) {
    lcd.print("MIST:OFF FAN:ON ");
  } else {
    lcd.print("MIST:OFF FAN:OFF");
  }
}

// ============================================================
// FUNGSI API — KOMUNIKASI KE LARAVEL BACKEND
// ============================================================

/**
 * Fetch threshold terbaru dari Web Dashboard.
 * GET /api/thresholds/active
 */
void fetchThresholds() {
  if (!wifiUp()) return;

  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification untuk testing

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/thresholds/active");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(4000);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<768> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      tempMax = doc["data"]["temp_max"].as<float>();
      tempMin = doc["data"]["temp_min"].as<float>();
      humMin  = doc["data"]["humidity_min"].as<float>();
      humMax  = doc["data"]["humidity_max"].as<float>();

      rhTriggerLow  = humMin;
      // Histeresis stop realistis: deadband 5% (misal 85% ON -> 90% OFF) menghasilkan kurva melengkung landai.
      // Mencegah short-cycling (osilasi cepat yang membuat grafik lancip) & menjaga kelembapan stabil di zona aman.
      rhTriggerHigh = min(humMax - 4.0f, humMin + 5.0f);  // Misal 85 + 5 = 90.0%

      Serial.printf("[API] Threshold Sinkron! T:%.1f-%.1f°C | RH:%.1f-%.1f%%\n",
                    tempMin, tempMax, humMin, humMax);

      // ── BACA PERINTAH KONTROL JEDA PANEN (PRD Section 3.A) ──
      if (doc["data"].containsKey("device_command")) {
        JsonObject cmdObj = doc["data"]["device_command"];
        String cmd = cmdObj["command"].as<String>();
        if (cmd == "PAUSE") {
          unsigned long remSec = cmdObj["remaining_seconds"].as<unsigned long>();
          if (remSec > 0 && !isPausedMode) {
            String rsn = cmdObj.containsKey("reason") ? cmdObj["reason"].as<String>() : "Mode Panen (Dashboard)";
            startPauseMode(remSec, rsn);
          }
        } else if (cmd == "AUTO" || cmd == "RESUME") {
          if (isPausedMode) {
            endPauseMode("Command " + cmd + " diterima dari Dashboard");
          }
        }
      }
    } else {
      Serial.println("[API] ⚠️ Gagal parse JSON threshold.");
    }
  } else {
    Serial.printf("[API] ⚠️ Gagal fetch threshold (HTTP %d)\n", httpCode);
  }
  http.end();
}

/**
 * Kirim data sensor ke Laravel.
 * POST /api/sensor-data
 */
void sendSensorData(float temp, float hum) {
  if (!wifiUp()) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/sensor-data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(4000);

  StaticJsonDocument<256> doc;
  doc["device_id"]    = deviceId;
  doc["temperature"]  = serialized(String(temp, 2));
  doc["humidity"]     = serialized(String(hum, 2));
  doc["co2_level"]    = 480; // Baseline ambient CO2 ~480 ppm

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 201) {
    Serial.println("[API] ✅ Data sensor terkirim!");
  } else {
    Serial.printf("[API] ❌ Gagal kirim sensor data (HTTP %d)\n", httpCode);
  }
  http.end();
}

/**
 * Kirim log aktivasi aktuator dari antrian ke Laravel.
 * POST /api/sprinkler-logs
 */
int postSprinklerLog(const PendingLog& e) {
  if (!wifiUp()) return -1;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/sprinkler-logs");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(4000);

  StaticJsonDocument<512> doc;
  doc["device_id"]         = deviceId;
  doc["actuator"]          = e.act;
  doc["duration_seconds"]  = (int)e.dur;
  doc["trigger_reason"]    = e.trig;
  doc["stop_reason"]       = e.stop;

  if (e.startEpoch > 0) {
    struct tm tmBuf;
    gmtime_r(&e.startEpoch, &tmBuf);
    char timeStr[25];
    strftime(timeStr, sizeof(timeStr), "%Y-%m-%dT%H:%M:%SZ", &tmBuf);
    doc["started_at"] = timeStr;
  }

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 201) {
    Serial.println("[API] ✅ Log aktuator terkirim dari antrian!");
  } else {
    Serial.printf("[API] ❌ Gagal kirim log aktuator (HTTP %d)\n", httpCode);
  }
  http.end();
  return httpCode;
}
