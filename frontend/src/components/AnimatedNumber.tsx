import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  formatter?: (val: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Komponen angka beranimasi (count-up) yang sangat ringan.
 * - Berjalan via native requestAnimationFrame (60 FPS, 0% beban CPU berkelanjutan).
 * - Saat mount (buka menu): animasi mulus start dari 0 ke targetValue.
 * - Saat live data update (polling): transisi mulus dari nilai lama ke nilai baru (tidak reset ke 0).
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 800,
  decimals = 0,
  formatter,
  className = '',
  prefix = '',
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startValRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef<boolean>(false);

  useEffect(() => {
    const startVal = hasAnimatedRef.current ? displayValue : 0;
    startValRef.current = startVal;
    const endVal = Number.isFinite(value) ? value : 0;
    startTimeRef.current = null;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      hasAnimatedRef.current = true;
      return;
    }

    // Cubic ease-out: Cepat di awal, melambat mulus di akhir
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const current = startVal + (endVal - startVal) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
        hasAnimatedRef.current = true;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatText = () => {
    if (formatter) {
      return formatter(displayValue);
    }
    if (decimals > 0) {
      return displayValue.toLocaleString('id-ID', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return Math.round(displayValue).toLocaleString('id-ID');
  };

  return (
    <span className={className}>
      {prefix}{formatText()}{suffix}
    </span>
  );
};

export default AnimatedNumber;
