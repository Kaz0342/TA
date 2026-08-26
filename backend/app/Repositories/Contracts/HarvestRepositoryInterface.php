<?php

namespace App\Repositories\Contracts;

use App\Models\Harvest;
use Illuminate\Database\Eloquent\Collection;

interface HarvestRepositoryInterface
{
    public function getAll(array $filters = []): Collection;

    public function store(array $data): Harvest;

    public function getTodayTotal(): float;

    /**
     * Ambil data panen harian (aggregated per hari) untuk chart dashboard.
     *
     * @param int $days Jumlah hari ke belakang
     * @return array<int, array{date: string, label: string, total_kg: float}>
     */
    public function getDailyChart(int $days = 14): array;
}
