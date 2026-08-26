<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * DashboardController — endpoint untuk widget dashboard.
 *
 * @see PRD FR-1.3
 */
class DashboardController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly DashboardService $service
    ) {}

    /**
     * GET /api/dashboard/stats
     * Return semua ringkasan data untuk dashboard utama.
     */
    public function stats(): JsonResponse
    {
        $stats = $this->service->getQuickStats();

        return $this->success($stats, 'Dashboard stats retrieved');
    }
}
