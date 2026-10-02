<?php

namespace App\Repositories;

use App\Models\BaglogBatch;
use App\Repositories\Contracts\BaglogRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class BaglogRepository implements BaglogRepositoryInterface
{
    public function getAll(array $filters = []): Collection
    {
        $query = BaglogBatch::query()
            ->withSum('assignments as assigned_quantity', 'initial_quantity')
            ->withCount('assignments as assigned_slots_count');

        if (isset($filters['status'])) {
            $query->withStatus($filters['status']);
        }

        return $query->orderByDesc('entry_date')->get();
    }

    public function findById(int $id): ?BaglogBatch
    {
        return BaglogBatch::find($id);
    }

    public function store(array $data): BaglogBatch
    {
        $maxAttempts = 3;
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                if (empty($data['batch_code'])) {
                    $data['batch_code'] = BaglogBatch::generateBatchCode($data['entry_date'] ?? null);
                }

                return BaglogBatch::create($data);
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                if ($attempt === $maxAttempts) {
                    throw $e;
                }
                unset($data['batch_code']);
            }
        }

        return BaglogBatch::create($data);
    }

    public function update(BaglogBatch $batch, array $data): BaglogBatch
    {
        $batch->update($data);

        return $batch;
    }
}
