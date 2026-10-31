<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ScmAdvisorService;
use App\Services\TraceabilityService;
use Illuminate\Http\JsonResponse;

class ScmAdvisorController extends Controller
{
    public function __construct(
        private readonly ScmAdvisorService $advisorService,
        private readonly TraceabilityService $traceabilityService
    ) {}

    /**
     * Snapshot kapasitas fisik dan okupansi kumbung real-time.
     */
    public function capacitySnapshot(): JsonResponse
    {
        $snapshot = $this->advisorService->getCapacitySnapshot();

        return response()->json([
            'success' => true,
            'data' => $snapshot,
            'message' => 'Snapshot kapasitas kumbung berhasil diambil',
        ]);
    }

    /**
     * Proyeksi pelepasan slot dan kapasitas bebas (Rolling Capacity Forecast).
     */
    public function capacityForecast(): JsonResponse
    {
        $forecast = $this->advisorService->getRollingCapacityForecast();

        return response()->json([
            'success' => true,
            'data' => $forecast,
            'message' => 'Proyeksi kapasitas bergulir berhasil dihitung',
        ]);
    }

    /**
     * Rekomendasi Purchase Order (PO) & Restock Bibit Cerdas.
     */
    public function restockRecommendations(): JsonResponse
    {
        $recommendations = $this->advisorService->getRestockRecommendations();

        return response()->json([
            'success' => true,
            'data' => $recommendations,
            'message' => 'Rekomendasi restock bibit berhasil dihitung',
        ]);
    }

    /**
     * Ketertelusuran Hulu-ke-Hilir dari sebuah batch baglog.
     */
    public function batchTraceability(string $batchCode): JsonResponse
    {
        $trace = $this->traceabilityService->getBatchTraceability($batchCode);

        if (! $trace) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Batch baglog tidak ditemukan',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $trace,
            'message' => 'Ketertelusuran batch berhasil ditelusuri',
        ]);
    }

    /**
     * Penelusuran asal-usul panen dari sebuah transaksi penjualan.
     */
    public function saleTraceability(int $id): JsonResponse
    {
        $origin = $this->traceabilityService->getSaleOrigin($id);

        if (! $origin) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Transaksi penjualan tidak ditemukan',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $origin,
            'message' => 'Asal-usul penjualan berhasil ditelusuri',
        ]);
    }
}

