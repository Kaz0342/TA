#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sim_harness.py - headless fast-forward runner untuk iot_simulator.py (repo TA, branch develop)

Kenapa ada: angka di RENCANA_PERBAIKAN_LOGIKA.md dihasilkan script ini, jadi bisa lu reproduksi sendiri.

- Tanpa network : send_sensor_data / send_actuator_log di-stub (log ditangkap di memori)
- Jam palsu     : 1 iterasi = 1 detik simulasi, tanpa sleep (2 hari simulasi ~ 4-5 detik nyata)
- Patch opsional: string-replace pada salinan sementara -> file iot_simulator.py asli TIDAK disentuh.
                  Patch ini = spesifikasi perubahan sisi simulator untuk F-10a, F-10b, F-11, F-12 (+F12b yang dicoba dan ditolak).

Pemakaian (dari root repo):
    python sim_harness.py --suite all          # semua tabel (+-5 menit)
    python sim_harness.py --suite misting      # tabel F-11/F-12
    python sim_harness.py --suite heat         # tabel F-10
    python sim_harness.py --suite incubation   # bukti F-11 (ambang hard-coded)
    python sim_harness.py --suite gain         # sensitivitas koefisien misting
    python sim_harness.py --suite cadence      # evaluasi tiap 1 s vs 5 s (F-13)
    python sim_harness.py --suite misting --fast   # 1 bulan x 1 seed, buat cek cepat

Catatan validitas: ini memverifikasi LOGIKA KONTROL di dalam model simulator. Koefisien fisikanya
(misting 0.16, fan 0.04/0.08, recovery) adalah asumsi, bukan hasil ukur. Lihat Lampiran A di dokumen.
"""
import argparse
import contextlib
import datetime
import importlib.util
import io
import os
import random
import statistics
import tempfile
import time as _time

# ------------------------------------------------------------------ patches (spesifikasi fix sisi simulator)
F10A_ANCHOR = ("    if is_night:\n"
               "        # Failsafe 2: Jika ada fan siang yang masih aktif saat transisi jam 17:00, matikan segera!\n")
F10A_BLOCK = (
    "    # [F-10a] Histeresis stop Safety Override berlaku 24 jam (siang DAN malam)\n"
    "    if state.is_fan_active and getattr(state, 'is_critical_override', False):\n"
    "        if max_temp <= (critical_threshold - 1.0) and temp <= state.temp_max:\n"
    "            state.is_fan_active = False\n"
    "            state.is_critical_override = False\n"
    "            state.fan_cooling_last_stop_time = time.time()\n"
    "            duration = int(time.time() - (state.fan_start_time or time.time()))\n"
    "            stop_reason = f\"Suhu kritis teratasi (Max {max_temp}C <= {critical_threshold - 1.0}C)\"\n"
    "            send_actuator_log(max(1, duration), state.fan_trigger_reason, stop_reason, \"fan\")\n"
    "        return\n\n")
F10B_ANCHOR = "        # 0. NIGHT LOCKOUT (17:00 - 06:00 WIB): Misting DILARANG nyala agar jamur tidak tidur basah kuyup\n"
F10B_BLOCK = ("        # [F-10b] Jangan mulai misting saat kondisi kritis (override fan akan langsung memotongnya)\n"
              "        if state.get_max_temp() > state.temp_max + CRITICAL_TEMP_OFFSET:\n"
              "            return\n\n")

PATCHES = {
    "F10a": [(F10A_ANCHOR, F10A_BLOCK + F10A_ANCHOR)],
    "F10b": [(F10B_ANCHOR, F10B_BLOCK + F10B_ANCHOR)],
    # F-11: ambang darurat ikut preset (untuk humMin=85 hasilnya identik dengan angka lama 75/70/65)
    "F11": [("critical_low_rh = 75.0", "critical_low_rh = state.hum_min - 10.0"),
            ("if hum >= 70.0 and min_hum >= 65.0:",
             "if hum >= state.hum_min - 15.0 and min_hum >= state.hum_min - 20.0:")],
    # F-12: deadband stop = humMin + min(3, setengah rentang), timeout misting 60 -> 90 detik
    "F12": [("min(self.hum_max - 4.0, self.hum_min + 5.0)",
             "self.hum_min + min(3.0, 0.5 * (self.hum_max - self.hum_min))"),
            ("MAX_MISTING_DURATION = 60 ", "MAX_MISTING_DURATION = 90 ")],
    # F-12b (DICOBA, TIDAK MEMBANTU -> jangan dipakai): durasi ON minimum 20 detik sebelum boleh stop karena target
    "F12b": [("target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max)",
              "target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max and elapsed >= 20)")],
}

PRESETS = {  # sama dengan PHASE_PRESETS di frontend/src/pages/Settings.tsx
    "fruiting": dict(temp=(24.0, 32.0), hum=(85.0, 95.0)),
    "primordia": dict(temp=(24.0, 28.0), hum=(85.0, 90.0)),
    "incubation": dict(temp=(26.0, 30.0), hum=(65.0, 75.0)),
    "seed_default": dict(temp=(24.0, 32.0), hum=(80.0, 95.0)),  # default seeder backend
}


# ------------------------------------------------------------------ loader & runner
def load_sim(path, patches, gain=None):
    src = open(path, encoding="utf-8").read()
    for name in patches:
        for old, new in PATCHES[name]:
            n = src.count(old)
            assert n == 1, f"patch {name}: anchor ditemukan {n}x (harus 1x). Kode simulator berubah?"
            src = src.replace(old, new)
    if gain is not None:
        assert "0.16 * evap_potential" in src, "koefisien misting 0.16 tidak ditemukan"
        src = src.replace("0.16 * evap_potential", f"{gain} * evap_potential")
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


def run_case(path, patches=(), *, preset="fruiting", month=7, seed=7, days=2, weather="auto",
             ambient_t=None, ambient_h=None, gain=None, eval_every=1, timeout=None):
    random.seed(seed)
    sim = load_sim(path, patches, gain)
    if timeout is not None:
        sim.MAX_MISTING_DURATION = timeout
    if ambient_t:
        sim.AMBIENT_TEMP_MIN, sim.AMBIENT_TEMP_MAX = ambient_t
    if ambient_h:
        sim.AMBIENT_HUM_MIN, sim.AMBIENT_HUM_MAX = ambient_h
    temp, hum = PRESETS[preset]["temp"], PRESETS[preset]["hum"]

    clock = {"t": datetime.datetime(2026, 9, 29, 0, 0, 0, tzinfo=sim.WIB).timestamp()}
    real_time = _time.time
    _time.time = lambda: clock["t"]
    sim.get_wib_now = lambda: datetime.datetime.fromtimestamp(clock["t"], tz=sim.WIB)
    logs = []
    sim.send_actuator_log = lambda d, tr, sr, a="misting": logs.append(dict(dur=d, trig=tr, stop=sr, act=a))
    sim.send_sensor_data = lambda *a, **k: True

    crit_line = temp[1] + sim.CRITICAL_TEMP_OFFSET
    n = days * 86400
    c = dict(below=0, above=0, hot=0, crit=0, fan_on=0, pump=0, toggles=0, rh_sum=0.0)
    prev_fan = False
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            wg = sim.WeatherGenerator(forced_weather=weather, custom_month=month)
            st = sim.KumbungState(weather_gen=wg)
            st.update_thresholds({"temp_min": temp[0], "temp_max": temp[1],
                                  "humidity_min": hum[0], "humidity_max": hum[1]})
            for i in range(n):
                clock["t"] += 1.0
                st.simulate_tick(1.0)
                if i % eval_every == 0:
                    sim.control_misting(st)
                    sim.control_fan(st)
                t, h = st.get_readings()
                c["rh_sum"] += h
                c["below"] += h < hum[0]
                c["above"] += h > hum[1]
                c["hot"] += t > temp[1]
                c["crit"] += st.get_max_temp() > crit_line
                c["fan_on"] += bool(st.is_fan_active)
                c["pump"] += bool(st.is_misting_active)
                c["toggles"] += (bool(st.is_fan_active) != prev_fan)
                prev_fan = bool(st.is_fan_active)
    finally:
        _time.time = real_time

    mist = [l for l in logs if l["act"] == "misting"]
    fan = [l for l in logs if l["act"] == "fan"]
    normal = [l for l in mist if not l["stop"].startswith("Pulse")]
    tgt = sum(l["stop"].startswith("Target") for l in normal)
    tmo = sum(l["stop"].startswith("Safety timeout") for l in normal)
    return dict(
        stop_rh=st.rh_trigger_high, cycles=len(mist) / days, pulses=(len(mist) - len(normal)) / days,
        timeout_pct=100.0 * tmo / max(1, tgt + tmo), pump_min=c["pump"] / days / 60.0,
        rh_mean=c["rh_sum"] / n, below=100.0 * c["below"] / n, above=100.0 * c["above"] / n,
        override=sum("Safety Override" in l["trig"] for l in fan), toggles=c["toggles"] / days,
        fan_on=100.0 * c["fan_on"] / n, cut=sum("Dipotong" in l["stop"] for l in mist),
        hot=100.0 * c["hot"] / n, crit=100.0 * c["crit"] / n, long_logs=sum(l["dur"] > 600 for l in logs),
    )


def mean(runs, key):
    return statistics.mean(r[key] for r in runs)


def label_of(patches):
    return "+".join(patches) if patches else "asli"


# ------------------------------------------------------------------ suites
def suite_misting(path, days, months, seeds):
    print(f"\n== MISTING (F-11/F-12): rata-rata {len(months) * len(seeds)} run (bulan {months} x seed {seeds}), {days} hari/run ==")
    print(f"{'preset':<13}{'patch':<9}{'stop':>5}{'siklus/hr':>10}{'pulse/hr':>9}{'timeout%':>9}{'pompa mnt/hr':>13}{'RH<humMin%':>11}{'RH>humMax%':>11}")
    for preset in ("fruiting", "primordia", "seed_default"):
        for patches in ((), ("F11", "F12")):
            runs = [run_case(path, patches, preset=preset, month=m, seed=s, days=days) for m in months for s in seeds]
            print(f"{preset:<13}{label_of(patches):<9}{runs[0]['stop_rh']:>4.1f}%{mean(runs, 'cycles'):>10.1f}{mean(runs, 'pulses'):>9.1f}"
                  f"{mean(runs, 'timeout_pct'):>9.0f}{mean(runs, 'pump_min'):>13.1f}{mean(runs, 'below'):>11.1f}{mean(runs, 'above'):>11.1f}", flush=True)


def suite_incubation(path, days, seeds):
    print(f"\n== INKUBASI 65/75 (F-11): ambient RH dipaksa 60-72% biar RH rata-rata ada DALAM rentang target; bulan 7, {len(seeds)} seed ==")
    print(f"{'kondisi':<26}{'patch':<6}{'siklus/hr':>10}{'pulse T2/hr':>12}{'RH rata2':>9}{'RH<humMin%':>11}{'RH>humMax%':>11}{'pompa mnt/hr':>13}")
    cases = [("ambient bawaan sim (82-95)", None, ()),
             ("ambient kering (60-72)", (60.0, 72.0), ()),
             ("ambient kering (60-72)", (60.0, 72.0), ("F11",))]
    for name, amb, patches in cases:
        runs = [run_case(path, patches, preset="incubation", month=7, seed=s, days=days, ambient_h=amb) for s in seeds]
        print(f"{name:<26}{label_of(patches):<6}{mean(runs, 'cycles'):>10.1f}{mean(runs, 'pulses'):>12.1f}{mean(runs, 'rh_mean'):>9.1f}"
              f"{mean(runs, 'below'):>11.1f}{mean(runs, 'above'):>11.1f}{mean(runs, 'pump_min'):>13.1f}", flush=True)


def suite_heat(path, days):
    print(f"\n== PANAS EKSTREM (F-10): preset fruiting, cuaca cerah dipaksa, bulan 7, seed 11, {days} hari ==")
    print(f"{'ambient':<11}{'patch':<11}{'override':>9}{'toggle fan/hr':>14}{'misting dipotong':>17}{'fan ON%':>8}{'sensor>34C%':>12}{'RH<humMin%':>11}{'log>600s':>9}")
    for amb in ((27.0, 36.0), (28.0, 39.0)):
        for patches in ((), ("F10a",), ("F10a", "F10b")):
            r = run_case(path, patches, preset="fruiting", month=7, seed=11, days=days, weather="cerah", ambient_t=amb)
            print(f"{amb[0]:.0f}-{amb[1]:.0f} C   {label_of(patches):<11}{r['override']:>9}{r['toggles']:>14.0f}{r['cut']:>17}"
                  f"{r['fan_on']:>8.1f}{r['crit']:>12.1f}{r['below']:>11.1f}{r['long_logs']:>9}", flush=True)


def suite_gain(path, days):
    print(f"\n== SENSITIVITAS KOEFISIEN MISTING (asumsi 0.16): preset fruiting, bulan 7, seed 7, {days} hari ==")
    print(f"{'gain':<7}{'patch':<9}{'siklus/hr':>10}{'timeout%':>9}{'pompa mnt/hr':>13}{'RH<humMin%':>11}")
    for gain in (0.10, 0.16, 0.25, 0.35):
        for patches in ((), ("F11", "F12")):
            r = run_case(path, patches, preset="fruiting", month=7, seed=7, days=days, gain=gain)
            print(f"{gain:<7}{label_of(patches):<9}{r['cycles']:>10.1f}{r['timeout_pct']:>9.0f}{r['pump_min']:>13.1f}{r['below']:>11.1f}", flush=True)


def suite_cadence(path, days):
    print(f"\n== CADENCE EVALUASI (F-13): sim 1 s vs firmware 5 s; preset fruiting, bulan 7, seed 7, {days} hari ==")
    print(f"{'eval tiap':<10}{'patch':<9}{'siklus/hr':>10}{'timeout%':>9}{'pompa mnt/hr':>13}{'RH<humMin%':>11}")
    for ev in (1, 5):
        for patches in ((), ("F11", "F12")):
            r = run_case(path, patches, preset="fruiting", month=7, seed=7, days=days, eval_every=ev)
            print(f"{ev} s{'':<7}{label_of(patches):<9}{r['cycles']:>10.1f}{r['timeout_pct']:>9.0f}{r['pump_min']:>13.1f}{r['below']:>11.1f}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sim", default="iot_simulator.py", help="path ke iot_simulator.py")
    ap.add_argument("--suite", default="all", choices=["all", "misting", "incubation", "heat", "gain", "cadence"])
    ap.add_argument("--days", type=int, default=2)
    ap.add_argument("--fast", action="store_true", help="1 bulan x 1 seed (cek cepat)")
    a = ap.parse_args()
    months, seeds = ((7,), (1,)) if a.fast else ((1, 7), (1, 2))
    if a.suite in ("all", "misting"):
        suite_misting(a.sim, a.days, months, seeds)
    if a.suite in ("all", "incubation"):
        suite_incubation(a.sim, a.days, seeds)
    if a.suite in ("all", "heat"):
        suite_heat(a.sim, a.days)
    if a.suite in ("all", "gain"):
        suite_gain(a.sim, a.days)
    if a.suite in ("all", "cadence"):
        suite_cadence(a.sim, a.days)


if __name__ == "__main__":
    main()
