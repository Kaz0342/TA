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
 * [Control]   Dual Cooldown Guard (Misting 150s & Fan Homogenisasi 120s)
 * [Safety]    Pulse Misting (30s) untuk Rak Atas kering kritis
 * [Safety]    Safety Override: Suhu Kritis (>34°C) paksa Fan ON (Bypass Cooldown)
 * [Safety]    Safety Hold: Tahan misting jika RH >= 95% cegah jamur busuk
 * [Safety]    Timeout darurat misting maks 90 detik per siklus
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
const unsigned long MAX_MISTING_DURATION_MS     = 90000;   // 90 detik timeout darurat misting
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
float rhTriggerHigh = 93.0;  // = humMax - 2.0

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

unsigned long mistingStartTime           = 0;
unsigned long mistingLastStopTime        = 0;
unsigned long fanStartTime               = 0;
unsigned long fanLastStopTime            = 0;
unsigned long lastNightPeriodicFanTime   = 0;
unsigned long lastNightPurgeFanTime      = 0;

String mistingTriggerReason = "";
String fanTriggerReason     = "";

// Cache pembacaan sensor terakhir
float lastTemp       = 27.5;
float lastHum        = 85.0;
float maxSensorTemp  = 27.5;
float minSensorHum   = 85.0;
float humDisparity   = 0.0;

// ============================================================
// FORWARD DECLARATIONS & TIME HELPER
// ============================================================
void startMisting(String reason, bool isPulse);
void stopMisting(String stopReason);
void startFan(String reason, bool homogenize, bool nightMode);
void stopFan(String stopReason);
void controlMisting(float temp, float hum, float minHum);
void controlFan(float avgTemp, float maxTemp, float disparity, float currentHum);
void updateLCD(float temp, float hum, bool misting, bool fan);
void fetchThresholds();
void sendSensorData(float temp, float hum);
void sendSprinklerLog(unsigned long durationSec, String triggerReason, String stopReason, String actuator);

int getCurrentHourWIB() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 200)) {
    return timeinfo.tm_hour;
  }
  return 12; // Fallback jika WiFi/NTP belum sync
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

  // Koneksi WiFi
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi.");
  Serial.print("[WIFI] Menghubungkan ke ");
  Serial.print(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    lcd.print(".");
  }
  Serial.println("\n[WIFI] Terhubung! IP: " + WiFi.localIP().toString());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected! ");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());
  delay(1500);
  lcd.clear();

  // Sinkronisasi Waktu NTP (WIB = UTC+7) untuk Jam Operasional Malam
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("[NTP] Menyelaraskan jam operasional WIB...");

  // Fetch threshold pertama kali saat boot
  fetchThresholds();
}

// ============================================================
// LOOP UTAMA (NON-BLOCKING)
// ============================================================
void loop() {
  // Guard: Cek koneksi WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi terputus! Mencoba rekoneksi...");
    lcd.setCursor(0, 1);
    lcd.print("WiFi Disconn... ");
    WiFi.reconnect();
    delay(1000);
    return;
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

      // Disparitas kelembaban vertikal (|A - C|)
      if (validA && validC) {
        humDisparity = abs(hA - hC);
      } else {
        humDisparity = (maxSensorTemp > -900.0 && minSensorHum < 900.0) ? (lastHum - minSensorHum) : 0.0;
      }

      Serial.printf("[FUSION] Rata-rata Tertimbang: T=%.1f°C | RH=%.1f%% | Disparitas RH=%.1f%%\n", 
                    lastTemp, lastHum, humDisparity);
    } else {
      Serial.println("[FATAL] SEMUA sensor DHT22 gagal membaca! Periksa wiring GPIO.");
      lcd.setCursor(0, 0);
      lcd.print("ALL SENSOR ERR! ");
      lcd.setCursor(0, 1);
      lcd.print("Check Wiring    ");
      return;
    }

    // ── EVALUASI KONTROL MISTING & FAN ────────────────────────
    controlMisting(lastTemp, lastHum, minSensorHum);
    controlFan(lastTemp, maxSensorTemp, humDisparity, lastHum);

    // ── UPDATE TAMPILAN LCD ───────────────────────────────────
    updateLCD(lastTemp, lastHum, isMistingActive, isFanActive);
  }

  // ── B. KIRIM DATA KE LARAVEL API (Tiap 60 Detik) ────────────
  if (now - lastApiSendTime >= apiSendInterval) {
    lastApiSendTime = now;
    if (lastTemp > 0) {
      sendSensorData(lastTemp, lastHum);
    }
  }

  // ── C. FETCH THRESHOLD DARI WEB (Tiap 30 Detik) ────────────
  if (now - lastThresholdFetch >= thresholdInterval) {
    lastThresholdFetch = now;
    fetchThresholds();
  }

  // ── D. SAFETY WATCHDOG: MISTING TIMEOUT (90s / 30s) ────────
  if (isMistingActive) {
    unsigned long elapsed = now - mistingStartTime;
    if (isPulseMisting && elapsed >= PULSE_MISTING_DURATION_MS) {
      Serial.println("[SAFETY] 🛑 Pulse Misting selesai (30s). Mematikan pompa...");
      stopMisting("Pulse misting selesai (30s)");
    } else if (!isPulseMisting && elapsed >= MAX_MISTING_DURATION_MS) {
      Serial.println("[SAFETY] 🛑 Misting TIMEOUT (90s)! Mematikan pompa secara paksa.");
      stopMisting("Safety timeout (90 detik)");
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
}

// ============================================================
// LOGIKA KONTROL MISTING (DENGAN COOLDOWN GUARD 150s)
// ============================================================

void controlMisting(float temp, float hum, float minHum) {
  unsigned long now = millis();
  float criticalLowRh = rhTriggerLow - 4.0;
  int currentHour = getCurrentHourWIB();
  bool isNight = (currentHour >= NIGHT_START_HOUR || currentHour < NIGHT_END_HOUR);

  if (!isMistingActive) {
    // MUTUAL EXCLUSION (INTERLOCK):
    // Jika Exhaust Fan sedang aktif, Misting DILARANG nyala!
    // Mencegah kabut mikro disedot langsung keluar dan terbuang sia-sia.
    if (isFanActive) {
      return;
    }

    // 0. NIGHT LOCKOUT (17:00 - 06:00 WIB): Misting DILARANG nyala agar jamur tidak tidur basah kuyup
    if (isNight) {
      // Pengecualian darurat ekstrem: hanya boleh nyala jika terjadi dehidrasi parah (RH rata-rata < 70% atau sensor < 65%)
      if (hum >= 70.0 && minHum >= 65.0) {
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

  // Kirim riwayat aktivasi ke Laravel API
  sendSprinklerLog(duration, mistingTriggerReason, stopReason, "misting");
}

// ============================================================
// LOGIKA KONTROL EXHAUST FAN (DENGAN HOMOGENISASI & COOLDOWN 120s)
// ============================================================

void controlFan(float avgTemp, float maxTemp, float disparity, float currentHum) {
  unsigned long now = millis();
  float criticalThreshold = tempMax + CRITICAL_TEMP_OFFSET;
  int currentHour = getCurrentHourWIB();
  bool isNight = (currentHour >= NIGHT_START_HOUR || currentHour < NIGHT_END_HOUR);

  // 1. TIER 2: Safety Override Suhu Kritis (BYPASS SEMUA DELAY & COOLDOWN!)
  if (maxTemp > criticalThreshold) {
    if (isMistingActive) {
      stopMisting("Dipotong Safety Override Kipas (Suhu Kritis)");
    }
    if (!isFanActive || isHomogenizing || isNightFan) {
      String reason = "Safety Override (Sensor Max " + String(maxTemp, 1) + "C > " + String(criticalThreshold, 1) + "C)";
      startFan(reason, false, false);
      Serial.printf("   🚨 [SAFETY OVERRIDE] Fan PAKSA ON! Sensor tertinggi %.1f°C > batas kritis %.1f°C\n", 
                    maxTemp, criticalThreshold);
    }
    return;  // Tahan fan ON selama ada zona kritis
  }

  // 2. SETTLING DELAY GUARD: Fan dilarang nyala jika misting baru mati < 60 detik lalu
  if (mistingLastStopTime > 0 && (now - mistingLastStopTime < POST_MISTING_FAN_DELAY_MS)) {
    return; // Tunggu kabut mengendap
  }

  // 3. NIGHT MODE FAN (17:00 - 06:00 WIB)
  if (isNight) {
    // Jika fan malam sedang aktif (durasi 45s)
    if (isFanActive && isNightFan) {
      unsigned long elapsed = now - fanStartTime;
      if (elapsed >= NIGHT_FAN_DURATION_MS) {
        stopFan("Night ventilation selesai 45s (RH: " + String(currentHum, 1) + "%)");
      }
      return;
    }

    if (!isFanActive && !isMistingActive) {
      // Pemicu Malam 1: Over-Humidity Purge (RH >= 96.0%, Cooldown 30 menit)
      if (currentHum >= NIGHT_OVER_HUMIDITY_THRESHOLD) {
        if (lastNightPurgeFanTime == 0 || (now - lastNightPurgeFanTime >= NIGHT_FAN_COOLDOWN_MS)) {
          lastNightPurgeFanTime = now;
          String reason = "Night Over-Humidity Purge (RH " + String(currentHum, 1) + "% >= " + String(NIGHT_OVER_HUMIDITY_THRESHOLD, 1) + "%)";
          startFan(reason, false, true);
          return;
        }
      }

      // Pemicu Malam 2: Periodic CO2 Flush (Tiap 60 Menit)
      if (lastNightPeriodicFanTime == 0) {
        lastNightPeriodicFanTime = now;
      } else if (now - lastNightPeriodicFanTime >= NIGHT_FAN_PERIODIC_MS) {
        lastNightPeriodicFanTime = now;
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
  if (avgTemp > tempMax) {
    if (!isFanActive && !isMistingActive) {
      String reason = "Suhu Tinggi (Avg " + String(avgTemp, 1) + "C > " + String(tempMax, 1) + "C)";
      startFan(reason, false, false);
    }
  } else if (avgTemp <= tempMin) {
    if (isFanActive && !isHomogenizing && !isNightFan) {
      String stopReason = "Suhu normal (Avg " + String(avgTemp, 1) + "C <= " + String(tempMin, 1) + "C)";
      stopFan(stopReason);
    }
  }
}

void startFan(String reason, bool homogenize, bool nightMode) {
  fanTriggerReason = reason;
  isHomogenizing   = homogenize;
  isNightFan       = nightMode;

  digitalWrite(PIN_RELAY_FAN, RELAY_ON);
  isFanActive  = true;
  fanStartTime = millis();

  Serial.print("   🌀 [FAN ON] ");
  if (nightMode) Serial.print("[NIGHT PURGE 45s] ");
  else if (homogenize) Serial.print("[HOMOGENISASI 30s] ");
  Serial.println("Pemicu: " + reason);
}

void stopFan(String stopReason) {
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);

  unsigned long duration = (millis() - fanStartTime) / 1000;
  isFanActive     = false;
  isHomogenizing  = false;
  isNightFan      = false;
  fanLastStopTime = millis();  // Mulai masa cooldown homogenisasi 120 detik

  Serial.printf("   🌀 [FAN OFF] Durasi: %lu detik — %s\n", duration, stopReason.c_str());

  // Kirim riwayat aktivasi ke Laravel API
  sendSprinklerLog(max((unsigned long)1, duration), fanTriggerReason, stopReason, "fan");
}

// ============================================================
// LCD DISPLAY
// ============================================================
void updateLCD(float temp, float hum, bool misting, bool fan) {
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
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification untuk testing

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/thresholds/active");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(10000);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      tempMax = doc["data"]["temp_max"].as<float>();
      tempMin = doc["data"]["temp_min"].as<float>();
      humMin  = doc["data"]["humidity_min"].as<float>();
      humMax  = doc["data"]["humidity_max"].as<float>();

      rhTriggerLow  = humMin;
      rhTriggerHigh = humMax - 2.0;

      Serial.printf("[API] Threshold Sinkron! T:%.1f-%.1f°C | RH:%.1f-%.1f%%\n",
                    tempMin, tempMax, humMin, humMax);
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
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/sensor-data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(10000);

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
 * Kirim log aktivasi aktuator ke Laravel.
 * POST /api/sprinkler-logs
 */
void sendSprinklerLog(unsigned long durationSec, String triggerReason, String stopReason, String actuator) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/sprinkler-logs");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(10000);

  StaticJsonDocument<384> doc;
  doc["device_id"]         = deviceId;
  doc["actuator"]          = actuator;
  doc["duration_seconds"]  = (int)durationSec;
  doc["trigger_reason"]    = triggerReason;
  doc["stop_reason"]       = stopReason;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 201) {
    Serial.println("[API] ✅ Log aktuator terkirim!");
  } else {
    Serial.printf("[API] ❌ Gagal kirim log aktuator (HTTP %d)\n", httpCode);
  }
  http.end();
}
