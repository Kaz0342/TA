<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSensorDataRequest;
use App\Services\SensorDataService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SensorDataController — endpoint data IoT sensor.
 *
 * THIN CONTROLLER: hanya handle HTTP transport.
 * Business logic ada di SensorDataService.
 * Data access ada di SensorDataRepository.
 *
 * POST /api/sensor-data    → terima payload IoT (NO AUTH)
 * GET  /api/sensor-data/latest → data terbaru (AUTH)
 * GET  /api/sensor-data/chart  → data chart (AUTH)
 *
 * @see PRD FR-4.1 (API Endpoint IoT)
 * @see PRD FR-1.1 (Real-time Climate Cards)
 * @see PRD FR-1.2 (Climate Chart 24 jam)
 */
class SensorDataController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly SensorDataService $service
    ) {}

    /**
     * POST /api/sensor-data
     *
     * Endpoint khusus untuk menerima JSON payload dari ESP32.
     * TIDAK pakai user auth — device endpoint.
     * Rate limited: max 20 req/menit per device_id.
     *
     * Setelah simpan, otomatis cek threshold.
     * Jika ada violation, return alerts di response.
     */
    public function store(StoreSensorDataRequest $request): JsonResponse
    {
        $result = $this->service->store($request->validated());

        $responseData = [
            'sensor_data' => $result['sensor_data'],
        ];

        // Sertakan alerts jika ada pelanggaran threshold
        if (! empty($result['alerts'])) {
            $responseData['alerts'] = $result['alerts'];
        }

        return $this->created(
            $responseData,
            empty($result['alerts'])
                ? 'Data sensor berhasil disimpan'
                : 'Data sensor disimpan — WARNING: threshold violation detected!'
        );
    }

    /**
     * GET /api/sensor-data/latest
     *
     * Ambil data sensor terbaru.
     * Dipakai oleh FR-1.1 (Real-time Climate Cards).
     */
    public function latest(): JsonResponse
    {
        $sensorData = $this->service->getLatest();

        if (! $sensorData) {
            return $this->notFound('Belum ada data sensor');
        }

        // Cek threshold saat ini juga
        $alerts = $this->service->checkThresholdViolations($sensorData);

        return $this->success([
            'temperature' => $sensorData->temperature,
            'humidity' => $sensorData->humidity,
            'device_id' => $sensorData->device_id,
            'recorded_at' => $sensorData->recorded_at->toIso8601String(),
            'alerts' => $alerts,
        ]);
    }

    /**
     * GET /api/sensor-data/chart?hours=24
     *
     * Ambil data sensor untuk line chart.
     * Dipakai oleh FR-1.2 (Climate Chart 24 jam).
     *
     * Query param: hours (default 24, max 168 = 1 minggu)
     */
    public function chart(Request $request): JsonResponse
    {
        $hours = min((int) $request->get('hours', 24), 168);

        $chartData = $this->service->getChartData($hours);

        // Format data untuk frontend chart library (Recharts/Chart.js)
        $formatted = $chartData->map(fn ($reading) => [
            'temperature' => (float) $reading->temperature,
            'humidity' => (float) $reading->humidity,
            'recorded_at' => $reading->recorded_at->toIso8601String(),
            'time_label' => $reading->recorded_at->format('H:i'),
        ]);

        return $this->success($formatted, 'Chart data retrieved', 200, [
            'hours' => $hours,
            'total_readings' => $chartData->count(),
        ]);
    }
}
