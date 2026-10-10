<?php

namespace App\Services;

use App\Models\BaglogBatch;
use App\Repositories\Contracts\BaglogRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
        // Probe P18: Larang pembalikan status dari disposed kembali ke active
        if ($batch->status === BaglogBatch::STATUS_DISPOSED && $status === BaglogBatch::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'status' => 'Batch yang sudah dibuang (disposed) tidak dapat diaktifkan kembali.',
            ]);
        }

        // Probe P18: Larang mengubah batch menjadi completed jika masih ada slot aktif di rak
        if ($status === BaglogBatch::STATUS_COMPLETED && $batch->assignments()->active()->exists()) {
            throw ValidationException::withMessages([
                'status' => 'Status batch tidak dapat diubah menjadi completed karena masih memiliki slot aktif di rak.',
            ]);
        }

        $data = ['status' => $status];
        if ($notes) {
            $data['notes'] = $notes;
        }

        return DB::transaction(function () use ($batch, $data, $status) {
            $updated = $this->repository->update($batch, $data);

            // Kaskade penutupan siklus slot jika batch ditandai contaminated atau disposed (W-02/W-10)
            if (in_array($status, [BaglogBatch::STATUS_CONTAMINATED, BaglogBatch::STATUS_DISPOSED])) {
                $reason = $status === BaglogBatch::STATUS_CONTAMINATED ? 'CONTAMINATED' : 'DISPOSED';
                foreach ($batch->assignments()->active()->get() as $assignment) {
                    $assignment->complete($reason);
                }
            }

            return $updated;
        });
    }
}
