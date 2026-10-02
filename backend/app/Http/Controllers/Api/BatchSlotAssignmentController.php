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
            'assigned_at' => 'required|date|before_or_equal:today',
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
        if (count($slotCodes) !== count(array_unique(array_map('strtoupper', $slotCodes)))) {
            return $this->error('Terdapat kode slot yang duplikat dalam permohonan alokasi.', 422);
        }

        // Validasi kapasitas slot individual dari database
        $upperSlotCodes = array_map('strtoupper', $slotCodes);
        $slotsDb = Slot::whereIn('slot_code', $upperSlotCodes)->pluck('max_capacity', 'slot_code');
        foreach ($slotEntries as $entry) {
            $slotCodeUpper = strtoupper($entry['slot_code']);
            $maxCap = $slotsDb[$slotCodeUpper] ?? 10;
            $qty = (int) ($entry['initial_quantity'] ?? 10);
            if ($qty > $maxCap) {
                return $this->error("Jumlah alokasi pada slot {$slotCodeUpper} ({$qty} baglog) melebihi kapasitas maksimum slot ({$maxCap} baglog).", 422);
            }
        }

        $created = [];
        $errorResponse = null;

        DB::transaction(function () use ($batchId, $assignedAt, $slotEntries, $upperSlotCodes, &$created, &$errorResponse) {
            $batch = BaglogBatch::lockForUpdate()->findOrFail($batchId);

            if (! $batch->isActive()) {
                $errorResponse = $this->error('Batch baglog sudah tidak aktif.', 422);
                return;
            }

            if (\Carbon\Carbon::parse($assignedAt)->lt(\Carbon\Carbon::parse($batch->entry_date))) {
                $errorResponse = $this->error('Tanggal penempatan tidak boleh sebelum tanggal masuk batch (' . \Carbon\Carbon::parse($batch->entry_date)->toDateString() . ').', 422);
                return;
            }

            // Rekonsiliasi kuantitas batch (W-04)
            $alreadyAssigned = (int) BatchSlotAssignment::where('baglog_batch_id', $batchId)->sum('initial_quantity');
            $newTotal = (int) collect($slotEntries)->sum(fn ($e) => (int) ($e['initial_quantity'] ?? 10));

            if ($alreadyAssigned + $newTotal > $batch->quantity) {
                $remaining = max(0, $batch->quantity - $alreadyAssigned);
                $errorResponse = $this->error(
                    "Total penempatan alokasi ({$alreadyAssigned} + {$newTotal} = " . ($alreadyAssigned + $newTotal) . " baglog) melebihi kuantitas batch ({$batch->quantity} baglog). Sisa baglog belum ditempatkan: {$remaining} baglog.",
                    422
                );
                return;
            }

            // Validasi okupansi dengan lock dalam transaksi
            $occupiedSlots = BatchSlotAssignment::whereIn('slot_code', $upperSlotCodes)
                ->whereIn('current_status', [BatchSlotAssignment::STATUS_INCUBATION, BatchSlotAssignment::STATUS_FRUITING])
                ->lockForUpdate()
                ->pluck('slot_code')
                ->toArray();

            if (! empty($occupiedSlots)) {
                $errorResponse = $this->error(
                    'Beberapa slot yang dipilih masih terisi batch aktif: ' . implode(', ', $occupiedSlots),
                    422,
                    ['occupied_slots' => $occupiedSlots]
                );
                return;
            }

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

        if ($errorResponse) {
            return $errorResponse;
        }

        return $this->created([
            'total_assigned' => count($created),
            'assignments' => $created,
        ], 'Batch baglog berhasil dialokasikan ke koordinat slot rak');
    }

    /**
     * PATCH /api/batch-slot-assignments/{id}/status
     * Ubah status fase pertumbuhan slot (INCUBATION -> FRUITING -> COMPLETED).
     * Menerapkan matriks transisi legal (W-10).
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:INCUBATION,FRUITING,COMPLETED',
            'reason' => 'nullable|in:EXHAUSTED,CONTAMINATED,DISPOSED,MANUAL',
            'date' => 'nullable|date|before_or_equal:today',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $assignment = BatchSlotAssignment::find($id);

        if (! $assignment) {
            return $this->notFound('Data alokasi slot tidak ditemukan');
        }

        $newStatus = $request->input('status');
        $currentStatus = $assignment->current_status;

        // Idempotent jika status sama
        if ($newStatus === $currentStatus) {
            return $this->success($assignment, 'Status fase slot tidak berubah');
        }

        // Cek matriks transisi legal (W-10)
        $allowedTransitions = BatchSlotAssignment::TRANSITIONS[$currentStatus] ?? [];
        if (! in_array($newStatus, $allowedTransitions, true)) {
            return $this->error("Transisi status dari {$currentStatus} ke {$newStatus} tidak diperbolehkan.", 422);
        }

        if ($newStatus === BatchSlotAssignment::STATUS_COMPLETED) {
            $assignment->complete($request->input('reason', 'MANUAL'), $request->input('date'));
        } else {
            $assignment->update([
                'current_status' => $newStatus,
            ]);
        }

        return $this->success($assignment->fresh(), 'Status fase slot berhasil diperbarui');
    }

    /**
     * POST /api/batch-slot-assignments/{id}/complete
     * Selesaikan siklus hidup slot secara eksplisit (Tutup siklus / kosongkan slot) (W-02).
     * Sisa baglog dialirkan ke jurnal afkir HABIS_PRODUKSI sesuai prinsip ledger.
     */
    public function completeCycle(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|in:EXHAUSTED,CONTAMINATED,DISPOSED,MANUAL',
            'date' => 'nullable|date|before_or_equal:today',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $assignment = BatchSlotAssignment::find($id);

        if (! $assignment) {
            return $this->notFound('Data alokasi slot tidak ditemukan');
        }

        if ($assignment->current_status === BatchSlotAssignment::STATUS_COMPLETED) {
            return $this->error('Siklus slot ini sudah berstatus selesai (COMPLETED).', 422);
        }

        $reason = $request->input('reason', 'EXHAUSTED');
        $date = $request->input('date', now()->toDateString());

        $assignment->complete($reason, $date);

        return $this->success([
            'assignment' => $assignment->fresh(),
            'slot_code' => $assignment->slot_code,
            'is_now_empty' => ! Slot::find($assignment->slot_code)->isOccupied(),
        ], 'Siklus hidup slot berhasil diselesaikan dan slot telah dikosongkan');
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
