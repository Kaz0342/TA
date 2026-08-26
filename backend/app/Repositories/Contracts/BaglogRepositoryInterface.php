<?php

namespace App\Repositories\Contracts;

use App\Models\BaglogBatch;
use Illuminate\Database\Eloquent\Collection;

interface BaglogRepositoryInterface
{
    public function getAll(array $filters = []): Collection;

    public function findById(int $id): ?BaglogBatch;

    public function store(array $data): BaglogBatch;

    public function update(BaglogBatch $batch, array $data): BaglogBatch;
}
