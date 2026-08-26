<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSprinklerLogRequest;
use App\Models\SprinklerLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class SprinklerLogController extends Controller
{
    use ApiResponse;

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

        $log = SprinklerLog::create($validated);

        return $this->success($log, 'Sprinkler log saved successfully', 201);
    }
}
