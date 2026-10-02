<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBaglogRequest;
use App\Models\BaglogBatch;
use App\Services\BaglogService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BaglogBatchController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly BaglogService $service
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status']);
        $baglogs = $this->service->getAllBaglogs($filters);

        // Append age_days (accessor) explicitly for API response
        $baglogs->each->append('age_days');

        return $this->success($baglogs, 'Baglogs retrieved');
    }

    public function store(StoreBaglogRequest $request): JsonResponse
    {
        $baglog = $this->service->createBaglog($request->validated(), $request->user()->id);
        $baglog->append('age_days');

        return $this->created($baglog, 'Batch baglog berhasil ditambahkan');
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:'.implode(',', [
                BaglogBatch::STATUS_ACTIVE,
                BaglogBatch::STATUS_CONTAMINATED,
                BaglogBatch::STATUS_DISPOSED,
                BaglogBatch::STATUS_COMPLETED,
            ]),
            'notes' => 'nullable|string',
        ]);

        $batch = $this->service->getBaglogById($id);

        if (! $batch) {
            return $this->notFound('Baglog batch tidak ditemukan');
        }

        $updatedBatch = $this->service->changeStatus($batch, $request->status, $request->notes);
        $updatedBatch->append('age_days');

        return $this->success($updatedBatch, 'Status baglog berhasil diubah');
    }

    /**
     * GET /api/baglogs/{id}/hpp
     * Kalkulasi Margin Kontribusi & HPP batch tertentu.
     */
    public function hpp(int $id): JsonResponse
    {
        $batch = BaglogBatch::find($id);

        if (! $batch) {
            return $this->notFound('Baglog batch tidak ditemukan');
        }

        return $this->success($batch->marginKontribusi(), 'Analisis HPP & Margin Kontribusi berhasil dimuat');
    }

    /**
     * GET /api/baglogs/hpp-summary
     * Rekapitulasi HPP & Margin Kontribusi seluruh batch aktif.
     */
    public function hppSummary(): JsonResponse
    {
        $batches = BaglogBatch::with(['operationalExpenses', 'sales'])->get();

        $summaries = $batches->map(fn (BaglogBatch $b) => $b->marginKontribusi());

        $totalModal = (float) $summaries->sum('modal_baglog_awal');
        $totalOps = (float) $summaries->sum('biaya_operasional');
        $totalOmzet = (float) $summaries->sum('omzet_kotor');
        $totalMargin = (float) $summaries->sum('margin_kontribusi');
        $totalHarvestAll = (float) $summaries->sum('total_harvest_kg');
        $totalBiayaAll = $totalModal + $totalOps;
        $avgHppAll = $totalHarvestAll > 0 ? round($totalBiayaAll / $totalHarvestAll, 2) : 0.0;

        return $this->success([
            'total_batches' => $batches->count(),
            'total_modal_investasi' => $totalModal,
            'total_operational_expense' => $totalOps,
            'total_biaya' => $totalBiayaAll,
            'total_sales_revenue' => $totalOmzet,
            'total_margin_kontribusi' => $totalMargin,
            'total_harvest_kg' => $totalHarvestAll,
            'avg_hpp_per_kg' => $avgHppAll,
            'aggregate' => [
                'total_modal_baglog' => $totalModal,
                'total_biaya_operasional' => $totalOps,
                'total_biaya' => $totalBiayaAll,
                'total_omzet' => $totalOmzet,
                'total_margin_kontribusi' => $totalMargin,
            ],
            'batches' => $summaries,
        ], 'Ringkasan HPP seluruh batch berhasil dimuat');
    }
}
