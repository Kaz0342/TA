<?php

namespace App\Repositories;

use App\Models\Harvest;
use App\Repositories\Contracts\HarvestRepositoryInterface;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class HarvestRepository implements HarvestRepositoryInterface
{
    public function getAll(array $filters = []): Collection
    {
        $query = Harvest::with('baglogBatch'); // Eager load relasi

        if (isset($filters['start_date']) && isset($filters['end_date'])) {
            $query->betweenDates($filters['start_date'], $filters['end_date']);
        }

        return $query->orderByDesc('harvest_date')->orderByDesc('id')->get();
    }

    public function store(array $data): Harvest
    {
        return Harvest::create($data);
    }

    public function getTodayTotal(): float
    {
        return (float) Harvest::today()->sum('weight_kg');
    }

    /**
     * Aggregasi panen harian untuk 14 hari terakhir.
     * Hari tanpa panen tetap ditampilkan dengan total_kg = 0.
     */
    public function getDailyChart(int $days = 14): array
    {
        $startDate = now()->subDays($days - 1)->startOfDay();

        // Query: GROUP BY harvest_date, SUM weight_kg
        $harvests = Harvest::where('harvest_date', '>=', $startDate->toDateString())
            ->select(
                DB::raw('DATE(harvest_date) as date'),
                DB::raw('SUM(weight_kg) as total_kg')
            )
            ->groupBy(DB::raw('DATE(harvest_date)'))
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        // Isi hari-hari kosong dengan 0
        $chart = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $startDate->copy()->addDays($i);
            $dateStr = $date->toDateString();
            $chart[] = [
                'date' => $dateStr,
                'label' => $date->translatedFormat('d M'),
                'total_kg' => isset($harvests[$dateStr])
                    ? round((float) $harvests[$dateStr]->total_kg, 2)
                    : 0,
            ];
        }

        return $chart;
    }
}
