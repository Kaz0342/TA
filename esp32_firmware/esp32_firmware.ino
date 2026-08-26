#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- KONFIGURASI WIFI ---
const char* ssid = "NAMA_WIFI_LO";
const char* password = "PASSWORD_WIFI_LO";

// --- KONFIGURASI API BACKEND ---
// Ganti dengan IP Address Laptop lo (cek pake ipconfig di CMD)
// Jangan pake 127.0.0.1 karena ESP32 punya network sendiri
String apiBaseUrl = "http://192.168.1.5:8000/api"; 
String deviceId = "ESP32-KUMBUNG-REAL";

// --- PIN HARDWARE ---
#define DHTPIN 4          // Pin data sensor DHT22
#define DHTTYPE DHT22     // Jenis sensor (DHT11 / DHT22)
#define RELAY_PIN 5       // Pin Relay untuk Pompa Air

DHT dht(DHTPIN, DHTTYPE);

// --- VARIABEL THRESHOLD DEFAULT ---
float tempMax = 30.0;
float humMin = 60.0;
float humMax = 90.0;

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // Default OFF (Relay active low biasanya)

  // Konek ke WiFi
  Serial.println("Koneksi ke WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // 1. Ambil Threshold dari Web
    fetchThresholds();

    // 2. Baca Sensor DHT22
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    // Cek kalo sensor error
    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("Gagal membaca sensor DHT!");
      delay(2000);
      return;
    }

    // 3. Kirim Data Sensor ke Web
    sendSensorData(temperature, humidity);

    // 4. Logika Siram Otomatis (SMART LOGIC & DYNAMIC DURATION)
    if (temperature > tempMax && humidity < humMax) {
      float deltaTemp = temperature - tempMax;
      // Durasi Proporsional (Tiap 1C = 30 detik). Min 30, Max 180.
      int dynDuration = constrain(int(deltaTemp * 30) + 30, 30, 180);
      String reason = "Suhu berlebih " + String(deltaTemp) + "C";
      triggerSprinkler(dynDuration, reason); 
    } 
    else if (temperature > tempMax && humidity >= humMax) {
      Serial.println("⚠️ Suhu Panas TAPI Kelembaban Tinggi! Pompa DITAHAN.");
    }
    else if (humidity < humMin) {
      float deltaHum = humMin - humidity;
      // Durasi Proporsional (Tiap 1% = 5 detik). Min 30, Max 120.
      int dynDuration = constrain(int(deltaHum * 5) + 30, 30, 120);
      String reason = "Kelembaban kurang " + String(deltaHum) + "%";
      triggerSprinkler(dynDuration, reason); 
    }

  } else {
    Serial.println("WiFi Putus! Coba reconnecting...");
    WiFi.reconnect();
  }

  // Delay 10 Detik sebelum baca ulang
  delay(10000); 
}

// ==========================================
// FUNGSI BANTUAN API
// ==========================================

void fetchThresholds() {
  HTTPClient http;
  http.begin(apiBaseUrl + "/thresholds/active");
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    // Parse JSON (Gunakan library ArduinoJson)
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      tempMax = doc["data"]["temp_max"];
      humMin = doc["data"]["humidity_min"];
      humMax = doc["data"]["humidity_max"];
      Serial.println("Threshold diupdate dari Web!");
    }
  }
  http.end();
}

void sendSensorData(float temp, float hum) {
  HTTPClient http;
  http.begin(apiBaseUrl + "/sensor-data");
  http.addHeader("Content-Type", "application/json");

  // Format JSON payload
  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceId;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["co2_level"] = 450.0; // Bebas kalo gada sensor CO2
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  if (httpCode == 201) {
    Serial.println("Data sensor terkirim!");
  } else {
    Serial.println("Gagal kirim data sensor");
  }
  http.end();
}

void triggerSprinkler(int durationSec, String reason) {
  Serial.println("💦 NYALAKAN POMPA!");
  digitalWrite(RELAY_PIN, LOW); // Relay ON
  
  // Nunggu selama durasi (dalam ms)
  delay(durationSec * 1000);
  
  digitalWrite(RELAY_PIN, HIGH); // Relay OFF
  Serial.println("🛑 MATIKAN POMPA!");

  // Kirim log ke web
  HTTPClient http;
  http.begin(apiBaseUrl + "/sprinkler-logs");
  http.addHeader("Content-Type", "application/json");

  // Format waktu secara kasar krn ESP32 gaada RTC bawaan. 
  // Backend Laravel akan assign 'now()' pas nerima request (karena kita hapus started_at)
  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceId;
  doc["duration_seconds"] = durationSec;
  doc["trigger_reason"] = reason;
  
  String requestBody;
  serializeJson(doc, requestBody);
  http.POST(requestBody);
  http.end();
}
