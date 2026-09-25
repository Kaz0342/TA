<?php

namespace App\Repositories;

use App\Models\SensorData;
use App\Repositories\Contracts\SensorDataRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

/**
 * Eloquent implementation dari SensorDataRepository.
 *
 * Semua query ke tabel sensor_data lewat sini.
 * Controller/Service TIDAK boleh query langsung ke Model.
 *
 * @see App\Repositories\Contracts\SensorDataRepositoryInterface
 */
class SensorDataRepository implements SensorDataRepositoryInterface
{
    /**
     * Simpan data sensor baru.
     * Data sensor bersifat IMMUTABLE — sekali masuk, tidak diubah.
     */
    public function store(array $data): SensorData
    {
        if (empty($data['recorded_at'])) {
            $data['recorded_at'] = now();
        }

        return SensorData::create($data);
    }

    /**
     * Ambil data sensor terbaru (1 record terakhir).
     * Dipakai untuk FR-1.1 (Real-time Climate Cards).
     */
    public function getLatest(): ?SensorData
    {
        return SensorData::latestReading()->first();
    }

    /**
     * Ambil data sensor dalam X jam terakhir dengan SQL Downsampling adaptif.
     * Dipakai untuk FR-1.2 (Climate Chart 24 jam / 7 hari).
     *
     * Jika data < 100 baris (misal testing unit), kembalikan raw data.
     * Jika data ribuan (IoT real), agregasi via time-bucket di SQL
     * agar payload turun dari ratusan KB ke <15 KB dan query super cepat (<30ms).
     *
     * @return Collection<int, SensorData>
     */
    public function getLastHours(int $hours = 24): Collection
    {
        $baseQuery = SensorData::lastHours($hours);

        // Jika data sedikit (misal testing atau baru running < 1 jam), kembalikan langsung
        $count = (clone $baseQuery)->count();
        if ($count <= 100) {
            return $baseQuery->orderBy('recorded_at', 'asc')->get();
        }

        // Tentukan interval bucket (menit) berdasarkan rentang jam
        // 6h  -> 5 menit (~72 titik)
        // 12h -> 15 menit (~48 titik)
        // 24h -> 15 menit (~96 titik)
        // 7d (168h) -> 60 menit (~168 titik)
        // >7d -> 120 menit (~180 titik)
        $driver = \Illuminate\Support\Facades\DB::connection()->getDriverName();

        if ($hours <= 6) {
            $minuteStep = 5;
        } elseif ($hours <= 24) {
            $minuteStep = 15;
        } elseif ($hours <= 168) {
            $minuteStep = 60;
        } else {
            $minuteStep = 120;
        }

        $since = now()->subHours($hours);

        if ($driver === 'sqlite') {
            if ($minuteStep >= 60) {
                $stepHours = intdiv($minuteStep, 60);
                if ($stepHours <= 1) {
                    $timeExpr = "strftime('%Y-%m-%d %H:00:00', recorded_at)";
                } else {
                    $timeExpr = "strftime('%Y-%m-%d ', recorded_at) || printf('%02d:00:00', (cast(strftime('%H', recorded_at) as integer) / {$stepHours}) * {$stepHours})";
                }
            } else {
                $timeExpr = "strftime('%Y-%m-%d %H:', recorded_at) || printf('%02d:00', (cast(strftime('%M', recorded_at) as integer) / {$minuteStep}) * {$minuteStep})";
            }

            $results = \Illuminate\Support\Facades\DB::select("
                SELECT 
                    ROUND(AVG(temperature), 2) as temperature,
                    ROUND(AVG(humidity), 2) as humidity,
                    ROUND(AVG(co2_level), 2) as co2_level,
                    ROUND(AVG(light_intensity), 2) as light_intensity,
                    {$timeExpr} as bucket_time
                FROM sensor_data
                WHERE recorded_at >= ?
                GROUP BY bucket_time
                ORDER BY bucket_time ASC
            ", [$since->toDateTimeString()]);
        } elseif ($driver === 'mysql') {
            $results = \Illuminate\Support\Facades\DB::select("
                SELECT 
                    ROUND(AVG(temperature), 2) as temperature,
                    ROUND(AVG(humidity), 2) as humidity,
                    ROUND(AVG(co2_level), 2) as co2_level,
                    ROUND(AVG(light_intensity), 2) as light_intensity,
                    FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(recorded_at) / (? * 60)) * (? * 60)) as bucket_time
                FROM sensor_data
                WHERE recorded_at >= ?
                GROUP BY bucket_time
                ORDER BY bucket_time ASC
            ", [$minuteStep, $minuteStep, $since->toDateTimeString()]);
        } else {
            // Fallback generic SQL jika database lain
            return $baseQuery->orderBy('recorded_at', 'asc')->limit(120)->get();
        }

        // Map ke Collection SensorData model (tanpa hit DB ulang)
        $models = array_map(function ($row) {
            $model = new SensorData();
            $model->temperature = (string) $row->temperature;
            $model->humidity = (string) $row->humidity;
            $model->co2_level = $row->co2_level ? (string) $row->co2_level : null;
            $model->light_intensity = $row->light_intensity ? (string) $row->light_intensity : null;
            $model->recorded_at = \Carbon\Carbon::parse($row->bucket_time);
            $model->exists = true;
            return $model;
        }, $results);

        return new Collection($models);
    }

    /**
     * Ambil data sensor terbaru per device.
     * Berguna untuk multi-kumbung di Phase 2+.
     *
     * @return Collection<int, SensorData>
     */
    public function getLatestPerDevice(): Collection
    {
        // Subquery: ambil MAX recorded_at per device_id
        $latestPerDevice = SensorData::selectRaw('device_id, MAX(recorded_at) as max_recorded')
            ->groupBy('device_id');

        return SensorData::joinSub($latestPerDevice, 'latest', function ($join) {
            $join->on('sensor_data.device_id', '=', 'latest.device_id')
                ->on('sensor_data.recorded_at', '=', 'latest.max_recorded');
        })->get();
    }
}
