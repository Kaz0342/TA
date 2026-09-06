# Panduan Dashboard API Controller

Dokumen ini berisi logika **DashboardController** untuk mensuplai data ke *frontend* (grafik dan angka metrik). Kueri yang digunakan sudah dioptimasi menggunakan fungsi agregasi SQL agar kinerjanya sangat ringan, cocok buat dilampirin di laporan TA.

---

## 1. Controller (`app/Http/Controllers/Api/DashboardController.php`)

```php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SensorData;
use App\Models\BaglogBatch;
use App\Models\Harvest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard/stats
     * Mengambil angka metrik ringkasan untuk kartu (Card) paling atas di Dashboard.
     */
    public function getStats(): JsonResponse
    {
        // 1. Ambil data suhu & kelembaban paling terakhir (terkini)
        $latestSensor = SensorData::orderBy('created_at', 'desc')->first();

        // 2. Hitung total baglog yang masih aktif (belum diafkir/dibuang)
        $totalActiveBaglog = BaglogBatch::where('is_active', true)->sum('quantity');

        // 3. Hitung total panen (Kg) khusus hari ini
        $todayHarvestKg = Harvest::whereDate('harvest_date', Carbon::today())->sum('total_kg');

        return response()->json([
            'status' => 'success',
            'data' => [
                'current_temperature' => $latestSensor ? (float) $latestSensor->temperature : null,
                'current_humidity'    => $latestSensor ? (float) $latestSensor->humidity : null,
                'active_baglogs'      => (int) $totalActiveBaglog,
                'today_harvest_kg'    => (float) $todayHarvestKg,
                'last_update'         => $latestSensor ? $latestSensor->created_at->toDateTimeString() : null,
            ]
        ]);
    }

    /**
     * GET /api/dashboard/chart-24h
     * Mengambil data rata-rata suhu & kelembaban per JAM selama 24 jam terakhir.
     * Menggunakan Raw Query (Agregasi SQL) biar efisien dan database nggak ngos-ngosan.
     */
    public function getChart24h(): JsonResponse
    {
        // Kueri agregasi ini dikhususkan untuk RDBMS seperti MySQL/PostgreSQL.
        // Kita nge-grup ribuan data sensor per JAM, lalu database yang menghitung rata-ratanya (AVG).
        // JAUH lebih cepat daripada narik ribuan data ke memori PHP.
        
        $chartData = SensorData::select(
                DB::raw("DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as time_label"),
                DB::raw("ROUND(AVG(temperature), 2) as avg_temperature"),
                DB::raw("ROUND(AVG(humidity), 2) as avg_humidity")
            )
            ->where('created_at', '>=', Carbon::now()->subHours(24))
            ->groupBy('time_label')
            ->orderBy('time_label', 'asc')
            ->get();

        // Format ulang response biar sumbu X grafik (Frontend) gampang ngebacanya
        $formattedData = $chartData->map(function ($item) {
            return [
                // Mengubah format dari '2026-09-06 14:00:00' menjadi sekadar '14:00'
                'time_label'  => Carbon::parse($item->time_label)->format('H:i'),
                'temperature' => (float) $item->avg_temperature,
                'humidity'    => (float) $item->avg_humidity,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $formattedData
        ]);
    }
}
```

---

## 2. Konfigurasi Routes (`routes/api.php`)

Jangan lupa daftarkan kedua endpoint ini di sistem routing.

```php
use App\Http\Controllers\Api\DashboardController;

// Endpoint Dashboard
Route::prefix('dashboard')->group(function () {
    Route::get('/stats', [DashboardController::class, 'getStats']);
    Route::get('/chart-24h', [DashboardController::class, 'getChart24h']);
});
```
