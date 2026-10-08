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

        // W-15: Pre-aggregate culls & harvests untuk mencegah N+1 query explosion
        $activeBatchIds = $slots->pluck('activeAssignment.baglog_batch_id')->filter()->unique()->values();
        $slotCodes = $slots->pluck('slot_code')->filter()->unique()->values();

        $cullAggregates = collect();
        $harvestAggregates = collect();

        if ($activeBatchIds->isNotEmpty() && $slotCodes->isNotEmpty()) {
            $cullAggregates = DB::table('baglog_culls')
                ->select('baglog_batch_id', 'slot_code', DB::raw('SUM(quantity) as total_culls'))
                ->whereNull('voided_at')
                ->whereIn('baglog_batch_id', $activeBatchIds)
                ->whereIn('slot_code', $slotCodes)
                ->groupBy('baglog_batch_id', 'slot_code')
                ->get()
                ->keyBy(fn ($item) => "{$item->baglog_batch_id}_{$item->slot_code}");

            $harvestAggregates = DB::table('harvests')
                ->select(
                    'baglog_batch_id',
                    'slot_code',
                    DB::raw('MAX(flush_number) as max_flush'),
                    DB::raw('SUM(weight_kg) as total_kg')
                )
                ->whereNull('voided_at')
                ->whereIn('baglog_batch_id', $activeBatchIds)
                ->whereIn('slot_code', $slotCodes)
                ->groupBy('baglog_batch_id', 'slot_code')
                ->get()
                ->keyBy(fn ($item) => "{$item->baglog_batch_id}_{$item->slot_code}");
        }

        $data = $slots->map(function (Slot $slot) use ($cullAggregates, $harvestAggregates) {
            $assignment = $slot->activeAssignment;
            $batch = $assignment?->baglogBatch;

            $cullCount = 0;
            $maxFlush = null;
            $totalHarvestKg = 0.0;
            $lastFlush = 0;

            if ($assignment) {
                $aggKey = "{$assignment->baglog_batch_id}_{$assignment->slot_code}";
                if (isset($cullAggregates[$aggKey])) {
                    $cullCount = (int) $cullAggregates[$aggKey]->total_culls;
                }
                if (isset($harvestAggregates[$aggKey])) {
                    $maxFlush = (int) $harvestAggregates[$aggKey]->max_flush;
                    $totalHarvestKg = (float) $harvestAggregates[$aggKey]->total_kg;
                    $lastFlush = $maxFlush;
                }
            }

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
                    'active_capacity' => $assignment->kapasitasAktif($cullCount),
                    'initial_mycelium_stage' => $assignment->initial_mycelium_stage,
                    'current_status' => $assignment->current_status,
                    'assigned_at' => $assignment->assigned_at?->toDateString(),
                    'badge' => $assignment->badgeStatus($maxFlush),
                    'total_harvest_kg' => $totalHarvestKg,
                    'last_flush' => $lastFlush,
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
            'activeAssignment.baglogBatch',
            'assignments.baglogBatch',
            'culls.baglogBatch',
            'harvests.baglogBatch',
        ])->find(strtoupper($code));

        if (! $slot) {
            return $this->notFound("Slot koordinat {$code} tidak ditemukan");
        }

        $active = $slot->activeAssignment;
        $activeCulls = 0;
        $activeMaxFlush = null;

        if ($active) {
            $activeCulls = (int) $slot->culls
                ->where('baglog_batch_id', $active->baglog_batch_id)
                ->sum('quantity');

            $activeHarvests = $slot->harvests
                ->where('baglog_batch_id', $active->baglog_batch_id);

            $activeMaxFlush = $activeHarvests->isNotEmpty()
                ? (int) $activeHarvests->max('flush_number')
                : null;
        }

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
                'active_capacity' => $active->kapasitasAktif($activeCulls),
                'stage' => $active->initial_mycelium_stage,
                'status' => $active->current_status,
                'assigned_at' => $active->assigned_at?->toDateString(),
                'badge' => $active->badgeStatus($activeMaxFlush),
            ] : null,
            'total_panen_kg' => (float) $slot->harvests->sum('weight_kg'),
            'total_culls_qty' => (int) $slot->culls->sum('quantity'),
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
            ->whereNull('voided_at')
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

    /**
     * GET /api/racks
     * Daftar seluruh rak yang tersedia beserta statistik okupansi slot.
     */
    public function racks(): JsonResponse
    {
        $racks = Slot::select('row')
            ->distinct()
            ->orderBy('row')
            ->pluck('row');

        if ($racks->isEmpty()) {
            $racks = collect(['A', 'B', 'C']);
        }

        $stats = Slot::select('row')
            ->selectRaw('count(*) as total_slots')
            ->selectRaw('sum(max_capacity) as total_capacity')
            ->groupBy('row')
            ->get()
            ->keyBy(fn ($item) => strtoupper($item->row));

        $occupiedSlots = DB::table('batch_slot_assignments')
            ->join('slots', 'batch_slot_assignments.slot_code', '=', 'slots.slot_code')
            ->whereIn('batch_slot_assignments.current_status', ['INCUBATION', 'FRUITING'])
            ->select('slots.row', DB::raw('count(distinct slots.slot_code) as occupied_count'))
            ->groupBy('slots.row')
            ->pluck('occupied_count', 'row')
            ->mapWithKeys(fn ($count, $row) => [strtoupper($row) => $count]);

        $data = $racks->map(function ($row) use ($stats, $occupiedSlots) {
            $rowUpper = strtoupper($row);
            $stat = $stats->get($rowUpper);
            $total = $stat ? (int) $stat->total_slots : 100;
            $occupied = (int) ($occupiedSlots->get($rowUpper) ?? 0);

            return [
                'row' => $rowUpper,
                'label' => "Rak {$rowUpper}",
                'total_slots' => $total,
                'occupied_slots' => $occupied,
                'empty_slots' => max(0, $total - $occupied),
                'total_capacity' => $stat ? (int) $stat->total_capacity : ($total * 10),
            ];
        })->values();

        return $this->success($data, 'Daftar rak berhasil dimuat');
    }

    /**
     * POST /api/racks
     * Tambah rak baru dengan dimensi standar (10 bay x 10 tier, kapasitas 10/slot = 100 slot baru).
     */
    public function storeRack(Request $request): JsonResponse
    {
        $request->validate([
            'row' => [
                'nullable',
                'string',
                'size:1',
                'regex:/^[a-zA-Z]$/',
            ],
        ], [
            'row.size' => 'Kode rak harus berupa 1 karakter abjad (misal: D, E, F).',
            'row.regex' => 'Kode rak hanya boleh berupa huruf alfabet A-Z.',
        ]);

        if ($request->filled('row')) {
            $row = strtoupper($request->input('row'));
        } else {
            // Otomatis tentukan huruf alfabet berikutnya
            $existingRows = Slot::distinct()->pluck('row')->map(fn ($r) => strtoupper($r))->toArray();
            $alphabet = range('A', 'Z');
            $row = null;
            foreach ($alphabet as $letter) {
                if (! in_array($letter, $existingRows, true)) {
                    $row = $letter;
                    break;
                }
            }

            if (! $row) {
                return $this->error('Semua abjad rak A-Z sudah terpakai.', 422);
            }
        }

        // Cek duplikasi
        if (Slot::where('row', $row)->exists()) {
            return $this->error("Rak {$row} sudah ada di dalam sistem.", 422);
        }

        // Generate 100 slot koordinat standar
        $now = now();
        $slots = [];
        for ($bay = 1; $bay <= 10; $bay++) {
            for ($tier = 1; $tier <= 10; $tier++) {
                $slots[] = [
                    'slot_code' => sprintf('%s-%02d-%02d', $row, $bay, $tier),
                    'row' => $row,
                    'bay' => $bay,
                    'tier' => $tier,
                    'max_capacity' => 10,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($slots, 50) as $chunk) {
            DB::table('slots')->insert($chunk);
        }

        return $this->success([
            'row' => $row,
            'label' => "Rak {$row}",
            'slots_created' => count($slots),
            'total_capacity' => count($slots) * 10,
        ], "Rak {$row} berhasil ditambahkan dengan 100 slot (kapasitas 1.000 baglog)", 201);
    }

    /**
     * DELETE /api/racks/{row}
     * Hapus rak jika seluruh slot di dalamnya masih kosong dan tidak memiliki riwayat.
     */
    public function destroyRack(string $row): JsonResponse
    {
        $row = strtoupper($row);
        $slots = Slot::where('row', $row)->get();

        if ($slots->isEmpty()) {
            return $this->notFound("Rak {$row} tidak ditemukan.");
        }

        $slotCodes = $slots->pluck('slot_code')->toArray();

        // Validasi tidak ada histori assignment
        $hasAssignments = DB::table('batch_slot_assignments')
            ->whereIn('slot_code', $slotCodes)
            ->exists();

        if ($hasAssignments) {
            return $this->error("Rak {$row} tidak dapat dihapus karena memiliki riwayat alokasi batch baglog.", 422);
        }

        // Validasi tidak ada riwayat panen aktif
        $hasHarvests = DB::table('harvests')
            ->whereIn('slot_code', $slotCodes)
            ->whereNull('voided_at')
            ->exists();

        if ($hasHarvests) {
            return $this->error("Rak {$row} tidak dapat dihapus karena memiliki riwayat panen.", 422);
        }

        // Validasi tidak ada riwayat afkir aktif
        $hasCulls = DB::table('baglog_culls')
            ->whereIn('slot_code', $slotCodes)
            ->whereNull('voided_at')
            ->exists();

        if ($hasCulls) {
            return $this->error("Rak {$row} tidak dapat dihapus karena memiliki riwayat afkir.", 422);
        }

        Slot::where('row', $row)->delete();

        return $this->success([
            'row' => $row,
            'deleted_slots' => count($slotCodes),
        ], "Rak {$row} dan {$slots->count()} slot di dalamnya berhasil dihapus.");
    }
}
