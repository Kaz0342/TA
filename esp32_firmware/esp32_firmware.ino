/**
 * ============================================================
 * Smart Shroom Controller (SSC) — ULTIMATE VERSION
 * ============================================================
 * 
 * Firmware ESP32 untuk monitoring & kontrol otomatis 
 * mikroklimat kumbung budidaya JAMUR KUPING (Auricularia auricula).
 * 
 * FITUR:
 * [IoT]       WiFi + HTTP POST data sensor ke Laravel API
 * [IoT]       Fetch threshold dinamis dari Web Dashboard
 * [Hardware]  DHT22, LCD I2C 16x2, 3x Relay (Pompa, Solenoid, Fan)
 * [Logic]     Histeresis misting (RH low → ON, RH high → OFF)
 * [Safety]    Timer misting maks 90 detik per siklus
 * [Design]    Non-blocking millis() — ESP32 TIDAK pernah freeze
 * 
 * PIN ASSIGNMENT:
 *   GPIO 4   → DHT22 (Data)
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
 * @author  King (TA — Sistem Informasi)
 * @version 2.0.0 (Ultimate — Wokwi Ready)
 */

#include <WiFi.h>
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
String apiBaseUrl = "https://yo-yo-flammable-wobbling.ngrok-free.dev/api";
String deviceId   = "ESP32-KUMBUNG-01";

// ============================================================
// PIN ASSIGNMENT
// ============================================================
const int PIN_DHT            = 4;   // GPIO 4  → Data DHT22
const int PIN_RELAY_PUMP     = 26;  // GPIO 26 → Pompa Misting (12V)
const int PIN_RELAY_SOLENOID = 25;  // GPIO 25 → Solenoid Valve (12V)
const int PIN_RELAY_FAN      = 33;  // GPIO 33 → Exhaust Fan (220V)

// Relay Active LOW (umum untuk relay module ESP32)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// ============================================================
// INISIALISASI SENSOR & LCD
// ============================================================
DHT dhtSensor(PIN_DHT, DHT22);
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

// ============================================================
// TIMER NON-BLOCKING (millis)
// ============================================================
unsigned long lastSensorReadTime   = 0;
const unsigned long sensorInterval = 5000;  // Baca sensor tiap 5 detik

unsigned long lastApiSendTime      = 0;
const unsigned long apiSendInterval = 10000; // Kirim data ke API tiap 10 detik

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

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("=== Smart Shroom Controller v2.0 ===");
  Serial.println("=== Jamur Kuping (Auricularia)   ===");

  // Inisialisasi LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Shroom SCM");
  lcd.setCursor(0, 1);
  lcd.print("Jamur Kuping v2 ");
  delay(2000);
  lcd.clear();

  // Inisialisasi Sensor DHT22
  dhtSensor.begin();

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

  // ── A. BACA SENSOR (tiap 5 detik) ────────────────────────
  if (now - lastSensorReadTime >= sensorInterval) {
    lastSensorReadTime = now;

    float h = dhtSensor.readHumidity();
    float t = dhtSensor.readTemperature();

    if (isnan(h) || isnan(t)) {
      Serial.println("[ERROR] Gagal baca sensor DHT!");
      lcd.setCursor(0, 0);
      lcd.print("Sensor Error!   ");
      lcd.setCursor(0, 1);
      lcd.print("Check Wiring    ");
      return;
    }

    lastTemp = t;
    lastHum  = h;

    Serial.printf("[SENSOR] Suhu: %.1f°C | RH: %.1f%%\n", lastTemp, lastHum);

    // ── LOGIKA HISTERESIS MISTING ──────────────────────────
    controlMisting(lastTemp, lastHum);

    // ── LOGIKA EXHAUST FAN ─────────────────────────────────
    controlFan(lastTemp);

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
 * Logika Exhaust Fan:
 * - NYALA jika suhu > tempMax (buang udara panas)
 * - MATI  jika suhu <= tempMin (udah adem)
 * Pake histeresis biar fan nggak ON-OFF-ON-OFF cepet banget
 */
void controlFan(float temp) {
  if (temp > tempMax) {
    if (!isFanActive) {
      digitalWrite(PIN_RELAY_FAN, RELAY_ON);
      isFanActive = true;
      Serial.println("[AKSI] 🌀 Exhaust Fan AKTIF.");
    }
  } else if (temp <= tempMin) {
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

  HTTPClient http;
  http.begin(apiBaseUrl + "/thresholds/active");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(5000);
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

  HTTPClient http;
  http.begin(apiBaseUrl + "/sensor-data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(5000);

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

  HTTPClient http;
  http.begin(apiBaseUrl + "/sprinkler-logs");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartShroom");
  http.setTimeout(5000);

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
