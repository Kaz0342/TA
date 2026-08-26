<?php

namespace App\Repositories;

use App\Models\BaglogBatch;
use App\Repositories\Contracts\BaglogRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class BaglogRepository implements BaglogRepositoryInterface
{
    public function getAll(array $filters = []): Collection
    {
        $query = BaglogBatch::query();

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
        // Auto generate batch code if not provided
        if (empty($data['batch_code'])) {
            $data['batch_code'] = BaglogBatch::generateBatchCode();
        }

        return BaglogBatch::create($data);
    }

    public function update(BaglogBatch $batch, array $data): BaglogBatch
    {
        $batch->update($data);

        return $batch;
    }
}
