import { Thermometer, Droplets, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper untuk gabungin class Tailwind
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Logika Status Warna Suhu (Jamur Kuping):
 * - Hijau (Optimal): 25 - 30 °C
 * - Kuning (Waspada): 20 - 24.9 °C ATAU 30.1 - 35 °C
 * - Merah (Kritis): < 20 °C ATAU > 35 °C
 */
const getTempStatus = (temp: number) => {
  if (temp >= 25 && temp <= 30) return { label: 'Optimal', color: 'bg-[#28e085]', icon: CheckCircle2 };
  if ((temp >= 20 && temp < 25) || (temp > 30 && temp <= 35)) return { label: 'Waspada', color: 'bg-yellow-400', icon: Info };
  return { label: 'Kritis', color: 'bg-red-500', icon: AlertTriangle };
};

/**
 * Logika Status Warna Kelembapan/RH (Jamur Kuping):
 * - Hijau (Optimal): 85 - 95 %
 * - Kuning (Waspada): 75 - 84.9 % ATAU > 95 %
 * - Merah (Kritis): < 75 %
 */
const getHumStatus = (hum: number) => {
  if (hum >= 85 && hum <= 95) return { label: 'Optimal', color: 'bg-[#28e085]', icon: CheckCircle2 };
  if ((hum >= 75 && hum < 85) || hum > 95) return { label: 'Waspada', color: 'bg-yellow-400', icon: Info };
  return { label: 'Kritis', color: 'bg-red-500', icon: AlertTriangle };
};

interface ClimateCardsProps {
  temperature?: number | null;
  humidity?: number | null;
  isLoading?: boolean;
}

export default function ClimateCards({ temperature, humidity, isLoading }: ClimateCardsProps) {
  const tempStatus = temperature ? getTempStatus(temperature) : null;
  const humStatus = humidity ? getHumStatus(humidity) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Kartu Suhu (Temperature) */}
      <div className={cn(
        "relative flex flex-col p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] duration-300",
        tempStatus?.color || "bg-gray-200"
      )}>
        <div className="flex justify-between items-start">
          <div className="p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <Thermometer className="w-8 h-8 text-black stroke-[3]" />
          </div>
          
          {/* Label Status (Bisa dilihat jelas lewat HP) */}
          {tempStatus && (
            <div className="flex items-center gap-2 bg-white border-4 border-black px-4 py-1.5 font-black uppercase text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <tempStatus.icon className="w-5 h-5 stroke-[3]" />
              {tempStatus.label}
            </div>
          )}
        </div>
        
        <div className="mt-8">
          <p className="text-sm font-black uppercase text-black mb-1">Suhu Ruangan</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-6xl sm:text-7xl font-black text-black tracking-tighter">
              {isLoading ? '--' : temperature?.toFixed(1) || '--'}
            </h2>
            <span className="text-3xl font-black text-black">°C</span>
          </div>
        </div>

        {/* Garis pemisah brutalist */}
        <div className="mt-6 pt-4 border-t-4 border-black flex justify-between text-xs sm:text-sm font-black uppercase">
          <span>Target: 25 - 30 °C</span>
          <span className="opacity-70 truncate max-w-[100px] sm:max-w-none text-right">IoT ESP32</span>
        </div>
      </div>

      {/* Kartu Kelembapan (Humidity) */}
      <div className={cn(
        "relative flex flex-col p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] duration-300",
        humStatus?.color || "bg-gray-200"
      )}>
        <div className="flex justify-between items-start">
          <div className="p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <Droplets className="w-8 h-8 text-black stroke-[3]" />
          </div>
          
          {/* Label Status */}
          {humStatus && (
            <div className="flex items-center gap-2 bg-white border-4 border-black px-4 py-1.5 font-black uppercase text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <humStatus.icon className="w-5 h-5 stroke-[3]" />
              {humStatus.label}
            </div>
          )}
        </div>
        
        <div className="mt-8">
          <p className="text-sm font-black uppercase text-black mb-1">Kelembapan Udara (RH)</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-6xl sm:text-7xl font-black text-black tracking-tighter">
              {isLoading ? '--' : humidity?.toFixed(1) || '--'}
            </h2>
            <span className="text-3xl font-black text-black">%</span>
          </div>
        </div>

        {/* Garis pemisah brutalist */}
        <div className="mt-6 pt-4 border-t-4 border-black flex justify-between text-xs sm:text-sm font-black uppercase">
          <span>Target: 85 - 95 %</span>
          <span className="opacity-70 truncate max-w-[100px] sm:max-w-none text-right">IoT ESP32</span>
        </div>
      </div>
    </div>
  );
}
