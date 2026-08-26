<?php

namespace App\Services;

use App\Models\BaglogBatch;
use App\Repositories\Contracts\BaglogRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class BaglogService
{
    public function __construct(
        private readonly BaglogRepositoryInterface $repository
    ) {}

    public function getAllBaglogs(array $filters = []): Collection
    {
        return $this->repository->getAll($filters);
    }

    public function getBaglogById(int $id): ?BaglogBatch
    {
        return $this->repository->findById($id);
    }

    public function createBaglog(array $data, int $userId): BaglogBatch
    {
        $data['user_id'] = $userId;

        return $this->repository->store($data);
    }

    public function updateBaglog(BaglogBatch $batch, array $data): BaglogBatch
    {
        return $this->repository->update($batch, $data);
    }

    public function changeStatus(BaglogBatch $batch, string $status, ?string $notes = null): BaglogBatch
    {
        $data = ['status' => $status];
        if ($notes) {
            $data['notes'] = $notes;
        }

        return $this->repository->update($batch, $data);
    }
}
