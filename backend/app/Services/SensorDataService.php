<?php

namespace App\Services;

use App\Models\SensorData;
use App\Models\ThresholdSetting;
use App\Repositories\Contracts\SensorDataRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

/**
 * SensorDataService — business logic untuk data sensor IoT.
 *
 * Sesuai ECC Rule (rules/php/patterns.md):
 * "Move business rules into application/domain services
 *  that are easy to test without HTTP bootstrapping."
 *
 * Responsibilities:
 * 1. Simpan data sensor + cek threshold → return alert
 * 2. Ambil data terbaru untuk Dashboard
 * 3. Ambil data chart 24 jam
 *
 * @see PRD FR-4.1, FR-1.1, FR-1.2
 */
class SensorDataService
{
    public function __construct(
        private readonly SensorDataRepositoryInterface $repository
    ) {}

    /**
     * Simpan data sensor baru dari IoT device.
     * Setelah simpan, cek apakah melanggar threshold.
     *
     * @param  array  $data  — validated sensor payload
     * @return array{sensor_data: SensorData, alerts: list<array>}
     */
    public function store(array $data): array
    {
        $sensorData = $this->repository->store($data);

        // Cek threshold violations
        $alerts = $this->checkThresholdViolations($sensorData);

        return [
            'sensor_data' => $sensorData,
            'alerts' => $alerts,
        ];
    }

    /**
     * Ambil data sensor terbaru (untuk Climate Cards FR-1.1).
     */
    public function getLatest(): ?SensorData
    {
        return $this->repository->getLatest();
    }

    /**
     * Ambil data sensor untuk chart (FR-1.2).
     * Default 24 jam terakhir.
     *
     * @return Collection<int, SensorData>
     */
    public function getChartData(int $hours = 24): Collection
    {
        return $this->repository->getLastHours($hours);
    }

    /**
     * Cek apakah data sensor melanggar threshold yang aktif.
     * Dipakai oleh store() dan bisa dipanggil terpisah.
     *
     * @return list<array{type: string, message: string, severity: string}>
     */
    public function checkThresholdViolations(SensorData $sensorData): array
    {
        $threshold = ThresholdSetting::active()->first();

        if (! $threshold) {
            return [];
        }

        return $threshold->checkViolations($sensorData);
    }
}
