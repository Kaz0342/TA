#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
simulasi_amplop_kumbung.py  -  model fisika SEDERHANA (lumped) amplop kumbung: atap, dinding, ventilasi, uap air

Tujuan   : membandingkan pilihan ATAP dan DINDING (asbes+anyaman bambu vs alternatif) pada kumbung 5 x 7 m, dan melihat
           seperti apa jadinya controller asli di iot_simulator.py kalau "kumbung"-nya punya fisika (bukan relaksasi ke ambient).
Yang BUKAN: ini bukan prediksi derajat-per-derajat. Semua parameter material/kebocoran adalah ASUMSI berlabel (lihat Env/Plant).
            Pakai untuk URUTAN pilihan dan ORDE BESAR; kalibrasi dengan data logger 2 minggu setelah kumbung berdiri.

Isi model (per detik, dt = 1 s):
  - 2 simpul suhu  : udara (Ta) dan massa (Tb = baglog + rak + lantai + lapisan dalam dinding)
  - atap & dinding : konduksi kuasi-statis + suhu sol-air (radiasi matahari - pendinginan langit), pertukaran konveksi ke udara
                     dan radiasi ke massa; kondensasi uap di permukaan dalam yang lebih dingin dari titik embun
  - ventilasi      : kebocoran dinding (ACH) + kipas (Q_fan saat ON) membawa udara luar (T, kelembapan absolut)
  - uap air        : kabut nozzle (sebagian menguap di udara, sisanya jadi air permukaan), penguapan permukaan basah, kondensasi,
                     pertukaran ventilasi; air berlebih ditiriskan
  - luar ruangan   : hari tipikal tiap bulan dari tabel iklim (Tmin/Tmax/RH bulanan -> titik embun), radiasi matahari
                     (Haurwitz x indeks kecerahan dari curah hujan)
  - controller     : control_misting() / control_fan() ASLI dari iot_simulator.py dijalankan tiap 5 detik di atas model ini.

Pemakaian (dari root repo; validasi_simulator_vs_iklim.py harus satu folder dengan file ini; --sim = path iot_simulator.py):
    python simulasi_amplop_kumbung.py --suite selftest   # 4 cek konsistensi model (fluks atap vs hitungan tangan, kekekalan energi & air, jenuh <= 100%)
    python simulasi_amplop_kumbung.py --suite roof       # free-float (aktuator mati): 12 pilihan atap x 4 hari-contoh x 2 dinding
    python simulasi_amplop_kumbung.py --suite wall       # free-float: 5 pilihan dinding x atap A0/A3
    python simulasi_amplop_kumbung.py --suite water      # kebutuhan air kabut (hitungan langsung) untuk menahan 26 C / 88% RH per ACH
    python simulasi_amplop_kumbung.py --suite control    # controller ASLI di atas model (matriks kecil)
    python simulasi_amplop_kumbung.py --suite ctl2       # matriks utama: efek atap / efek dinding / efek logika kontrol (4 varian controller)
    python simulasi_amplop_kumbung.py --suite break      # rincian % waktu dingin/panas/kering/basah + neraca air harian
    python simulasi_amplop_kumbung.py --suite cross      # cek silang: controller yang sama di "dunia" iot_simulator.py (ambient S1)
    python simulasi_amplop_kumbung.py --suite sens       # sensitivitas (kipas, nozzle, metabolisme, A_bio, td_amp, seed, ...)
    python simulasi_amplop_kumbung.py --suite sensfree   # ketahanan URUTAN atap thd parameter fisik + kurva alfa cat + kurva paranet
    python simulasi_amplop_kumbung.py --suite lit        # ulang skenario inti dgn rentang "literatur" 20-28 C / 85-95%
    python simulasi_amplop_kumbung.py --suite safe       # night lockout: asli vs dibatasi duty (usulan_aman) vs dihapus (usulan)
    python simulasi_amplop_kumbung.py --suite trace --trace A0 W0 7 terik --variant usulan    # jejak per jam 1 hari
    python simulasi_amplop_kumbung.py --suite all        # semuanya (lama: puluhan menit)

Varian controller (--variant): asli | malam_bebas (night lockout dihapus) | malam_longgar | kipas_pintar (P1+P3) | usulan (P1+P2+P3) | usulan_aman (P1+P3+P2').
    P1 = sensor suhu luar + kipas hanya jika udara luar lebih sejuk (histeresis 1 K); P2 = tanpa night lockout; P2' = night lockout diganti jeda >= 600 s antar siklus;\n    P3 = pagar RH untuk kabut pendingin.
    Semua varian ditambal ke SALINAN SEMENTARA iot_simulator.py di memori; file asli tidak pernah diubah.

Hanya stdlib. Python >= 3.9.
"""
import argparse
import contextlib
import io
import math
import os
import random
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, replace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validasi_simulator_vs_iklim import (CLIM, MONTH_ID, FakeClock, _s1_patches, abs_hum, clamp, diurnal_factor, es,  # noqa: E402
                                         load_sim, rho_sat)

RHO_CP = 1207.0          # J/(m3 K)  udara 1.2 kg/m3 x 1005 J/kgK
L_VAP = 2.45e6           # J/kg
LAT, LON, MERIDIAN = -7.6055, 110.3112, 105.0     # koordinat target; WIB = UTC+7 -> meridian 105 E
N_DAY = {1: 17, 2: 47, 3: 75, 4: 105, 5: 135, 6: 162, 7: 198, 8: 228, 9: 258, 10: 288, 11: 318, 12: 344}   # hari rata-rata (Klein)


# ----------------------------------------------------------------------------------------------------------
# PARAMETER
# ----------------------------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Geo:
    """Kumbung 5 x 7 m, tinggi tembok 3 m, bubungan 4 m (atap pelana, kemiringan ~22 derajat).
    V = 35*3 + 0.5*5*1*7 = 122.5 m3 (sama dgn angka di iot_simulator.py); A_roof = 2*7*sqrt(2.5^2+1^2) = 37.7; A_wall = 72+5 = 77."""
    A_floor: float = 35.0
    V: float = 122.5
    A_roof: float = 37.7
    A_wall: float = 77.0


@dataclass(frozen=True)
class Plant:
    n_bag: int = 3000            # [CODE] SlotSeeder.php: 300 slot x 10 baglog
    m_bag: float = 1.2           # kg/baglog  [ASUMSI] baglog 1.0-1.5 kg
    cp_bag: float = 3100.0       # J/kgK      [ASUMSI] serbuk kayu lembap ~60% air
    A_bag: float = 450.0         # m2 permukaan baglog [ASUMSI] 0.15 m2 per baglog
    C_other: float = 3.0e6       # J/K rak+lantai+lapisan dalam dinding [ASUMSI]
    hc_bag: float = 4.0          # W/m2K konveksi baglog<->udara (tanpa kipas) [ASUMSI]
    hc_bag_fan: float = 7.0      # idem saat kipas ON
    hc_roof: float = 1.2         # W/m2K bawah atap panas (stratifikasi stabil) [ASUMSI]
    hc_wall: float = 2.7         # W/m2K dinding vertikal [ASUMSI]
    G_ground: float = 100.0      # W/K lantai -> tanah [ASUMSI]
    T_ground: float = 24.4       # C ~ suhu rata-rata tahunan
    q_met: float = 0.10          # W per kg baglog (metabolisme jamur) [ASUMSI; 0-0.3 di literatur kompos/spawn-run]
    Q_fan: float = 510.0         # m3/jam saat ON. [DOC] docs/analisis_sensor_24jam.md:135 "minimal 300 CFM" = 510 m3/jam
    m_noz: float = 0.2 / 60.0    # kg/s aliran nozzle saat pompa ON (0.2 L/menit) [ASUMSI; sim lama setara 0.14-0.25 L/menit]
    A_bio: float = 7.0           # m2 luas EFEKTIF penguapan dari baglog/tubuh buah (~23 cm2 per baglog) [ASUMSI; setara ~2 g air/hari/baglog
                                 # pada RH 85-88% = baglog kehilangan ~10-15% bobotnya selama siklus 75 hari]. Sumber lembap biologis.
    A_wet_max: float = 100.0     # m2 permukaan yang bisa basah (lantai + kulit baglog + rak) [ASUMSI]
    Ws_full: float = 3.0         # kg air permukaan -> seluruh A_wet_max basah
    Ws_cap: float = 20.0         # kg batas; lebih dari ini menetes/ditiriskan
    h_o: float = 15.0            # W/m2K koefisien film luar gabungan (konveksi + radiasi) [ASUMSI; ASHRAE musim panas 17]
    dR_roof: float = 63.0        # W/m2 defisit radiasi gelombang panjang atap horizontal, langit cerah [ASHRAE]
    dR_wall: float = 20.0        # W/m2 dinding vertikal
    f_wall_sun: float = 0.15     # fraksi radiasi horizontal yang efektif jatuh ke rata-rata permukaan dinding [ASUMSI]


@dataclass(frozen=True)
class Env:
    name: str
    roof_alpha: float
    roof_R: float            # m2K/W lapisan atap (tanpa film)
    roof_eps_in: float
    roof_shade: float = 0.0  # fraksi radiasi yang diblok paranet di atas atap
    roof_eps_out: float = 0.90
    wall_alpha: float = 0.50
    wall_R: float = 0.03
    wall_eps_in: float = 0.90
    ach_leak: float = 4.0
    wall_mass: float = 0.0   # J/K tambahan massa termal dinding (mis. bata ringan)


# --- ATAP -------------------------------------------------------------------------------------------------
#   alpha asbes 0.60: [SUMBER] IESVE Table 14 "Asbestos sheets, natural colour: 0.6" (belum menua/kotor)
ROOFS = {
    "A0": dict(roof_alpha=0.60, roof_R=0.012, roof_eps_in=0.90),                          # asbes gelombang polos (baseline)
    "A0k": dict(roof_alpha=0.75, roof_R=0.012, roof_eps_in=0.90),                         # asbes tua/berlumut [ASUMSI]
    "A1": dict(roof_alpha=0.30, roof_R=0.012, roof_eps_in=0.90),                          # + cat putih reflektif (sudah menua ~1-2 th) [ASUMSI; baru 0.15-0.20: Berdahl&Bretz 1997]
    "A1b": dict(roof_alpha=0.45, roof_R=0.012, roof_eps_in=0.90),                         # cat putih kotor/berjamur [ASUMSI]
    "A2": dict(roof_alpha=0.60, roof_R=0.162, roof_eps_in=0.05),                          # + foil di bawah atap (celah udara), KERING [ASUMSI]
    "A2w": dict(roof_alpha=0.60, roof_R=0.162, roof_eps_in=0.60),                         # foil yg sudah berembun/berdebu [ASUMSI]
    "A3": dict(roof_alpha=0.30, roof_R=0.162, roof_eps_in=0.05),                          # cat putih + foil
    "A4": dict(roof_alpha=0.30, roof_R=0.162, roof_eps_in=0.05, roof_shade=0.65),         # cat putih + foil + paranet 65%
    "A5": dict(roof_alpha=0.60, roof_R=0.012, roof_eps_in=0.90, roof_shade=0.65),         # asbes + paranet 65% di atas
    "A6": dict(roof_alpha=0.30, roof_R=0.012, roof_eps_in=0.90, roof_shade=0.65),         # cat putih + paranet 65%
    "T1": dict(roof_alpha=0.70, roof_R=1.00, roof_eps_in=0.90),                           # atap daun sagu/alang-alang ~7 cm [ASUMSI R]
    "S1": dict(roof_alpha=0.35, roof_R=2.10, roof_eps_in=0.90),                           # panel sandwich PU 50 mm (R = 0.05/0.025)
}
ROOF_LABEL = {
    "A0": "asbes polos", "A0k": "asbes tua/kotor", "A1": "asbes + cat putih", "A1b": "asbes + cat putih kotor",
    "A2": "asbes + foil (kering)", "A2w": "asbes + foil basah/berdebu", "A3": "asbes + cat putih + foil",
    "A4": "A3 + paranet 65%", "A5": "asbes + paranet 65%", "A6": "cat putih + paranet 65%",
    "T1": "atap daun sagu/ilalang", "S1": "panel sandwich PU 50 mm",
}
# --- DINDING ----------------------------------------------------------------------------------------------
WALLS = {
    "W0": dict(wall_alpha=0.50, wall_R=0.03, ach_leak=4.0),                                # anyaman bambu rapat
    "W0o": dict(wall_alpha=0.50, wall_R=0.03, ach_leak=8.0),                               # idem, angin kencang/celah besar
    "W0r": dict(wall_alpha=0.50, wall_R=0.03, ach_leak=2.0),                               # anyaman sangat rapat + lis
    "W1": dict(wall_alpha=0.50, wall_R=0.04, ach_leak=1.5),                                # bambu + plastik UV di sisi dalam
    "W3": dict(wall_alpha=0.30, wall_R=0.70, ach_leak=1.0, wall_mass=4.6e6),               # bata ringan 10 cm, cat putih
}
WALL_LABEL = {"W0": "bambu rapat (4 ACH)", "W0o": "bambu berangin (8 ACH)", "W0r": "bambu sangat rapat (2 ACH)",
              "W1": "bambu + plastik UV (1.5 ACH)", "W3": "bata ringan (1 ACH)"}


def make_env(roof, wall, **over):
    d = dict(ROOFS[roof])
    d.update(WALLS[wall])
    d.update(over)
    return Env(name=f"{roof}+{wall}", **d)


# ----------------------------------------------------------------------------------------------------------
# LUAR RUANGAN: hari tipikal bulan itu
# ----------------------------------------------------------------------------------------------------------
def kt_for_rain(rain_mm):
    """indeks kecerahan bulanan (H/H0) dari curah hujan  [ASUMSI; kisaran Jawa Tengah ~0.40-0.65]"""
    return 0.42 if rain_mm >= 300 else 0.50 if rain_mm >= 150 else 0.58 if rain_mm >= 80 else 0.66


def _ghi_clear(month, h_wib):
    n = N_DAY[month]
    decl = math.radians(23.45 * math.sin(math.radians(360.0 * (284 + n) / 365.0)))
    b = math.radians(360.0 * (n - 81) / 364.0)
    eot = 9.87 * math.sin(2 * b) - 7.53 * math.cos(b) - 1.5 * math.sin(b)            # menit
    solar_t = h_wib + (LON - MERIDIAN) * 4.0 / 60.0 + eot / 60.0
    w = math.radians(15.0 * (solar_t - 12.0))
    lat = math.radians(LAT)
    cz = math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(w)
    if cz <= 0.02:
        return 0.0
    return 1098.0 * cz * math.exp(-0.057 / cz) * (1 + 0.033 * math.cos(math.radians(360.0 * n / 365.0)))   # Haurwitz


def _h0_daily(month):
    n = N_DAY[month]
    decl = math.radians(23.45 * math.sin(math.radians(360.0 * (284 + n) / 365.0)))
    lat = math.radians(LAT)
    ws = math.acos(-math.tan(lat) * math.tan(decl))
    e0 = 1 + 0.033 * math.cos(math.radians(360.0 * n / 365.0))
    return 24 * 3600 / math.pi * 1367.0 * e0 * (math.cos(lat) * math.cos(decl) * math.sin(ws) + ws * math.sin(lat) * math.sin(decl))   # J/m2/hari


class Outdoor:
    """Profil 1-menit: T, kelembapan absolut (kg/m3), radiasi horizontal I (W/m2), faktor langit cerah cf (0-1)."""

    def __init__(self, month, kind="rata2", td_amp=1.0):
        tmin, _, tmax, rain, rh_mean = CLIM[month]
        if kind == "terik":          # hari terik ~P90 [ASUMSI: Tmax +2 K, Tmin +0.5 K, langit cerah]
            tmin, tmax = tmin + 0.5, tmax + 2.0
        elif kind == "mendung":      # hari mendung/hujan [ASUMSI: Tmax -1.5 K]
            tmax -= 1.5
        # radiasi
        clear = [_ghi_clear(month, i / 60.0) for i in range(1440)]
        h_clear = sum(clear) * 60.0
        h0 = _h0_daily(month)
        kt = {"rata2": kt_for_rain(rain), "terik": min(0.74, h_clear / h0), "mendung": 0.30}[kind]
        scale = kt * h0 / h_clear
        self.kt, self.month, self.kind = kt, month, kind
        self.I = [g * scale for g in clear]
        self.cf = clamp((kt - 0.35) / 0.40, 0.15, 1.0)
        # suhu & titik embun (Td = Td0 + amplitudo kecil mengikuti siang; Td0 dicari agar rata-rata RH = data bulan itu)
        f = [diurnal_factor(i / 60.0) for i in range(1440)]
        self.T = [tmin + (tmax - tmin) * x for x in f]
        fm = statistics.mean(f)

        def mean_rh(td0):
            tot = 0.0
            for i in range(0, 1440, 10):
                td = td0 + td_amp * (f[i] - fm)
                tot += min(100.0, 100.0 * es(min(td, self.T[i])) / es(self.T[i]))
            return tot / 144.0

        lo, hi = -5.0, 30.0
        for _ in range(50):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if mean_rh(mid) < rh_mean else (lo, mid)
        self.td0 = (lo + hi) / 2
        self.Td = [min(self.td0 + td_amp * (f[i] - fm), self.T[i]) for i in range(1440)]
        self.RH = [min(100.0, 100.0 * es(self.Td[i]) / es(self.T[i])) for i in range(1440)]
        self.rv = [rho_sat(self.Td[i]) / 1000.0 for i in range(1440)]       # kg/m3 uap di luar (= rho_sat pada titik embun)

    def at(self, sec_of_day):
        return int(sec_of_day // 60) % 1440


# ----------------------------------------------------------------------------------------------------------
# MODEL
# ----------------------------------------------------------------------------------------------------------
class Model:
    def __init__(self, env, out, geo=Geo(), pl=Plant(), rh0=0.85):
        self.env, self.out, self.g, self.p = env, out, geo, pl
        self.C_air = RHO_CP * geo.V
        self.C_m = pl.n_bag * pl.m_bag * pl.cp_bag + pl.C_other + env.wall_mass
        self.q_met_w = pl.q_met * pl.n_bag * pl.m_bag
        i = out.at(0)
        self.Ta = out.T[i] + 2.0
        self.Tb = self.Ta
        self.rv = rh0 * rho_sat(self.Ta) / 1000.0
        self.Ws = 0.0
        self.acc = dict(mist_in=0.0, bio_in=0.0, vent_net_out=0.0, cond=0.0, drain=0.0, evap_s=0.0, evap_air=0.0, q_roof=0.0, q_wall=0.0)
        self.Tri = self.Ta
        self.Twi = self.Ta

    @property
    def RH(self):
        return 100.0 * self.rv / (rho_sat(self.Ta) / 1000.0)

    def surfaces(self, i, Ta, Tb):
        """Suhu permukaan dalam atap & dinding (kuasi-statis) dan fluks (W) ke udara & massa."""
        e, p, g, o = self.env, self.p, self.g, self.out
        To, I, cf = o.T[i], o.I[i], o.cf
        # atap. Paranet di atas atap: (1) menahan fraksi `roof_shade` radiasi surya, (2) ikut MENUTUPI pandangan atap ke langit, jadi
        # pendinginan radiasi gelombang panjang berkurang (net ~ ambient: faktor 1 - 0.9*shade), (3) net yg kena matahari sedikit lebih hangat
        # dari udara (+0.005 K per W/m2) dan meradiasikan panas itu ke atap (0.9 * 5.5 W/m2K * dT_net * shade). Versi awal model lupa (2) dan (3)
        # sehingga paranet terlihat terlalu bagus (atap jadi 'penyerap panas' 30 MJ/hari); sudah dikoreksi.
        sh = e.roof_shade
        net_heat = sh * 0.9 * 5.5 * (0.005 * I)
        tsa = To + (e.roof_alpha * (1.0 - sh) * I + net_heat - e.roof_eps_out * p.dR_roof * cf * (1.0 - 0.9 * sh)) / p.h_o
        r_out = 1.0 / p.h_o + e.roof_R
        hr = 5.5 * e.roof_eps_in
        tri = (tsa / r_out + p.hc_roof * Ta + hr * Tb) / (1.0 / r_out + p.hc_roof + hr)
        q_roof_air = p.hc_roof * (tri - Ta) * g.A_roof
        q_roof_mass = hr * (tri - Tb) * g.A_roof
        # dinding
        tsw = To + (e.wall_alpha * p.f_wall_sun * I - e.roof_eps_out * p.dR_wall * cf) / p.h_o
        rw_out = 1.0 / p.h_o + e.wall_R
        hrw = 5.5 * e.wall_eps_in
        twi = (tsw / rw_out + p.hc_wall * Ta + hrw * Tb) / (1.0 / rw_out + p.hc_wall + hrw)
        q_wall_air = p.hc_wall * (twi - Ta) * g.A_wall
        q_wall_mass = hrw * (twi - Tb) * g.A_wall
        return tri, twi, q_roof_air, q_roof_mass, q_wall_air, q_wall_mass

    def step(self, sec_of_day, mist_on, fan_on, dt=1.0):
        e, p, g, o = self.env, self.p, self.g, self.out
        i = o.at(sec_of_day)
        Ta, Tb, rv, To, rvo = self.Ta, self.Tb, self.rv, o.T[i], o.rv[i]
        tri, twi, qra, qrm, qwa, qwm = self.surfaces(i, Ta, Tb)
        self.Tri, self.Twi = tri, twi
        # ventilasi
        Q = e.ach_leak * g.V / 3600.0 + (p.Q_fan / 3600.0 if fan_on else 0.0)         # m3/s
        hc_b = p.hc_bag_fan if fan_on else p.hc_bag
        # uap
        rs_a = rho_sat(Ta) / 1000.0
        rh = rv / rs_a
        m_mist = p.m_noz if mist_on else 0.0
        phi = clamp((1.0 - rh) / 0.25, 0.1, 1.0) if mist_on else 0.0
        m_air = phi * m_mist                       # menguap langsung di udara
        m_dep = m_mist - m_air                     # jadi air permukaan
        a_wet = p.A_wet_max * min(1.0, self.Ws / p.Ws_full)
        hm = hc_b / RHO_CP
        e_s = min(hm * a_wet * max(0.0, rho_sat(Tb) / 1000.0 - rv), self.Ws / dt)
        e_bio = hm * p.A_bio * max(0.0, rho_sat(Tb) / 1000.0 - rv)
        m_c_roof = max(0.0, rv - rho_sat(tri) / 1000.0) * (p.hc_roof / RHO_CP) * g.A_roof
        m_c_wall = max(0.0, rv - rho_sat(twi) / 1000.0) * (p.hc_wall / RHO_CP) * g.A_wall
        drv = (Q * (rvo - rv) + m_air + e_s + e_bio - m_c_roof - m_c_wall) / g.V
        # suhu
        dTa = (Q * RHO_CP * (To - Ta) + qra + qwa + hc_b * p.A_bag * (Tb - Ta) - L_VAP * m_air) / self.C_air
        dTb = (hc_b * p.A_bag * (Ta - Tb) + qrm + qwm + p.G_ground * (p.T_ground - Tb) + self.q_met_w - L_VAP * (e_s + e_bio)) / self.C_m
        self.Ta += dTa * dt
        self.Tb += dTb * dt
        self.rv = rv + drv * dt
        self.Ws += (m_dep + m_c_roof + m_c_wall - e_s) * dt
        # jenuh -> embun di volume udara (lepas panas laten)
        rs = rho_sat(self.Ta) / 1000.0
        if self.rv > rs:
            ex = (self.rv - rs) * g.V
            self.rv = rs
            self.Ws += ex
            self.Ta += L_VAP * ex / self.C_air
            self.acc["cond"] += ex
        if self.Ws > p.Ws_cap:
            self.acc["drain"] += self.Ws - p.Ws_cap
            self.Ws = p.Ws_cap
        a = self.acc
        a["mist_in"] += m_mist * dt
        a["bio_in"] += e_bio * dt
        a["vent_net_out"] += Q * (rv - rvo) * dt
        a["cond"] += (m_c_roof + m_c_wall) * dt
        a["evap_s"] += e_s * dt
        a["evap_air"] += m_air * dt
        a["q_roof"] += (qra + qrm) * dt
        a["q_wall"] += (qwa + qwm) * dt


# ----------------------------------------------------------------------------------------------------------
# PENJALAN: free-float (aktuator mati) dan dengan controller asli
# ----------------------------------------------------------------------------------------------------------
def _summ(rows, tmax_line=27.0):
    """rows: (Ta, RH, Tb) per menit untuk 1 hari."""
    n = len(rows)
    ta = [r[0] for r in rows]
    rh = [r[1] for r in rows]
    return dict(Ta_max=max(ta), Ta_min=min(ta), Ta_mean=statistics.mean(ta), RH_mean=statistics.mean(rh), RH_min=min(rh),
                h_gt27=sum(t > 27 for t in ta) / 60.0, h_gt30=sum(t > 30 for t in ta) / 60.0, h_gt32=sum(t > 32 for t in ta) / 60.0,
                pct_rh_lt85=100.0 * sum(r < 85 for r in rh) / n, pct_rh_gt95=100.0 * sum(r > 95 for r in rh) / n)


def run_free(env, month, kind="rata2", days=3, pl=Plant(), geo=Geo(), td_amp=1.0, rh0=0.85):
    out = Outdoor(month, kind, td_amp)
    m = Model(env, out, geo, pl, rh0)
    rows = []
    for d in range(days):
        a0 = dict(m.acc)
        day_rows = []
        for s in range(86400):
            m.step(s, False, False)
            if s % 60 == 0:
                day_rows.append((m.Ta, m.RH, m.Tb))
        rows = day_rows
    r = _summ(rows)
    r["Tb_mean"] = statistics.mean(x[2] for x in rows)
    r["roof_MJ"] = m.acc["q_roof"] / days / 1e6          # energi atap per hari (rata-rata hari-hari simulasi), MJ
    r["Tri_max"] = m.Tri
    return r


_RNG_OUT = random.Random(7)       # noise sensor luar dipisah supaya urutan RNG controller asli tidak berubah


def write_to_state(sim, st, ta, rh, t_out=None):
    """Tulis kondisi plant ke 3 sensor ala simulate_tick(): offset zona + noise + clamp + rata-rata tertimbang.
    t_out: suhu luar (sensor luar USULAN, noise 0.3 K); controller asli tidak membacanya."""
    st.outdoor_temp = None if t_out is None else t_out + _RNG_OUT.gauss(0.0, 0.3)
    for z, cfg in sim.SENSOR_ZONES.items():
        s = st.sensors[z]
        t, h = ta + cfg["temp_offset"], rh + cfg["hum_offset"]
        s["true_temperature"], s["true_humidity"] = t, h
        s["temperature"] = clamp(round(t + random.gauss(0, cfg["noise_temp"]), 1), sim.TEMP_MIN_PHYSICAL, sim.TEMP_MAX_PHYSICAL)
        s["humidity"] = clamp(round(h + random.gauss(0, cfg["noise_hum"]), 1), sim.HUM_MIN_PHYSICAL, sim.HUM_MAX_PHYSICAL)
    A, B, C = st.sensors["A"], st.sensors["B"], st.sensors["C"]
    st.temperature = 0.35 * A["temperature"] + 0.40 * B["temperature"] + 0.25 * C["temperature"]
    st.humidity = 0.35 * A["humidity"] + 0.40 * B["humidity"] + 0.25 * C["humidity"]


PRESET = {"dokumen": dict(temp=(23.0, 27.0), hum=(85.0, 95.0)),          # target file analisis iklim
          "fruiting": dict(temp=(24.0, 32.0), hum=(85.0, 95.0)),         # PHASE_PRESETS Settings.tsx
          "seed": dict(temp=(24.0, 32.0), hum=(80.0, 95.0)),              # default seeder backend
          "literatur": dict(temp=(20.0, 28.0), hum=(85.0, 95.0))}         # rentang fruiting yg lebih lebar (file iklim sec.: "20-25 sampai 23-28")

_SIM = {}
_LOCK = ("        if is_night:\n"
         "            # Pengecualian darurat ekstrem: hanya boleh nyala jika terjadi dehidrasi parah (relatif terhadap hum_min)\n"
         "            if hum >= state.hum_min - 15.0 and min_hum >= state.hum_min - 20.0:\n"
         "                return\n")
# USULAN P1 "kipas pintar": butuh 1 sensor suhu LUAR (DS18B20/DHT22 ternaungi) -> state.outdoor_temp.
# Kipas pendingin (Tier 1 dan Safety Override) hanya jalan kalau udara luar lebih dingin dari rata-rata dalam; histeresis 1 K supaya
# relay tidak 'chattering': boleh ON jika T_luar < T_dalam - 1.0, harus OFF jika T_luar > T_dalam. Kalau kipas tidak berguna, biarkan
# kabut (pendinginan evaporatif) bekerja: pemblokir F-10b dilewati.
_FAN_HELPER = ("FAN_ON_DELTA, FAN_OFF_DELTA = 1.0, 0.0   # [USULAN] K\n\n\n"
               "def _fan_useful(state, temp):\n"
               "    t_out = getattr(state, 'outdoor_temp', None)\n"
               "    if t_out is None:\n"
               "        return True\n"
               "    ok = getattr(state, '_fan_ok', True)\n"
               "    if ok and t_out > temp - FAN_OFF_DELTA:\n"
               "        ok = False\n"
               "    elif (not ok) and t_out < temp - FAN_ON_DELTA:\n"
               "        ok = True\n"
               "    state._fan_ok = ok\n"
               "    return ok\n\n\n"
               "def control_misting(state: KumbungState):")
# USULAN P3: kabut untuk PENDINGINAN jangan bikin RH melewati humMax (tahan mulai di humMax-3, berhenti di humMax-1)
_RH_GUARD_PATCHES = [
    ("            if temp > state.temp_max and hum >= state.hum_max:\n",
     "            if temp > state.temp_max and hum >= state.hum_max - 3.0:\n"),
    ("        target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max)\n",
     "        target_reached = (hum >= state.rh_trigger_high and temp <= state.temp_max) or hum >= state.hum_max - 1.0\n"),
]
_FAN_PATCHES = [
    ("def control_misting(state: KumbungState):", _FAN_HELPER),
    ("        if state.get_max_temp() > state.temp_max + CRITICAL_TEMP_OFFSET:\n            return\n",
     "        if state.get_max_temp() > state.temp_max + CRITICAL_TEMP_OFFSET and _fan_useful(state, temp):\n            return\n"),
    ("    if max_temp > critical_threshold:\n        # Jika misting sedang aktif",
     "    if max_temp > critical_threshold and _fan_useful(state, temp):\n        # Jika misting sedang aktif"),
    ("    if state.is_fan_active and getattr(state, 'is_critical_override', False):\n        if max_temp <= (critical_threshold - 1.0) and temp <= state.temp_max:\n",
     "    if state.is_fan_active and getattr(state, 'is_critical_override', False):\n        if (max_temp <= (critical_threshold - 1.0) and temp <= state.temp_max) or not _fan_useful(state, temp):\n"),
    ("    temp_stop_threshold = state.temp_max - TEMP_HYSTERESIS\n    if temp > state.temp_max:\n        if not state.is_fan_active and not state.is_misting_active:\n",
     "    temp_stop_threshold = state.temp_max - TEMP_HYSTERESIS\n    if temp > state.temp_max and _fan_useful(state, temp):\n        if not state.is_fan_active and not state.is_misting_active:\n"),
    ("    elif temp <= temp_stop_threshold:\n        if state.is_fan_active and not is_homo",
     "    elif temp <= temp_stop_threshold or not _fan_useful(state, temp):\n        if state.is_fan_active and not is_homo"),
]
# USULAN P2': night lockout diganti pembatas duty: histeresis normal tetap berlaku di malam hari, tapi jeda minimal 600 s antar siklus misting
# (duty malam <= ~13%; siklus tipikal 30-60 s -> ~5-9%). Untuk yang khawatir lantai/baglog basah terus semalaman.
_LOCK_LIMITED = ("        if is_night:\n"
                 "            # [USULAN] malam: histeresis normal berlaku, tapi jeda minimal 600 s antar siklus misting (batasi duty malam)\n"
                 "            if state.misting_last_stop_time > 0 and (time.time() - state.misting_last_stop_time) < 600.0:\n"
                 "                return\n")
VARIANTS = {
    "asli": [],
    # night lockout dihapus (hanya untuk melihat efeknya, BUKAN usulan)
    "malam_bebas": [(_LOCK, "")],
    # ambang darurat malam dilonggarkan: misting malam boleh jika rata-rata < humMin-5 atau satu sensor < humMin-10
    "malam_longgar": [(_LOCK, _LOCK.replace("state.hum_min - 15.0", "state.hum_min - 5.0").replace("state.hum_min - 20.0", "state.hum_min - 10.0"))],
    # usulan P1+P3: sensor luar + aturan kipas berhisteresis + pagar RH untuk kabut pendingin (night lockout TIDAK diubah)
    "kipas_pintar": list(_FAN_PATCHES) + list(_RH_GUARD_PATCHES),
    # usulan penuh P1+P2+P3: + night lockout dihapus (batas atas manfaat; lihat catatan risiko tetesan malam di dokumen)
    "usulan": list(_FAN_PATCHES) + list(_RH_GUARD_PATCHES) + [(_LOCK, "")],
    # usulan "aman": P1+P3 + malam dibatasi duty-nya (P2') alih-alih night lockout dihapus total
    "usulan_aman": list(_FAN_PATCHES) + list(_RH_GUARD_PATCHES) + [(_LOCK, _LOCK_LIMITED)],
}


def get_sim(path, variant="asli"):
    key = (path, variant)
    if key not in _SIM:
        _SIM[key] = load_sim(path, VARIANTS[variant])
    return _SIM[key]


def run_control(sim_path, env, month, kind="rata2", preset="dokumen", days=4, pl=Plant(), geo=Geo(), seed=1, td_amp=1.0, variant="asli"):
    sim = get_sim(sim_path, variant)
    random.seed(seed)
    _RNG_OUT.seed(7 + seed)
    out = Outdoor(month, kind, td_amp)
    m = Model(env, out, geo, pl)
    th = PRESET[preset]
    logs = []
    sim.send_actuator_log = lambda d, tr, sr, a="misting": logs.append((d, tr, sr, a))
    sim.send_sensor_data = lambda *a, **k: True
    rows, pump_s, fan_s, mist_cycles, fan_cycles, npump_s = [], 0, 0, 0, 0, 0
    prev_mist = prev_fan = False
    with FakeClock(sim, month=month, day=10) as ck, contextlib.redirect_stdout(io.StringIO()):     # controller nge-print banyak
        wg = sim.WeatherGenerator(forced_weather="cerah", custom_month=month)
        st = sim.KumbungState(weather_gen=wg)
        st.update_thresholds({"temp_min": th["temp"][0], "temp_max": th["temp"][1], "humidity_min": th["hum"][0], "humidity_max": th["hum"][1]})
        m.acc = {k: 0.0 for k in m.acc}
        for i in range(days * 86400):
            ck.t += 1.0
            sod = i % 86400
            if i == (days - 1) * 86400:                      # mulai hitung hari terakhir (hari sebelumnya = pemanasan)
                m.acc = {k: 0.0 for k in m.acc}
                pump_s = fan_s = mist_cycles = fan_cycles = npump_s = 0
                rows = []
            m.step(sod, st.is_misting_active, st.is_fan_active)
            if i % 5 == 4:
                write_to_state(sim, st, m.Ta, m.RH, t_out=out.T[out.at(sod)])
                sim.control_misting(st)
                sim.control_fan(st)
            if i >= (days - 1) * 86400:
                pump_s += bool(st.is_misting_active)
                if sod >= 17 * 3600 or sod < 6 * 3600:             # jam malam menurut controller (17:00-06:00)
                    npump_s += bool(st.is_misting_active)
                fan_s += bool(st.is_fan_active)
                mist_cycles += bool(st.is_misting_active) and not prev_mist
                fan_cycles += bool(st.is_fan_active) and not prev_fan
                prev_mist, prev_fan = bool(st.is_misting_active), bool(st.is_fan_active)
                if sod % 60 == 0:
                    rows.append((m.Ta, m.RH, m.Tb))
    r = _summ(rows)
    n = len(rows)
    t_lo, t_hi = th["temp"]
    h_lo, h_hi = th["hum"]
    r.update(pct_t_gt_max=100.0 * sum(x[0] > t_hi for x in rows) / n, pct_t_lt_min=100.0 * sum(x[0] < t_lo for x in rows) / n,
             pct_ok=100.0 * sum((t_lo <= x[0] <= t_hi) and (h_lo <= x[1] <= h_hi) for x in rows) / n,
             pump_min=pump_s / 60.0, fan_min=fan_s / 60.0, water_L=m.acc["mist_in"], mist_cycles=mist_cycles, fan_cycles=fan_cycles,
             night_pump_min=npump_s / 60.0, drain_L=m.acc["drain"], bio_L=m.acc["bio_in"], cond_L=m.acc["cond"], evap_surf_L=m.acc["evap_s"], vent_L=m.acc["vent_net_out"])
    # RH di jam malam (21-05) = periode night lockout
    night = [x[1] for k, x in enumerate(rows) if (k // 60) >= 21 or (k // 60) < 5]
    r["RH_night_mean"] = statistics.mean(night)
    r["pct_night_rh_lt85"] = 100.0 * sum(v < 85 for v in night) / len(night)
    return r


# ----------------------------------------------------------------------------------------------------------
# SUITE
# ----------------------------------------------------------------------------------------------------------
def suite_selftest(sim_path):
    print("\n== SELFTEST ==")
    # 1) fluks atap vs hitungan tangan
    p, g = Plant(), Geo()
    out = Outdoor(7, "terik")
    for key in ("A0", "A1", "A2", "A3", "A5"):
        env = make_env(key, "W0")
        m = Model(env, out, g, p)
        i = 13 * 60                                    # 13:00 WIB
        # hitung tangan: Ta=Tb=28
        e = env
        sh_ = e.roof_shade
        tsa = out.T[i] + (e.roof_alpha * (1 - sh_) * out.I[i] + sh_ * 0.9 * 5.5 * 0.005 * out.I[i]
                          - e.roof_eps_out * p.dR_roof * out.cf * (1 - 0.9 * sh_)) / p.h_o
        hr = 5.5 * e.roof_eps_in
        r_out = 1 / p.h_o + e.roof_R
        # solusi tertutup untuk Ta=Tb=28: fluks = (tsa-28)/(r_out + 1/(hc+hr))
        q_hand = (tsa - 28.0) / (r_out + 1.0 / (p.hc_roof + hr))
        tri, twi, qra, qrm, qwa, qwm = m.surfaces(i, 28.0, 28.0)
        q_code = (qra + qrm) / g.A_roof
        print(f"  atap {key:<4} 13:00 hari terik: I={out.I[i]:.0f} W/m2  T_sol-air={tsa:.1f} C  fluks (tangan)={q_hand:.1f}  (kode)={q_code:.1f} W/m2  "
              f"{'OK' if abs(q_hand - q_code) < 0.05 else 'BEDA'}")
    # 2) kotak tertutup: kalor metabolik saja -> kenaikan suhu = q*t/(C_air+C_m)
    pl = replace(p, G_ground=0.0, A_bio=0.0)
    env = Env(name="tertutup", roof_alpha=0.0, roof_R=1e6, roof_eps_in=0.0, wall_alpha=0.0, wall_R=1e6, wall_eps_in=0.0, ach_leak=0.0, roof_eps_out=0.0)
    flat = Outdoor(7, "rata2")
    flat.I = [0.0] * 1440
    m = Model(env, flat, g, pl, rh0=0.5)
    t0 = m.Ta
    for s in range(86400):
        m.step(s, False, False)
    pred = m.q_met_w * 86400 / (m.C_air + m.C_m)
    print(f"  kotak tertutup + kalor metabolik {m.q_met_w:.0f} W: dT 24 jam model = {m.Ta - t0:.3f} K, prediksi = {pred:.3f} K  "
          f"{'OK' if abs((m.Ta - t0) - pred) < 0.02 else 'BEDA'}")
    # 3) neraca air: kabut + ventilasi acak, semua jalur dihitung
    env = make_env("A0", "W0")
    out = Outdoor(7, "rata2")
    m = Model(env, out, g, p)
    rng = random.Random(5)
    mist = fan = False
    v0 = m.rv * g.V + m.Ws
    for s in range(2 * 86400):
        if s % 300 == 0:
            mist, fan = rng.random() < 0.2, rng.random() < 0.15
        m.step(s % 86400, mist, fan)
    a = m.acc
    storage = m.rv * g.V + m.Ws - v0
    # air masuk: kabut. keluar: ventilasi netto, drain. kondensasi & penguapan permukaan hanya memindahkan antar tampungan (udara<->Ws)
    resid = a["mist_in"] + a["bio_in"] - a["vent_net_out"] - a["drain"] - storage
    print(f"  neraca air 2 hari (kabut {a['mist_in']:.2f} kg + biologis {a['bio_in']:.2f} kg, ventilasi netto-keluar {a['vent_net_out']:.2f} kg, tiris {a['drain']:.2f} kg, "
          f"simpanan {storage:.2f} kg): sisa = {resid:.4f} kg  {'OK' if abs(resid) < 0.01 * max(1.0, a['mist_in']) else 'BEDA'}")
    # 4) jenuh: kabut terus-menerus tanpa ventilasi -> RH <= 100%
    env0 = replace(make_env("A0", "W0"), ach_leak=0.0)
    m = Model(env0, out, g, p)
    mx = 0.0
    for s in range(3600):
        m.step(s, True, False)
        mx = max(mx, m.RH)
    print(f"  kabut terus 1 jam tanpa ventilasi: RH maks = {mx:.2f}% (harus <= 100), Ws = {m.Ws:.1f} kg, tiris {m.acc['drain']:.1f} kg")


def _fmt_free(tag, r):
    return (f"  {tag:<34}{r['Ta_max']:>7.1f}{r['Ta_mean']:>7.1f}{r['h_gt27']:>8.1f}{r['h_gt30']:>8.1f}{r['h_gt32']:>8.1f}{r['roof_MJ']:>9.0f}")


def suite_roof():
    print("\n== ATAP: free-float (kipas & kabut MATI), baglog 3000, kumbung 5x7 m, hari ke-3 ==")
    cases = [(7, "rata2", "Juli, hari rata-rata"), (7, "terik", "Juli, hari terik"), (10, "terik", "Oktober, hari terik"), (1, "rata2", "Januari, hari rata-rata")]
    for wall in ("W0", "W1"):
        for month, kind, label in cases:
            print(f"\n  [{label}]  dinding {WALL_LABEL[wall]}")
            print(f"  {'atap':<34}{'Ta maks':>7}{'Ta rata':>7}{'jam>27':>8}{'jam>30':>8}{'jam>32':>8}{'atap MJ/hr':>9}")
            for key in ("A0", "A0k", "A1", "A1b", "A2", "A2w", "A3", "A4", "A5", "A6", "T1", "S1"):
                r = run_free(make_env(key, wall), month, kind)
                print(_fmt_free(f"{key} {ROOF_LABEL[key]}", r), flush=True)


def suite_wall():
    print("\n== DINDING: free-float, atap A0 (asbes polos) dan A3 (cat putih + foil), hari terik Juli & Oktober ==")
    print(f"  {'kombinasi':<44}{'Ta maks':>8}{'Ta rata':>8}{'jam>30':>8}{'RH rata':>9}{'RH min':>8}")
    for roof in ("A0", "A3"):
        for month in (7, 10):
            for wall in ("W0o", "W0", "W0r", "W1", "W3"):
                r = run_free(make_env(roof, wall), month, "terik")
                print(f"  {roof} + {WALL_LABEL[wall]:<28} ({MONTH_ID[month]}){r['Ta_max']:>8.1f}{r['Ta_mean']:>8.1f}{r['h_gt30']:>8.1f}{r['RH_mean']:>9.1f}{r['RH_min']:>8.1f}", flush=True)


def suite_water():
    print("\n== KEBUTUHAN AIR UNTUK MENAHAN 26 C / 88% RH (hitungan langsung: Q x (uap dalam - uap luar)) ==")
    g = Geo()
    print(f"  uap dalam = {abs_hum(26, 88):.1f} g/m3.  L/hari = ACH x {g.V} m3 x 24 jam x (uap dalam - uap luar rata-rata hari) / 1000  (air laten saja)")
    print(f"  {'ACH':>5}" + "".join(f"{MONTH_ID[m] + ' (RH luar ' + str(CLIM[m][4]) + '%)':>22}" for m in (1, 7, 10)))
    outs = {m: statistics.mean(Outdoor(m, 'rata2').rv) * 1000.0 for m in (1, 7, 10)}
    for ach in (1.0, 1.5, 2.0, 4.0, 8.0, 12.0):
        row = f"  {ach:>5.1f}"
        for m in (1, 7, 10):
            row += f"{ach * g.V * 24 * (abs_hum(26, 88) - outs[m]) / 1000.0:>22.0f}"
        print(row)
    print("  (uap luar rata-rata hari: " + ", ".join(f"{MONTH_ID[m]} {outs[m]:.1f} g/m3" for m in (1, 7, 10)) + ")")
    print("  Belum termasuk: air yang menetes/terbuang ke lantai, kondensasi di atap, dan penguapan fraksi kabut yang jadi genangan.")


def _job(args):
    sim_path, roof, wall, month, kind, preset, over = args
    pl = replace(Plant(), **over.get("pl", {})) if over.get("pl") else Plant()
    env = make_env(roof, wall, **over.get("env", {}))
    r = run_control(sim_path, env, month, kind, preset, pl=pl, variant=over.get("variant", "asli"),
                    td_amp=over.get("td_amp", 1.0), seed=over.get("seed", 1))
    return args, r


def _fmt_ctl(tag, r):
    return (f"  {tag:<30}{r['Ta_max']:>6.1f}{r['pct_t_gt_max']:>7.0f}{r['h_gt30']:>6.1f}{r['RH_mean']:>7.1f}{r['pct_rh_lt85']:>7.0f}{r['pct_rh_gt95']:>7.0f}"
            f"{r['pct_night_rh_lt85']:>8.0f}{r['pump_min']:>7.0f}{r['fan_min']:>6.0f}{r['water_L']:>7.0f}{r['mist_cycles']:>6d}{r['fan_cycles']:>6d}{r['pct_ok']:>6.0f}")


CTL_HDR = (f"  {'kombinasi':<30}{'Ta mx':>6}{'%T>max':>7}{'j>30':>6}{'RH rt':>7}{'%RH<85':>7}{'%RH>95':>7}{'%mlm<85':>8}{'pompa':>7}{'kipas':>6}{'air L':>7}{'#mist':>6}{'#fan':>6}{'%OK':>6}")


def suite_control(sim_path, procs=2):
    print("\n== CONTROLLER ASLI (iot_simulator.py) DI ATAS MODEL KUMBUNG. Hari ke-4 dari 4. preset = 'dokumen' (23-27 C, 85-95%) kecuali disebut ==")
    print("   %T>max = % waktu suhu rata-rata > tempMax;  j>30 = jam suhu udara > 30 C;  %mlm<85 = % jam 21-05 dengan RH < 85;")
    print("   pompa/kipas = menit ON per hari;  air L = air kabut per hari;  %OK = % waktu T dan RH keduanya di dalam rentang preset")
    envs = [("A0", "W0"), ("A1", "W0"), ("A3", "W1"), ("A4", "W1"), ("T1", "W0"), ("S1", "W1")]
    jobs = []
    for month, kind in ((7, "rata2"), (7, "terik"), (10, "terik"), (1, "rata2")):
        for roof, wall in envs:
            jobs.append((sim_path, roof, wall, month, kind, "dokumen", {}))
    with ProcessPoolExecutor(max_workers=procs) as ex:
        res = list(ex.map(_job, jobs))
    last = None
    for a, r in res:
        key = (a[3], a[4])
        if key != last:
            print(f"\n  [{MONTH_ID[a[3]]}, hari {a[4]}]")
            print(CTL_HDR)
            last = key
        print(_fmt_ctl(f"{a[1]}+{a[2]} {ROOF_LABEL[a[1]][:14]}", r), flush=True)


def suite_break(sim_path, procs=2):
    """Rincian kenapa %OK tidak 100%: porsi waktu di luar rentang (dingin/panas/kering/basah) + neraca air harian."""
    cases = ((7, "rata2"), (7, "terik"), (10, "terik"), (1, "rata2"))
    combos = [(r, w, v) for r, w in (("A0", "W0"), ("A1", "W0"), ("A5", "W0"), ("A3", "W1")) for v in ("asli", "usulan")]
    jobs = [(sim_path, r, w, m, k, "dokumen", {"variant": v}) for m, k in cases for r, w, v in combos]
    with ProcessPoolExecutor(max_workers=procs) as ex:
        res = list(ex.map(_job, jobs))
    print("\n== RINCIAN WAKTU DI LUAR RENTANG DAN NERACA AIR (preset dokumen 23-27 C / 85-95%) ==")
    print("   %T<23 / %T>27 / %RH<85 / %RH>95 = % waktu sehari; %OK = T dan RH sama-sama dalam rentang. Air (L/hari): kabut masuk, biologis masuk,")
    print("   ventilasi bawa keluar (netto), kondensasi atap+dinding (terbentuk), tiris (kelebihan >20 kg di lantai)")
    last = None
    for a, r in res:
        key = (a[3], a[4])
        if key != last:
            print(f"\n  [{MONTH_ID[a[3]]}, hari {a[4]}]")
            print(f"  {'kombinasi':<26}{'%T<23':>7}{'%T>27':>7}{'%RH<85':>8}{'%RH>95':>8}{'%OK':>6}{'kabut':>7}{'biol.':>7}{'vent.':>7}{'kond.':>7}{'tiris':>7}")
            last = key
        tag = f"{a[1]}+{a[2]} [{a[6]['variant']}]"
        print(f"  {tag:<26}{r['pct_t_lt_min']:>7.0f}{r['pct_t_gt_max']:>7.0f}{r['pct_rh_lt85']:>8.0f}{r['pct_rh_gt95']:>8.0f}{r['pct_ok']:>6.0f}"
              f"{r['water_L']:>7.1f}{r['bio_L']:>7.1f}{r['vent_L']:>7.1f}{r['cond_L']:>7.1f}{r['drain_L']:>7.1f}", flush=True)


def _cross_job(args):
    """Controller yang SAMA, tapi di 'dunia' iot_simulator.py sendiri (simulate_tick: relaksasi ke ambient) dengan ambient tertambal S1."""
    sim_path, month, variant, seed, days = args
    src = open(sim_path, encoding="utf-8").read()
    sim = load_sim(sim_path, _s1_patches(src) + VARIANTS[variant])
    random.seed(seed)
    th = PRESET["dokumen"]
    sim.send_actuator_log = lambda *a, **k: None
    rows = []
    pump_s = fan_s = 0
    with FakeClock(sim, month=month, day=10) as ck, contextlib.redirect_stdout(io.StringIO()):
        wg = sim.WeatherGenerator(forced_weather="auto", custom_month=month)
        st = sim.KumbungState(weather_gen=wg)
        st.update_thresholds({"temp_min": th["temp"][0], "temp_max": th["temp"][1], "humidity_min": th["hum"][0], "humidity_max": th["hum"][1]})
        for i in range(days * 86400):
            ck.t += 1.0
            st.simulate_tick(1.0)
            st.outdoor_temp = wg.ambient(sim.get_wib_now())[0]       # sensor luar usulan = ambient S1 (tanpa noise)
            if i % 5 == 4:
                sim.control_misting(st)
                sim.control_fan(st)
            if i >= 86400:                                           # hari 1 = pemanasan
                pump_s += bool(st.is_misting_active)
                fan_s += bool(st.is_fan_active)
                if i % 60 == 0:
                    rows.append((st.temperature, st.humidity, ((i % 86400) // 3600)))
    n = len(rows)
    night = [r[1] for r in rows if r[2] >= 21 or r[2] < 5]
    nd = days - 1
    return args, dict(rh_mean=statistics.mean(r[1] for r in rows), rh_min=min(r[1] for r in rows),
                      pct_rh_lt85=100.0 * sum(r[1] < 85 for r in rows) / n, pct_night_lt85=100.0 * sum(v < 85 for v in night) / len(night),
                      pct_t_gt27=100.0 * sum(r[0] > 27.0 for r in rows) / n, pump_min=pump_s / 60.0 / nd, fan_min=fan_s / 60.0 / nd)


def suite_cross(sim_path, procs=2):
    """Cek silang antar-plant: apakah temuan controller (night lockout, interlock) muncul juga di 'dunia' simulator sendiri?"""
    print("\n== CEK SILANG: controller yang sama di DUNIA iot_simulator.py (simulate_tick) dengan ambient S1; 3 hari/run, hari 2-3 dianalisis; 2 seed ==")
    print("   (BUKAN model amplop. Kalau arah temuannya sama di dua plant yang berbeda, temuan itu soal logika kontrol, bukan soal asumsi fisika gw.)")
    jobs = [(sim_path, m, v, s, 3) for m in (1, 7, 10) for v in ("asli", "malam_bebas", "usulan") for s in (1, 2)]
    with ProcessPoolExecutor(max_workers=procs) as ex:
        res = list(ex.map(_cross_job, jobs))
    print(f"  {'bln':<5}{'varian':<14}{'RH rata':>8}{'RH min':>8}{'%RH<85':>8}{'%mlm<85':>9}{'%T>27':>7}{'pompa':>7}{'kipas':>7}")
    agg = {}
    for a, r in res:
        agg.setdefault((a[1], a[2]), []).append(r)
    for (m, v), rs in agg.items():
        mean = lambda k: statistics.mean(x[k] for x in rs)          # noqa: E731
        print(f"  {MONTH_ID[m]:<5}{v:<14}{mean('rh_mean'):>8.1f}{mean('rh_min'):>8.0f}{mean('pct_rh_lt85'):>8.0f}{mean('pct_night_lt85'):>9.0f}"
              f"{mean('pct_t_gt27'):>7.0f}{mean('pump_min'):>7.0f}{mean('fan_min'):>7.0f}", flush=True)


def suite_sens(sim_path, procs=2):
    print("\n== SENSITIVITAS (Juli, hari terik; atap A0 vs A3, dinding W0 vs W1) ==")
    base = dict(sim_path=sim_path)
    jobs, tags = [], []

    def add(tag, roof, wall, over, preset="dokumen", month=7, kind="terik"):
        jobs.append((sim_path, roof, wall, month, kind, preset, over))
        tags.append(tag)

    for roof, wall in (("A0", "W0"), ("A3", "W1")):
        add(f"{roof}+{wall} dasar", roof, wall, {})
        add(f"{roof}+{wall} kipas 1020 m3/j", roof, wall, {"pl": {"Q_fan": 1020.0}})
        add(f"{roof}+{wall} kipas 2040 m3/j", roof, wall, {"pl": {"Q_fan": 2040.0}})
        add(f"{roof}+{wall} nozzle 0.1 L/mnt", roof, wall, {"pl": {"m_noz": 0.1 / 60.0}})
        add(f"{roof}+{wall} nozzle 0.4 L/mnt", roof, wall, {"pl": {"m_noz": 0.4 / 60.0}})
        add(f"{roof}+{wall} metab. 0.3 W/kg", roof, wall, {"pl": {"q_met": 0.3}})
        add(f"{roof}+{wall} malam longgar", roof, wall, {"variant": "malam_longgar"})
        add(f"{roof}+{wall} night lockout OFF", roof, wall, {"variant": "malam_bebas"})
        add(f"{roof}+{wall} preset fruiting 24-32", roof, wall, {}, preset="fruiting")
        add(f"{roof}+{wall} A_bio 0 (tanpa biologis)", roof, wall, {"pl": {"A_bio": 0.0}})
        add(f"{roof}+{wall} A_bio 3.5 m2", roof, wall, {"pl": {"A_bio": 3.5}})
        add(f"{roof}+{wall} A_bio 14 m2", roof, wall, {"pl": {"A_bio": 14.0}})
        add(f"{roof}+{wall} td_amp 0 (Td konstan)", roof, wall, {"td_amp": 0.0})
        add(f"{roof}+{wall} td_amp 2 K", roof, wall, {"td_amp": 2.0})
        for sd in (2, 3, 4):
            add(f"{roof}+{wall} seed {sd}", roof, wall, {"seed": sd})
    with ProcessPoolExecutor(max_workers=procs) as ex:
        res = list(ex.map(_job, jobs))
    print(CTL_HDR)
    for tag, (a, r) in zip(tags, res):
        print(_fmt_ctl(tag, r), flush=True)


def suite_ctl2(sim_path, procs=2):
    """Matriks utama untuk dokumen: (R) efek atap, (W) efek dinding, (C) efek logika kontrol."""
    cases = ((7, "rata2"), (7, "terik"), (10, "terik"), (1, "rata2"))
    blocks = []
    blocks.append(("R. EFEK ATAP (dinding bambu rapat 4 ACH, controller ASLI, preset dokumen 23-27 C / 85-95%)",
                   [(roof, "W0", "asli") for roof in ("A0", "A0k", "A1", "A5", "A3", "A4", "T1", "S1")]))
    blocks.append(("W. EFEK DINDING (atap asbes polos A0, controller ASLI)",
                   [("A0", wall, "asli") for wall in ("W0o", "W0", "W0r", "W1", "W3")]))
    blocks.append(("C. EFEK LOGIKA KONTROL (atap+dinding tetap; asli | night lockout OFF | kipas pintar | usulan = kipas pintar + night lockout OFF)",
                   [(roof, wall, v) for roof, wall in (("A0", "W0"), ("A1", "W0"), ("A3", "W1")) for v in ("asli", "malam_bebas", "kipas_pintar", "usulan")]))
    for title, combos in blocks:
        jobs = [(sim_path, roof, wall, month, kind, "dokumen", {"variant": v}) for month, kind in cases for roof, wall, v in combos]
        with ProcessPoolExecutor(max_workers=procs) as ex:
            res = list(ex.map(_job, jobs))
        print(f"\n== {title} ==")
        print("   %T>max = % waktu suhu rata-rata > tempMax (27);  j>30 = jam suhu udara > 30 C;  %mlm<85 = % jam 21-05 dengan RH < 85; pompa/kipas = menit ON/hari")
        last = None
        for a, r in res:
            key = (a[3], a[4])
            if key != last:
                print(f"\n  [{MONTH_ID[a[3]]}, hari {a[4]}]")
                print(CTL_HDR)
                last = key
            tag = f"{a[1]}+{a[2]}" + (f" [{a[6]['variant']}]" if a[6].get("variant", "asli") != "asli" or title.startswith("C.") else "")
            print(_fmt_ctl(tag, r), flush=True)


def suite_sensfree():
    """Ketahanan URUTAN atap terhadap asumsi parameter fisik. Free-float (aktuator mati), dinding W0, hari terik, atap saja."""
    roofs = ("A0", "A1", "A5", "A3", "T1", "S1")
    variants = [
        ("dasar", {}),
        ("langit lembap  dR_roof 30 W/m2", {"dR_roof": 30.0, "dR_wall": 10.0}),
        ("langit kering  dR_roof 80 W/m2", {"dR_roof": 80.0, "dR_wall": 25.0}),
        ("film luar h_o 10 (tanpa angin)", {"h_o": 10.0}),
        ("film luar h_o 25 (berangin)", {"h_o": 25.0}),
        ("hc_roof 0.8 W/m2K", {"hc_roof": 0.8}),
        ("hc_roof 2.0 W/m2K", {"hc_roof": 2.0}),
        ("massa lain 1.5 MJ/K", {"C_other": 1.5e6}),
        ("massa lain 6 MJ/K", {"C_other": 6.0e6}),
        ("metabolisme 0", {"q_met": 0.0}),
        ("metabolisme 0.3 W/kg", {"q_met": 0.3}),
        ("hc_bag 2 W/m2K", {"hc_bag": 2.0}),
        ("hc_bag 6 W/m2K", {"hc_bag": 6.0}),
    ]
    for month, kind, label in ((7, "terik", "Juli hari terik"), (10, "terik", "Oktober hari terik")):
        print(f"\n== KETAHANAN URUTAN ATAP ({label}, free-float, dinding bambu rapat) : Ta maks C ==")
        print(f"  {'variasi parameter':<34}" + "".join(f"{r:>7}" for r in roofs) + "   urutan (terdingin -> terpanas)")
        for tag, kw in variants:
            pl = replace(Plant(), **kw)
            vals = {r: run_free(make_env(r, "W0"), month, kind, pl=pl)["Ta_max"] for r in roofs}
            order = " < ".join(sorted(roofs, key=lambda r: vals[r]))
            print(f"  {tag:<34}" + "".join(f"{vals[r]:>7.1f}" for r in roofs) + f"   {order}", flush=True)
    print("\n== KURVA ALFA PERMUKAAN ATAP (asbes tanpa foil, free-float, dinding bambu rapat): makin kotor cat putih -> alfa naik ==")
    print(f"  {'alfa':>6}  {'keterangan':<34}{'Jul terik Ta mx':>16}{'atap MJ/hr':>12}{'Okt terik Ta mx':>17}{'atap MJ/hr':>12}")
    notes = {0.15: "cat putih BARU (Berdahl&Bretz)", 0.20: "putih baru, kualitas biasa", 0.30: "putih ~1-2 th (A1)", 0.40: "putih mulai kotor",
             0.45: "putih kotor/berjamur (A1b)", 0.60: "asbes polos baru (A0)", 0.75: "asbes tua/berlumut (A0k)"}
    for al, nt in notes.items():
        cells = []
        for month in (7, 10):
            r = run_free(make_env("A0", "W0", roof_alpha=al), month, "terik")
            cells += [r["Ta_max"], r["roof_MJ"]]
        print(f"  {al:>6.2f}  {nt:<34}{cells[0]:>16.1f}{cells[1]:>12.0f}{cells[2]:>17.1f}{cells[3]:>12.0f}", flush=True)
    print("\n== KURVA PARANET DI ATAS ATAP (asbes polos, free-float, dinding bambu rapat): fraksi radiasi yang diblok ==")
    print(f"  {'blok':>6}  {'Jul terik Ta mx':>16}{'atap MJ/hr':>12}{'Okt terik Ta mx':>17}{'atap MJ/hr':>12}")
    for sh in (0.0, 0.30, 0.50, 0.65, 0.75, 0.90):
        cells = []
        for month in (7, 10):
            r = run_free(make_env("A0", "W0", roof_shade=sh), month, "terik")
            cells += [r["Ta_max"], r["roof_MJ"]]
        print(f"  {sh:>6.2f}  {cells[0]:>16.1f}{cells[1]:>12.0f}{cells[2]:>17.1f}{cells[3]:>12.0f}", flush=True)


def suite_lit(sim_path, procs=2):
    """Skenario inti diulang dengan rentang 'literatur' 20-28 C / 85-95%: seberapa banyak %OK rendah itu soal DEFINISI rentang (malam dingin)?"""
    cases = ((7, "rata2"), (7, "terik"), (10, "terik"), (1, "rata2"))
    combos = [(r, w, v) for r, w in (("A0", "W0"), ("A1", "W0"), ("A3", "W1")) for v in ("asli", "usulan")]
    jobs = [(sim_path, r, w, m, k, "literatur", {"variant": v}) for m, k in cases for r, w, v in combos]
    with ProcessPoolExecutor(max_workers=procs) as ex:
        res = list(ex.map(_job, jobs))
    print("\n== RENTANG 'LITERATUR' 20-28 C / 85-95% (tempMax = 28, bukan 27) ==")
    print("   %T<20 / %T>28 / %RH<85 / %RH>95 = % waktu sehari; %OK = T dan RH sama-sama dalam rentang")
    last = None
    for a, r in res:
        key = (a[3], a[4])
        if key != last:
            print(f"\n  [{MONTH_ID[a[3]]}, hari {a[4]}]")
            print(f"  {'kombinasi':<26}{'Ta mx':>7}{'%T<20':>7}{'%T>28':>7}{'%RH<85':>8}{'%RH>95':>8}{'%OK':>6}{'pompa':>7}{'kipas':>7}{'air L':>7}")
            last = key
        tag = f"{a[1]}+{a[2]} [{a[6]['variant']}]"
        print(f"  {tag:<26}{r['Ta_max']:>7.1f}{r['pct_t_lt_min']:>7.0f}{r['pct_t_gt_max']:>7.0f}{r['pct_rh_lt85']:>8.0f}{r['pct_rh_gt95']:>8.0f}{r['pct_ok']:>6.0f}"
              f"{r['pump_min']:>7.0f}{r['fan_min']:>7.0f}{r['water_L']:>7.1f}", flush=True)


def suite_safe(sim_path, procs=2):
    """Night lockout: dihapus total (usulan) vs dibatasi duty-nya (usulan_aman) vs asli. Fokus: RH malam, menit pompa malam, air kabut."""
    cases = ((7, "rata2"), (7, "terik"), (10, "terik"), (1, "rata2"))
    combos = [(r, w, v) for r, w in (("A0", "W0"), ("A1", "W0"), ("A3", "W1")) for v in ("asli", "usulan_aman", "usulan")]
    jobs = [(sim_path, r, w, m, k, "dokumen", {"variant": v}) for m, k in cases for r, w, v in combos]
    with ProcessPoolExecutor(max_workers=procs) as ex:
        res = list(ex.map(_job, jobs))
    print("\n== NIGHT LOCKOUT: asli | usulan_aman (P1+P3, malam dibatasi jeda >= 600 s) | usulan (P1+P3, lockout dihapus) ==")
    print("   pompa malam = menit pompa ON antara 17:00-06:00; RH malam = rata-rata RH 21-05; %mlm<85 = % jam 21-05 dengan RH<85")
    last = None
    for a, r in res:
        key = (a[3], a[4])
        if key != last:
            print(f"\n  [{MONTH_ID[a[3]]}, hari {a[4]}]")
            print(f"  {'kombinasi':<26}{'RH rata':>8}{'RH mlm':>8}{'%RH<85':>8}{'%mlm<85':>9}{'pompa':>7}{'p.mlm':>7}{'air L':>7}{'#mist':>7}{'%OK':>6}")
            last = key
        tag = f"{a[1]}+{a[2]} [{a[6]['variant']}]"
        print(f"  {tag:<26}{r['RH_mean']:>8.1f}{r['RH_night_mean']:>8.1f}{r['pct_rh_lt85']:>8.0f}{r['pct_night_rh_lt85']:>9.0f}{r['pump_min']:>7.0f}"
              f"{r['night_pump_min']:>7.0f}{r['water_L']:>7.1f}{r['mist_cycles']:>7d}{r['pct_ok']:>6.0f}", flush=True)


def suite_trace(sim_path, roof, wall, month, kind, preset="dokumen", variant="asli"):
    """Jejak per jam hari terakhir dengan controller asli (untuk memahami KENAPA hasilnya begitu)."""
    sim = get_sim(sim_path, variant)
    random.seed(1)
    _RNG_OUT.seed(8)
    env = make_env(roof, wall)
    out = Outdoor(month, kind)
    m = Model(env, out)
    th = PRESET[preset]
    sim.send_actuator_log = lambda *a, **k: None
    rows = []
    with FakeClock(sim, month=month, day=10) as ck, contextlib.redirect_stdout(io.StringIO()):
        wg = sim.WeatherGenerator(forced_weather="cerah", custom_month=month)
        st = sim.KumbungState(weather_gen=wg)
        st.update_thresholds({"temp_min": th["temp"][0], "temp_max": th["temp"][1], "humidity_min": th["hum"][0], "humidity_max": th["hum"][1]})
        days = 4
        acc = {}
        for i in range(days * 86400):
            ck.t += 1.0
            sod = i % 86400
            m.step(sod, st.is_misting_active, st.is_fan_active)
            if i % 5 == 4:
                write_to_state(sim, st, m.Ta, m.RH, t_out=out.T[out.at(sod)])
                sim.control_misting(st)
                sim.control_fan(st)
            if i >= (days - 1) * 86400:
                h = sod // 3600
                a = acc.setdefault(h, dict(n=0, ta=0.0, tb=0.0, rh=0.0, mist=0, fan=0, ws=0.0, tri=0.0))
                a["n"] += 1
                a["ta"] += m.Ta
                a["tb"] += m.Tb
                a["rh"] += m.RH
                a["ws"] += m.Ws
                a["tri"] += m.Tri
                a["mist"] += bool(st.is_misting_active)
                a["fan"] += bool(st.is_fan_active)
    print(f"\n== JEJAK {roof}+{wall}, {MONTH_ID[month]} {kind}, preset {preset}, varian {variant} (rata-rata per jam, hari ke-4) ==")
    print(f"  {'jam':>4}{'T luar':>8}{'RH luar':>9}{'Ta':>7}{'Tb':>7}{'T atap':>8}{'RH dlm':>8}{'Ws kg':>7}{'pompa mnt':>10}{'kipas mnt':>10}")
    for h in range(24):
        a = out and acc[h]
        n = a["n"]
        print(f"  {h:>4}{out.T[h * 60 + 30]:>8.1f}{out.RH[h * 60 + 30]:>9.0f}{a['ta'] / n:>7.1f}{a['tb'] / n:>7.1f}{a['tri'] / n:>8.1f}{a['rh'] / n:>8.1f}{a['ws'] / n:>7.2f}{a['mist'] / 60.0:>10.1f}{a['fan'] / 60.0:>10.1f}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sim", default="iot_simulator.py")
    ap.add_argument("--suite", default="all", choices=["all", "selftest", "roof", "wall", "water", "control", "ctl2", "break", "cross", "sens", "sensfree", "lit", "safe", "trace"])
    ap.add_argument("--trace", nargs=4, metavar=("ATAP", "DINDING", "BULAN", "JENIS"), help="untuk --suite trace, mis. A0 W0 7 terik")
    ap.add_argument("--preset", default="dokumen", choices=list(PRESET))
    ap.add_argument("--variant", default="asli", choices=list(VARIANTS))
    ap.add_argument("--procs", type=int, default=2)
    a = ap.parse_args()
    if a.suite in ("all", "selftest"):
        suite_selftest(a.sim)
    if a.suite in ("all", "roof"):
        suite_roof()
    if a.suite in ("all", "wall"):
        suite_wall()
    if a.suite in ("all", "water"):
        suite_water()
    if a.suite in ("all", "control"):
        suite_control(a.sim, a.procs)
    if a.suite in ("all", "ctl2"):
        suite_ctl2(a.sim, a.procs)
    if a.suite in ("all", "break"):
        suite_break(a.sim, a.procs)
    if a.suite in ("all", "cross"):
        suite_cross(a.sim, a.procs)
    if a.suite in ("all", "sens"):
        suite_sens(a.sim, a.procs)
    if a.suite in ("all", "sensfree"):
        suite_sensfree()
    if a.suite in ("all", "lit"):
        suite_lit(a.sim, a.procs)
    if a.suite in ("all", "safe"):
        suite_safe(a.sim, a.procs)
    if a.suite == "trace":
        r_, w_, m_, k_ = a.trace
        suite_trace(a.sim, r_, w_, int(m_), k_, a.preset, a.variant)


if __name__ == "__main__":
    main()
