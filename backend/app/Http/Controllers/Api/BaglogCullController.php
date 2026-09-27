<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Controller untuk mengelola pencatatan ledger kematian / mutasi afkir baglog per slot.
 */
class BaglogCullController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/baglog-culls
     * List mutasi afkir dengan filter batch, slot, alasan, dan rentang tanggal (Audit Trail).
     */
    public function index(Request $request): JsonResponse
    {
        $query = BaglogCull::with(['baglogBatch', 'slot']);

        if ($request->filled('baglog_batch_id')) {
            $query->where('baglog_batch_id', $request->query('baglog_batch_id'));
        }

        if ($request->filled('slot_code')) {
            $query->where('slot_code', strtoupper($request->query('slot_code')));
        }

        if ($request->filled('reason')) {
            $query->where('reason', $request->query('reason'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('cull_date', [$request->query('start_date'), $request->query('end_date')]);
        }

        $culls = $query->orderByDesc('cull_date')->orderByDesc('id')->get();

        $data = $culls->map(fn (BaglogCull $c) => [
            'id' => $c->id,
            'baglog_batch_id' => $c->baglog_batch_id,
            'batch_code' => $c->baglogBatch?->batch_code,
            'slot_code' => $c->slot_code,
            'cull_date' => $c->cull_date?->toDateString(),
            'quantity' => $c->quantity,
            'reason' => $c->reason,
            'notes' => $c->notes,
            'created_at' => $c->created_at?->toIso8601String(),
        ]);

        return $this->success($data, 'Data ledger afkir baglog berhasil dimuat');
    }

    /**
     * POST /api/baglog-culls
     * Catat pengurangan baglog afkir pada slot tertentu.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'baglog_batch_id' => 'required|exists:baglog_batches,id',
            'slot_code' => 'required|string|exists:slots,slot_code',
            'cull_date' => 'required|date',
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|in:TRICHODERMA,BUSUK_BASAH,HAMA,KERING,LAINNYA',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $batchId = (int) $request->input('baglog_batch_id');
        $slotCode = strtoupper($request->input('slot_code'));
        $qty = (int) $request->input('quantity');

        // Cari active assignment untuk slot & batch ini
        $assignment = BatchSlotAssignment::where('baglog_batch_id', $batchId)
            ->where('slot_code', $slotCode)
            ->whereIn('current_status', [BatchSlotAssignment::STATUS_INCUBATION, BatchSlotAssignment::STATUS_FRUITING])
            ->first();

        if (! $assignment) {
            return $this->error("Tidak ditemukan batch aktif di koordinat slot {$slotCode}.", 422);
        }

        $sisaKapasitas = $assignment->kapasitasAktif();

        if ($qty > $sisaKapasitas) {
            return $this->error(
                "Jumlah afkir ({$qty} baglog) melebihi kapasitas aktif di slot {$slotCode} (sisa {$sisaKapasitas} baglog).",
                422
            );
        }

        $cull = BaglogCull::create([
            'baglog_batch_id' => $batchId,
            'slot_code' => $slotCode,
            'cull_date' => $request->input('cull_date'),
            'quantity' => $qty,
            'reason' => $request->input('reason'),
            'notes' => $request->input('notes'),
        ]);

        return $this->created([
            'cull' => $cull,
            'slot_active_capacity_remaining' => $assignment->kapasitasAktif(),
        ], 'Pencatatan afkir baglog berhasil disimpan');
    }
}
