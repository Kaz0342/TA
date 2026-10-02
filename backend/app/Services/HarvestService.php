<?php

namespace App\Services;

use App\Models\BaglogBatch;
use App\Models\BatchSlotAssignment;
use App\Models\Harvest;
use App\Repositories\Contracts\HarvestRepositoryInterface;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HarvestService
{
    public function __construct(
        private readonly HarvestRepositoryInterface $repository
    ) {}

    public function getAllHarvests(array $filters = []): Collection
    {
        return $this->repository->getAll($filters);
    }

    /**
     * Catat hasil panen harian dengan pengaman slot, flush otomatis, dan state transition.
     * Sesuai W-01, W-08, dan W-11.
     *
     * @throws ValidationException
     */
    public function createHarvest(array $data, int $userId): Harvest
    {
        $data['user_id'] = $userId;
        $data['quality_grade'] = $data['quality_grade'] ?? 'A';

        return DB::transaction(function () use ($data) {
            $batchId = $data['baglog_batch_id'] ?? null;
            $slotCode = ! empty($data['slot_code']) ? strtoupper($data['slot_code']) : null;

            if ($slotCode) {
                // Cari assignment aktif untuk slot ini
                $query = BatchSlotAssignment::where('slot_code', $slotCode)->active()->lockForUpdate();
                if ($batchId) {
                    $query->where('baglog_batch_id', $batchId);
                }
                $assignment = $query->first();

                if (! $assignment) {
                    throw ValidationException::withMessages([
                        'slot_code' => "Slot {$slotCode} tidak memiliki batch aktif yang cocok.",
                    ]);
                }

                // Sinkronkan batch_id dari assignment bila sebelumnya kosong
                $data['baglog_batch_id'] = $assignment->baglog_batch_id;
                $batchId = $assignment->baglog_batch_id;

                // Cek kapasitas aktif di slot (W-08)
                if ($assignment->kapasitasAktif() <= 0) {
                    throw ValidationException::withMessages([
                        'slot_code' => "Slot {$slotCode} sudah tidak memiliki baglog aktif (kapasitas 0).",
                    ]);
                }

                // Invarian tanggal: tanggal panen tidak boleh sebelum penempatan slot (W-11)
                if (Carbon::parse($data['harvest_date'])->lt(Carbon::parse($assignment->assigned_at))) {
                    throw ValidationException::withMessages([
                        'harvest_date' => 'Tanggal panen tidak boleh sebelum tanggal masuk rak (' . Carbon::parse($assignment->assigned_at)->toDateString() . ').',
                    ]);
                }

                // Auto-increment flush per slot bila kosong
                if (empty($data['flush_number'])) {
                    $lastFlush = (int) Harvest::where('baglog_batch_id', $batchId)
                        ->where('slot_code', $slotCode)
                        ->max('flush_number');
                    $data['flush_number'] = $lastFlush ? ($lastFlush + 1) : 1;
                }

                if ($data['flush_number'] > (int) config('baglog.max_flush', 7)) {
                    throw ValidationException::withMessages([
                        'flush_number' => 'Melebihi batas flush maksimal (' . config('baglog.max_flush', 7) . '); silakan tutup siklus slot ini.',
                    ]);
                }

                // State transition otomatis: panen pertama mengubah INCUBATION -> FRUITING (W-10)
                if ($assignment->current_status === BatchSlotAssignment::STATUS_INCUBATION) {
                    $assignment->update(['current_status' => BatchSlotAssignment::STATUS_FRUITING]);
                }
            } elseif ($batchId) {
                // Penimbangan per batch tanpa spesifikasi slot (Keputusan Lapangan #1)
                $batch = BaglogBatch::find($batchId);
                if ($batch && ! $batch->isActive()) {
                    throw ValidationException::withMessages([
                        'baglog_batch_id' => 'Batch baglog tidak aktif.',
                    ]);
                }

                if (empty($data['flush_number'])) {
                    $lastFlush = (int) Harvest::where('baglog_batch_id', $batchId)->max('flush_number');
                    $data['flush_number'] = $lastFlush ? ($lastFlush + 1) : 1;
                }
            } else {
                $data['flush_number'] = $data['flush_number'] ?? 1;
            }

            return $this->repository->store($data);
        });
    }

    public function getTodayTotal(): float
    {
        return $this->repository->getTodayTotal();
    }

    /**
     * Ambil data chart panen harian (14 hari terakhir).
     */
    public function getHarvestChart(int $days = 14): array
    {
        return $this->repository->getDailyChart($days);
    }
}
