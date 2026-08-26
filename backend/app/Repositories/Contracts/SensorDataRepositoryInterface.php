<?php

namespace App\Repositories\Contracts;

use App\Models\SensorData;
use Illuminate\Database\Eloquent\Collection;

/**
 * Interface SensorDataRepositoryInterface — kontrak data access sensor.
 *
 * Sesuai ECC Architecture Pattern:
 * "Encapsulate data access behind standard interface.
 *  Business logic depends on abstract interface, not storage mechanism."
 *
 * @see AGENTS.md → Repository Pattern
 */
interface SensorDataRepositoryInterface
{
    /**
     * Simpan data sensor baru.
     */
    public function store(array $data): SensorData;

    /**
     * Ambil data sensor terbaru (1 record terakhir).
     */
    public function getLatest(): ?SensorData;

    /**
     * Ambil data sensor dalam X jam terakhir.
     *
     * @return Collection<int, SensorData>
     */
    public function getLastHours(int $hours = 24): Collection;

    /**
     * Ambil data sensor terbaru per device.
     *
     * @return Collection<int, SensorData>
     */
    public function getLatestPerDevice(): Collection;
}
