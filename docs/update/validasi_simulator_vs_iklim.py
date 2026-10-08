#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validasi_simulator_vs_iklim.py  -  cek generator "ambient" iot_simulator.py terhadap data iklim lokasi

Data pembanding : normal iklim 1991-2020 Muntilan (proksi Salam/Jumoyo, Magelang, +-400 mdpl),
                  dari file analisis_iklim_jamur_kuping_koordinat_-7.60555_110.31122.md
Yang dicek      : (1) suhu min/maks harian & RH harian  (2) konsistensi psikrometrik (titik embun, kelembapan absolut)
                  (3) sifat "free-float" kumbung saat aktuator mati  (4) arti fisik koefisien kipas / recovery / misting
Cara kerja      : simulator dijalankan headless dengan jam palsu (1 iterasi = 1 detik simulasi, tanpa sleep, tanpa network).
                  File iot_simulator.py asli TIDAK diubah.

Pemakaian (dari root repo):
    python validasi_simulator_vs_iklim.py --part all
    python validasi_simulator_vs_iklim.py --part ambient --days 2 --seeds 2   # ukur ambient file --sim (asli ATAU yang sudah ditambal S1; terdeteksi otomatis)
    python validasi_simulator_vs_iklim.py --part recon          # ambient "yang seharusnya" dari data (tanpa simulator)
    python validasi_simulator_vs_iklim.py --part patched        # uji tambalan kalibrasi ambient (usulan S1)
    python validasi_simulator_vs_iklim.py --emit-s1 iot_simulator_S1.py   # tulis salinan simulator bertambalan S1 (asli tidak diubah)

Hanya stdlib. Python >= 3.9.
"""
import argparse
import contextlib
import datetime
import importlib.util
import io
import math
import os
import random
import statistics
import sys
import tempfile
import time as _time

# ----------------------------------------------------------------------------------------------------------
# DATA IKLIM  (bulan: Tmin, Tmean, Tmax, hujan mm, RH %)  - tabel §2 dan §3 file analisis iklim
# ----------------------------------------------------------------------------------------------------------
CLIM = {
    1: (20.2, 24.1, 27.9, 400.4, 80), 2: (20.1, 24.2, 28.2, 390.1, 81), 3: (20.4, 24.5, 28.6, 399.3, 79),
    4: (20.8, 24.8, 28.7, 297.2, 77), 5: (20.6, 24.7, 28.7, 193.3, 72), 6: (19.7, 24.1, 28.6, 117.4, 71),
    7: (18.9, 23.5, 28.0, 50.1, 70), 8: (18.9, 23.6, 28.2, 37.2, 70), 9: (19.7, 24.1, 28.5, 66.1, 71),
    10: (20.6, 24.8, 29.0, 157.1, 75), 11: (20.6, 24.5, 28.4, 313.5, 79), 12: (20.3, 24.1, 27.8, 406.0, 80),
}
MONTH_ID = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
VOLUME_M3 = 122.5          # 5 m x 7 m x 3.5 m (docstring & komentar iot_simulator.py)
RAIN_STATES = {"HUJAN_SEDANG", "HUJAN_LEBAT", "HUJAN_MALAM"}


# ----------------------------------------------------------------------------------------------------------
# PSIKROMETRI (Magnus; hPa, g/m3)
# ----------------------------------------------------------------------------------------------------------
def es(t):
    """tekanan uap jenuh (hPa)"""
    return 6.112 * math.exp(17.62 * t / (243.12 + t))


def dewpoint(t, rh):
    g = math.log(max(rh, 1e-3) / 100.0) + 17.62 * t / (243.12 + t)
    return 243.12 * g / (17.62 - g)


def abs_hum(t, rh):
    """kelembapan absolut (g/m3)"""
    return 216.7 * (rh / 100.0 * es(t)) / (t + 273.15)


def rho_sat(t):
    return abs_hum(t, 100.0)


# ----------------------------------------------------------------------------------------------------------
# JAM PALSU + LOADER SIMULATOR
# ----------------------------------------------------------------------------------------------------------
class FakeClock:
    """Ganti time.time() dan sim.get_wib_now() dengan jam yang kita putar sendiri."""

    def __init__(self, sim, month=1, day=10, hour=0, minute=0, year=2026):
        self.sim = sim
        self.t0 = datetime.datetime(year, month, day, hour, minute, 0, tzinfo=sim.WIB).timestamp()
        self.t = self.t0

    def __enter__(self):
        self._real = _time.time
        _time.time = lambda: self.t
        self.sim.get_wib_now = lambda: datetime.datetime.fromtimestamp(self.t, tz=self.sim.WIB)
        return self

    def __exit__(self, *exc):
        _time.time = self._real
        return False


def load_sim(path, patches=()):
    """Import iot_simulator.py tanpa menjalankan main(). patches = [(old, new), ...] (string-replace, harus unik)."""
    src = open(path, encoding="utf-8").read()
    for old, new in patches:
        n = src.count(old)
        assert n == 1, f"anchor patch ditemukan {n}x (harus 1x): {old[:60]!r}"
        src = src.replace(old, new)
    fd, tmp = tempfile.mkstemp(suffix=".py", prefix="sim_variant_")
    os.close(fd)
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(src)
    spec = importlib.util.spec_from_file_location(os.path.basename(tmp)[:-3], tmp)
    mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(mod)
    os.remove(tmp)
    return mod


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def is_s1(sim):
    """True bila modul simulator ini SUDAH memuat tambalan S1 (WeatherGenerator.ambient)."""
    return hasattr(sim.WeatherGenerator, "ambient")


def amb_now(sim, wg, now):
    """Udara luar (suhu, RH) yang benar-benar dipakai simulate_tick() pada modul ini:
    - file sudah ditambal S1 -> wg.ambient(now)
    - file asli v3.5         -> kurva dasar _get_ambient_* + pergeseran state cuaca"""
    if is_s1(sim):
        return wg.ambient(now)
    return (sim.KumbungState._get_ambient_temp(now) + wg.current_temp_shift,
            sim.KumbungState._get_ambient_hum(now) + wg.current_hum_shift)


# ----------------------------------------------------------------------------------------------------------
# REKONSTRUKSI AMBIENT DARI DATA (titik embun konstan) - dipakai juga oleh simulasi_amplop_kumbung.py
# ----------------------------------------------------------------------------------------------------------
def diurnal_factor(h, t_sr=6.0, t_pk=14.0):
    """Bentuk siklus harian ala simulator (naik setengah-cosinus, turun pelan ber-pangkat 0.7). 0 = Tmin, 1 = Tmax."""
    h = h % 24.0
    if t_sr <= h <= t_pk:
        tau = (h - t_sr) / (t_pk - t_sr)
        return (1.0 - math.cos(tau * math.pi)) / 2.0
    dt = (h - t_pk) if h >= t_pk else (h + 24.0 - t_pk)
    tau = dt / (24.0 - (t_pk - t_sr))
    return (1.0 + math.cos((tau ** 0.7) * math.pi)) / 2.0


def t_profile(month, h, t_sr=6.0, t_pk=14.0):
    tmin, _, tmax, _, _ = CLIM[month]
    return tmin + (tmax - tmin) * diurnal_factor(h, t_sr, t_pk)


def solve_dewpoint(month, t_sr=6.0, t_pk=14.0, step=0.1):
    """Titik embun konstan Td sehingga rata-rata RH harian (RH dipotong 100%) = RH bulanan data."""
    target = CLIM[month][4]
    ts = [t_profile(month, i * step, t_sr, t_pk) for i in range(int(24 / step))]

    def mean_rh(td):
        return sum(min(100.0, 100.0 * es(min(td, t)) / es(t)) for t in ts) / len(ts)

    lo, hi = -5.0, 30.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if mean_rh(mid) < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def recon_day(month, t_sr=6.0, t_pk=14.0):
    """Hari tipikal bulan itu: fungsi jam -> (T, RH, Td_efektif). Td konstan (dipotong T bila T < Td)."""
    td = solve_dewpoint(month, t_sr, t_pk)

    def at(h):
        t = t_profile(month, h, t_sr, t_pk)
        tde = min(td, t)
        return t, min(100.0, 100.0 * es(tde) / es(t)), tde

    return td, at


# ----------------------------------------------------------------------------------------------------------
# BAGIAN 1 - AMBIENT SIMULATOR vs DATA
# ----------------------------------------------------------------------------------------------------------
def run_ambient(sim, month, days=2, seed=1, rec_every=60, ambient_fn=None):
    """Putar WeatherGenerator + kurva diurnal persis seperti simulate_tick(), catat ambient tiap rec_every detik."""
    random.seed(seed)
    rows = []
    rerolls = changes = 0
    with FakeClock(sim, month=month) as ck:
        wg = sim.WeatherGenerator(forced_weather="auto", custom_month=month)
        prev_end, prev_state = wg.state_end_time, wg.current_state
        for i in range(days * 86400):
            ck.t += 1.0
            wg.tick(1.0)
            if wg.state_end_time != prev_end:
                rerolls += 1
                prev_end = wg.state_end_time
                if wg.current_state != prev_state:
                    changes += 1
                prev_state = wg.current_state
            if i % rec_every == 0:
                now = sim.get_wib_now()
                if ambient_fn is None:      # ambient yang dipakai modul itu sendiri (v3.5 asli ATAU S1 bila file sudah ditambal)
                    t, h = amb_now(sim, wg, now)
                else:                       # varian tertambal di memori (--part patched): pakai metode ambient()-nya sendiri
                    t, h = ambient_fn(wg, now)
                t = clamp(t, sim.TEMP_MIN_PHYSICAL, sim.TEMP_MAX_PHYSICAL)
                h = clamp(h, sim.HUM_MIN_PHYSICAL, sim.HUM_MAX_PHYSICAL)
                rows.append((i // 86400, now.hour + now.minute / 60.0, t, h, wg.current_state in RAIN_STATES))
    return rows, rerolls / days, changes / days


def daily_stats(rows, days):
    out = []
    for d in range(days):
        r = [x for x in rows if x[0] == d]
        ts = [x[2] for x in r]
        hs = [x[3] for x in r]
        td = [dewpoint(x[2], x[3]) for x in r]
        out.append(dict(tmin=min(ts), tmax=max(ts), rh=statistics.mean(hs), rhmin=min(hs), rhmax=max(hs),
                        rain=100.0 * sum(x[4] for x in r) / len(r), td_rng=max(td) - min(td)))
    return out


def part_ambient(sim, days, seeds, ambient_fn=None):
    print(f"\n== AMBIENT simulator vs data iklim  ({days} hari x {seeds} seed per bulan; 1 s/iterasi) ==")
    hdr = (f"{'bln':<4}{'Tmin data':>10}{'sim':>6}{'d':>6}{'Tmax data':>10}{'sim':>6}{'d':>6}"
           f"{'rentang data':>13}{'sim':>6}{'RH data':>9}{'sim':>6}{'d':>7}{'RHmin':>7}{'RHmax':>7}"
           f"{'hujan%':>8}{'re-roll/hari':>13}{'ganti/hari':>11}")
    print(hdr)
    agg = {k: [] for k in ("dtmin", "dtmax", "rng_sim", "rng_dat", "drh", "rain")}
    for m in range(1, 13):
        stats, rr, ch = [], [], []
        for s in range(seeds):
            rows, r, c = run_ambient(sim, m, days=days, seed=100 * m + s, ambient_fn=ambient_fn)
            stats += daily_stats(rows, days)
            rr.append(r)
            ch.append(c)
        tmin = statistics.mean(x["tmin"] for x in stats)
        tmax = statistics.mean(x["tmax"] for x in stats)
        rh = statistics.mean(x["rh"] for x in stats)
        rhmin = statistics.mean(x["rhmin"] for x in stats)
        rhmax = statistics.mean(x["rhmax"] for x in stats)
        rain = statistics.mean(x["rain"] for x in stats)
        d_tmin, d_tmax, _, _, rhd = CLIM[m][0], CLIM[m][2], None, None, CLIM[m][4]
        print(f"{MONTH_ID[m]:<4}{d_tmin:>10.1f}{tmin:>6.1f}{tmin - d_tmin:>+6.1f}{d_tmax:>10.1f}{tmax:>6.1f}{tmax - d_tmax:>+6.1f}"
              f"{d_tmax - d_tmin:>13.1f}{tmax - tmin:>6.1f}{rhd:>9.0f}{rh:>6.1f}{rh - rhd:>+7.1f}{rhmin:>7.0f}{rhmax:>7.0f}"
              f"{rain:>8.1f}{statistics.mean(rr):>13.0f}{statistics.mean(ch):>11.0f}", flush=True)
        agg["dtmin"].append(tmin - d_tmin)
        agg["dtmax"].append(tmax - d_tmax)
        agg["rng_sim"].append(tmax - tmin)
        agg["rng_dat"].append(d_tmax - d_tmin)
        agg["drh"].append(rh - rhd)
        agg["rain"].append(rain)
    print(f"{'rata2':<4}{'':>10}{'':>6}{statistics.mean(agg['dtmin']):>+6.1f}{'':>10}{'':>6}{statistics.mean(agg['dtmax']):>+6.1f}"
          f"{statistics.mean(agg['rng_dat']):>13.1f}{statistics.mean(agg['rng_sim']):>6.1f}{'':>9}{'':>6}{statistics.mean(agg['drh']):>+7.1f}")
    print("  d = sim - data. 'hujan%' = % waktu berada di state hujan; 're-roll/hari' = berapa kali state cuaca diundi ulang per hari; 'ganti/hari' = yang hasilnya state berbeda.")
    # pemetaan musim
    print("\n  Pemetaan musim simulator vs curah hujan data (ambang praktis: basah >= 250 mm, kering < 130 mm):")
    print(f"  {'bln':<4}{'hujan mm':>9}  {'musim simulator':<16}{'musim menurut data':<20}{'cocok?':>7}")
    for m in range(1, 13):
        with FakeClock(sim, month=m):
            sm = sim.WeatherGenerator(forced_weather="auto", custom_month=m).season_code
        rain = CLIM[m][3]
        dm = "MUSIM_HUJAN" if rain >= 250 else ("MUSIM_KEMARAU" if rain < 130 else "PANCAROBA")
        print(f"  {MONTH_ID[m]:<4}{rain:>9.0f}  {sm:<16}{dm:<20}{'ya' if sm == dm else 'TIDAK':>7}")


# ----------------------------------------------------------------------------------------------------------
# BAGIAN 2 - PSIKROMETRI: apakah kurva ambient simulator masuk akal secara fisika?
# ----------------------------------------------------------------------------------------------------------
def part_psikro(sim):
    if is_s1(sim):
        print("\n== PSIKROMETRI dilewati: file ini sudah memuat tambalan S1; kurva dasar _get_ambient_* tidak dipakai lagi "
              "(ambient S1 diukur oleh --part ambient). ==")
        return
    print("\n== PSIKROMETRI kurva dasar simulator (tanpa pergeseran cuaca) ==")
    print(f"  AMBIENT_TEMP {sim.AMBIENT_TEMP_MIN}-{sim.AMBIENT_TEMP_MAX} C, AMBIENT_HUM {sim.AMBIENT_HUM_MIN}-{sim.AMBIENT_HUM_MAX} %")
    print(f"  {'jam':>6}{'T':>7}{'RH':>7}{'titik embun':>13}{'abs. humid g/m3':>17}")
    tds, ahs = [], []
    for hh in (5.5, 7.0, 9.0, 11.0, 13.5, 15.0, 17.0, 19.0, 21.0, 23.0, 3.0):
        now = datetime.datetime(2026, 7, 15, int(hh), int(round((hh % 1) * 60)), tzinfo=sim.WIB)
        t = sim.KumbungState._get_ambient_temp(now)
        h = sim.KumbungState._get_ambient_hum(now)
        td, ah = dewpoint(t, h), abs_hum(t, h)
        tds.append(td)
        ahs.append(ah)
        print(f"  {hh:>6.1f}{t:>7.1f}{h:>7.1f}{td:>13.1f}{ah:>17.1f}")
    d_ah = max(ahs) - min(ahs)
    print(f"  -> titik embun bergeser {min(tds):.1f} -> {max(tds):.1f} C ({max(tds) - min(tds):.1f} K) dalam sehari; "
          f"kelembapan absolut {min(ahs):.1f} -> {max(ahs):.1f} g/m3.")
    print(f"  -> selisih {d_ah:.1f} g/m3 x {VOLUME_M3} m3 = {d_ah * VOLUME_M3 / 1000:.2f} kg air yang 'muncul' dari udara luar "
          f"antara subuh dan siang tanpa sumber (hujan tidak dihitung).")
    print("  Pembanding: udara luar tropis biasanya menjaga titik embun hampir konstan sepanjang hari (+-1-2 K).")
    print("\n  Rekonstruksi dari data (titik embun konstan), bulan Jan / Jul / Okt:")
    print(f"  {'bln':<5}{'Td':>6}{'RH subuh':>10}{'RH 14:00':>10}{'T subuh':>9}{'T 14:00':>9}")
    for m in (1, 7, 10):
        td, at = recon_day(m)
        t6, r6, _ = at(6.0)
        t14, r14, _ = at(14.0)
        print(f"  {MONTH_ID[m]:<5}{td:>6.1f}{r6:>10.0f}{r14:>10.0f}{t6:>9.1f}{t14:>9.1f}")


def part_recon():
    print("\n== AMBIENT 'YANG SEHARUSNYA' (rekonstruksi dari tabel iklim, titik embun konstan) ==")
    print(f"  {'bln':<4}{'Tmin':>6}{'Tmax':>6}{'RH rata2':>9}{'Td':>6}{'RH min (siang)':>16}{'RH maks (subuh)':>17}{'jam RH<85%':>12}{'jam RH<70%':>12}")
    for m in range(1, 13):
        td, at = recon_day(m)
        pts = [(h / 4.0, at(h / 4.0)) for h in range(96)]
        rhs = [p[1][1] for p in pts]
        print(f"  {MONTH_ID[m]:<4}{CLIM[m][0]:>6.1f}{CLIM[m][2]:>6.1f}{CLIM[m][4]:>9.0f}{td:>6.1f}{min(rhs):>16.0f}{max(rhs):>17.0f}"
              f"{sum(r < 85 for r in rhs) / 4:>12.1f}{sum(r < 70 for r in rhs) / 4:>12.1f}")


# ----------------------------------------------------------------------------------------------------------
# BAGIAN 3 - FREE-FLOAT: aktuator mati, seberapa "kumbung" kah state internalnya?
# ----------------------------------------------------------------------------------------------------------
def run_freefloat(sim, month=7, weather="mendung", days=3, seed=3):
    random.seed(seed)
    ser = []
    with FakeClock(sim, month=month) as ck:
        wg = sim.WeatherGenerator(forced_weather=weather, custom_month=month)
        st = sim.KumbungState(weather_gen=wg)
        for i in range(days * 86400):
            ck.t += 1.0
            st.simulate_tick(1.0)
            if i % 60 == 0:
                now = sim.get_wib_now()
                ta, ha = amb_now(sim, wg, now)
                ta = clamp(ta, sim.TEMP_MIN_PHYSICAL, sim.TEMP_MAX_PHYSICAL)
                ha = clamp(ha, sim.HUM_MIN_PHYSICAL, sim.HUM_MAX_PHYSICAL)
                ser.append((i // 86400, ta, ha, st.temperature, st.humidity))
    return ser


def _harmonic(series, period_samples):
    """koefisien Fourier kompleks pada frekuensi 1/hari untuk deret ber-sampling 1 menit"""
    n = len(series)
    re_ = sum(v * math.cos(2 * math.pi * i / period_samples) for i, v in enumerate(series)) * 2 / n
    im_ = -sum(v * math.sin(2 * math.pi * i / period_samples) for i, v in enumerate(series)) * 2 / n
    return complex(re_, im_)


def part_freefloat(sim):
    print("\n== FREE-FLOAT (Misting & Fan mati; cuaca 'cerah' dipaksa supaya ambient mulus; analisis hari ke-2 & ke-3) ==")
    print(f"  {'bln':<4}{'dT rata2 (in-amb)':>19}{'dRH rata2':>11}{'rasio amplitudo T':>19}{'rasio amplitudo RH':>20}{'lag T (mnt)':>12}{'lag RH (mnt)':>13}")
    for m in (1, 7):
        ser = run_freefloat(sim, month=m, weather="cerah", days=3)
        win = [x for x in ser if x[0] >= 1]            # tepat 2 hari, sampling 1 menit
        per = 1440.0
        res = []
        for ia, ib in ((1, 3), (2, 4)):
            a = _harmonic([x[ia] for x in win], per)
            b = _harmonic([x[ib] for x in win], per)
            ratio = abs(b) / abs(a)
            lag = ((math.atan2(a.imag, a.real) - math.atan2(b.imag, b.real)) % (2 * math.pi)) / (2 * math.pi) * 1440.0
            if lag > 720:
                lag -= 1440.0
            res.append((ratio, lag))
        d3 = [x for x in ser if x[0] == 2]
        dt = statistics.mean(x[3] - x[1] for x in d3)
        dh = statistics.mean(x[4] - x[2] for x in d3)
        print(f"  {MONTH_ID[m]:<4}{dt:>+19.2f}{dh:>+11.2f}{res[0][0]:>19.2f}{res[1][0]:>20.2f}{res[0][1]:>12.0f}{res[1][1]:>13.0f}")
    print("  rasio amplitudo = amplitudo harmonik harian (indoor) / (ambient); lag = indoor tertinggal dari ambient (menit).")
    print("  Kumbung nyata dengan massa baglog ~11 MJ/K dan dinding menyimpan panas: rasio < 1 dan lag berjam-jam, bukan menit.")
    print("  Offset zona A/B/C yang statis menghasilkan bias fusi (0.35*A + 0.40*B + 0.25*C) sebesar:")
    ft = sum(w * sim.SENSOR_ZONES[z]["temp_offset"] for z, w in (("A", 0.35), ("B", 0.40), ("C", 0.25)))
    fh = sum(w * sim.SENSOR_ZONES[z]["hum_offset"] for z, w in (("A", 0.35), ("B", 0.40), ("C", 0.25)))
    print(f"    suhu {ft:+.3f} C, RH {fh:+.3f} %  (hampir nol -> rata-rata tertimbang praktis = nilai pusat)")


# ----------------------------------------------------------------------------------------------------------
# BAGIAN 4 - KOEFISIEN: terjemahkan ke besaran fisik
# ----------------------------------------------------------------------------------------------------------
def part_koef(sim):
    V = VOLUME_M3
    print(f"\n== ARTI FISIK KOEFISIEN (V = {V} m3) ==")
    print("  Relaksasi orde-1 dx/dt = -k (x - x_luar) setara pertukaran udara Q = k*V  ->  ACH = k*3600")
    print(f"  {'koefisien':<34}{'k (1/s)':>9}{'ACH':>8}{'Q m3/jam':>11}{'konstanta waktu':>17}")
    rows = [
        ("TEMP_RECOVERY_RATE (pasif)", sim.TEMP_RECOVERY_RATE),
        ("HUM_RECOVERY_RATE (permukaan kering)", sim.HUM_RECOVERY_RATE),
        ("HUM_RECOVERY_RATE (permukaan basah, x0.35)", sim.HUM_RECOVERY_RATE * 0.35),
        ("Fan: suhu (0.08)", 0.08),
        ("Fan: RH (0.04)", 0.04),
    ]
    for name, k in rows:
        print(f"  {name:<34}{k:>9.4f}{k * 3600:>8.0f}{k * 3600 * V:>11.0f}{1 / k:>14.0f} s")
    print("  Pembanding kasar: kipas dinding 25-40 cm di dunia nyata mengalirkan ordo 500-3000 m3/jam setelah hambatan (cek datasheet),")
    print("  yaitu 4-25 ACH untuk 122.5 m3. Koefisien kipas simulator = 144-288 ACH, jauh di atas itu.")
    # misting
    print("\n  Misting: dRH/dt = 0.16 * evap_potential, evap_potential = max(0.05, (98-RH)/25)")
    print(f"  {'RH':>4}{'T':>5}{'dRH %/s':>9}{'air g/s':>9}{'L/menit':>9}{'pendinginan laten kW':>22}{'dT udara-saja K/s':>20}{'dT di sim K/s':>15}")
    for rh in (75, 85, 90):
        for t in (25, 28):
            evp = max(0.05, (98 - rh) / 25.0)
            drh = 0.16 * evp
            g_s = (drh / 100.0) * rho_sat(t) * V          # gram uap per detik
            q_kw = g_s / 1000.0 * 2.45e6 / 1000.0
            dt_air = q_kw * 1000.0 / (1.2 * 1005.0 * V)
            dt_sim = 0.025 * evp
            print(f"  {rh:>4}{t:>5}{drh:>9.4f}{g_s:>9.2f}{g_s * 60 / 1000:>9.3f}{q_kw:>22.1f}{dt_air:>20.4f}{dt_sim:>15.4f}")
    for t, rh in ((28, 85), (28, 75), (25, 85)):
        cap = (rho_sat(t) - abs_hum(t, rh)) * V
        print(f"  Kapasitas udara menyerap uap sampai jenuh dari {t} C / {rh}% : {cap:.0f} g per {V} m3")
    print("  -> laju uap misting (~0.14 L/menit) masuk akal untuk 1-2 nozzle; yang tidak ada adalah BATAS fisik (udara jenuh -> sisa air jadi tetesan/lantai basah).")


# ----------------------------------------------------------------------------------------------------------
# BAGIAN 5 - TAMBALAN S1: kalibrasi ambient dari data iklim (usulan), diuji dengan metode yang sama
# ----------------------------------------------------------------------------------------------------------
S1_BLOCK = '''
# === [S1] AMBIENT DARI NORMAL IKLIM BULANAN (menggantikan AMBIENT_TEMP/HUM_MIN/MAX yang dikarang) ===
# bulan: (Tmin, Tmax, RH rata-rata harian, curah hujan mm)  - Muntilan 1991-2020, proksi Salam/Jumoyo (+-400 mdpl)
CLIMATE_MONTHLY = {
    1: (20.2, 27.9, 80, 400.4), 2: (20.1, 28.2, 81, 390.1), 3: (20.4, 28.6, 79, 399.3), 4: (20.8, 28.7, 77, 297.2),
    5: (20.6, 28.7, 72, 193.3), 6: (19.7, 28.6, 71, 117.4), 7: (18.9, 28.0, 70, 50.1), 8: (18.9, 28.2, 70, 37.2),
    9: (19.7, 28.5, 71, 66.1), 10: (20.6, 29.0, 75, 157.1), 11: (20.6, 28.4, 79, 313.5), 12: (20.3, 27.8, 80, 406.0),
}


def season_from_rain(month):
    """musim dari curah hujan bulanan data (bukan dari kalender 12-1-2 / 6-7-8)"""
    rain = CLIMATE_MONTHLY[month][3]
    return 'MUSIM_HUJAN' if rain >= 250 else ('MUSIM_KEMARAU' if rain < 130 else 'PANCAROBA')


def _esat(t):
    return 6.112 * math.exp(17.62 * t / (243.12 + t))


def _diurnal(hf, t_sr=6.0, t_pk=14.0):
    """0 = Tmin (06:00), 1 = Tmax (14:00); bentuk sama seperti kurva lama (naik cosinus, turun pangkat 0.7)"""
    if t_sr <= hf <= t_pk:
        return (1.0 - math.cos((hf - t_sr) / (t_pk - t_sr) * math.pi)) / 2.0
    dt = (hf - t_pk) if hf >= t_pk else (hf + 24.0 - t_pk)
    return (1.0 + math.cos(((dt / 16.0) ** 0.7) * math.pi)) / 2.0


_DEW_CACHE = {}


def dewpoint_for_month(month):
    """Titik embun harian (dianggap konstan) s.t. rata-rata RH harian = RH data bulan itu (RH dipotong 100%)."""
    if month not in _DEW_CACHE:
        tmin, tmax, rh_mean, _ = CLIMATE_MONTHLY[month]
        temps = [tmin + (tmax - tmin) * _diurnal(i * 0.25) for i in range(96)]
        lo, hi = -5.0, 30.0
        for _ in range(50):
            mid = (lo + hi) / 2
            avg = sum(min(100.0, 100.0 * _esat(min(mid, t)) / _esat(t)) for t in temps) / len(temps)
            lo, hi = (mid, hi) if avg < rh_mean else (lo, mid)
        _DEW_CACHE[month] = (lo + hi) / 2
    return _DEW_CACHE[month]


def ambient_climate(month, now, d_temp=0.0, d_dew=0.0):
    """(T, RH) udara luar. T dari Tmin/Tmax bulan itu; RH diturunkan dari titik embun -> RH turun saat siang secara fisik."""
    tmin, tmax, _, _ = CLIMATE_MONTHLY[month]
    hf = now.hour + now.minute / 60.0 + now.second / 3600.0
    t = tmin + (tmax - tmin) * _diurnal(hf) + d_temp
    td = min(dewpoint_for_month(month) + d_dew, t)
    return t, min(HUM_MAX_PHYSICAL, 100.0 * _esat(td) / _esat(t))

'''


# Porsi WAKTU tiap state per musim (asumsi: intensitas hujan rata-rata ~6 mm/jam -> 400 mm/bulan ~ 9% waktu hujan).
# Probabilitas PILIH state = porsi waktu / durasi rata-rata, dinormalkan (supaya state panjang tidak mendominasi).
S1_TIME_SHARE_DAY = {
    'MUSIM_HUJAN':   {'CERAH_TERIK': 0.30, 'BERAWAN_MENDUNG': 0.58, 'HUJAN_SEDANG': 0.09, 'HUJAN_LEBAT': 0.03},
    'PANCAROBA':     {'CERAH_TERIK': 0.50, 'BERAWAN_MENDUNG': 0.44, 'HUJAN_SEDANG': 0.05, 'HUJAN_LEBAT': 0.01},
    'MUSIM_KEMARAU': {'CERAH_TERIK': 0.72, 'BERAWAN_MENDUNG': 0.265, 'HUJAN_SEDANG': 0.013, 'HUJAN_LEBAT': 0.002},
}
S1_TIME_SHARE_NIGHT = {
    'MUSIM_HUJAN':   {'MALAM_CERAH': 0.25, 'MALAM_BERAWAN': 0.65, 'HUJAN_MALAM': 0.10},
    'PANCAROBA':     {'MALAM_CERAH': 0.45, 'MALAM_BERAWAN': 0.50, 'HUJAN_MALAM': 0.05},
    'MUSIM_KEMARAU': {'MALAM_CERAH': 0.72, 'MALAM_BERAWAN': 0.27, 'HUJAN_MALAM': 0.01},
}

S1_DAY_STATES = '''DAY_WEATHER_STATES = {
    # temp_shift (K) = anomali suhu udara luar; hum_shift (K!) = anomali TITIK EMBUN (bukan RH lagi). Durasi: jam-an.
    'CERAH_TERIK': {
        'label': '☀️ Cerah Terik (Panas)', 'temp_shift': +0.6, 'hum_shift': -0.6,
        'duration_min_sec': 3600, 'duration_max_sec': 10800,
    },
    'BERAWAN_MENDUNG': {
        'label': '⛅ Berawan / Mendung', 'temp_shift': -0.4, 'hum_shift': +0.2,
        'duration_min_sec': 1800, 'duration_max_sec': 7200,
    },
    'HUJAN_SEDANG': {
        'label': '🌧️ Hujan Sedang', 'temp_shift': -1.0, 'hum_shift': +0.6,
        'duration_min_sec': 1200, 'duration_max_sec': 3600,
    },
    'HUJAN_LEBAT': {
        'label': '⛈️ Hujan Lebat / Badai', 'temp_shift': -1.5, 'hum_shift': +0.9,
        'duration_min_sec': 600, 'duration_max_sec': 2400,
    },
}

'''

S1_NIGHT_STATES = '''NIGHT_WEATHER_STATES = {
    'MALAM_CERAH': {
        'label': '🌙 Malam Cerah (Sejuk)', 'temp_shift': -0.5, 'hum_shift': -0.3,
        'duration_min_sec': 7200, 'duration_max_sec': 18000,
    },
    'MALAM_BERAWAN': {
        'label': '☁️ Malam Berawan (Stabil)', 'temp_shift': +0.2, 'hum_shift': +0.3,
        'duration_min_sec': 7200, 'duration_max_sec': 14400,
    },
    'HUJAN_MALAM': {
        'label': '🌧️ Hujan Malam (Dingin Basah)', 'temp_shift': -0.8, 'hum_shift': +0.6,
        'duration_min_sec': 1800, 'duration_max_sec': 5400,
    },
}

'''

S1_METHODS = '''    def _centering(self):
        """Anomali cuaca harus rata-rata 0 (normal iklim sudah memuat rata-rata cuaca): hitung bias berbobot waktu."""
        tot_t = tot_d = 0.0
        for states, weights, hours in ((DAY_WEATHER_STATES, DAY_SEASON_CONFIGS[self.season_code]['weights'], 11.0),
                                       (NIGHT_WEATHER_STATES, NIGHT_SEASON_CONFIGS[self.season_code]['weights'], 13.0)):
            wt = {k: weights[k] * 0.5 * (states[k]['duration_min_sec'] + states[k]['duration_max_sec']) for k in states}
            z = sum(wt.values())
            tot_t += hours / 24.0 * sum(wt[k] / z * states[k]['temp_shift'] for k in states)
            tot_d += hours / 24.0 * sum(wt[k] / z * states[k]['hum_shift'] for k in states)
        return tot_t, tot_d

    def ambient(self, now):
        """(T, RH) udara luar sekarang = normal iklim bulan ini + anomali cuaca (tanpa bias)."""
        return ambient_climate(self.month, now, self.current_temp_shift - self._off_t, self.current_hum_shift - self._off_d)

    def _check_is_night(self) -> bool:'''


def _s1_season_blocks():
    """Teks pengganti DAY_SEASON_CONFIGS / NIGHT_SEASON_CONFIGS: bobot pilih = porsi waktu / durasi rata-rata."""
    def weights(shares, states):
        raw = {k: v / (0.5 * (states[k]['dmin'] + states[k]['dmax'])) for k, v in shares.items()}
        z = sum(raw.values())
        return {k: round(v / z, 4) for k, v in raw.items()}
    day = {'CERAH_TERIK': dict(dmin=3600, dmax=10800), 'BERAWAN_MENDUNG': dict(dmin=1800, dmax=7200),
           'HUJAN_SEDANG': dict(dmin=1200, dmax=3600), 'HUJAN_LEBAT': dict(dmin=600, dmax=2400)}
    night = {'MALAM_CERAH': dict(dmin=7200, dmax=18000), 'MALAM_BERAWAN': dict(dmin=7200, dmax=14400),
             'HUJAN_MALAM': dict(dmin=1800, dmax=5400)}
    names = {'MUSIM_HUJAN': 'Musim Hujan (Monsun Barat)', 'MUSIM_KEMARAU': 'Musim Kemarau (Monsun Timur)',
             'PANCAROBA': 'Musim Pancaroba (Transisi)'}
    day_txt = "DAY_SEASON_CONFIGS = {\n"
    for k, sh in S1_TIME_SHARE_DAY.items():
        day_txt += f"    '{k}': {{'name': '{names[k]}', 'weights': {weights(sh, day)}}},\n"
    day_txt += "}\n\n"
    night_txt = "NIGHT_SEASON_CONFIGS = {\n"
    for k, sh in S1_TIME_SHARE_NIGHT.items():
        night_txt += f"    '{k}': {{'weights': {weights(sh, night)}}},\n"
    night_txt += "}\n\n"
    return day_txt, night_txt


def _s1_patches(src):
    """Daftar (old, new) untuk load_sim(). Semua anchor harus unik di iot_simulator.py v3.5."""
    # urutan di file: DAY_WEATHER_STATES -> "# Status Cuaca Malam Hari" -> NIGHT_WEATHER_STATES -> "# Probabilitas ... Siang Hari"
    d0, d1 = src.index("DAY_WEATHER_STATES = {"), src.index("# Status Cuaca Malam Hari")
    n0, n1 = src.index("NIGHT_WEATHER_STATES = {"), src.index("# Probabilitas Monsun Iklim Indonesia Siang Hari")
    return [
        (src[d0:d1], S1_DAY_STATES),
        (src[n0:n1], S1_NIGHT_STATES),
        (src[src.index("DAY_SEASON_CONFIGS = {"):src.index("# Probabilitas Monsun Iklim Indonesia Malam Hari")], _s1_season_blocks()[0]),
        (src[src.index("NIGHT_SEASON_CONFIGS = {"):src.index("class WeatherGenerator:")], _s1_season_blocks()[1]),
        # blok iklim sebelum WeatherGenerator
        ("class WeatherGenerator:", S1_BLOCK + "\nclass WeatherGenerator:"),
        # musim dari curah hujan + simpan bulan + bias pusat anomali
        ("        if month in [12, 1, 2]:\n            self.season_code = 'MUSIM_HUJAN'\n        elif month in [6, 7, 8]:\n"
         "            self.season_code = 'MUSIM_KEMARAU'\n        else:\n            self.season_code = 'PANCAROBA'\n",
         "        self.month = month\n        self.season_code = season_from_rain(month)\n"),
        ("        self.season_name = DAY_SEASON_CONFIGS[self.season_code]['name']\n",
         "        self.season_name = DAY_SEASON_CONFIGS[self.season_code]['name']\n        self._off_t, self._off_d = self._centering()\n"),
        # metode baru
        ("    def _check_is_night(self) -> bool:", S1_METHODS),
        # tempat ambient dipakai
        ("        base_temp = self._get_ambient_temp(now) + self.weather_gen.current_temp_shift\n"
         "        base_hum = self._get_ambient_hum(now) + self.weather_gen.current_hum_shift\n",
         "        base_temp, base_hum = self.weather_gen.ambient(now)\n"),
        ("        base_ambient_temp = self._get_ambient_temp(now)\n        base_ambient_hum = self._get_ambient_hum(now)\n\n"
         "        # Modifikasi cuaca stokastik (hujan, terik, mendung)\n"
         "        ambient_temp = base_ambient_temp + self.weather_gen.current_temp_shift\n"
         "        ambient_hum = base_ambient_hum + self.weather_gen.current_hum_shift\n",
         "        ambient_temp, ambient_hum = self.weather_gen.ambient(now)\n"),
    ]


def part_patched(path, days, seeds):
    """Pasang S1 pada salinan sementara; ukur ulang tabel ambient. iot_simulator.py asli tidak disentuh."""
    src = open(path, encoding="utf-8").read()
    if "CLIMATE_MONTHLY" in src and "def ambient(self, now)" in src:
        print("\n*** File ini SUDAH memuat tambalan S1, jadi tidak ditambal ulang. Ukur dengan: --part ambient ***")
        return None
    sim = load_sim(path, _s1_patches(src))
    print("\n*** SIMULATOR TERTAMBAL S1 (ambient dari normal iklim; titik embun; state cuaca jam-an; anomali berpusat) ***")
    part_ambient(sim, days, seeds, ambient_fn=lambda wg, now: wg.ambient(now))
    return sim


# ----------------------------------------------------------------------------------------------------------
def emit_s1(path, out_path):
    """Tulis SALINAN iot_simulator.py yang sudah ditambal S1 (file asli tidak diubah). Bandingkan: diff -u iot_simulator.py OUT.py"""
    src = open(path, encoding="utf-8").read()
    if "CLIMATE_MONTHLY" in src and "def ambient(self, now)" in src:
        print(f"{path} sudah memuat tambalan S1; tidak ada yang ditulis.")
        return
    for old, new in _s1_patches(src):
        n = src.count(old)
        assert n == 1, f"anchor patch ditemukan {n}x (harus 1x): {old[:60]!r}"
        src = src.replace(old, new)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"Tertulis: {out_path}  (tambalan S1 pada {path}; file asli tidak diubah)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sim", default="iot_simulator.py")
    ap.add_argument("--emit-s1", metavar="OUT.py", help="tulis salinan simulator yang sudah ditambal S1 ke OUT.py lalu keluar")
    ap.add_argument("--part", default="all", choices=["all", "ambient", "psikro", "recon", "freefloat", "koef", "patched"])
    ap.add_argument("--days", type=int, default=2)
    ap.add_argument("--seeds", type=int, default=2)
    a = ap.parse_args()
    if a.emit_s1:
        emit_s1(a.sim, a.emit_s1)
        return
    if a.part == "recon":
        part_recon()
        return
    sim = load_sim(a.sim)
    if a.part in ("all", "ambient"):
        part_ambient(sim, a.days, a.seeds)
    if a.part in ("all", "psikro"):
        part_psikro(sim)
    if a.part in ("all", "recon"):
        part_recon()
    if a.part in ("all", "freefloat"):
        part_freefloat(sim)
    if a.part in ("all", "koef"):
        part_koef(sim)
    if a.part in ("all", "patched"):
        part_patched(a.sim, a.days, a.seeds)


if __name__ == "__main__":
    main()
