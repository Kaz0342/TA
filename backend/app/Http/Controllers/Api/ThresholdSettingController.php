<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateThresholdRequest;
use App\Models\ThresholdSetting;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * ThresholdSettingController — handle API settings batas suhu.
 *
 * @see PRD FR-4.2
 */
class ThresholdSettingController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/thresholds
     * Ambil setting aktif (untuk admin).
     */
    public function index(): JsonResponse
    {
        $threshold = ThresholdSetting::active()->first();

        if (! $threshold) {
            return $this->notFound('Belum ada setting threshold aktif.');
        }

        return $this->success($threshold, 'Threshold retrieved');
    }

    /**
     * PUT /api/thresholds
     * Update batas suhu/kelembaban.
     */
    public function update(UpdateThresholdRequest $request): JsonResponse
    {
        // Karena sistem hanya punya 1 threshold aktif per kumbung
        $threshold = ThresholdSetting::active()->first();

        if (! $threshold) {
            // Jika belum ada, buat baru
            $threshold = new ThresholdSetting;
            $threshold->user_id = $request->user()->id;
            $threshold->is_active = true;
        }

        $threshold->fill($request->validated());
        $threshold->save();

        return $this->success($threshold, 'Setting threshold berhasil diupdate');
    }
}
