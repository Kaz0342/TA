<?php

namespace App\Services;

use App\Models\Harvest;
use App\Repositories\Contracts\HarvestRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class HarvestService
{
    public function __construct(
        private readonly HarvestRepositoryInterface $repository
    ) {}

    public function getAllHarvests(array $filters = []): Collection
    {
        return $this->repository->getAll($filters);
    }

    public function createHarvest(array $data, int $userId): Harvest
    {
        $data['user_id'] = $userId;

        return $this->repository->store($data);
    }

    public function getTodayTotal(): float
    {
        return $this->repository->getTodayTotal();
    }

    /**
     * Ambil data chart panen harian (14 hari terakhir).
     */
    public function getHarvestChart(int $days = 14): array
    {
        return $this->repository->getDailyChart($days);
    }
}
