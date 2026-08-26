<?php

namespace App\Services;

use App\Models\Sale;
use App\Repositories\Contracts\HarvestRepositoryInterface;
use App\Repositories\Contracts\SaleRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class SaleService
{
    public function __construct(
        private readonly SaleRepositoryInterface $repository,
        private readonly HarvestRepositoryInterface $harvestRepository
    ) {}

    public function getAllSales(array $filters = []): Collection
    {
        return $this->repository->getAll($filters);
    }

    public function createSale(array $data, int $userId): Sale
    {
        $data['user_id'] = $userId;

        // Kalkulasi revenue menggunakan bcmath (presisi desimal uang)
        $data['total_revenue'] = bcmul((string) $data['quantity_kg'], (string) $data['price_per_kg'], 2);

        return $this->repository->store($data);
    }

    /**
     * Report: Perbandingan panen vs terjual minggu ini.
     */
    public function getWeeklyReport(): array
    {
        // Untuk minggu ini, total panen vs total penjualan
        $harvests = $this->harvestRepository->getAll([
            'start_date' => now()->startOfWeek()->toDateString(),
            'end_date' => now()->endOfWeek()->toDateString(),
        ]);

        $sales = $this->repository->getWeeklySales();

        $totalHarvestKg = (float) $harvests->sum('weight_kg');
        $totalSalesKg = (float) $sales->sum('quantity_kg');
        $totalRevenue = (float) $sales->sum('total_revenue');

        return [
            'period' => 'this_week',
            'start_date' => now()->startOfWeek()->toDateString(),
            'end_date' => now()->endOfWeek()->toDateString(),
            'total_harvest_kg' => $totalHarvestKg,
            'total_sales_kg' => $totalSalesKg,
            'unsold_kg' => max(0, $totalHarvestKg - $totalSalesKg),
            'total_revenue_idr' => $totalRevenue,
        ];
    }
}
