"""
Smart Shroom IoT Simulator v3.0 — Multi-Sensor (3x DHT22)
=========================================================
Script ini mensimulasikan perilaku 3 sensor DHT22 + aktuator (Misting & Fan)
di kumbung jamur kuping (Auricularia auricula-judae) berukuran 5m x 7m x 3.5m.

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
import argparse
import signal

# Handler sinyal terminasi agar graceful exit di runner cloud (GitHub Actions)
def handle_sigterm(signum, frame):
    print("\n[STOP] Menerima sinyal terminasi (SIGTERM). Simulator berhenti dengan aman.")
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)

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
# ZONA WAKTU & WAKTU LOKAL KUMBUNG
# ============================================================
# Zona Waktu Indonesia Barat (WIB = UTC+7)
# Wajib dieksplisitkan agar simulasi mikroklimat jamur sinkron 100% dengan
# jam biologis kumbung di Indonesia, tidak terpengaruh timezone runner (misal GitHub Actions UTC).
WIB = datetime.timezone(datetime.timedelta(hours=7))

def get_wib_now() -> datetime.datetime:
    """Mengembalikan waktu saat ini dalam zona waktu WIB (Asia/Jakarta, UTC+7)."""
    return datetime.datetime.now(WIB)

# ============================================================
# MODEL FISIKA KUMBUNG JAMUR
# ============================================================
# Konstanta lingkungan kumbung jamur kuping (Auricularia auricula-judae)
# Karakteristik mikroklimat kumbung tropis dataran menengah-rendah:
# - Pagi/Fajar (titik terdingin): ~22.0°C
# - Siang bolong (puncak panas): ~29.5°C
# - Kelembaban berkorelasi terbalik dengan suhu (hukum psikrometrik)
AMBIENT_TEMP_MIN = 22.0        # Suhu minimum harian saat subuh (°C) — kumbung jamur kuping lebih hangat
AMBIENT_TEMP_MAX = 29.5        # Suhu maksimum harian saat siang bolong (°C)
AMBIENT_HUM_MIN = 82.0         # Kelembaban terendah saat siang hari (%) — butuh kelembaban tinggi
AMBIENT_HUM_MAX = 95.0         # Kelembaban tertinggi saat dini hari/subuh (%)

# Titik kritis siklus diurnal (WIB)
T_SUNRISE = 5.5                # Subuh / titik terdingin: 05:30 WIB
T_PEAK = 13.5                  # Puncak panas radiasi matahari: 13:30 WIB

# Koefisien kembali ke kondisi ambient alami kumbung (drift per detik)
TEMP_RECOVERY_RATE = 0.005     # Relaksasi suhu alami menuju ambient
HUM_RECOVERY_RATE = 0.008      # Relaksasi kelembaban alami menuju ambient

# Batas fisik sensor DHT22
TEMP_MIN_PHYSICAL = 18.0       # Batas bawah fisik kumbung (°C)
TEMP_MAX_PHYSICAL = 40.0       # Batas atas fisik kumbung (°C)
HUM_MIN_PHYSICAL = 40.0        # Batas bawah kelembaban fisik (%)
HUM_MAX_PHYSICAL = 99.0        # Batas atas kelembaban fisik (%)

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
        # Inisialisasi dari kondisi ambient WIB saat ini
        now = get_wib_now()
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
        self.temp_max = 32.0
        self.temp_min = 24.0
        self.hum_min = 80.0
        self.hum_max = 95.0
        self.rh_trigger_low = 80.0       # = hum_min
        self.rh_trigger_high = 93.0      # = hum_max - 2.0 (95 - 2 = 93)

    @staticmethod
    def _get_ambient_temp(now: datetime.datetime) -> float:
        """
        Hitung suhu ambient alami kumbung berdasarkan siklus diurnal waktu WIB.
        Model Termodinamika Asimetris:
        1. Fase Pemanasan (05:30 - 13:30): Radiasi matahari menaikkan suhu ruangan (8 jam).
        2. Fase Pendinginan (13:30 - 05:30): Radiasi panas dilepas ke langit malam (16 jam).
           Suhu turun bertahap secara alami:
           * 14:00 : ~28.4°C
           * 17:00 : ~26.6°C
           * 21:00 : ~24.0°C (jam 9 malam sejuk)
           * 22:00 : ~23.5°C (jam 10 malam semakin dingin)
           * 00:00 : ~22.6°C (tengah malam sejuk)
           * 05:30 : ~21.5°C (subuh, titik terdingin)
        """
        hour_fraction = now.hour + now.minute / 60.0 + now.second / 3600.0

        if T_SUNRISE <= hour_fraction <= T_PEAK:
            # Pemanasan siang hari (8 jam) — kurva harmonik sinus
            tau = (hour_fraction - T_SUNRISE) / (T_PEAK - T_SUNRISE)
            factor = (1.0 - math.cos(tau * math.pi)) / 2.0
        else:
            # Pendinginan malam hari (16 jam) — peluruhan termal radiatif kontinu
            dt = (hour_fraction - T_PEAK) if hour_fraction >= T_PEAK else (hour_fraction + 24.0 - T_PEAK)
            tau = dt / 16.0
            # Pangkat 0.7 memodelkan penurunan suhu lebih responsif setelah sunset (18:00 WIB)
            factor = (1.0 + math.cos((tau ** 0.7) * math.pi)) / 2.0

        return AMBIENT_TEMP_MIN + (AMBIENT_TEMP_MAX - AMBIENT_TEMP_MIN) * factor

    @staticmethod
    def _get_ambient_hum(now: datetime.datetime) -> float:
        """
        Hitung kelembaban relatif ambient (korelasi terbalik dengan suhu).
        Saat suhu turun malam hari, kelembaban relatif udara (RH) naik secara fisik.
        """
        hour_fraction = now.hour + now.minute / 60.0 + now.second / 3600.0

        if T_SUNRISE <= hour_fraction <= T_PEAK:
            tau = (hour_fraction - T_SUNRISE) / (T_PEAK - T_SUNRISE)
            factor = (1.0 - math.cos(tau * math.pi)) / 2.0
        else:
            dt = (hour_fraction - T_PEAK) if hour_fraction >= T_PEAK else (hour_fraction + 24.0 - T_PEAK)
            tau = dt / 16.0
            factor = (1.0 + math.cos((tau ** 0.7) * math.pi)) / 2.0

        return AMBIENT_HUM_MAX - (AMBIENT_HUM_MAX - AMBIENT_HUM_MIN) * factor

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
        Menerapkan hukum termodinamika realistis untuk exhaust fan dan misting nozzle.
        """
        now = get_wib_now()
        ambient_temp = self._get_ambient_temp(now)
        ambient_hum = self._get_ambient_hum(now)

        sum_t, sum_h = 0.0, 0.0

        for zone_id, zone_cfg in SENSOR_ZONES.items():
            s = self.sensors[zone_id]

            # Target ambient per zona = ambient pusat + offset zona
            zone_ambient_temp = ambient_temp + zone_cfg['temp_offset']
            zone_ambient_hum = ambient_hum + zone_cfg['hum_offset']

            # 1. Efek aktuator aktif (Termodinamika riil)
            # A. Misting (Pendinginan evaporatif dari kabut air halus)
            if self.is_misting_active:
                # Laju evaporasi berkurang jika udara mendekati titik jenuh (RH >= 95%)
                evap_potential = max(0.0, (95.0 - s['humidity']) / 95.0)
                # Batas suhu bola basah (wet-bulb): misting di iklim tropis lembab
                # tidak bisa mendinginkan lebih rendah dari ~2.0°C di bawah ambient
                wet_bulb_limit = zone_ambient_temp - 2.0
                temp_drop_headroom = max(0.0, s['temperature'] - wet_bulb_limit)

                s['temperature'] -= 0.02 * evap_potential * min(1.0, temp_drop_headroom / 1.5) * dt_seconds
                s['humidity'] += 0.20 * evap_potential * dt_seconds

            # B. Exhaust Fan (Konveksi paksa / pertukaran udara dengan luar)
            if self.is_fan_active:
                # Kipas hanya membuang akumulasi udara panas di atap kumbung ke luar ruangan.
                # Kipas BUKAN AC pendingin; kipas TIDAK BISA mendinginkan ruangan di bawah ambient luar!
                temp_excess = max(0.0, s['temperature'] - zone_ambient_temp)
                s['temperature'] -= temp_excess * 0.08 * dt_seconds

                # Udara dari luar masuk menarik kelembaban mendekati ambient luar
                hum_diff = s['humidity'] - zone_ambient_hum
                s['humidity'] -= hum_diff * 0.04 * dt_seconds

            # 2. Drift alami menuju kesetimbangan ambient zona
            temp_diff = zone_ambient_temp - s['temperature']
            hum_diff = zone_ambient_hum - s['humidity']
            s['temperature'] += temp_diff * TEMP_RECOVERY_RATE * dt_seconds
            s['humidity'] += hum_diff * HUM_RECOVERY_RATE * dt_seconds

            # 3. Sensor noise per zona (DHT22 accuracy: ±0.5°C, ±2%)
            s['temperature'] += random.gauss(0, zone_cfg['noise_temp'])
            s['humidity'] += random.gauss(0, zone_cfg['noise_hum'])

            # 4. Clamp ke batas fisik realistis
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
    parser = argparse.ArgumentParser(description="Smart Shroom IoT Simulator")
    parser.add_argument("--duration", type=int, default=0, help="Durasi simulasi dalam detik (0 = tanpa batas)")
    parser.add_argument("--interval", type=int, default=SENSOR_SEND_INTERVAL, help="Interval pengiriman data sensor (detik)")
    args = parser.parse_args()

    duration = args.duration
    send_interval = args.interval

    print("=" * 60)
    print("  🍄 Smart Shroom IoT Simulator v3.0 (Multi-Sensor)")
    print(f"  Device: {DEVICE_ID}")
    print(f"  Backend: {API_BASE_URL}")
    print(f"  Sensor: 3x DHT22 (Segitiga Diagonal)")
    if duration > 0:
        print(f"  Durasi: {duration}s ({round(duration/3600, 2)} jam)")
    print(f"  Interval Kirim: {send_interval}s")
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
    start_time = time.time()
    last_sensor_send = 0
    last_threshold_fetch = time.time()
    tick_count = 0

    try:
        while True:
            now = time.time()

            # Cek apakah durasi simulasi sudah tercapai
            if duration > 0 and (now - start_time) >= duration:
                print()
                print("=" * 60)
                print(f"  🏁 Durasi simulasi {duration} detik selesai.")
                temp, hum = state.get_readings()
                print(f"  Kondisi akhir: Suhu {temp}°C | RH {hum}%")
                print("=" * 60)
                break

            tick_count += 1
            timestamp = get_wib_now().strftime("%H:%M:%S WIB")

            # Simulasikan perubahan mikroklimat (interval 1 detik per tick)
            state.simulate_tick(dt_seconds=1.0)

            # Jalankan logika kontrol aktuator (setiap tick, seperti firmware)
            control_misting(state)
            control_fan(state)

            # Kirim data sensor ke API setiap send_interval detik
            if now - last_sensor_send >= send_interval:
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
