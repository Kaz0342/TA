<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DeviceControlService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Controller untuk kontrol interupsi aktuator (Mode Jeda Panen & Auto-Resume).
 */
class DeviceControlController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly DeviceControlService $service
    ) {}

    /**
     * GET /api/device/command
     * Status perintah kontrol perangkat saat ini.
     */
    public function status(): JsonResponse
    {
        return $this->success($this->service->getCurrentCommand(), 'Status perintah perangkat dimuat');
    }

    /**
     * POST /api/device/pause
     * Jeda misting & fan dengan durasi preset (2 Jam, 4 Jam, 6 Jam, 8 Jam).
     */
    public function pause(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'duration_seconds' => 'required|integer|min:60|max:86400',
            'reason' => 'nullable|string|max:200',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $duration = (int) $request->input('duration_seconds');
        $reason = $request->input('reason', 'Mode Panen');

        $result = $this->service->pause($duration, $reason);

        return $this->success($result, "Mode jeda berhasil diaktifkan selama {$duration} detik. Misting & Exhaust Fan dinonaktifkan.");
    }

    /**
     * POST /api/device/resume
     * Akhiri mode jeda seketika dan kembalikan mikrokontroler ke mode AUTO.
     */
    public function resume(): JsonResponse
    {
        $result = $this->service->resume();

        return $this->success($result, 'Mode jeda diakhiri. Sistem kembali ke mode AUTO dan membaca sensor seketika.');
    }
}
