"""
Smart Shroom IoT Simulator v3.0 — Multi-Sensor (3x DHT22)
=========================================================
Script ini mensimulasikan perilaku 3 sensor DHT22 + aktuator (Misting & Fan)
di kumbung jamur tiram berukuran 5m x 7m x 3.5m.

Penempatan sensor: Segitiga Diagonal
  Sensor A: Zona Atas (dekat pintu, 2.5m) — paling panas & kering
  Sensor B: Zona Tengah (pusat kumbung, 1.5m) — zona referensi
  Sensor C: Zona Bawah (pojok belakang, 0.5m) — paling dingin & lembab

Prinsip simulasi:
1. Tiap sensor punya offset suhu/kelembaban sesuai zona fisiknya
2. ESP32 menghitung rata-rata dari 3 sensor sebelum mengambil keputusan
3. Nilai rata-rata yang dikirim ke API (sama seperti firmware asli)
4. Logika kontrol hysteresis IDENTIK dengan esp32_firmware.ino v3.0

@author Smart Shroom SCM — Tugas Akhir
@see docs/penempatan_sensor.md
"""

import time
import math
import random
import requests
import datetime
import sys
import os

# Fix encoding untuk Windows terminal (agar emoji tidak error)
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# ============================================================
# KONFIGURASI
# ============================================================
API_BASE_URL = "https://tugasakhir-lime.vercel.app/api"
DEVICE_ID = "ESP32-KUMBUNG-01"

# Interval pengiriman data (detik)
SENSOR_SEND_INTERVAL = 60       # Kirim data sensor tiap 60 detik (1 menit)
THRESHOLD_FETCH_INTERVAL = 30   # Fetch threshold dari web tiap 30 detik
MAX_MISTING_DURATION = 90       # Safety timeout misting (detik)
CRITICAL_TEMP_OFFSET = 2.0      # Safety Override: jika SATU sensor > tempMax + offset ini, paksa Fan ON

# ============================================================
# MODEL FISIKA KUMBUNG JAMUR
# ============================================================
# Konstanta lingkungan kumbung jamur tiram
# Referensi: Panduan Budidaya Jamur Tiram (Pleurotus ostreatus)
AMBIENT_TEMP_BASE = 26.0       # Suhu rata-rata harian kumbung (°C)
AMBIENT_TEMP_AMPLITUDE = 4.0   # Amplitudo fluktuasi siang-malam (°C)
AMBIENT_HUM_BASE = 82.0        # Kelembaban rata-rata kumbung (%)
AMBIENT_HUM_AMPLITUDE = 8.0    # Amplitudo fluktuasi kelembaban (%)

# Koefisien dampak aktuator terhadap pembacaan sensor (per detik)
MISTING_TEMP_EFFECT = -0.03    # Misting menurunkan suhu 0.03°C/detik (evaporative cooling)
MISTING_HUM_EFFECT = 0.25      # Misting menaikkan kelembaban 0.25%/detik
FAN_TEMP_EFFECT = -0.05        # Fan menurunkan suhu 0.05°C/detik (konveksi paksa)
FAN_HUM_EFFECT = -0.10         # Fan menurunkan kelembaban 0.10%/detik (bawa udara kering masuk)

# Koefisien kembali ke kondisi ambient (tanpa aktuator, per detik)
TEMP_RECOVERY_RATE = 0.005     # Suhu perlahan kembali ke ambient
HUM_RECOVERY_RATE = 0.008      # Kelembaban perlahan kembali ke ambient

# Batas fisik sensor
TEMP_MIN_PHYSICAL = 18.0       # Suhu minimum fisik kumbung (°C)
TEMP_MAX_PHYSICAL = 40.0       # Suhu maksimum fisik kumbung (°C)
HUM_MIN_PHYSICAL = 40.0        # Kelembaban minimum fisik (%)
HUM_MAX_PHYSICAL = 99.0        # Kelembaban maksimum fisik (%)

# ============================================================
# OFFSET ZONA SENSOR (Segitiga Diagonal)
# ============================================================
# Setiap sensor punya offset terhadap nilai ambient pusat kumbung.
# Offset ini mensimulasikan perbedaan fisik antar zona.
SENSOR_ZONES = {
    'A': {  # Zona Atas, dekat pintu (2.5m)
        'label': 'Atas (Pintu)',
        'temp_offset': +1.8,   # Udara panas naik ke atas + dekat pintu
        'hum_offset': -4.0,    # Lebih kering karena panas
        'noise_temp': 0.15,    # Noise lebih tinggi (fluktuasi pintu)
        'noise_hum': 0.4,
    },
    'B': {  # Zona Tengah, pusat kumbung (1.5m)
        'label': 'Tengah (Pusat)',
        'temp_offset': 0.0,    # Referensi utama
        'hum_offset': 0.0,
        'noise_temp': 0.1,     # Noise standar DHT22
        'noise_hum': 0.3,
    },
    'C': {  # Zona Bawah, pojok belakang (0.5m)
        'label': 'Bawah (Pojok)',
        'temp_offset': -1.5,   # Udara dingin turun + jauh dari pintu
        'hum_offset': +5.0,    # Lebih lembab karena dingin
        'noise_temp': 0.08,    # Noise lebih rendah (zona stabil)
        'noise_hum': 0.2,
    },
}


# ============================================================
# STATE SIMULATOR
# ============================================================
class KumbungState:
    """State mikroklimat kumbung jamur dengan 3 sensor (Segitiga Diagonal)."""

    def __init__(self):
        # Inisialisasi dari kondisi ambient saat ini
        now = datetime.datetime.now()
        base_temp = self._get_ambient_temp(now)
        base_hum = self._get_ambient_hum(now)

        # State per-sensor (suhu & kelembaban masing-masing zona)
        self.sensors = {}
        for zone_id, zone in SENSOR_ZONES.items():
            self.sensors[zone_id] = {
                'temperature': base_temp + zone['temp_offset'],
                'humidity': base_hum + zone['hum_offset'],
            }

        # Nilai rata-rata (yang dikirim ke API dan dipakai aktuator)
        self.temperature = base_temp
        self.humidity = base_hum

        # State aktuator (mirror dari esp32_firmware.ino)
        self.is_misting_active = False
        self.is_fan_active = False
        self.misting_start_time = None
        self.misting_duration_total = 0

        # Threshold dari web (akan di-fetch)
        self.temp_max = 30.0
        self.temp_min = 23.0
        self.hum_min = 80.0
        self.hum_max = 90.0
        self.rh_trigger_low = 80.0       # = hum_min
        self.rh_trigger_high = 88.0      # = hum_max - 2.0

    @staticmethod
    def _get_ambient_temp(now: datetime.datetime) -> float:
        """
        Hitung suhu ambient berdasarkan jam.
        Model sinusoidal: puncak panas jam 14:00, paling dingin jam 04:00.
        T(t) = T_base + A * sin((t - 8) * π / 12)
        """
        hour_fraction = now.hour + now.minute / 60.0
        phase = (hour_fraction - 8.0) * math.pi / 12.0
        return AMBIENT_TEMP_BASE + AMBIENT_TEMP_AMPLITUDE * math.sin(phase)

    @staticmethod
    def _get_ambient_hum(now: datetime.datetime) -> float:
        """
        Hitung kelembaban ambient (berkorelasi terbalik dengan suhu).
        Siang kering, malam lembab.
        """
        hour_fraction = now.hour + now.minute / 60.0
        phase = (hour_fraction - 8.0) * math.pi / 12.0
        return AMBIENT_HUM_BASE - AMBIENT_HUM_AMPLITUDE * math.sin(phase)

    def update_thresholds(self, thresholds: dict):
        """Update threshold dari respons API."""
        self.temp_max = thresholds['temp_max']
        self.temp_min = thresholds['temp_min']
        self.hum_min = thresholds['humidity_min']
        self.hum_max = thresholds['humidity_max']
        self.rh_trigger_low = self.hum_min
        self.rh_trigger_high = self.hum_max - 2.0

    def simulate_tick(self, dt_seconds: float):
        """
        Simulasikan perubahan mikroklimat selama dt_seconds untuk 3 sensor.
        Tiap sensor punya offset zona + noise individual.
        Lalu hitung rata-rata untuk keputusan aktuator.
        """
        now = datetime.datetime.now()
        ambient_temp = self._get_ambient_temp(now)
        ambient_hum = self._get_ambient_hum(now)

        sum_t, sum_h = 0.0, 0.0

        for zone_id, zone_cfg in SENSOR_ZONES.items():
            s = self.sensors[zone_id]

            # Target ambient per zona = ambient pusat + offset zona
            zone_ambient_temp = ambient_temp + zone_cfg['temp_offset']
            zone_ambient_hum = ambient_hum + zone_cfg['hum_offset']

            # 1. Efek aktuator aktif
            if self.is_misting_active:
                s['temperature'] += MISTING_TEMP_EFFECT * dt_seconds
                s['humidity'] += MISTING_HUM_EFFECT * dt_seconds

            if self.is_fan_active:
                s['temperature'] += FAN_TEMP_EFFECT * dt_seconds
                s['humidity'] += FAN_HUM_EFFECT * dt_seconds

            # 2. Drift alami kembali ke ambient zona
            temp_diff = zone_ambient_temp - s['temperature']
            hum_diff = zone_ambient_hum - s['humidity']
            s['temperature'] += temp_diff * TEMP_RECOVERY_RATE * dt_seconds
            s['humidity'] += hum_diff * HUM_RECOVERY_RATE * dt_seconds

            # 3. Sensor noise per zona (DHT22 accuracy: ±0.5°C, ±2%)
            s['temperature'] += random.gauss(0, zone_cfg['noise_temp'])
            s['humidity'] += random.gauss(0, zone_cfg['noise_hum'])

            # 4. Clamp ke batas fisik
            s['temperature'] = max(TEMP_MIN_PHYSICAL, min(TEMP_MAX_PHYSICAL, s['temperature']))
            s['humidity'] = max(HUM_MIN_PHYSICAL, min(HUM_MAX_PHYSICAL, s['humidity']))

            sum_t += s['temperature']
            sum_h += s['humidity']

        # 5. Hitung rata-rata 3 sensor
        self.temperature = sum_t / len(SENSOR_ZONES)
        self.humidity = sum_h / len(SENSOR_ZONES)

    def get_readings(self) -> tuple:
        """Return rata-rata pembacaan sensor (yang dikirim ke API)."""
        return round(self.temperature, 1), round(self.humidity, 1)

    def get_zone_readings(self) -> dict:
        """Return pembacaan per zona (untuk tampilan terminal)."""
        result = {}
        for zone_id in SENSOR_ZONES:
            s = self.sensors[zone_id]
            result[zone_id] = (round(s['temperature'], 1), round(s['humidity'], 1))
        return result

    def get_max_temp(self) -> float:
        """Return suhu TERTINGGI dari semua sensor (untuk Safety Override)."""
        return round(max(s['temperature'] for s in self.sensors.values()), 1)

    def get_min_hum(self) -> float:
        """Return kelembaban TERENDAH dari semua sensor (untuk Safety Override)."""
        return round(min(s['humidity'] for s in self.sensors.values()), 1)


# ============================================================
# KONTROL AKTUATOR (IDENTIK dengan esp32_firmware.ino)
# ============================================================

def control_misting(state: KumbungState):
    """
    Logika Histeresis Misting — mirror dari controlMisting() di firmware.
    - NYALA  jika RH < rhTriggerLow  ATAU suhu > tempMax
    - MATI   jika RH >= rhTriggerHigh DAN suhu <= tempMax
    - DITAHAN jika suhu panas TAPI RH sudah terlalu tinggi (cegah busuk)
    """
    temp, hum = state.get_readings()

    if not state.is_misting_active:
        # Cek kondisi trigger nyala
        if hum < state.rh_trigger_low or temp > state.temp_max:
            # Safety: jangan nyiram kalau RH udah tinggi banget
            if temp > state.temp_max and hum >= state.hum_max:
                print(f"   ⚠️  [HOLD] Suhu panas ({temp}°C) TAPI RH tinggi ({hum}%). Pompa DITAHAN!")
                return
            # Mulai misting
            state.is_misting_active = True
            state.misting_start_time = time.time()
            state.misting_duration_total = 0
            print(f"   💦 [MISTING ON] Pompa + Solenoid AKTIF (RH:{hum}% T:{temp}°C)")
    else:
        # Cek kondisi trigger mati
        target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max)
        elapsed = time.time() - state.misting_start_time

        if target_reached:
            state.is_misting_active = False
            state.misting_duration_total = int(elapsed)
            reason = f"Target tercapai (RH:{hum}% T:{temp}°C)"
            print(f"   🛑 [MISTING OFF] Durasi: {state.misting_duration_total}s — {reason}")
            send_sprinkler_log(state.misting_duration_total, reason)

        elif elapsed >= MAX_MISTING_DURATION:
            state.is_misting_active = False
            state.misting_duration_total = MAX_MISTING_DURATION
            reason = f"Safety timeout ({MAX_MISTING_DURATION}s)"
            print(f"   🛑 [MISTING OFF] TIMEOUT! Durasi: {MAX_MISTING_DURATION}s — {reason}")
            send_sprinkler_log(MAX_MISTING_DURATION, reason)


def control_fan(state: KumbungState):
    """
    Logika Exhaust Fan — mirror dari controlFan() di firmware.
    - NYALA jika suhu rata-rata > tempMax (buang udara panas)
    - NYALA PAKSA jika SATU sensor > tempMax + CRITICAL_TEMP_OFFSET (Safety Override)
    - MATI  jika suhu rata-rata <= tempMin DAN tidak ada sensor kritis (histeresis)
    """
    temp, _ = state.get_readings()
    max_temp = state.get_max_temp()
    critical_threshold = state.temp_max + CRITICAL_TEMP_OFFSET

    # Safety Override: cek apakah ada sensor individu yang melewati batas kritis
    if max_temp > critical_threshold:
        if not state.is_fan_active:
            state.is_fan_active = True
            print(f"   🚨 [SAFETY OVERRIDE] Fan PAKSA ON! Sensor tertinggi {max_temp}°C > batas kritis {critical_threshold}°C")
        return  # Jangan matikan fan selama ada sensor kritis

    # Logika normal (pakai rata-rata)
    if temp > state.temp_max:
        if not state.is_fan_active:
            state.is_fan_active = True
            print(f"   🌀 [FAN ON] Exhaust Fan AKTIF (Suhu avg {temp}°C > {state.temp_max}°C)")
    elif temp <= state.temp_min:
        if state.is_fan_active:
            state.is_fan_active = False
            print(f"   🌀 [FAN OFF] Exhaust Fan MATI (Suhu avg {temp}°C <= {state.temp_min}°C)")


# ============================================================
# KOMUNIKASI API
# ============================================================

def fetch_thresholds() -> dict:
    """GET /api/thresholds/active — ambil batas threshold dari web."""
    try:
        response = requests.get(f"{API_BASE_URL}/thresholds/active", timeout=10)
        if response.status_code == 200:
            data = response.json().get('data', {})
            return {
                'temp_max': float(data.get('temp_max', 30.0)),
                'temp_min': float(data.get('temp_min', 23.0)),
                'humidity_min': float(data.get('humidity_min', 80.0)),
                'humidity_max': float(data.get('humidity_max', 90.0))
            }
    except Exception as e:
        print(f"   ⚠️  Gagal fetch threshold: {e}")
    return None


def send_sensor_data(temp: float, hum: float):
    """POST /api/sensor-data — kirim pembacaan sensor ke backend."""
    payload = {
        "device_id": DEVICE_ID,
        "temperature": temp,
        "humidity": hum,
        "co2_level": round(random.gauss(480, 30), 1)  # CO2 ambient ~480 ppm ± noise
    }
    try:
        response = requests.post(f"{API_BASE_URL}/sensor-data", json=payload, timeout=10)
        if response.status_code == 201:
            return True
        else:
            print(f"   ❌ Gagal kirim data: HTTP {response.status_code}")
    except Exception as e:
        print(f"   ⚠️  Error koneksi: {e}")
    return False


def send_sprinkler_log(duration: int, reason: str):
    """POST /api/sprinkler-logs — kirim log penyiraman."""
    payload = {
        "device_id": DEVICE_ID,
        "duration_seconds": duration,
        "trigger_reason": reason
    }
    try:
        response = requests.post(f"{API_BASE_URL}/sprinkler-logs", json=payload, timeout=10)
        if response.status_code != 201:
            print(f"   ❌ Gagal kirim sprinkler log: HTTP {response.status_code}")
    except Exception as e:
        print(f"   ⚠️  Error kirim sprinkler log: {e}")


# ============================================================
# LCD VIRTUAL (Terminal Output)
# ============================================================

def print_lcd(temp: float, hum: float, misting: bool, fan: bool):
    """Simulasi tampilan LCD 16x2 di terminal."""
    line1 = f"T:{temp:5.1f}C H:{hum:4.1f}%"
    mist_str = "ON " if misting else "OFF"
    fan_str = "ON " if fan else "OFF"
    line2 = f"MIST:{mist_str} FAN:{fan_str}"
    print(f"   📟 LCD │ {line1} │")
    print(f"          │ {line2}          │")


# ============================================================
# MAIN LOOP
# ============================================================

def main():
    print("=" * 60)
    print("  🍄 Smart Shroom IoT Simulator v3.0 (Multi-Sensor)")
    print(f"  Device: {DEVICE_ID}")
    print(f"  Backend: {API_BASE_URL}")
    print(f"  Sensor: 3x DHT22 (Segitiga Diagonal)")
    print("=" * 60)
    print()

    # Inisialisasi state kumbung
    state = KumbungState()
    print(f"[INIT] Kondisi awal kumbung (3 sensor):")
    zones = state.get_zone_readings()
    for zid, (zt, zh) in zones.items():
        label = SENSOR_ZONES[zid]['label']
        print(f"   [{zid}] {label}: {zt}°C | {zh}%")
    avg_t, avg_h = state.get_readings()
    print(f"   [AVG] Rata-rata: {avg_t}°C | {avg_h}%")
    print()

    # Fetch threshold pertama kali
    print("[BOOT] Mengambil threshold dari Dashboard...")
    thresholds = fetch_thresholds()
    if thresholds:
        state.update_thresholds(thresholds)
        print(f"   ✅ Threshold: T={state.temp_min}-{state.temp_max}°C | RH={state.hum_min}-{state.hum_max}%")
    else:
        print(f"   ⚠️  Menggunakan threshold default")
    print()

    # Timer non-blocking (seperti millis() di firmware)
    last_sensor_send = 0
    last_threshold_fetch = time.time()
    tick_count = 0

    try:
        while True:
            now = time.time()
            tick_count += 1
            timestamp = datetime.datetime.now().strftime("%H:%M:%S")

            # Simulasikan perubahan mikroklimat (interval 1 detik per tick)
            state.simulate_tick(dt_seconds=1.0)

            # Jalankan logika kontrol aktuator (setiap tick, seperti firmware)
            control_misting(state)
            control_fan(state)

            # Kirim data sensor ke API setiap SENSOR_SEND_INTERVAL detik
            if now - last_sensor_send >= SENSOR_SEND_INTERVAL:
                last_sensor_send = now
                temp, hum = state.get_readings()
                zones = state.get_zone_readings()

                print(f"[{timestamp}] ── Tick #{tick_count} ──────────────────────")

                # Tampilkan pembacaan per zona
                for zid, (zt, zh) in zones.items():
                    label = SENSOR_ZONES[zid]['label']
                    print(f"   [{zid}] {label}: {zt}°C | {zh}%")

                # Kirim rata-rata ke API
                success = send_sensor_data(temp, hum)
                status = "✅" if success else "❌"
                print(f"   {status} AVG → API: Suhu {temp}°C | RH {hum}%")

                # Tampilkan LCD virtual
                print_lcd(temp, hum, state.is_misting_active, state.is_fan_active)

                # Status aktuator
                actuators = []
                if state.is_misting_active:
                    elapsed = int(now - state.misting_start_time)
                    actuators.append(f"💦 Misting: ON ({elapsed}s/{MAX_MISTING_DURATION}s)")
                if state.is_fan_active:
                    actuators.append("🌀 Fan: ON")
                if not actuators:
                    actuators.append("💤 Semua aktuator: OFF")
                for a in actuators:
                    print(f"   {a}")

                print()

            # Fetch threshold dari web secara berkala
            if now - last_threshold_fetch >= THRESHOLD_FETCH_INTERVAL:
                last_threshold_fetch = now
                thresholds = fetch_thresholds()
                if thresholds:
                    state.update_thresholds(thresholds)

            # Tick interval 1 detik (simulasi real-time)
            time.sleep(1)

    except KeyboardInterrupt:
        print()
        print("=" * 60)
        print("  🛑 Simulator dihentikan oleh pengguna.")
        temp, hum = state.get_readings()
        print(f"  Kondisi terakhir: Suhu {temp}°C | RH {hum}%")
        print(f"  Misting: {'ON' if state.is_misting_active else 'OFF'}")
        print(f"  Fan: {'ON' if state.is_fan_active else 'OFF'}")
        print("=" * 60)
        sys.exit(0)


if __name__ == "__main__":
    main()
