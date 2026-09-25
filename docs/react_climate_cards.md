# Panduan Komponen KPI Iklim: SemiCircleGauge & AnimatedNumber

Dokumen ini menjelaskan implementasi kartu indikator iklim (**Climate KPI Cards**) pada halaman utama Dashboard Smart Shroom SCM. Sistem menggunakan gaya desain **Harmonious Modern Sage Green & Dark Mode** yang dilengkapi dengan **Hardware-Accelerated Gauge Needle Animation** dan **60 FPS Number Counter**.

---

## 1. Arsitektur Komponen KPI

Alih-alih kartu statis kotak kaku, Dashboard menggunakan visualisasi dial setengah lingkaran (*semi-circle radial gauge*) dan interpolasi angka dinamis:

```
[Dashboard.tsx]
     ├── Kartu Suhu (°C)       ──> SemiCircleGauge (min: 15, max: 35) + AnimatedNumber
     ├── Kartu Kelembapan (%)  ──> SemiCircleGauge (min: 40, max: 100) + AnimatedNumber
     ├── Kartu Baglog Aktif    ──> AnimatedProgressBar (kapasitas 3.000) + AnimatedNumber
     └── Kartu Panen Hari Ini  ──> AnimatedProgressBar (target 15 KG) + AnimatedNumber
```

---

## 2. Kode Komponen Gauge (`frontend/src/components/SemiCircleGauge.tsx`)

Komponen ini merender SVG path busur setengah lingkaran (`minAngle = -90°`, `maxAngle = +90°`) dengan jarum penunjuk yang dirotasi menggunakan properti CSS `transform: rotate(...)` dan diakselerasi GPU.

```tsx
import React, { useEffect, useState } from 'react';

interface SemiCircleGaugeProps {
  value: number;
  min: number;
  max: number;
  unit: string;
  optimalMin?: number;
  optimalMax?: number;
  isDark?: boolean;
}

export default function SemiCircleGauge({
  value,
  min,
  max,
  unit,
  optimalMin,
  optimalMax,
  isDark = false,
}: SemiCircleGaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(min);

  // Buffer 50ms memastikan state 0 ter-render di DOM sebelum transisi CSS dimulai
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 50);
    return () => clearTimeout(timer);
  }, [value, min]);

  const clampedVal = Math.min(Math.max(animatedValue, min), max);
  const ratio = (clampedVal - min) / (max - min);
  const rotationDeg = -90 + ratio * 180;

  // Penentuan warna status berdasarkan rentang optimal
  const isOptimal = optimalMin !== undefined && optimalMax !== undefined
    ? clampedVal >= optimalMin && clampedVal <= optimalMax
    : true;

  const needleColor = isOptimal ? '#244b37' : '#e05345';

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 100 55" className="w-full h-auto max-w-[150px]">
        {/* Track Latar Busur */}
        <path
          d="M 12 44 A 38 38 0 0 1 88 44"
          fill="none"
          stroke={isDark ? '#233d2e' : '#e2ede6'}
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Jarum Indikator (Transform-Origin di Titik Poros) */}
        <line
          x1="50"
          y1="44"
          x2="50"
          y2="18"
          stroke={needleColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transformOrigin: '50px 44px',
            transition: 'transform 1000ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />

        {/* Titik Poros Tengah */}
        <circle cx="50" cy="44" r="3.5" fill={needleColor} />
      </svg>
    </div>
  );
}
```

---

## 3. Kode Komponen Counter (`frontend/src/components/AnimatedNumber.tsx`)

Menghasilkan efek angka yang menghitung naik (*count-up*) secara mulus pada kecepatan 60 FPS menggunakan `requestAnimationFrame` dan kurva perlambatan kubik (*ease-out cubic*):

```tsx
import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  precision?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function AnimatedNumber({
  value,
  duration = 1000,
  precision = 1,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startValRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let animId: number;
    const startVal = startValRef.current;
    const endVal = value;
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      
      // Easing function: Ease-Out Cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        startValRef.current = endVal;
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{displayValue.toFixed(precision)}{suffix}
    </span>
  );
}
```

---

## 4. Penggunaan di Kartu Dashboard (`Dashboard.tsx`)

```tsx
{/* Kartu Suhu Kumbung */}
<div className="bg-white dark:bg-[#1a2e23] border border-[#d6e9df] dark:border-[#2a4435] rounded-3xl p-5 shadow-xs">
  <div className="flex justify-between items-center mb-2">
    <span className="text-xs font-bold text-[#759183] uppercase tracking-wider">Suhu Kumbung</span>
    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e8f4ed] text-[#15803d]">Optimal</span>
  </div>
  
  <div className="text-3xl font-extrabold text-[#192e22] dark:text-[#edf5f0]">
    <AnimatedNumber value={currentTemp} precision={1} suffix="°C" />
  </div>

  <SemiCircleGauge 
    value={currentTemp} 
    min={15} 
    max={35} 
    unit="°C" 
    optimalMin={24} 
    optimalMax={32} 
  />
</div>
```
