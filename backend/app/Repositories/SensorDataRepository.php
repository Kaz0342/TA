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
     * Ambil data sensor dalam X jam terakhir.
     * Dipakai untuk FR-1.2 (Climate Chart 24 jam).
     *
     * Order ascending (oldest first) biar chart line berjalan kiri→kanan.
     *
     * @return Collection<int, SensorData>
     */
    public function getLastHours(int $hours = 24): Collection
    {
        return SensorData::lastHours($hours)
            ->orderBy('recorded_at', 'asc')
            ->get();
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
