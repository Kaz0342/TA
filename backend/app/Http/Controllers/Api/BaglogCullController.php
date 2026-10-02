<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'cull_date' => 'required|date|before_or_equal:today',
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|in:TRICHODERMA,BUSUK_BASAH,HAMA,KERING,LAINNYA,HABIS_PRODUKSI',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $batchId = (int) $request->input('baglog_batch_id');
        $slotCode = strtoupper($request->input('slot_code'));
        $qty = (int) $request->input('quantity');
        $cullDate = $request->input('cull_date');

        $result = DB::transaction(function () use ($batchId, $slotCode, $qty, $cullDate, $request) {
            // Cari active assignment untuk slot & batch ini dengan lock
            $assignment = BatchSlotAssignment::where('baglog_batch_id', $batchId)
                ->where('slot_code', $slotCode)
                ->whereIn('current_status', [BatchSlotAssignment::STATUS_INCUBATION, BatchSlotAssignment::STATUS_FRUITING])
                ->lockForUpdate()
                ->first();

            if (! $assignment) {
                return ['error' => "Tidak ditemukan batch aktif di koordinat slot {$slotCode}.", 'status' => 422];
            }

            // Invarian tanggal: cull_date >= assigned_at (W-11)
            if (\Carbon\Carbon::parse($cullDate)->lt(\Carbon\Carbon::parse($assignment->assigned_at))) {
                return [
                    'error' => 'Tanggal afkir tidak boleh sebelum tanggal penempatan slot (' . \Carbon\Carbon::parse($assignment->assigned_at)->toDateString() . ').',
                    'status' => 422,
                ];
            }

            $sisaKapasitas = $assignment->kapasitasAktif();

            if ($qty > $sisaKapasitas) {
                return [
                    'error' => "Jumlah afkir ({$qty} baglog) melebihi kapasitas aktif di slot {$slotCode} (sisa {$sisaKapasitas} baglog).",
                    'status' => 422,
                ];
            }

            $cull = BaglogCull::create([
                'baglog_batch_id' => $batchId,
                'slot_code' => $slotCode,
                'cull_date' => $cullDate,
                'quantity' => $qty,
                'reason' => $request->input('reason'),
                'notes' => $request->input('notes'),
            ]);

            $sisaSetelah = $assignment->kapasitasAktif();

            // Bila baglog di slot habis (kapasitas aktif = 0), otomatis selesaikan siklus slot (W-02)
            if ($sisaSetelah === 0) {
                $assignment->update([
                    'current_status' => BatchSlotAssignment::STATUS_COMPLETED,
                    'completed_at' => $cullDate,
                    'completed_reason' => 'EXHAUSTED',
                ]);
            }

            return [
                'cull' => $cull,
                'remaining' => $sisaSetelah,
            ];
        });

        if (isset($result['error'])) {
            return $this->error($result['error'], $result['status']);
        }

        return $this->created([
            'cull' => $result['cull'],
            'slot_active_capacity_remaining' => $result['remaining'],
        ], 'Pencatatan afkir baglog berhasil disimpan');
    }

    /**
     * POST /api/baglog-culls/{id}/void
     * Batalkan data afkir yang salah input (W-09).
     * Pulihkan kapasitas aktif slot, dan re-open slot jika sempat otomatis COMPLETED karena EXHAUSTED.
     */
    public function void(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|min:5|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 422);
        }

        return DB::transaction(function () use ($request, $id) {
            $cull = BaglogCull::withVoided()->find($id);

            if (! $cull) {
                return $this->notFound('Data afkir baglog tidak ditemukan');
            }

            if ($cull->isVoided()) {
                return $this->error('Data afkir baglog sudah dibatalkan (voided) sebelumnya', 422);
            }

            $cull->void($request->user()->id, $request->input('reason'));

            // Pulihkan kapasitas aktif assignment jika sempat selesai (COMPLETED) karena EXHAUSTED
            if ($cull->slot_code) {
                $assignment = BatchSlotAssignment::where('baglog_batch_id', $cull->baglog_batch_id)
                    ->where('slot_code', $cull->slot_code)
                    ->latest('id')
                    ->first();

                if ($assignment && $assignment->current_status === BatchSlotAssignment::STATUS_COMPLETED && $assignment->completed_reason === 'EXHAUSTED') {
                    // Cek apakah slot masih belum diisi batch lain
                    $isOccupied = BatchSlotAssignment::where('slot_code', $cull->slot_code)
                        ->where('id', '!=', $assignment->id)
                        ->whereIn('current_status', [BatchSlotAssignment::STATUS_INCUBATION, BatchSlotAssignment::STATUS_FRUITING])
                        ->exists();

                    if (! $isOccupied) {
                        $assignment->update([
                            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
                            'completed_at' => null,
                            'completed_reason' => null,
                        ]);
                        $assignment->baglogBatch?->refreshLifecycle();
                    }
                }
            }

            return $this->success($cull, 'Data afkir baglog berhasil di-void (dibatalkan)');
        });
    }
}
