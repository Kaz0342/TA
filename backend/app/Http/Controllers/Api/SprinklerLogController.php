<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSprinklerLogRequest;
use App\Models\SprinklerLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SprinklerLogController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/sprinkler-logs
     * Ambil riwayat log aktivasi aktuator (misting & fan).
     * Mendukung query param: ?actuator=misting|fan & ?limit=10
     */
    public function index(Request $request): JsonResponse
    {
        $limit = min(max((int) $request->query('limit', 10), 1), 100);
        $actuator = $request->query('actuator');

        $query = SprinklerLog::query()->orderBy('started_at', 'desc');

        if ($actuator && in_array(strtolower($actuator), ['misting', 'fan'], true)) {
            $query->where('actuator', strtolower($actuator));
        }

        $logs = $query->limit($limit)->get([
            'id',
            'device_id',
            'actuator',
            'duration_seconds',
            'trigger_reason',
            'stop_reason',
            'started_at',
            'created_at',
        ]);

        return $this->success($logs, 'Sprinkler logs retrieved successfully');
    }

    /**
     * POST /api/sprinkler-logs
     * Endpoint untuk ESP32 ngirim log setelah nyiram.
     */
    public function store(StoreSprinklerLogRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // IOT-W1 Fix: Jika ESP32 tidak mengirim started_at, gunakan waktu server
        if (empty($validated['started_at'])) {
            $validated['started_at'] = now();
        }

        if (empty($validated['actuator'])) {
            $validated['actuator'] = 'misting';
        }

        $log = SprinklerLog::create($validated);

        return $this->success($log, 'Sprinkler log saved successfully', 201);
    }
}
