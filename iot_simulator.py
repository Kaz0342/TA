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
MISTING_COOLDOWN = 150          # Jeda wajib setelah misting OFF (detik) — waktu evaporasi & difusi kabut
POST_MISTING_FAN_DELAY = 60     # Jeda wajib setelah misting OFF sebelum fan boleh nyala (detik) — waktu kabut mengendap
FAN_HOMOGENIZE_COOLDOWN = 120   # Jeda wajib setelah fan homogenisasi OFF (detik) — relaksasi udara & sirkulasi
CRITICAL_TEMP_OFFSET = 2.0      # Safety Override: jika SATU sensor > tempMax + offset ini, paksa Fan ON

# Konstanta Night Mode (Malam Hari: 17:00 - 06:00 WIB)
NIGHT_START_HOUR = 17           # 17:00 WIB: Mulai mode malam (Misting lockout)
NIGHT_END_HOUR = 6              # 06:00 WIB: Selesai mode malam
NIGHT_FAN_DURATION = 45         # Durasi pasti nyala fan malam (detik)
NIGHT_FAN_PERIODIC_INTERVAL = 3600  # Tiap 60 menit (3600 detik) fan nyala 45s buat buang CO2
NIGHT_FAN_COOLDOWN = 1800       # Cooldown 30 menit (1800 detik) setelah over-humidity purge
NIGHT_OVER_HUMIDITY_THRESHOLD = 96.0  # Batas atas RH malam pemicu purge (96.0%)

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
# STOCHASTIC WEATHER GENERATOR (Model Rantai Markov Cuaca Musiman)
# ============================================================
# 4 Status Cuaca Stokastik dengan parameter termodinamika mikroklimat
WEATHER_STATES = {
    'CERAH_TERIK': {
        'label': '☀️ Cerah Terik (Panas)',
        'temp_shift': +1.8,    # Suhu luar naik, kumbung naik ~1.8°C
        'hum_shift': -6.0,     # RH turun ~6%
        'duration_min_sec': 120,   # 2 menit s.d. 5 menit dalam run real-time
        'duration_max_sec': 300,
    },
    'BERAWAN_MENDUNG': {
        'label': '⛅ Berawan / Mendung',
        'temp_shift': -0.8,    # Redup, suhu kumbung turun ~0.8°C
        'hum_shift': +4.0,     # RH naik ~4%
        'duration_min_sec': 90,
        'duration_max_sec': 240,
    },
    'HUJAN_SEDANG': {
        'label': '🌧️ Hujan Sedang',
        'temp_shift': -2.5,    # Hujan mendinginkan atap kumbung
        'hum_shift': +10.0,    # RH melonjak tinggi
        'duration_min_sec': 60,
        'duration_max_sec': 180,
    },
    'HUJAN_LEBAT': {
        'label': '⛈️ Hujan Lebat / Badai',
        'temp_shift': -3.8,    # Sangat dingin
        'hum_shift': +15.0,    # Mendekati titik jenuh 98-99%
        'duration_min_sec': 45,
        'duration_max_sec': 120,
    },
}

# Probabilitas Monsun Iklim Indonesia (khususnya wilayah Jawa/DIY)
SEASON_CONFIGS = {
    'MUSIM_HUJAN': {  # Des, Jan, Feb (DJF - Monsun Barat)
        'name': 'Musim Hujan (Monsun Barat)',
        'weights': {
            'CERAH_TERIK': 0.15,
            'BERAWAN_MENDUNG': 0.35,
            'HUJAN_SEDANG': 0.35,
            'HUJAN_LEBAT': 0.15,
        }
    },
    'MUSIM_KEMARAU': {  # Jun, Jul, Agu (JJA - Monsun Timur / Bediding)
        'name': 'Musim Kemarau (Monsun Timur)',
        'weights': {
            'CERAH_TERIK': 0.70,
            'BERAWAN_MENDUNG': 0.22,
            'HUJAN_SEDANG': 0.07,
            'HUJAN_LEBAT': 0.01,
        }
    },
    'PANCAROBA': {  # Mar, Apr, Mei & Sep, Okt, Nov
        'name': 'Musim Pancaroba (Transisi)',
        'weights': {
            'CERAH_TERIK': 0.45,
            'BERAWAN_MENDUNG': 0.30,
            'HUJAN_SEDANG': 0.20,
            'HUJAN_LEBAT': 0.05,
        }
    }
}


class WeatherGenerator:
    """Stochastic Weather Generator berbasis Rantai Markov & Iklim Musiman Indonesia."""

    def __init__(self, forced_weather: str = "auto", custom_month: int = 0):
        self.forced_weather = (forced_weather or "auto").lower()
        self.custom_month = custom_month

        now = get_wib_now()
        month = custom_month if (1 <= custom_month <= 12) else now.month

        if month in [12, 1, 2]:
            self.season_code = 'MUSIM_HUJAN'
        elif month in [6, 7, 8]:
            self.season_code = 'MUSIM_KEMARAU'
        else:
            self.season_code = 'PANCAROBA'

        self.season_name = SEASON_CONFIGS[self.season_code]['name']
        self.current_state = 'BERAWAN_MENDUNG'
        self.state_end_time = 0.0
        self.current_temp_shift = 0.0
        self.current_hum_shift = 0.0
        self.target_temp_shift = 0.0
        self.target_hum_shift = 0.0

        self._pick_initial_state()

    def _pick_initial_state(self):
        if self.forced_weather == "cerah":
            self.current_state = "CERAH_TERIK"
        elif self.forced_weather == "mendung":
            self.current_state = "BERAWAN_MENDUNG"
        elif self.forced_weather == "hujan":
            self.current_state = "HUJAN_SEDANG"
        elif self.forced_weather == "badai":
            self.current_state = "HUJAN_LEBAT"
        else:
            weights = SEASON_CONFIGS[self.season_code]['weights']
            states = list(weights.keys())
            probs = list(weights.values())
            self.current_state = random.choices(states, weights=probs, k=1)[0]

        cfg = WEATHER_STATES[self.current_state]
        self.target_temp_shift = cfg['temp_shift']
        self.target_hum_shift = cfg['hum_shift']
        self.current_temp_shift = self.target_temp_shift
        self.current_hum_shift = self.target_hum_shift
        duration = random.uniform(cfg['duration_min_sec'], cfg['duration_max_sec'])
        self.state_end_time = time.time() + duration

    def tick(self, dt_seconds: float):
        now = time.time()

        # Cek transisi state jika mode auto
        if self.forced_weather == "auto" and now >= self.state_end_time:
            weights = SEASON_CONFIGS[self.season_code]['weights']
            states = list(weights.keys())
            probs = list(weights.values())
            self.current_state = random.choices(states, weights=probs, k=1)[0]
            cfg = WEATHER_STATES[self.current_state]
            self.target_temp_shift = cfg['temp_shift']
            self.target_hum_shift = cfg['hum_shift']
            duration = random.uniform(cfg['duration_min_sec'], cfg['duration_max_sec'])
            self.state_end_time = now + duration

        # Inersia termal & kelembaban (transisi halus secara asimtotik)
        alpha_t = min(1.0, 0.03 * dt_seconds)
        alpha_h = min(1.0, 0.04 * dt_seconds)
        self.current_temp_shift += (self.target_temp_shift - self.current_temp_shift) * alpha_t
        self.current_hum_shift += (self.target_hum_shift - self.current_hum_shift) * alpha_h

    @property
    def current_weather_label(self) -> str:
        return WEATHER_STATES[self.current_state]['label']


# ============================================================
# STATE SIMULATOR
# ============================================================
class KumbungState:
    """State mikroklimat kumbung jamur dengan 3 sensor (Segitiga Diagonal)."""

    def __init__(self, weather_gen: WeatherGenerator = None):
        self.weather_gen = weather_gen or WeatherGenerator()

        # Inisialisasi dari kondisi ambient WIB saat ini
        now = get_wib_now()
        base_temp = self._get_ambient_temp(now) + self.weather_gen.current_temp_shift
        base_hum = self._get_ambient_hum(now) + self.weather_gen.current_hum_shift

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
        self.misting_trigger_reason = ""
        self.misting_last_stop_time = 0.0  # Timestamp terakhir misting dimatikan (untuk cooldown)
        self.fan_start_time = None
        self.fan_trigger_reason = ""
        self.fan_last_stop_time = 0.0  # Timestamp terakhir fan homogenisasi dimatikan (untuk cooldown)
        self.last_night_periodic_fan_time = 0.0  # Timestamp terakhir periodic CO2 flush malam
        self.last_night_purge_fan_time = 0.0     # Timestamp terakhir over-humidity purge malam
        self.is_night_fan = False                # Flag apakah fan sedang running di mode malam

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
        self.phase_mode = thresholds.get('phase_mode', 'fruiting')
        self.rh_trigger_low = self.hum_min
        self.rh_trigger_high = self.hum_max - 2.0

    def simulate_tick(self, dt_seconds: float):
        """
        Simulasikan perubahan mikroklimat selama dt_seconds untuk 3 sensor.
        Menerapkan hukum termodinamika realistis untuk exhaust fan dan misting nozzle.
        """
        # 0. Update state cuaca musiman stokastik
        self.weather_gen.tick(dt_seconds)

        now = get_wib_now()
        base_ambient_temp = self._get_ambient_temp(now)
        base_ambient_hum = self._get_ambient_hum(now)

        # Modifikasi cuaca stokastik (hujan, terik, mendung)
        ambient_temp = base_ambient_temp + self.weather_gen.current_temp_shift
        ambient_hum = base_ambient_hum + self.weather_gen.current_hum_shift

        # Batas fisik
        ambient_temp = max(TEMP_MIN_PHYSICAL, min(TEMP_MAX_PHYSICAL, ambient_temp))
        ambient_hum = max(HUM_MIN_PHYSICAL, min(HUM_MAX_PHYSICAL, ambient_hum))

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

        # 5. Hitung Rata-Rata Tertimbang (Weighted Sensor Fusion - Opsi 3)
        # Bobot: Sensor A (Atas/Pintu) = 0.35, Sensor B (Tengah/Pusat) = 0.40, Sensor C (Bawah/Pojok) = 0.25
        t_a = self.sensors['A']['temperature']
        t_b = self.sensors['B']['temperature']
        t_c = self.sensors['C']['temperature']
        h_a = self.sensors['A']['humidity']
        h_b = self.sensors['B']['humidity']
        h_c = self.sensors['C']['humidity']

        self.temperature = (0.35 * t_a) + (0.40 * t_b) + (0.25 * t_c)
        self.humidity = (0.35 * h_a) + (0.40 * h_b) + (0.25 * h_c)

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

    def get_hum_disparity(self) -> float:
        """Return selisih absolut kelembaban antara Sensor A (Atas) dan Sensor C (Bawah)."""
        return round(abs(self.sensors['A']['humidity'] - self.sensors['C']['humidity']), 1)

    def get_temp_disparity(self) -> float:
        """Return selisih absolut suhu antara Sensor A (Atas) dan Sensor C (Bawah)."""
        return round(abs(self.sensors['A']['temperature'] - self.sensors['C']['temperature']), 1)


# ============================================================
# KONTROL AKTUATOR (Opsi 3: Two-Tier Multi-Zone Control)
# ============================================================

def control_misting(state: KumbungState):
    """
    Logika Histeresis Misting dengan Safety Override (Opsi 3 Hibrida).
    - Tier 1 (Normal): NYALA jika RH rata-rata tertimbang < rhTriggerLow
    - Tier 2 (Safety Override): NYALA KILAT (Pulse 30s) jika SATU sensor drop < threshold - 4%
    - Safety Hold: TAHAN jika suhu panas TAPI RH sudah terlalu tinggi (cegah busuk)
    """
    temp, hum = state.get_readings()
    min_hum = state.get_min_hum()
    critical_low_rh = state.rh_trigger_low - 4.0

    now_dt = get_wib_now()
    hour = now_dt.hour
    is_night = (hour >= NIGHT_START_HOUR or hour < NIGHT_END_HOUR)

    if not state.is_misting_active:
        # 0. NIGHT LOCKOUT (17:00 - 06:00 WIB): Misting DILARANG nyala agar jamur tidak tidur basah kuyup
        if is_night:
            # Pengecualian darurat ekstrem: hanya boleh nyala jika RH anjlok < 75%
            if hum >= 75.0 and min_hum >= 75.0:
                return

        # Cooldown guard: cegah short-cycling sebelum kabut dari siklus sebelumnya evaporasi penuh
        if state.misting_last_stop_time > 0:
            elapsed_since_stop = time.time() - state.misting_last_stop_time
            if elapsed_since_stop < MISTING_COOLDOWN:
                remaining = int(MISTING_COOLDOWN - elapsed_since_stop)
                if int(elapsed_since_stop) % 30 == 0 and int(elapsed_since_stop) > 0:
                    print(f"   ⏳ [COOLDOWN] Pompa istirahat... {remaining}s tersisa (evaporasi kabut)")
                return

        # Pemicu 1: Tier 2 - Safety Override (Satu sensor kritis kekeringan, e.g. Rak Atas)
        if min_hum < critical_low_rh:
            # Safety check: jangan semprot kalau RH rata-rata sudah di atas hum_max
            if hum >= state.hum_max:
                print(f"   ⚠️  [HOLD] Sensor kritis ({min_hum}%) TAPI rata-rata kumbung basah ({hum}%). Pompa DITAHAN!")
                return
            state.is_misting_active = True
            state.is_pulse_misting = True
            state.misting_start_time = time.time()
            state.misting_duration_total = 0
            state.misting_trigger_reason = f"Safety Override: Sensor Terkering ({min_hum}% < {critical_low_rh:.1f}%)"
            print(f"   🚨 [SAFETY OVERRIDE] Pulse Misting AKTIF (30s) | Pemicu: {state.misting_trigger_reason}")
            return

        # Pemicu 2: Tier 1 - Kondisi Normal (Rata-rata tertimbang di bawah batas)
        if hum < state.rh_trigger_low or temp > state.temp_max:
            # Safety: jangan nyiram kalau RH udah tinggi banget
            if temp > state.temp_max and hum >= state.hum_max:
                print(f"   ⚠️  [HOLD] Suhu panas ({temp}°C) TAPI RH tinggi ({hum}%). Pompa DITAHAN!")
                return
            state.is_misting_active = True
            state.is_pulse_misting = False
            state.misting_start_time = time.time()
            state.misting_duration_total = 0

            if hum < state.rh_trigger_low and temp > state.temp_max:
                state.misting_trigger_reason = f"RH Rendah ({hum}% < {state.rh_trigger_low}%) & Suhu Panas ({temp}°C > {state.temp_max}°C)"
            elif hum < state.rh_trigger_low:
                state.misting_trigger_reason = f"Kelembaban Rendah ({hum}% < {state.rh_trigger_low}%)"
            else:
                state.misting_trigger_reason = f"Suhu Panas ({temp}°C > {state.temp_max}°C)"

            print(f"   💦 [MISTING ON] Pompa + Solenoid AKTIF | Pemicu: {state.misting_trigger_reason}")
    else:
        elapsed = time.time() - state.misting_start_time
        is_pulse = getattr(state, 'is_pulse_misting', False)

        # Pulse Misting timeout (maksimal 30 detik agar rak bawah tidak becek)
        if is_pulse and elapsed >= 30:
            state.is_misting_active = False
            state.is_pulse_misting = False
            state.misting_last_stop_time = time.time()
            state.misting_duration_total = int(elapsed)
            stop_reason = f"Pulse misting selesai (30s, Min RH: {min_hum}%)"
            print(f"   🛑 [MISTING OFF] {stop_reason}")
            send_actuator_log(state.misting_duration_total, state.misting_trigger_reason, stop_reason, "misting")
            return

        # Kondisi normal: trigger mati
        target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max)
        if target_reached:
            state.is_misting_active = False
            state.is_pulse_misting = False
            state.misting_last_stop_time = time.time()
            state.misting_duration_total = int(elapsed)
            stop_reason = f"Target tercapai (RH:{hum}% T:{temp}°C)"
            print(f"   🛑 [MISTING OFF] Durasi: {state.misting_duration_total}s — {stop_reason}")
            send_actuator_log(state.misting_duration_total, state.misting_trigger_reason, stop_reason, "misting")

        elif elapsed >= MAX_MISTING_DURATION:
            state.is_misting_active = False
            state.is_pulse_misting = False
            state.misting_last_stop_time = time.time()
            state.misting_duration_total = MAX_MISTING_DURATION
            stop_reason = f"Safety timeout ({MAX_MISTING_DURATION}s)"
            print(f"   🛑 [MISTING OFF] TIMEOUT! Durasi: {MAX_MISTING_DURATION}s — {stop_reason}")
            send_actuator_log(MAX_MISTING_DURATION, state.misting_trigger_reason, stop_reason, "misting")


def control_fan(state: KumbungState):
    """
    Logika Exhaust Fan dengan Homogenisasi Udara (Opsi 3 Hibrida).
    - Tier 1: NYALA jika suhu rata-rata tertimbang > tempMax (buang panas)
    - Tier 2: NYALA PAKSA jika SATU sensor > tempMax + CRITICAL_TEMP_OFFSET (Safety Override)
    - Tier 3: NYALA KILAT (30s) jika disparitas RH |A - C| > 8.0% (Homogenisasi / aduk udara)
    """
    temp, hum = state.get_readings()
    max_temp = state.get_max_temp()
    hum_disparity = state.get_hum_disparity()
    critical_threshold = state.temp_max + CRITICAL_TEMP_OFFSET

    now_dt = get_wib_now()
    hour = now_dt.hour
    is_night = (hour >= NIGHT_START_HOUR or hour < NIGHT_END_HOUR)

    # 1. Tier 2: Safety Override Suhu Kritis Atas (BYPASS SEMUA DELAY & COOLDOWN!)
    if max_temp > critical_threshold:
        if not state.is_fan_active:
            state.is_fan_active = True
            state.is_homogenizing = False
            state.is_night_fan = False
            state.fan_start_time = time.time()
            state.fan_trigger_reason = f"Safety Override (Sensor Max {max_temp}°C > {critical_threshold}°C)"
            print(f"   🚨 [SAFETY OVERRIDE] Fan PAKSA ON! Sensor tertinggi {max_temp}°C > batas kritis {critical_threshold}°C")
        return

    # 2. Settling Delay Guard: Fan dilarang nyala jika misting baru mati < 60 detik lalu
    # Memberi waktu kabut mikro mendarat di baglog dan tidak tersedot keluar
    if state.misting_last_stop_time > 0:
        elapsed_misting_stop = time.time() - state.misting_last_stop_time
        if elapsed_misting_stop < POST_MISTING_FAN_DELAY:
            return

    # 3. NIGHT MODE FAN (17:00 - 06:00 WIB)
    if is_night:
        # Jika sedang aktif siklus fan malam (durasi pasti 45s)
        if getattr(state, 'is_night_fan', False):
            elapsed = time.time() - (state.fan_start_time or time.time())
            if elapsed >= NIGHT_FAN_DURATION:
                state.is_fan_active = False
                state.is_night_fan = False
                state.fan_last_stop_time = time.time()
                stop_reason = f"Night ventilation selesai {NIGHT_FAN_DURATION}s (RH: {hum}%)"
                print(f"   🌙 [NIGHT FAN OFF] {stop_reason}")
                send_actuator_log(int(elapsed), state.fan_trigger_reason, stop_reason, "fan")
                return
            return

        if not state.is_fan_active and not state.is_misting_active:
            now_ts = time.time()

            # Pemicu Malam 1: Over-Humidity Purge (RH >= 96.0%, Cooldown 30 menit)
            if hum >= NIGHT_OVER_HUMIDITY_THRESHOLD:
                if (now_ts - state.last_night_purge_fan_time) >= NIGHT_FAN_COOLDOWN:
                    state.is_fan_active = True
                    state.is_night_fan = True
                    state.is_homogenizing = False
                    state.fan_start_time = now_ts
                    state.last_night_purge_fan_time = now_ts
                    state.fan_trigger_reason = f"Night Over-Humidity Purge (RH {hum}% >= {NIGHT_OVER_HUMIDITY_THRESHOLD}%)"
                    print(f"   🌙 [NIGHT FAN ON] Over-Humidity Purge (45s) | Pemicu: RH {hum}% >= {NIGHT_OVER_HUMIDITY_THRESHOLD}%")
                    return

            # Pemicu Malam 2: Periodic CO2 Flush (Tiap 60 Menit sekali)
            if state.last_night_periodic_fan_time == 0.0:
                state.last_night_periodic_fan_time = now_ts
            elif (now_ts - state.last_night_periodic_fan_time) >= NIGHT_FAN_PERIODIC_INTERVAL:
                state.is_fan_active = True
                state.is_night_fan = True
                state.is_homogenizing = False
                state.fan_start_time = now_ts
                state.last_night_periodic_fan_time = now_ts
                state.fan_trigger_reason = "Night Periodic CO2 Flush (Siklus 60 Menit)"
                print(f"   🌙 [NIGHT FAN ON] Periodic CO2 Flush (45s) | Siklus 60 Menit")
                return

        # Di malam hari, tidak menjalankan daytime temperature/homogenize triggers
        return

    # 4. DAYTIME LOGIC (06:00 - 17:00 WIB)
    # A. Tier 3: Homogenisasi Mikroklimat (Aduk udara jika disparitas > 8%)
    is_homo = getattr(state, 'is_homogenizing', False)
    if is_homo:
        elapsed = time.time() - (state.fan_start_time or time.time())
        if elapsed >= 30:
            state.is_fan_active = False
            state.is_homogenizing = False
            state.fan_last_stop_time = time.time()
            stop_reason = f"Homogenisasi selesai 30s (Disparitas: {hum_disparity}%)"
            print(f"   🌀 [FAN OFF] {stop_reason}")
            send_actuator_log(int(elapsed), state.fan_trigger_reason, stop_reason, "fan")
            return
        return

    # Cooldown guard khusus untuk Homogenisasi (cegah short-cycling relay fan)
    can_homogenize = True
    if state.fan_last_stop_time > 0:
        elapsed_since_fan_stop = time.time() - state.fan_last_stop_time
        if elapsed_since_fan_stop < FAN_HOMOGENIZE_COOLDOWN:
            can_homogenize = False
            if int(elapsed_since_fan_stop) % 30 == 0 and int(elapsed_since_fan_stop) > 0:
                remaining = int(FAN_HOMOGENIZE_COOLDOWN - elapsed_since_fan_stop)
                print(f"   ⏳ [FAN COOLDOWN] Kipas istirahat... {remaining}s tersisa (relaksasi sirkulasi)")

    if not state.is_fan_active and not state.is_misting_active and can_homogenize and hum_disparity > 8.0:
        state.is_fan_active = True
        state.is_homogenizing = True
        state.fan_start_time = time.time()
        state.fan_trigger_reason = f"Homogenisasi Sirkulasi (Disparitas RH {hum_disparity}% > 8.0%)"
        print(f"   🔄 [FAN HOMOGENISASI] Sirkulasi Aktif (30s) | Pemicu: Disparitas RH {hum_disparity}% > 8.0%")
        return

    # B. Tier 1: Logika normal siang hari (pakai rata-rata tertimbang)
    if temp > state.temp_max:
        if not state.is_fan_active:
            state.is_fan_active = True
            state.is_homogenizing = False
            state.fan_start_time = time.time()
            state.fan_trigger_reason = f"Suhu Tinggi (Avg {temp}°C > {state.temp_max}°C)"
            print(f"   🌀 [FAN ON] Exhaust Fan AKTIF (Suhu avg {temp}°C > {state.temp_max}°C)")
    elif temp <= state.temp_min:
        if state.is_fan_active and not is_homo:
            state.is_fan_active = False
            state.fan_last_stop_time = time.time()
            duration = int(time.time() - (state.fan_start_time or time.time()))
            stop_reason = f"Suhu normal (Avg {temp}°C <= {state.temp_min}°C)"
            print(f"   🌀 [FAN OFF] Exhaust Fan MATI (Suhu avg {temp}°C <= {state.temp_min}°C)")
            send_actuator_log(max(1, duration), state.fan_trigger_reason or "Suhu Tinggi", stop_reason, "fan")


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
                'temp_max': float(data.get('temp_max', 32.0)),
                'temp_min': float(data.get('temp_min', 24.0)),
                'humidity_min': float(data.get('humidity_min', 80.0)),
                'humidity_max': float(data.get('humidity_max', 95.0)),
                'phase_mode': data.get('phase_mode', 'fruiting')
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


def send_actuator_log(duration: int, trigger_reason: str, stop_reason: str, actuator: str = "misting"):
    """POST /api/sprinkler-logs — kirim log aktivitas aktuator (misting / fan)."""
    payload = {
        "device_id": DEVICE_ID,
        "actuator": actuator,
        "duration_seconds": duration,
        "trigger_reason": trigger_reason,
        "stop_reason": stop_reason
    }
    try:
        response = requests.post(f"{API_BASE_URL}/sprinkler-logs", json=payload, timeout=10)
        if response.status_code != 201:
            print(f"   ❌ Gagal kirim actuator log: HTTP {response.status_code}")
    except Exception as e:
        print(f"   ⚠️  Error kirim actuator log: {e}")

# Backward compatibility alias
send_sprinkler_log = send_actuator_log


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
    global API_BASE_URL
    parser = argparse.ArgumentParser(description="Smart Shroom IoT Simulator")
    parser.add_argument("--duration", type=int, default=0, help="Durasi simulasi dalam detik (0 = tanpa batas)")
    parser.add_argument("--interval", type=int, default=SENSOR_SEND_INTERVAL, help="Interval pengiriman data sensor (detik)")
    parser.add_argument("--local", action="store_true", help="Gunakan backend lokal (http://127.0.0.1:8000/api)")
    parser.add_argument("--api", type=str, default="", help="Custom API Base URL")
    parser.add_argument("--weather", type=str, default="auto", choices=["auto", "cerah", "mendung", "hujan", "badai"], help="Paksa status cuaca simulasi (default: auto berdasarkan bulan & musim)")
    parser.add_argument("--month", type=int, default=0, help="Simulasikan bulan tertentu (1-12, misal 1=Januari [Hujan], 7=Juli [Kemarau])")
    args = parser.parse_args()

    if args.local:
        API_BASE_URL = "http://127.0.0.1:8000/api"
    elif args.api:
        API_BASE_URL = args.api.rstrip("/")

    duration = args.duration
    send_interval = args.interval

    # Inisialisasi Weather Generator (Stochastic Markov Chain)
    weather_gen = WeatherGenerator(forced_weather=args.weather, custom_month=args.month)

    print("=" * 60)
    print("  🍄 Smart Shroom IoT Simulator v3.5 (Seasonal Stochastic)")
    print(f"  Device: {DEVICE_ID}")
    print(f"  Backend: {API_BASE_URL}")
    print(f"  Sensor: 3x DHT22 (Segitiga Diagonal)")
    print(f"  🌦️  Musim: {weather_gen.season_name} ({weather_gen.season_code})")
    print(f"  🌤️  Status Cuaca: {weather_gen.current_weather_label}")
    if args.weather != "auto":
        print(f"       ⚠️  Mode Cuaca Manual: {args.weather.upper()}")
    if args.month > 0:
        print(f"       ⚠️  Bulan Simulasi: {args.month}")
    if duration > 0:
        print(f"  Durasi: {duration}s ({round(duration/3600, 2)} jam)")
    print(f"  Interval Kirim: {send_interval}s")
    print("=" * 60)
    print()

    # Inisialisasi state kumbung
    state = KumbungState(weather_gen=weather_gen)
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
        phase_label = thresholds.get('phase_mode', 'fruiting').upper()
        print(f"   ✅ Threshold: T={state.temp_min}-{state.temp_max}°C | RH={state.hum_min}-{state.hum_max}% | FASE={phase_label}")
    else:
        print(f"   ⚠️  Menggunakan threshold default (Fase Fruiting)")
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
                weather_info = f"{state.weather_gen.current_weather_label} (ΔT: {state.weather_gen.current_temp_shift:+.1f}°C, ΔRH: {state.weather_gen.current_hum_shift:+.1f}%)"
                print(f"   {status} AVG → API: Suhu {temp}°C | RH {hum}% | {weather_info}")

                # Tampilkan LCD virtual
                print_lcd(temp, hum, state.is_misting_active, state.is_fan_active)

                # Status aktuator
                actuators = []
                if state.is_misting_active:
                    elapsed = int(now - state.misting_start_time)
                    actuators.append(f"💦 Misting: ON ({elapsed}s/{MAX_MISTING_DURATION}s)")
                elif state.misting_last_stop_time > 0:
                    cooldown_elapsed = int(now - state.misting_last_stop_time)
                    if cooldown_elapsed < MISTING_COOLDOWN:
                        remaining = MISTING_COOLDOWN - cooldown_elapsed
                        actuators.append(f"⏳ Misting: COOLDOWN ({remaining}s/{MISTING_COOLDOWN}s)")
                if state.is_fan_active:
                    actuators.append("🌀 Fan: ON")
                elif state.fan_last_stop_time > 0:
                    fan_cooldown_elapsed = int(now - state.fan_last_stop_time)
                    if fan_cooldown_elapsed < FAN_HOMOGENIZE_COOLDOWN:
                        rem_fan = FAN_HOMOGENIZE_COOLDOWN - fan_cooldown_elapsed
                        actuators.append(f"⏳ Fan: COOLDOWN ({rem_fan}s/{FAN_HOMOGENIZE_COOLDOWN}s)")
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
