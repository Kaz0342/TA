import time
import random
import requests
import datetime

# Konfigurasi Backend Laravel
API_BASE_URL = "http://127.0.0.1:8000/api"
DEVICE_ID = "ESP32-KUMBUNG-01"

print(f"🚀 Memulai Smart Shroom IoT Simulator untuk {DEVICE_ID}...")

def get_thresholds():
    """Mengambil batas suhu dan kelembaban dari Backend"""
    try:
        response = requests.get(f"{API_BASE_URL}/thresholds/active")
        if response.status_code == 200:
            data = response.json().get('data', {})
            return {
                'temp_max': float(data.get('temp_max', 30.0)),
                'temp_min': float(data.get('temp_min', 22.0)),
                'humidity_min': float(data.get('humidity_min', 60.0)),
                'humidity_max': float(data.get('humidity_max', 90.0))
            }
    except Exception as e:
        print(f"⚠️ Gagal mengambil threshold: {e}. Menggunakan default.")
    
    return {'temp_max': 30.0, 'temp_min': 22.0, 'humidity_min': 60.0, 'humidity_max': 90.0}

def send_sensor_data(temperature, humidity):
    """Mengirim data pembacaan sensor ke Backend"""
    payload = {
        "device_id": DEVICE_ID,
        "temperature": temperature,
        "humidity": humidity,
        "co2_level": random.uniform(400, 600) # Dummy data CO2
    }
    try:
        response = requests.post(f"{API_BASE_URL}/sensor-data", json=payload)
        if response.status_code == 201:
            print(f"✅ Data Terkirim: Suhu {temperature:.1f}°C | Kelembaban {humidity:.1f}%")
        else:
            print(f"❌ Gagal kirim data: {response.text}")
    except Exception as e:
        print(f"⚠️ Error koneksi: {e}")

def send_sprinkler_log(duration, reason):
    """Mengirim log penyiraman ke Backend"""
    payload = {
        "device_id": DEVICE_ID,
        "duration_seconds": duration,
        "trigger_reason": reason
    }
    try:
        # Pura-pura nyiram (jeda eksekusi)
        print(f"💦 [SPRINKLER ON] Menyiram selama {duration} detik... (Simulasi)")
        time.sleep(3) # Cukup 3 detik aja untuk simulasi
        
        response = requests.post(f"{API_BASE_URL}/sprinkler-logs", json=payload)
        if response.status_code == 201:
            print(f"🛑 [SPRINKLER OFF] Log penyiraman berhasil dicatat!")
        else:
            print(f"❌ Gagal kirim log: {response.text}")
    except Exception as e:
        print(f"⚠️ Error koneksi sprinkler log: {e}")


# Loop Utama (Berjalan terus menerus)
if __name__ == "__main__":
    while True:
        # 1. Ambil aturan batas terbaru dari web
        thresholds = get_thresholds()
        
        # 2. Baca sensor (Simulasi angka acak)
        # Bikin fluktuasi suhu antara 24°C s/d 33°C
        current_temp = round(random.uniform(24.0, 33.0), 1)
        current_hum = round(random.uniform(50.0, 85.0), 1)
        
        # 3. Kirim data sensor
        send_sensor_data(current_temp, current_hum)
        
        # 4. Cek Logika Otomatisasi (Sprinkler Trigger) - SMART LOGIC (Dynamic Duration)
        if current_temp > thresholds['temp_max'] and current_hum < thresholds['humidity_max']:
            # Hitung selisih (Delta)
            delta_temp = current_temp - thresholds['temp_max']
            # Rumus: Tiap kelebihan 1°C = semprot 30 detik (Plus base 30 detik). Maksimal 180 dtk.
            dynamic_duration = min(int(delta_temp * 30) + 30, 180)
            
            reason = f"Suhu berlebih {delta_temp:.1f}°C (Durasi proporsional)"
            send_sprinkler_log(duration=dynamic_duration, reason=reason)
            
        elif current_temp > thresholds['temp_max'] and current_hum >= thresholds['humidity_max']:
            print(f"⚠️ ALARM: Suhu Panas ({current_temp}°C) tapi Sangat Basah ({current_hum}%). Pompa DITAHAN untuk mencegah busuk!")
            
        elif current_hum < thresholds['humidity_min']:
            # Hitung selisih (Delta)
            delta_hum = thresholds['humidity_min'] - current_hum
            # Rumus: Tiap kekurangan 1% = semprot 5 detik (Plus base 30 dtk). Maksimal 120 dtk.
            dynamic_duration = min(int(delta_hum * 5) + 30, 120)
            
            reason = f"Kelembaban kurang {delta_hum:.1f}% (Durasi proporsional)"
            send_sprinkler_log(duration=dynamic_duration, reason=reason)
            
        # Tunggu 10 detik sebelum ngirim data lagi (Biar gak nyepam server)
        print("-" * 40)
        time.sleep(10)
