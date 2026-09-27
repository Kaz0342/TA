<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BaglogBatch;
use App\Models\BatchSlotAssignment;
use App\Models\Slot;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Controller untuk mengelola alokasi batch baglog ke koordinat slot rak (WMS).
 */
class BatchSlotAssignmentController extends Controller
{
    use ApiResponse;

    /**
     * POST /api/batch-slot-assignments
     * Alokasi batch baglog ke satu atau banyak slot sekaligus (Bulk / Drag-Select).
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'baglog_batch_id' => 'required|exists:baglog_batches,id',
            'assigned_at' => 'required|date',
            'slots' => 'required|array|min:1',
            'slots.*.slot_code' => 'required|string|exists:slots,slot_code',
            'slots.*.initial_quantity' => 'nullable|integer|min:1|max:20',
            'slots.*.initial_mycelium_stage' => 'required|in:LEVEL_1,LEVEL_2,LEVEL_3',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $batchId = (int) $request->input('baglog_batch_id');
        $assignedAt = $request->input('assigned_at');
        $slotEntries = $request->input('slots');

        $slotCodes = array_column($slotEntries, 'slot_code');

        // Validasi: Cek apakah ada slot duplikat di request
        if (count($slotCodes) !== count(array_unique($slotCodes))) {
            return $this->error('Terdapat kode slot yang duplikat dalam permohonan alokasi.', 422);
        }

        // Validasi: Cek apakah slot yang diminta sedang terisi oleh batch aktif
        $occupiedSlots = BatchSlotAssignment::whereIn('slot_code', $slotCodes)
            ->whereIn('current_status', [BatchSlotAssignment::STATUS_INCUBATION, BatchSlotAssignment::STATUS_FRUITING])
            ->pluck('slot_code')
            ->toArray();

        if (! empty($occupiedSlots)) {
            return $this->error(
                'Beberapa slot yang dipilih masih terisi batch aktif: ' . implode(', ', $occupiedSlots),
                422,
                ['occupied_slots' => $occupiedSlots]
            );
        }

        $created = [];

        DB::transaction(function () use ($batchId, $assignedAt, $slotEntries, &$created) {
            foreach ($slotEntries as $entry) {
                $created[] = BatchSlotAssignment::create([
                    'baglog_batch_id' => $batchId,
                    'slot_code' => strtoupper($entry['slot_code']),
                    'initial_quantity' => $entry['initial_quantity'] ?? 10,
                    'initial_mycelium_stage' => $entry['initial_mycelium_stage'],
                    'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
                    'assigned_at' => $assignedAt,
                ]);
            }
        });

        return $this->created([
            'total_assigned' => count($created),
            'assignments' => $created,
        ], 'Batch baglog berhasil dialokasikan ke koordinat slot rak');
    }

    /**
     * PATCH /api/batch-slot-assignments/{id}/status
     * Ubah status fase pertumbuhan slot (INCUBATION -> FRUITING -> COMPLETED).
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:INCUBATION,FRUITING,COMPLETED',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $assignment = BatchSlotAssignment::find($id);

        if (! $assignment) {
            return $this->notFound('Data alokasi slot tidak ditemukan');
        }

        $assignment->update([
            'current_status' => $request->input('status'),
        ]);

        return $this->success($assignment, 'Status fase slot berhasil diperbarui');
    }

    /**
     * DELETE /api/batch-slot-assignments/{id}
     * Batalkan alokasi slot (hanya jika belum ada rekaman panen atau kematian).
     */
    public function destroy(int $id): JsonResponse
    {
        $assignment = BatchSlotAssignment::find($id);

        if (! $assignment) {
            return $this->notFound('Data alokasi slot tidak ditemukan');
        }

        if ($assignment->harvests()->exists() || $assignment->culls()->exists()) {
            return $this->error('Alokasi slot tidak dapat dihapus karena sudah memiliki riwayat panen atau mutasi afkir.', 422);
        }

        $assignment->delete();

        return $this->success(null, 'Alokasi slot berhasil dibatalkan');
    }
}
