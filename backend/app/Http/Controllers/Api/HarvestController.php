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

    /**
     * POST /api/harvests/{id}/void
     * Batalkan data panen yang salah input (W-09).
     */
    public function void(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'reason' => 'required|string|min:5|max:255',
        ]);

        $harvest = \App\Models\Harvest::withVoided()->find($id);

        if (! $harvest) {
            return $this->notFound('Data panen tidak ditemukan');
        }

        if ($harvest->isVoided()) {
            return $this->error('Data panen sudah dibatalkan (voided) sebelumnya', 422);
        }

        $harvest->void($request->user()->id, $request->input('reason'));

        return $this->success($harvest, 'Data panen berhasil di-void (dibatalkan)');
    }
}
