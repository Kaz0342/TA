import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea
} from 'recharts';
import { Thermometer, Droplets, Package, Sprout, TrendingUp, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { Card } from '../components/ui';

// Fetchers
const fetchStats = async () => (await api.get('/dashboard/stats')).data.data;
const fetchLatestSensor = async () => (await api.get('/sensor-data/latest')).data.data;
const fetchChart = async () => (await api.get('/sensor-data/chart?hours=6')).data.data;
const fetchHarvestChart = async () => (await api.get('/harvests/chart?days=14')).data.data;
const fetchThresholds = async () => (await api.get('/thresholds/active')).data.data;

export default function Dashboard() {
  // Queries — Polling agresif agar responsif dan real-time sinkron dengan IoT (ESP32/Simulator)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchStats,
    refetchInterval: 10000, // Refetch tiap 10 detik
  });

  const { data: latestSensor, isLoading: sensorLoading } = useQuery({
    queryKey: ['latestSensor'],
    queryFn: fetchLatestSensor,
    refetchInterval: 3000, // Refetch tiap 3 detik (Real-time kartu sensor)
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['sensorChart'],
    queryFn: fetchChart,
    refetchInterval: 5000, // Refetch tiap 5 detik (Real-time grafik sensor)
  });

  const { data: harvestChartData, isLoading: harvestChartLoading } = useQuery({
    queryKey: ['harvestChart'],
    queryFn: fetchHarvestChart,
    refetchInterval: 30000, // Refetch tiap 30 detik
  });

  const { data: thresholds } = useQuery({
    queryKey: ['thresholds'],
    queryFn: fetchThresholds,
    refetchInterval: 30000, // Refetch tiap 30 detik
  });

  // Nilai numerik batas optimal dengan fallback standar budidaya jamur kuping
  const tempMin = Number(thresholds?.temp_min ?? 24);
  const tempMax = Number(thresholds?.temp_max ?? 32);
  const humMin = Number(thresholds?.humidity_min ?? 80);
  const humMax = Number(thresholds?.humidity_max ?? 95);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  // Helper format label waktu tanpa detik (HH:mm)
  const formatTimeLabel = (val: any) => {
    if (!val || typeof val !== 'string') return val;
    const parts = val.split(':');
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : val;
  };

  // Helper render Alert
  const hasAlerts = stats?.system_alerts?.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Alert Banner */}
      {hasAlerts && (
        <div className="bg-red-500 border-4 border-black p-4 flex items-start gap-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <AlertTriangle className="text-black w-8 h-8 shrink-0 mt-0.5 stroke-[3]" />
          <div>
            <h3 className="font-black text-black text-lg uppercase">Peringatan Sistem!</h3>
            <ul className="list-disc ml-6 text-black font-bold mt-1">
              {stats.system_alerts.map((a: any, i: number) => (
                <li key={i}>{a.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Real-time Temp */}
        <Card className="flex items-center gap-3 p-4 bg-yellow-400 group">
          <div className="p-2 bg-white border-4 border-black text-black group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <Thermometer className="w-8 h-8 stroke-[3]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-black uppercase leading-tight">Suhu Saat Ini</p>
            <p className="text-2xl sm:text-3xl font-black text-black leading-tight mt-1">
              {sensorLoading ? '...' : `${latestSensor?.temperature || '--'} °C`}
            </p>
          </div>
        </Card>

        {/* Real-time Humidity */}
        <Card className="flex items-center gap-3 p-4 bg-[#60a5fa] group">
          <div className="p-2 bg-white border-4 border-black text-black group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <Droplets className="w-8 h-8 stroke-[3]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-black uppercase leading-tight">Kelembapan</p>
            <p className="text-2xl sm:text-3xl font-black text-black leading-tight mt-1">
              {sensorLoading ? '...' : `${latestSensor?.humidity || '--'} %`}
            </p>
          </div>
        </Card>

        {/* Active Baglogs */}
        <Card className="flex items-center gap-3 p-4 bg-[#28e085] group">
          <div className="p-2 bg-white border-4 border-black text-black group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <Package className="w-8 h-8 stroke-[3]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-black uppercase leading-tight">Baglog Aktif</p>
            <p className="text-2xl sm:text-3xl font-black text-black leading-tight mt-1">
              {statsLoading ? '...' : (
                (stats?.active_baglogs ?? stats?.active_baglogs_count) !== undefined
                  ? Number(stats?.active_baglogs ?? stats?.active_baglogs_count).toLocaleString('id-ID')
                  : '--'
              )}
            </p>
          </div>
        </Card>

        {/* Revenue Week */}
        <Card className="flex items-center gap-3 p-4 bg-purple-400 group">
          <div className="p-2 bg-white border-4 border-black text-black group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <TrendingUp className="w-8 h-8 stroke-[3]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-black uppercase leading-tight">Omset Minggu Ini</p>
            <p className="text-xl sm:text-2xl font-black text-black leading-tight mt-1 truncate" title={stats ? formatCurrency(stats.weekly_revenue ?? stats.weekly_revenue_idr ?? stats.monthly_revenue_idr ?? 0) : ''}>
              {statsLoading ? '...' : formatCurrency(stats?.weekly_revenue ?? stats?.weekly_revenue_idr ?? stats?.monthly_revenue_idr ?? 0)}
            </p>
          </div>
        </Card>
      </div>

      {/* Sensor Line Charts — Suhu & Kelembaban (Responsive Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Grafik Suhu (6 Jam) */}
        <Card className="bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b-4 border-black pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 stroke-[3] text-yellow-500" />
              <h2 className="text-lg sm:text-xl font-black text-black uppercase">Grafik Suhu (6 Jam)</h2>
            </div>
            <span className="text-xs font-black px-2.5 py-1 bg-emerald-100 text-emerald-900 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Zona Ideal: {tempMin}°C — {tempMax}°C
            </span>
          </div>
          <div className="h-[280px] w-full border-4 border-black p-2 sm:p-4 bg-gray-50">
            {chartLoading ? (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">Loading chart...</div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} stroke="#000" vertical={false} />
                  <XAxis
                    dataKey="time_label"
                    tick={{ fontSize: 10, fill: '#000', fontWeight: 'bold' }}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 2 }}
                    minTickGap={30}
                    tickFormatter={formatTimeLabel}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#000', fontWeight: 'bold' }}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 2 }}
                    domain={[
                      (dataMin: number) => Math.min(Math.floor(Number.isFinite(dataMin) ? dataMin : 20), tempMin - 1),
                      (dataMax: number) => Math.max(Math.ceil(Number.isFinite(dataMax) ? dataMax : 30), tempMax + 1)
                    ]}
                    tickFormatter={(val) => `${val}°`}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '0px', border: '4px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', backgroundColor: '#fff' }}
                    labelStyle={{ fontWeight: 'black', color: '#000', textTransform: 'uppercase' }}
                    labelFormatter={(label: any) => `WAKTU: ${formatTimeLabel(label)} WIB`}
                    formatter={(value: any) => [`${value} °C`, 'Suhu']}
                    offset={15}
                    cursor={{ stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '4 4' }}
                  />
                  <ReferenceArea
                    y1={tempMin}
                    y2={tempMax}
                    fill="#10b981"
                    fillOpacity={0.22}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    name="Suhu (°C)"
                    dataKey="temperature"
                    stroke="#eab308"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#000', strokeWidth: 2.5, fill: '#eab308' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">
                Belum ada data sensor.
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between text-xs font-bold text-gray-600 mt-2 gap-1">
            <span>Batas optimal: {tempMin}°C — {tempMax}°C</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-emerald-500/20 border border-emerald-600 inline-block"></span>
              Area Hijau = Zona Ideal
            </span>
          </div>
        </Card>

        {/* Grafik Kelembapan (6 Jam) */}
        <Card className="bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b-4 border-black pb-2">
            <div className="flex items-center gap-2">
              <Droplets className="w-6 h-6 stroke-[3] text-blue-500" />
              <h2 className="text-lg sm:text-xl font-black text-black uppercase">Grafik Kelembapan (6 Jam)</h2>
            </div>
            <span className="text-xs font-black px-2.5 py-1 bg-emerald-100 text-emerald-900 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Zona Ideal: {humMin}% — {humMax}%
            </span>
          </div>
          <div className="h-[280px] w-full border-4 border-black p-2 sm:p-4 bg-gray-50">
            {chartLoading ? (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">Loading chart...</div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} stroke="#000" vertical={false} />
                  <XAxis
                    dataKey="time_label"
                    tick={{ fontSize: 10, fill: '#000', fontWeight: 'bold' }}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 2 }}
                    minTickGap={30}
                    tickFormatter={formatTimeLabel}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#000', fontWeight: 'bold' }}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 2 }}
                    domain={[
                      (dataMin: number) => Math.max(0, Math.min(Math.floor(Number.isFinite(dataMin) ? dataMin : 70), humMin - 5)),
                      (dataMax: number) => Math.min(100, Math.max(Math.ceil(Number.isFinite(dataMax) ? dataMax : 90), humMax + 5))
                    ]}
                    tickFormatter={(val) => `${val}%`}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '0px', border: '4px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', backgroundColor: '#fff' }}
                    labelStyle={{ fontWeight: 'black', color: '#000', textTransform: 'uppercase' }}
                    labelFormatter={(label: any) => `WAKTU: ${formatTimeLabel(label)} WIB`}
                    formatter={(value: any) => [`${value} %`, 'Kelembaban']}
                    offset={15}
                    cursor={{ stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '4 4' }}
                  />
                  <ReferenceArea
                    y1={humMin}
                    y2={humMax}
                    fill="#10b981"
                    fillOpacity={0.22}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    name="Kelembaban (%)"
                    dataKey="humidity"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#000', strokeWidth: 2.5, fill: '#3b82f6' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">
                Belum ada data sensor.
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between text-xs font-bold text-gray-600 mt-2 gap-1">
            <span>Batas optimal: {humMin}% — {humMax}%</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-emerald-500/20 border border-emerald-600 inline-block"></span>
              Area Hijau = Zona Ideal
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Harvest Today Summary — Card tetap */}
        <Card className="flex flex-col justify-between bg-white text-center items-center">
          <div className="w-full">
            <h2 className="text-xl font-black text-black mb-2 uppercase border-b-4 border-black pb-2 text-left w-full">Panen Hari Ini</h2>
            <p className="text-sm font-bold text-gray-700 mb-6 text-left">Total berat jamur kuping yang dipanen hari ini.</p>
          </div>

          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-[#28e085] text-black border-4 border-black mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
              <Sprout className="w-12 h-12 stroke-[3]" />
            </div>
            <p className="text-5xl font-black text-black">
              {statsLoading ? '...' : `${parseFloat(stats?.today_harvest_kg || 0).toFixed(2)}`} <span className="text-2xl">Kg</span>
            </p>
          </div>

          <p className="text-xs font-bold text-black mt-4 bg-yellow-400 px-3 py-1 border-2 border-black">
            Terakhir update: {new Date().toLocaleTimeString()}
          </p>
        </Card>

        {/* Grafik Panen Harian (14 Hari Terakhir) */}
        <Card className="lg:col-span-2 bg-white">
          <div className="flex items-center gap-2 mb-4 border-b-4 border-black pb-2">
            <Sprout className="w-6 h-6 stroke-[3] text-green-500" />
            <h2 className="text-xl font-black text-black uppercase">Grafik Panen Harian (14 Hari)</h2>
          </div>
          <div className="h-[280px] w-full border-4 border-black p-2 sm:p-4 bg-gray-50">
            {harvestChartLoading ? (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">Loading chart...</div>
            ) : harvestChartData && harvestChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={harvestChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} stroke="#000" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#000', fontWeight: 'bold' }}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 2 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#000', fontWeight: 'bold' }}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 2 }}
                    unit=" Kg"
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '0px', border: '4px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', backgroundColor: '#fff' }}
                    labelStyle={{ fontWeight: 'black', color: '#000', textTransform: 'uppercase' }}
                    formatter={(value: any) => [`${value} Kg`, 'Total Panen']}
                  />
                  <Bar
                    dataKey="total_kg"
                    name="Total Panen (Kg)"
                    fill="#28e085"
                    stroke="#000"
                    strokeWidth={3}
                    radius={[0, 0, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">
                Belum ada data panen.
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-gray-500 mt-2">Data diambil dari modul Harvest (FR-3.1)</p>
        </Card>

      </div>

      {/* Info Tanaman/Baglog */}
      <Card className="bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 border-b-4 border-black pb-4 gap-4">
          <h2 className="text-xl font-black text-black uppercase">Informasi Batch Penanaman Aktif</h2>
          <span className="text-sm bg-[#28e085] text-black border-2 border-black px-4 py-1 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">Jamur Kuping Hitam</span>
        </div>

        <div className="overflow-x-auto border-4 border-black">
          <table className="w-full text-sm text-left font-bold">
            <thead className="text-xs text-black uppercase bg-gray-200 border-b-4 border-black">
              <tr>
                <th className="px-4 py-3 border-r-4 border-black">Kode Batch</th>
                <th className="px-4 py-3 border-r-4 border-black">Tanggal Tanam</th>
                <th className="px-4 py-3 border-r-4 border-black">Umur (Hari)</th>
                <th className="px-4 py-3 border-r-4 border-black">Jumlah (Baglog)</th>
                <th className="px-4 py-3">Supplier</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {statsLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Memuat data penanaman...</td>
                </tr>
              ) : stats?.latest_batches?.length > 0 ? (
                stats.latest_batches.map((batch: any) => (
                  <tr key={batch.batch_code} className="border-b-4 border-black last:border-0 hover:bg-gray-100 transition-colors">
                    <td className="px-4 py-3 font-black text-black border-r-4 border-black">{batch.batch_code}</td>
                    <td className="px-4 py-3 border-r-4 border-black">{new Date(batch.entry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3 border-r-4 border-black">
                      <span className={`px-2 py-1 border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${batch.age_days >= 30 ? 'bg-yellow-400 text-black' : 'bg-[#28e085] text-black'}`}>
                        {batch.age_days} Hari
                      </span>
                    </td>
                    <td className="px-4 py-3 border-r-4 border-black font-black">{batch.quantity}</td>
                    <td className="px-4 py-3 text-gray-700">{batch.supplier}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Belum ada batch penanaman aktif.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Log Aktivitas Aktuator (Sprinkler & Exhaust Fan) */}
      <Card className="bg-white">
        <div className="flex items-center justify-between mb-6 border-b-4 border-black pb-4">
          <h2 className="text-xl font-black text-black uppercase">Log Aktivitas Kontrol Otomatis (Aktuator)</h2>
        </div>

        <div className="overflow-x-auto border-4 border-black">
          <table className="w-full text-sm text-left font-bold">
            <thead className="text-xs text-black uppercase bg-gray-200 border-b-4 border-black">
              <tr>
                <th className="px-4 py-3 border-r-4 border-black whitespace-nowrap">Waktu Kejadian</th>
                <th className="px-4 py-3 border-r-4 border-black whitespace-nowrap">Aktuator</th>
                <th className="px-4 py-3 border-r-4 border-black">Pemicu Nyala (Trigger)</th>
                <th className="px-4 py-3 border-r-4 border-black whitespace-nowrap">Durasi</th>
                <th className="px-4 py-3">Kondisi Akhir (Status)</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {statsLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Memuat data log...</td>
                </tr>
              ) : stats?.sprinkler_logs?.length > 0 ? (
                stats.sprinkler_logs.map((log: any, index: number) => (
                  <tr key={index} className="border-b-4 border-black last:border-0 hover:bg-gray-100 transition-colors">
                    <td className="px-4 py-3 border-r-4 border-black text-black whitespace-nowrap">
                      {new Date(log.started_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 border-r-4 border-black whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-black border-2 border-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${log.actuator === 'fan' ? 'bg-cyan-300 text-black' : 'bg-[#28e085] text-black'
                        }`}>
                        {log.actuator === 'fan' ? ' Exhaust Fan' : ' Misting & Valve'}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-r-4 border-black text-black font-extrabold uppercase">
                      {log.trigger_reason}
                    </td>
                    <td className="px-4 py-3 border-r-4 border-black whitespace-nowrap">
                      <span className="px-3 py-1 bg-yellow-400 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {log.duration_seconds} detik
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black">
                      <span className={`inline-block px-2.5 py-1 text-xs font-black border-2 border-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${log.stop_reason?.toLowerCase().includes('timeout')
                        ? 'bg-amber-300 text-black'
                        : 'bg-emerald-200 text-emerald-950'
                        }`}>
                        {log.stop_reason ?? 'Target Tercapai'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-bold">Belum ada aktivitas aktuator tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
