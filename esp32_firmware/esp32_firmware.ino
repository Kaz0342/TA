/**
 * ============================================================
 * Smart Shroom Controller (SSC) — ULTIMATE VERSION v3.0
 * ============================================================
 * 
 * Firmware ESP32 untuk monitoring & kontrol otomatis 
 * mikroklimat kumbung budidaya JAMUR TIRAM.
 * Kumbung: 5m x 7m x 3.5m (Volume: 122.5 m³)
 * 
 * FITUR:
 * [IoT]       WiFi + HTTP POST data sensor ke Laravel API
 * [IoT]       Fetch threshold dinamis dari Web Dashboard
 * [Hardware]  3x DHT22 (Multi-Sensor Averaging), LCD I2C 16x2, 3x Relay
 * [Logic]     Histeresis misting (RH low → ON, RH high → OFF)
 * [Safety]    Timer misting maks 90 detik per siklus
 * [Design]    Non-blocking millis() — ESP32 TIDAK pernah freeze
 * [Sensor]    Penempatan Segitiga Diagonal (Atas-Tengah-Bawah)
 * 
 * PIN ASSIGNMENT (3 Sensor DHT22):
 *   GPIO 4   → DHT22-A (Zona Atas, dekat pintu, 2.5m)
 *   GPIO 15  → DHT22-B (Zona Tengah, pusat kumbung, 1.5m)
 *   GPIO 2   → DHT22-C (Zona Bawah, pojok belakang, 0.5m)
 *   GPIO 26  → Relay Pompa Misting (12V)
 *   GPIO 25  → Relay Solenoid Valve (12V)
 *   GPIO 33  → Relay Exhaust Fan (220V)
 *   GPIO 21  → SDA (LCD I2C)
 *   GPIO 22  → SCL (LCD I2C)
 * 
 * API CONTRACT (Laravel Backend):
 *   POST /api/sensor-data      → { device_id, temperature, humidity, co2_level }
 *   POST /api/sprinkler-logs   → { device_id, duration_seconds, trigger_reason }
 *   GET  /api/thresholds/active → response.data.{ temp_max, temp_min, humidity_min, humidity_max }
 * 
 * @see docs/penempatan_sensor.md untuk detail strategi penempatan
 * @version 3.0.0 (Multi-Sensor Averaging)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHT.h"
#include <ArduinoJson.h>

// ============================================================
// KONFIGURASI JARINGAN (KHUSUS WOKWI)
// ============================================================
const char* ssid     = "Wokwi-GUEST";
const char* password = "";

// Wajib pake NGROK karena Wokwi nggak bisa akses localhost!
// Ganti URL di bawah ini sama link ngrok lo.
// Contoh: "https://abcd-1234.ngrok-free.app/api"
String apiBaseUrl = "https://tugasakhir-lime.vercel.app/api";
String deviceId   = "ESP32-KUMBUNG-01";

// ============================================================
// PIN ASSIGNMENT (3 SENSOR DHT22 — Segitiga Diagonal)
// ============================================================
const int PIN_DHT_A          = 4;   // GPIO 4  → DHT22-A (Zona Atas, dekat pintu, 2.5m)
const int PIN_DHT_B          = 15;  // GPIO 15 → DHT22-B (Zona Tengah, pusat, 1.5m)
const int PIN_DHT_C          = 2;   // GPIO 2  → DHT22-C (Zona Bawah, pojok belakang, 0.5m)
const int PIN_RELAY_PUMP     = 26;  // GPIO 26 → Pompa Misting (12V)
const int PIN_RELAY_SOLENOID = 25;  // GPIO 25 → Solenoid Valve (12V)
const int PIN_RELAY_FAN      = 33;  // GPIO 33 → Exhaust Fan (220V)

// Relay Active LOW (umum untuk relay module ESP32)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// Jumlah sensor DHT22
const int NUM_SENSORS = 3;

// ============================================================
// INISIALISASI SENSOR & LCD
// ============================================================
DHT dhtA(PIN_DHT_A, DHT22);  // Sensor A — Zona Atas
DHT dhtB(PIN_DHT_B, DHT22);  // Sensor B — Zona Tengah
DHT dhtC(PIN_DHT_C, DHT22);  // Sensor C — Zona Bawah
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============================================================
// THRESHOLD DEFAULT — JAMUR KUPING (Auricularia auricula)
// Nilai ini akan di-overwrite dari Web Dashboard via API
// Referensi mikroklimat jamur kuping:
//   Suhu optimal  : 25°C - 30°C
//   RH optimal    : 85% - 95%
// ============================================================
float tempMax  = 30.0;   // Batas suhu atas (dari API: temp_max)
float tempMin  = 25.0;   // Batas suhu bawah (dari API: temp_min)
float humMin   = 85.0;   // Batas RH bawah / trigger misting ON (dari API: humidity_min)
float humMax   = 95.0;   // Batas RH atas / trigger misting OFF (dari API: humidity_max)

// Threshold lokal (histeresis) — turunan dari threshold web
float rhTriggerLow  = 85.0;  // Nyalakan misting kalau RH < ini
float rhTriggerHigh = 93.0;  // Matikan misting kalau RH >= ini DAN suhu <= batas

// Safety Override: jika SATU sensor > tempMax + offset, paksa Fan ON
const float CRITICAL_TEMP_OFFSET = 2.0;

// ============================================================
// TIMER NON-BLOCKING (millis)
// ============================================================
unsigned long lastSensorReadTime   = 0;
const unsigned long sensorInterval = 5000;  // Baca sensor tiap 5 detik

unsigned long lastApiSendTime      = 0;
const unsigned long apiSendInterval = 60000; // Kirim data ke API tiap 60 detik (1 menit)

unsigned long lastThresholdFetch   = 0;
const unsigned long thresholdInterval = 30000; // Fetch threshold tiap 30 detik

// Safety Timer Misting (maks 90 detik per siklus)
const unsigned long MAX_MISTING_DURATION_MS = 90000;
unsigned long mistingStartTime = 0;

// ============================================================
// STATE AKTUATOR
// ============================================================
bool isMistingActive = false;
bool isFanActive     = false;

// Cache data sensor terakhir
float lastTemp = 0.0;
float lastHum  = 0.0;
float maxSensorTemp = 0.0;  // Suhu tertinggi dari semua sensor (untuk Safety Override)

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("=== Smart Shroom Controller v3.0 ===");
  Serial.println("=== Multi-Sensor (3x DHT22)      ===");

  // Inisialisasi LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Shroom SCM");
  lcd.setCursor(0, 1);
  lcd.print("3-Sensor v3.0   ");
  delay(2000);
  lcd.clear();

  // Inisialisasi 3 Sensor DHT22
  dhtA.begin();
  dhtB.begin();
  dhtC.begin();

  // Inisialisasi Relay (semua OFF saat boot)
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_SOLENOID, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_OFF);
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);

  // Koneksi WiFi
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi.");
  Serial.print("Koneksi ke WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    lcd.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected! ");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());
  delay(2000);
  lcd.clear();

  // Fetch threshold pertama kali saat boot
  fetchThresholds();
}

// ============================================================
// LOOP UTAMA (NON-BLOCKING)
// ============================================================
void loop() {
  // Guard: cek koneksi WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi putus! Reconnecting...");
    lcd.setCursor(0, 1);
    lcd.print("WiFi Putus!     ");
    WiFi.reconnect();
    delay(2000);
    return;
  }

  unsigned long now = millis();

  // ── A. BACA 3 SENSOR & AVERAGING (tiap 5 detik) ──────────
  if (now - lastSensorReadTime >= sensorInterval) {
    lastSensorReadTime = now;

    // Baca ketiga sensor
    float tA = dhtA.readTemperature();
    float hA = dhtA.readHumidity();
    float tB = dhtB.readTemperature();
    float hB = dhtB.readHumidity();
    float tC = dhtC.readTemperature();
    float hC = dhtC.readHumidity();

    // Hitung rata-rata (abaikan sensor yang error/NaN)
    float sumT = 0, sumH = 0;
    int validCount = 0;

    if (!isnan(tA) && !isnan(hA)) { sumT += tA; sumH += hA; validCount++; Serial.printf("  [A] Atas:   T=%.1f°C RH=%.1f%%\n", tA, hA); }
    else { Serial.println("  [A] Atas:   ERROR!"); }

    if (!isnan(tB) && !isnan(hB)) { sumT += tB; sumH += hB; validCount++; Serial.printf("  [B] Tengah: T=%.1f°C RH=%.1f%%\n", tB, hB); }
    else { Serial.println("  [B] Tengah: ERROR!"); }

    if (!isnan(tC) && !isnan(hC)) { sumT += tC; sumH += hC; validCount++; Serial.printf("  [C] Bawah:  T=%.1f°C RH=%.1f%%\n", tC, hC); }
    else { Serial.println("  [C] Bawah:  ERROR!"); }

    if (validCount == 0) {
      Serial.println("[ERROR] SEMUA sensor gagal! Cek wiring.");
      lcd.setCursor(0, 0);
      lcd.print("ALL Sensor ERR! ");
      lcd.setCursor(0, 1);
      lcd.print("Check Wiring    ");
      return;
    }

    // Rata-rata dari sensor yang valid
    lastTemp = sumT / validCount;
    lastHum  = sumH / validCount;

    // Cari suhu tertinggi dari sensor individu (untuk Safety Override)
    maxSensorTemp = -999;
    if (!isnan(tA)) maxSensorTemp = max(maxSensorTemp, tA);
    if (!isnan(tB)) maxSensorTemp = max(maxSensorTemp, tB);
    if (!isnan(tC)) maxSensorTemp = max(maxSensorTemp, tC);

    Serial.printf("[AVG] Rata-rata (%d sensor): T=%.1f°C | RH=%.1f%%\n", validCount, lastTemp, lastHum);
    Serial.printf("[MAX] Sensor tertinggi: T=%.1f°C (Batas kritis: %.1f°C)\n", maxSensorTemp, tempMax + CRITICAL_TEMP_OFFSET);
    if (validCount < NUM_SENSORS) {
      Serial.printf("[WARN] Hanya %d dari %d sensor aktif!\n", validCount, NUM_SENSORS);
    }

    // ── LOGIKA HISTERESIS MISTING ──────────────────────────
    controlMisting(lastTemp, lastHum);

    // ── LOGIKA EXHAUST FAN (dengan Safety Override) ─────────
    controlFan(lastTemp, maxSensorTemp);

    // ── UPDATE LCD ─────────────────────────────────────────
    updateLCD(lastTemp, lastHum, isMistingActive, isFanActive);
  }

  // ── B. KIRIM DATA KE API (tiap 10 detik) ─────────────────
  if (now - lastApiSendTime >= apiSendInterval) {
    lastApiSendTime = now;
    if (lastTemp > 0) {
      sendSensorData(lastTemp, lastHum);
    }
  }

  // ── C. FETCH THRESHOLD DARI WEB (tiap 30 detik) ──────────
  if (now - lastThresholdFetch >= thresholdInterval) {
    lastThresholdFetch = now;
    fetchThresholds();
  }

  // ── D. SAFETY CHECK MISTING TIMEOUT ──────────────────────
  if (isMistingActive) {
    if (now - mistingStartTime >= MAX_MISTING_DURATION_MS) {
      Serial.println("[SAFETY] Misting TIMEOUT! Paksa matikan pompa.");
      stopMisting("Safety timeout (90 detik)");
    }
  }
}

// ============================================================
// KONTROL AKTUATOR
// ============================================================

/**
 * Logika Histeresis Misting:
 * - NYALA  jika RH < rhTriggerLow  ATAU suhu > tempMax
 * - MATI   jika RH >= rhTriggerHigh DAN suhu <= batas aman
 * - DITAHAN jika suhu panas TAPI RH sudah terlalu tinggi (cegah busuk)
 */
void controlMisting(float temp, float hum) {
  if (!isMistingActive) {
    // Kondisi trigger nyala
    if (hum < rhTriggerLow || temp > tempMax) {
      // Safety: jangan nyiram kalau RH udah tinggi banget (cegah busuk)
      if (temp > tempMax && hum >= humMax) {
        Serial.println("[HOLD] Suhu panas TAPI RH sudah sangat tinggi! Pompa DITAHAN.");
        return;
      }
      startMisting();
    }
  } else {
    // Kondisi trigger mati
    bool targetReached = (hum >= rhTriggerHigh && temp <= tempMax);
    if (targetReached) {
      String reason = "Target mikroklimat tercapai (RH:" + String(hum, 1) + "% T:" + String(temp, 1) + "C)";
      stopMisting(reason);
    }
  }
}

void startMisting() {
  Serial.println("[AKSI] 💦 Memulai Misting...");
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_ON);  // Buka valve dulu
  delay(200);                                   // Jeda 200ms biar valve kebuka
  digitalWrite(PIN_RELAY_PUMP, RELAY_ON);       // Nyalakan pompa
  isMistingActive = true;
  mistingStartTime = millis();
}

void stopMisting(String reason) {
  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);      // Matikan pompa dulu
  delay(200);                                    // Jeda 200ms
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_OFF);   // Tutup valve

  unsigned long duration = (millis() - mistingStartTime) / 1000;
  isMistingActive = false;

  Serial.print("[AKSI] 🛑 Misting OFF. Durasi: ");
  Serial.print(duration);
  Serial.println(" detik.");

  // Kirim log penyiraman ke Laravel API
  sendSprinklerLog(duration, reason);
}

/**
 * Logika Exhaust Fan (dengan Safety Override):
 * - NYALA jika suhu rata-rata > tempMax (buang udara panas)
 * - NYALA PAKSA jika SATU sensor > tempMax + CRITICAL_TEMP_OFFSET (Safety Override)
 * - MATI  jika suhu rata-rata <= tempMin DAN tidak ada sensor kritis (histeresis)
 */
void controlFan(float avgTemp, float maxTemp) {
  float criticalThreshold = tempMax + CRITICAL_TEMP_OFFSET;

  // Safety Override: cek apakah ada sensor individu yang melewati batas kritis
  if (maxTemp > criticalThreshold) {
    if (!isFanActive) {
      digitalWrite(PIN_RELAY_FAN, RELAY_ON);
      isFanActive = true;
      Serial.printf("[SAFETY] \xF0\x9F\x9A\xA8 OVERRIDE! Fan PAKSA ON! Sensor tertinggi %.1f\xC2\xB0C > kritis %.1f\xC2\xB0C\n", maxTemp, criticalThreshold);
    }
    return;  // Jangan matikan fan selama ada sensor kritis
  }

  // Logika normal (pakai rata-rata)
  if (avgTemp > tempMax) {
    if (!isFanActive) {
      digitalWrite(PIN_RELAY_FAN, RELAY_ON);
      isFanActive = true;
      Serial.println("[AKSI] \xF0\x9F\x8C\x80 Exhaust Fan AKTIF.");
    }
  } else if (avgTemp <= tempMin) {
    if (isFanActive) {
      digitalWrite(PIN_RELAY_FAN, RELAY_OFF);
      isFanActive = false;
      Serial.println("[AKSI] Exhaust Fan MATI.");
    }
  }
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
 * Response: { data: { temp_max, temp_min, humidity_min, humidity_max } }
 */
void fetchThresholds() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification untuk Ngrok HTTPS

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

      Serial.printf("[API] Threshold updated! T:%.0f-%.0f°C | RH:%.0f-%.0f%%\n",
                    tempMin, tempMax, humMin, humMax);
    } else {
      Serial.println("[API] Gagal parse JSON threshold.");
    }
  } else {
    Serial.printf("[API] Gagal fetch threshold (HTTP %d)\n", httpCode);
  }
  http.end();
}

/**
 * Kirim data sensor ke Laravel.
 * POST /api/sensor-data
 * Payload: { device_id, temperature, humidity, co2_level }
 */
void sendSensorData(float temp, float hum) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification untuk Ngrok HTTPS

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/sensor-data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(10000);

  StaticJsonDocument<200> doc;
  doc["device_id"]    = deviceId;
  doc["temperature"]  = temp;
  doc["humidity"]     = hum;
  doc["co2_level"]    = 0; // Belum ada sensor CO2, kirim 0

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
 * Kirim log penyiraman ke Laravel.
 * POST /api/sprinkler-logs
 * Payload: { device_id, duration_seconds, trigger_reason }
 */
void sendSprinklerLog(unsigned long durationSec, String reason) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification untuk Ngrok HTTPS

  HTTPClient http;
  http.begin(client, apiBaseUrl + "/sprinkler-logs");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(10000);

  StaticJsonDocument<256> doc;
  doc["device_id"]         = deviceId;
  doc["duration_seconds"]  = (int)durationSec;
  doc["trigger_reason"]    = reason;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 201) {
    Serial.println("[API] ✅ Log misting terkirim!");
  } else {
    Serial.printf("[API] ❌ Gagal kirim log misting (HTTP %d)\n", httpCode);
  }
  http.end();
}
