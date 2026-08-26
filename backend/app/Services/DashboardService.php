<?php

namespace App\Services;

use App\Models\BaglogBatch;
use App\Models\Harvest;
use App\Models\Sale;
use App\Models\SprinklerLog;
use App\Repositories\Contracts\SensorDataRepositoryInterface;
use Carbon\Carbon;

/**
 * DashboardService — Aggregation service untuk FR-1.3 Quick Stats.
 *
 * Menggabungkan data dari berbagai tabel untuk ditampilkan
 * di Dashboard tanpa memberatkan controller.
 */
class DashboardService
{
    public function __construct(
        private readonly SensorDataRepositoryInterface $sensorRepository,
        private readonly SensorDataService $sensorService
    ) {}

    /**
     * Ambil summary stats untuk dashboard.
     */
    public function getQuickStats(): array
    {
        // 1. Total Baglog Aktif
        $activeBaglogs = BaglogBatch::active()->sum('quantity');

        // 2. Total Panen Hari Ini
        $todayHarvest = Harvest::today()->sum('weight_kg');

        // 3. Revenue Bulan Ini
        $monthlyRevenue = Sale::thisMonth()->sum('total_revenue');

        // 4. Alert dari Sensor Terbaru
        $latestSensor = $this->sensorRepository->getLatest();
        $alerts = [];

        if ($latestSensor) {
            // Menggunakan injected service
            $alerts = $this->sensorService->checkThresholdViolations($latestSensor);
        }

        $latestBatches = BaglogBatch::where('status', 'active')
            ->orderBy('entry_date', 'desc')
            ->limit(3)
            ->get(['batch_code', 'entry_date', 'quantity', 'supplier'])
            ->map(function ($batch) {
                // Tambahkan field komputasi umur hari
                $batch->age_days = Carbon::parse($batch->entry_date)->diffInDays(now());

                return $batch;
            });

        $sprinklerLogs = SprinklerLog::orderBy('started_at', 'desc')
            ->limit(5)
            ->get(['started_at', 'duration_seconds', 'trigger_reason']);

        return [
            'active_baglogs' => (int) $activeBaglogs,
            'today_harvest_kg' => (float) $todayHarvest,
            'monthly_revenue_idr' => (float) $monthlyRevenue,
            'system_alerts' => $alerts,
            'latest_batches' => $latestBatches,
            'sprinkler_logs' => $sprinklerLogs,
            'last_sensor_update' => $latestSensor ? $latestSensor->recorded_at->toIso8601String() : null,
        ];
    }
}
