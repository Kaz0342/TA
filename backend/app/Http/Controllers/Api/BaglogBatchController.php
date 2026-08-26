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
            'status' => 'required|in:'.implode(',', [BaglogBatch::STATUS_ACTIVE, BaglogBatch::STATUS_CONTAMINATED, BaglogBatch::STATUS_DISPOSED]),
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
}
