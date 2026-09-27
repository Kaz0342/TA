<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Harvest;
use App\Models\Slot;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Controller untuk navigasi Grid Kumbung 3D (Row-Bay-Tier) dan visualisasi spasial.
 */
class SlotController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/slots
     * List seluruh slot koordinat dengan status okupansi, batch aktif, sisa kapasitas, dan badge warna.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Slot::with(['activeAssignment.baglogBatch']);

        // Filter per lorong/rak (Row A, B, C)
        if ($request->filled('row')) {
            $query->byRow($request->query('row'));
        }

        // Filter status okupansi (occupied / empty)
        if ($request->query('status') === 'occupied') {
            $query->occupied();
        } elseif ($request->query('status') === 'empty') {
            $query->empty();
        }

        $slots = $query->orderBy('row')->orderBy('bay')->orderBy('tier')->get();

        $data = $slots->map(function (Slot $slot) {
            $assignment = $slot->activeAssignment;
            $batch = $assignment?->baglogBatch;

            return [
                'slot_code' => $slot->slot_code,
                'row' => $slot->row,
                'bay' => $slot->bay,
                'tier' => $slot->tier,
                'max_capacity' => $slot->max_capacity,
                'is_occupied' => $assignment !== null,
                'active_batch' => $batch ? [
                    'id' => $batch->id,
                    'batch_code' => $batch->batch_code,
                    'supplier' => $batch->supplier,
                    'status' => $batch->status,
                ] : null,
                'assignment' => $assignment ? [
                    'id' => $assignment->id,
                    'initial_quantity' => $assignment->initial_quantity,
                    'active_capacity' => $assignment->kapasitasAktif(),
                    'initial_mycelium_stage' => $assignment->initial_mycelium_stage,
                    'current_status' => $assignment->current_status,
                    'assigned_at' => $assignment->assigned_at?->toDateString(),
                    'badge' => $assignment->badgeStatus(),
                ] : null,
            ];
        });

        return $this->success($data, 'Daftar slot koordinat rak berhasil dimuat');
    }

    /**
     * GET /api/slots/{code}
     * Detail koordinat spesifik: riwayat penempatan batch, afkir (culls), dan panen.
     */
    public function show(string $code): JsonResponse
    {
        $slot = Slot::with([
            'assignments.baglogBatch',
            'culls.baglogBatch',
            'harvests.baglogBatch',
        ])->find(strtoupper($code));

        if (! $slot) {
            return $this->notFound("Slot koordinat {$code} tidak ditemukan");
        }

        $active = $slot->activeAssignment;

        return $this->success([
            'slot_code' => $slot->slot_code,
            'row' => $slot->row,
            'bay' => $slot->bay,
            'tier' => $slot->tier,
            'max_capacity' => $slot->max_capacity,
            'is_occupied' => $active !== null,
            'active_assignment' => $active ? [
                'id' => $active->id,
                'batch_id' => $active->baglog_batch_id,
                'batch_code' => $active->baglogBatch?->batch_code,
                'initial_quantity' => $active->initial_quantity,
                'active_capacity' => $active->kapasitasAktif(),
                'stage' => $active->initial_mycelium_stage,
                'status' => $active->current_status,
                'assigned_at' => $active->assigned_at?->toDateString(),
                'badge' => $active->badgeStatus(),
            ] : null,
            'total_panen_kg' => (float) $slot->harvests()->sum('weight_kg'),
            'total_culls_qty' => (int) $slot->culls()->sum('quantity'),
            'culls_history' => $slot->culls->map(fn ($c) => [
                'id' => $c->id,
                'batch_code' => $c->baglogBatch?->batch_code,
                'cull_date' => $c->cull_date?->toDateString(),
                'quantity' => $c->quantity,
                'reason' => $c->reason,
                'notes' => $c->notes,
            ]),
            'harvests_history' => $slot->harvests->map(fn ($h) => [
                'id' => $h->id,
                'batch_code' => $h->baglogBatch?->batch_code,
                'harvest_date' => $h->harvest_date?->toDateString(),
                'weight_kg' => (float) $h->weight_kg,
                'flush_number' => $h->flush_number,
                'quality_grade' => $h->quality_grade,
            ]),
        ], 'Detail slot koordinat berhasil dimuat');
    }

    /**
     * GET /api/slots/heatmap
     * Agregasi total panen (Kg) per koordinat slot untuk Heatmap Produktivitas Rak.
     */
    public function heatmap(Request $request): JsonResponse
    {
        $batchId = $request->query('batch_id');

        $harvestQuery = DB::table('harvests')
            ->select('slot_code', DB::raw('SUM(weight_kg) as total_kg'), DB::raw('COUNT(id) as harvest_count'))
            ->whereNotNull('slot_code')
            ->groupBy('slot_code');

        if ($batchId) {
            $harvestQuery->where('baglog_batch_id', $batchId);
        }

        $harvestStats = $harvestQuery->pluck('total_kg', 'slot_code')->toArray();

        $slots = Slot::orderBy('row')->orderBy('bay')->orderBy('tier')->get();

        $maxYield = ! empty($harvestStats) ? max(array_values($harvestStats)) : 1.0;

        $heatmapData = $slots->map(function (Slot $slot) use ($harvestStats, $maxYield) {
            $yield = (float) ($harvestStats[$slot->slot_code] ?? 0.0);
            $intensity = $maxYield > 0 ? round(($yield / $maxYield), 2) : 0.0;

            return [
                'slot_code' => $slot->slot_code,
                'row' => $slot->row,
                'bay' => $slot->bay,
                'tier' => $slot->tier,
                'total_kg' => $yield,
                'intensity' => $intensity, // 0.0 s/d 1.0 untuk visualisasi gradient warna
            ];
        });

        return $this->success([
            'max_kg_in_slot' => $maxYield,
            'slots' => $heatmapData,
        ], 'Data heatmap produktivitas rak berhasil dimuat');
    }
}
