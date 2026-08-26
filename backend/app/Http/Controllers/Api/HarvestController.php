<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreHarvestRequest;
use App\Services\HarvestService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HarvestController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly HarvestService $service
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['start_date', 'end_date']);
        $harvests = $this->service->getAllHarvests($filters);

        return $this->success($harvests, 'Harvest data retrieved');
    }

    public function store(StoreHarvestRequest $request): JsonResponse
    {
        $harvest = $this->service->createHarvest($request->validated(), $request->user()->id);

        return $this->created($harvest, 'Data panen berhasil disimpan');
    }

    public function todayTotal(): JsonResponse
    {
        $total = $this->service->getTodayTotal();

        return $this->success(['total_kg' => $total], 'Today harvest total retrieved');
    }

    /**
     * GET /api/harvests/chart
     * Data panen harian (aggregated) untuk chart di dashboard.
     */
    public function chart(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 14);
        $chartData = $this->service->getHarvestChart($days);

        return $this->success($chartData, 'Harvest chart data retrieved');
    }
}
