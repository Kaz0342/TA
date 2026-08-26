import { useQuery } from '@tanstack/react-query';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Thermometer, Droplets, Package, Sprout, TrendingUp, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { Card } from '../components/ui';

// Fetchers
const fetchStats = async () => (await api.get('/dashboard/stats')).data.data;
const fetchLatestSensor = async () => (await api.get('/sensor-data/latest')).data.data;
const fetchChart = async () => (await api.get('/sensor-data/chart?hours=24')).data.data;
const fetchHarvestChart = async () => (await api.get('/harvests/chart?days=14')).data.data;

export default function Dashboard() {
  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchStats,
    refetchInterval: 60000, // 1 menit
  });

  const { data: latestSensor, isLoading: sensorLoading } = useQuery({
    queryKey: ['latestSensor'],
    queryFn: fetchLatestSensor,
    refetchInterval: 30000, // 30 detik (FR-1.1)
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['sensorChart'],
    queryFn: fetchChart,
    refetchInterval: 300000, // 5 menit (FR-1.2)
  });

  const { data: harvestChartData, isLoading: harvestChartLoading } = useQuery({
    queryKey: ['harvestChart'],
    queryFn: fetchHarvestChart,
    refetchInterval: 300000, // 5 menit
  });

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <p className="text-xs font-black text-black uppercase leading-tight">Kelembaban</p>
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
              {statsLoading ? '...' : stats?.active_baglogs || 0}
            </p>
          </div>
        </Card>

        {/* Revenue */}
        <Card className="flex items-center gap-3 p-4 bg-[#c084fc] group">
          <div className="p-2 bg-white border-4 border-black text-black group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <TrendingUp className="w-8 h-8 stroke-[3]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-black uppercase leading-tight">Revenue (Bulan ini)</p>
            <p className="text-xl sm:text-2xl font-black text-black leading-tight mt-1 break-words">
              {statsLoading ? '...' : formatCurrency(stats?.monthly_revenue_idr || 0)}
            </p>
          </div>
        </Card>
      </div>

      {/* Chart Section — 2 grafik terpisah (ECC: Presentational Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Grafik Suhu (24 Jam) */}
        <Card className="bg-white">
          <div className="flex items-center gap-2 mb-4 border-b-4 border-black pb-2">
            <Thermometer className="w-6 h-6 stroke-[3] text-yellow-500" />
            <h2 className="text-xl font-black text-black uppercase">Grafik Suhu (24 Jam)</h2>
          </div>
          <div className="h-[280px] w-full border-4 border-black p-4 bg-gray-50">
            {chartLoading ? (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">Loading chart...</div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} stroke="#000" vertical={false} />
                  <XAxis 
                    dataKey="time_label" 
                    tick={{ fontSize: 11, fill: '#000', fontWeight: 'bold' }} 
                    tickLine={{ stroke: '#000' }} 
                    axisLine={{ stroke: '#000', strokeWidth: 2 }} 
                    minTickGap={40}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#000', fontWeight: 'bold' }} 
                    tickLine={{ stroke: '#000' }} 
                    axisLine={{ stroke: '#000', strokeWidth: 2 }} 
                    domain={['auto', 'auto']}
                    unit="°C"
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', border: '4px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', backgroundColor: '#fff' }}
                    labelStyle={{ fontWeight: 'black', color: '#000', textTransform: 'uppercase' }}
                    formatter={(value: number) => [`${value} °C`, 'Suhu']}
                  />
                  <Line 
                    type="monotone" 
                    name="Suhu (°C)"
                    dataKey="temperature" 
                    stroke="#eab308" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6, stroke: '#000', strokeWidth: 3, fill: '#eab308' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">
                Belum ada data sensor.
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-gray-500 mt-2">Batas optimal: 20°C — 30°C</p>
        </Card>

        {/* Grafik Kelembaban (24 Jam) */}
        <Card className="bg-white">
          <div className="flex items-center gap-2 mb-4 border-b-4 border-black pb-2">
            <Droplets className="w-6 h-6 stroke-[3] text-blue-500" />
            <h2 className="text-xl font-black text-black uppercase">Grafik Kelembaban (24 Jam)</h2>
          </div>
          <div className="h-[280px] w-full border-4 border-black p-4 bg-gray-50">
            {chartLoading ? (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">Loading chart...</div>
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} stroke="#000" vertical={false} />
                  <XAxis 
                    dataKey="time_label" 
                    tick={{ fontSize: 11, fill: '#000', fontWeight: 'bold' }} 
                    tickLine={{ stroke: '#000' }} 
                    axisLine={{ stroke: '#000', strokeWidth: 2 }} 
                    minTickGap={40}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#000', fontWeight: 'bold' }} 
                    tickLine={{ stroke: '#000' }} 
                    axisLine={{ stroke: '#000', strokeWidth: 2 }} 
                    domain={[50, 100]}
                    unit="%"
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', border: '4px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', backgroundColor: '#fff' }}
                    labelStyle={{ fontWeight: 'black', color: '#000', textTransform: 'uppercase' }}
                    formatter={(value: number) => [`${value} %`, 'Kelembaban']}
                  />
                  <Line 
                    type="monotone" 
                    name="Kelembaban (%)"
                    dataKey="humidity" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6, stroke: '#000', strokeWidth: 3, fill: '#3b82f6' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">
                Belum ada data sensor.
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-gray-500 mt-2">Batas optimal: 70% — 90%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Harvest Today Summary — Card tetap */}
        <Card className="flex flex-col justify-between bg-white text-center items-center">
          <div className="w-full">
            <h2 className="text-xl font-black text-black mb-2 uppercase border-b-4 border-black pb-2 text-left w-full">Panen Hari Ini</h2>
            <p className="text-sm font-bold text-gray-700 mb-6 text-left">Total berat jamur tiram yang dipanen hari ini.</p>
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
          <div className="h-[280px] w-full border-4 border-black p-4 bg-gray-50">
            {harvestChartLoading ? (
              <div className="w-full h-full flex items-center justify-center text-black font-bold">Loading chart...</div>
            ) : harvestChartData && harvestChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={harvestChartData} margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} stroke="#000" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: '#000', fontWeight: 'bold' }} 
                    tickLine={{ stroke: '#000' }} 
                    axisLine={{ stroke: '#000', strokeWidth: 2 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#000', fontWeight: 'bold' }} 
                    tickLine={{ stroke: '#000' }} 
                    axisLine={{ stroke: '#000', strokeWidth: 2 }} 
                    unit=" Kg"
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', border: '4px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', backgroundColor: '#fff' }}
                    labelStyle={{ fontWeight: 'black', color: '#000', textTransform: 'uppercase' }}
                    formatter={(value: number) => [`${value} Kg`, 'Total Panen']}
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
          <span className="text-sm bg-[#28e085] text-black border-2 border-black px-4 py-1 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">Jamur Tiram Putih</span>
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

      {/* Log Aktivitas Sprinkler */}
      <Card className="bg-white">
        <div className="flex items-center justify-between mb-6 border-b-4 border-black pb-4">
          <h2 className="text-xl font-black text-black uppercase">Log Aktivitas Penyiram Otomatis (Sprinkler)</h2>
        </div>
        
        <div className="overflow-x-auto border-4 border-black">
          <table className="w-full text-sm text-left font-bold">
            <thead className="text-xs text-black uppercase bg-gray-200 border-b-4 border-black">
              <tr>
                <th className="px-4 py-3 border-r-4 border-black">Waktu Kejadian</th>
                <th className="px-4 py-3 border-r-4 border-black">Durasi Nyala</th>
                <th className="px-4 py-3">Pemicu (Trigger)</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {statsLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500 font-bold">Memuat data log...</td>
                </tr>
              ) : stats?.sprinkler_logs?.length > 0 ? (
                stats.sprinkler_logs.map((log: any, index: number) => (
                  <tr key={index} className="border-b-4 border-black last:border-0 hover:bg-gray-100 transition-colors">
                    <td className="px-4 py-3 border-r-4 border-black text-black">
                      {new Date(log.started_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 border-r-4 border-black">
                      <span className="px-3 py-1 bg-yellow-400 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {log.duration_seconds} detik
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black font-black uppercase">{log.trigger_reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500 font-bold">Belum ada aktivitas penyiraman.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
