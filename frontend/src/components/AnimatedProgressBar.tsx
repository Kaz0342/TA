import React, { useEffect, useState } from 'react';

interface AnimatedProgressBarProps {
  percentage: number;
  className?: string;
  barClassName?: string;
}

/**
 * Progress bar beranimasi yang meluncur mulus dari 0% ke target persentase saat halaman dibuka.
 * Menggunakan transisi CSS hardware-accelerated (GPU) sehingga 100% enteng.
 */
export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  percentage,
  className = 'w-full bg-[#e8f2ec] dark:bg-[#1f382b] rounded-full h-2 mt-3 overflow-hidden',
  barClassName = 'bg-[#2e7d52] dark:bg-[#4ade80] h-full rounded-full transition-all duration-1000 ease-out',
}) => {
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));
    // Delay 50ms memastikan browser melukis frame awal (width 0%) sebelum transisi CSS dipicu
    const timer = setTimeout(() => {
      setWidth(clamped);
    }, 50);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className={className}>
      <div className={barClassName} style={{ width: `${width}%` }} />
    </div>
  );
};

export default AnimatedProgressBar;
