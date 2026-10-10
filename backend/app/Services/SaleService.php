<?php

namespace App\Services;

use App\Models\Harvest;
use App\Models\Sale;
use App\Repositories\Contracts\HarvestRepositoryInterface;
use App\Repositories\Contracts\SaleRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

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

    /**
     * Catat penjualan baru dengan validasi stok layak jual (AUD-02 & AUD-12).
     *
     * @throws ValidationException
     */
    public function createSale(array $data, int $userId): Sale
    {
        $data['user_id'] = $userId;

        // Hitung stok jamur layak jual yang tersedia (Grade A & B, non-void)
        $totalSellableHarvest = (float) Harvest::where(function ($q) {
            $q->whereNull('quality_grade')
                ->orWhere('quality_grade', '!=', 'REJECT');
        })->sum('weight_kg');

        $totalSales = (float) Sale::sum('quantity_kg');
        $availableStock = round($totalSellableHarvest - $totalSales, 2);

        $requestedQty = (float) $data['quantity_kg'];
        $isForced = ! empty($data['force']) && filter_var($data['force'], FILTER_VALIDATE_BOOLEAN);

        if ($requestedQty > $availableStock && ! $isForced) {
            throw ValidationException::withMessages([
                'quantity_kg' => [
                    "Stok jamur tiram layak jual tidak mencukupi (Tersedia: {$availableStock} kg, Permintaan: {$requestedQty} kg). Gunakan opsi penjualan paksa (force) dengan alasan jika pencatatan panen susulan.",
                ],
            ]);
        }

        // Kalkulasi revenue menggunakan bcmath (presisi desimal uang)
        $data['total_revenue'] = bcmul((string) $data['quantity_kg'], (string) $data['price_per_kg'], 2);

        // Jika force digunakan, dokumentasikan alasan pada catatan audit
        if ($isForced && ! empty($data['force_reason'])) {
            $forceNote = '[FORCE SALE: '.trim((string) $data['force_reason']).']';
            $data['notes'] = ! empty($data['notes']) ? ($data['notes'].' '.$forceNote) : $forceNote;
        }

        unset($data['force'], $data['force_reason']);

        return $this->repository->store($data);
    }

    /**
     * Report: Perbandingan panen vs terjual minggu ini.
     * Mengisolasi panen REJECT dari stok layak jual (AUD-12) dan menampilkan defisit stok riil (AUD-02).
     */
    public function getWeeklyReport(int $weekOffset = 0): array
    {
        $startDate = now()->subWeeks($weekOffset)->startOfWeek()->toDateString();
        $endDate = now()->subWeeks($weekOffset)->endOfWeek()->toDateString();

        $harvests = $this->harvestRepository->getAll([
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);

        $sales = $this->repository->getAll([
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);

        // Pisahkan panen layak jual (A+B) vs REJECT (AUD-12)
        $totalSellableHarvestKg = (float) $harvests->filter(fn ($h) => $h->quality_grade !== 'REJECT')->sum('weight_kg');
        $totalRejectKg = (float) $harvests->filter(fn ($h) => $h->quality_grade === 'REJECT')->sum('weight_kg');

        $totalSalesKg = (float) $sales->sum('quantity_kg');
        $totalRevenue = (float) $sales->sum('total_revenue');

        // Tampilkan sisa stok riil (bisa negatif/defisit, jangan disembunyikan max(0, ...)) (AUD-02)
        $unsoldKg = round($totalSellableHarvestKg - $totalSalesKg, 2);

        return [
            'period' => $weekOffset === 0 ? 'this_week' : $weekOffset.'_weeks_ago',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_harvest_kg' => $totalSellableHarvestKg,
            'total_reject_kg' => $totalRejectKg,
            'total_sales_kg' => $totalSalesKg,
            'unsold_kg' => $unsoldKg,
            'total_revenue_idr' => $totalRevenue,
        ];
    }
}
