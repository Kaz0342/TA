import React, { useEffect, useState, useRef } from 'react';
import { useThemeStore } from '../stores/themeStore';

interface SemiCircleGaugeProps {
  value: number;
  min: number;
  max: number;
  color?: string;
  trackColor?: string;
  className?: string;
}

export const SemiCircleGauge: React.FC<SemiCircleGaugeProps> = ({
  value,
  min,
  max,
  color = '#499b70',
  trackColor,
  className = 'w-24 h-14',
}) => {
  const { theme } = useThemeStore();
  const defaultTrack = theme === 'dark' ? '#1f382b' : '#e6ece8';
  const effectiveTrack = trackColor || defaultTrack;
  const pivotFill = theme === 'dark' ? '#142219' : '#ffffff';

  // Target persentase normalisasi [0 .. 1]
  const targetPercentage = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Animasi sweep dari 0 ke target saat mount
  const [animatedPercentage, setAnimatedPercentage] = useState<number>(0);
  const isMountedRef = useRef(false);

  useEffect(() => {
    // Delay 50ms memastikan browser melukis frame awal (0) ke layar sebelum transisi CSS dipicu
    const timer = setTimeout(() => {
      setAnimatedPercentage(targetPercentage);
      isMountedRef.current = true;
    }, 50);

    return () => clearTimeout(timer);
  }, [targetPercentage]);

  // SVG Geometry untuk semi-circle (radius 36)
  const R = 36;
  const arcLength = Math.PI * R; // ~113.1
  const strokeDashoffset = arcLength * (1 - animatedPercentage);

  // Derajat rotasi jarum:
  // 0% -> -90 deg (menunjuk ke ujung kiri minimum)
  // 50% -> 0 deg (lurus ke atas)
  // 100% -> +90 deg (menunjuk ke ujung kanan maksimum)
  const rotationDeg = -90 + animatedPercentage * 180;

  return (
    <div className={`relative flex items-end justify-center ${className}`}>
      <svg viewBox="0 0 100 52" className="w-full h-full overflow-visible">
        {/* Background Track Arc */}
        <path
          d="M 14 44 A 36 36 0 0 1 86 44"
          fill="none"
          stroke={effectiveTrack}
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Value Colored Arc (Sweep Transisi) */}
        <path
          d="M 14 44 A 36 36 0 0 1 86 44"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          style={{
            strokeDashoffset,
            transition: 'stroke-dashoffset 1000ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />

        {/* Needle / Pointer (Dianimasikan via GPU Hardware Acceleration CSS Transform Rotate) */}
        <line
          x1="50"
          y1="44"
          x2="50"
          y2="18"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            transformOrigin: '50px 44px',
            transform: `rotate(${rotationDeg}deg)`,
            transition: 'transform 1000ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />

        {/* Pivot Center Circle */}
        <circle
          cx="50"
          cy="44"
          r="3.5"
          fill={pivotFill}
          stroke={color}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

export default SemiCircleGauge;
