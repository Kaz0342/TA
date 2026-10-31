<?php

namespace App\Services;

use App\Models\BaglogBatch;
use App\Models\Customer;
use App\Models\Harvest;
use App\Models\Sale;
use App\Models\SensorData;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

/**
 * Service Domain Traceability (Ketertelusuran Hulu-ke-Hilir).
 *
 * Menghubungkan seluruh siklus hidup komoditas jamur:
 * [Pemasok Bibit] -> [Penerimaan Batch] -> [Alokasi Slot Rak] -> [Iklim IoT & Panen] -> [Penjualan ke Konsumen]
 */
class TraceabilityService
{
    /**
     * Dapatkan riwayat ketertelusuran lengkap dari sebuah batch kode (Hulu -> Tengah -> Hilir).
     *
     * @return array<string, mixed>|null
     */
    public function getBatchTraceability(string $batchCode): ?array
    {
        $batch = BaglogBatch::where('batch_code', $batchCode)
            ->with([
                'supplierRelation',
                'assignments.slot',
                'harvests' => fn ($q) => $q->whereNull('voided_at'),
                'culls' => fn ($q) => $q->whereNull('voided_at'),
            ])
            ->first();

        if (! $batch) {
            return null;
        }

        // 1. Hulu: Pemasok & Penerimaan
        $upstream = [
            'supplier_id' => $batch->supplier_id,
            'supplier_name' => $batch->supplierRelation?->name ?? $batch->supplier,
            'contact_person' => $batch->supplierRelation?->contact_person,
            'phone' => $batch->supplierRelation?->phone,
            'lead_time_days' => $batch->supplierRelation?->lead_time_days ?? 7,
            'po_number' => $batch->po_number,
            'entry_date' => $batch->entry_date,
            'initial_quantity' => $batch->quantity,
            'rejected_at_arrival' => $batch->rejected_at_arrival,
            'arrival_pass_rate_percent' => ($batch->quantity + $batch->rejected_at_arrival) > 0
                ? round(($batch->quantity / ($batch->quantity + $batch->rejected_at_arrival)) * 100, 2)
                : 100.0,
            'price_per_baglog' => $batch->price_per_baglog,
        ];

        // 2. Tengah: Alokasi Spasial Kumbung (Rak A, B, C)
        $slotsOccupied = [];
        $racks = [];
        foreach ($batch->assignments as $assignment) {
            if ($assignment->slot) {
                $slotsOccupied[] = [
                    'slot_code' => $assignment->slot->slot_code,
                    'rack_row' => $assignment->slot->row,
                    'level' => $assignment->slot->tier,
                    'status' => $assignment->current_status,
                    'initial_quantity' => $assignment->initial_quantity,
                    'active_baglogs' => $assignment->kapasitasAktif(),
                    'assigned_at' => $assignment->assigned_at,
                    'completed_at' => $assignment->completed_at,
                ];
                $racks[$assignment->slot->row] = true;
            }
        }

        $midstream = [
            'total_slots_occupied' => count($slotsOccupied),
            'racks_utilized' => array_keys($racks),
            'slots' => $slotsOccupied,
            'culls_count' => (int) $batch->culls->sum('quantity'),
            'current_batch_status' => $batch->status,
        ];

        // 3. Produksi & Panen
        $gradeAKg = (float) $batch->harvests->where('quality_grade', 'GRADE_A')->sum('weight_kg');
        $gradeBKg = (float) $batch->harvests->where('quality_grade', 'GRADE_B')->sum('weight_kg');
        $unassignedGradeKg = (float) $batch->harvests->whereNull('quality_grade')->sum('weight_kg');
        $rejectKg = (float) $batch->harvests->where('quality_grade', 'REJECT')->sum('weight_kg');
        $totalSellableKg = $gradeAKg + $gradeBKg + $unassignedGradeKg;

        $harvestEvents = $batch->harvests->map(function (Harvest $h) {
            return [
                'harvest_date' => $h->harvest_date,
                'flush_number' => $h->flush_number,
                'weight_kg' => (float) $h->weight_kg,
                'quality_grade' => $h->quality_grade ?? 'STANDARD',
                'slot_code' => $h->slot_code,
            ];
        });

        // 4. Hilir: Penjualan ke Pelanggan (Sales)
        $sales = Sale::where('baglog_batch_id', $batch->id)
            ->whereNull('voided_at')
            ->with('customer')
            ->orderBy('sale_date')
            ->get();

        $downstreamSales = $sales->map(function (Sale $s) {
            return [
                'sale_id' => $s->id,
                'sale_date' => $s->sale_date,
                'buyer_name' => $s->buyer_name,
                'customer_id' => $s->customer_id,
                'customer_category' => $s->customer?->category ?? 'UNSPECIFIED',
                'quantity_kg' => (float) $s->quantity_kg,
                'price_per_kg' => (float) $s->price_per_kg,
                'total_revenue' => (float) $s->total_revenue,
            ];
        });

        $totalSoldKg = round((float) $sales->sum('quantity_kg'), 2);
        $totalSalesRevenue = (float) $sales->sum('total_revenue');

        return [
            'batch_code' => $batch->batch_code,
            'upstream' => $upstream,
            'midstream' => $midstream,
            'production' => [
                'total_harvest_kg' => round($totalSellableKg + $rejectKg, 2),
                'sellable_harvest_kg' => round($totalSellableKg, 2),
                'reject_harvest_kg' => round($rejectKg, 2),
                'grade_a_kg' => round($gradeAKg, 2),
                'grade_b_kg' => round($gradeBKg, 2),
                'yield_per_baglog_kg' => $batch->quantity > 0 ? round($totalSellableKg / $batch->quantity, 3) : 0,
                'harvest_records_count' => $batch->harvests->count(),
                'harvest_history' => $harvestEvents,
            ],
            'downstream' => [
                'total_sold_kg' => $totalSoldKg,
                'total_revenue' => $totalSalesRevenue,
                'remaining_batch_stock_kg' => max(0, round($totalSellableKg - $totalSoldKg, 2)),
                'buyers_count' => $sales->pluck('buyer_name')->unique()->count(),
                'sales_history' => $downstreamSales,
            ],
            'traceability_chain_status' => [
                'upstream_verified' => ! empty($batch->supplier_id) || ! empty($batch->supplier),
                'midstream_spatially_tracked' => count($slotsOccupied) > 0,
                'downstream_linked' => $sales->isNotEmpty(),
                'end_to_end_complete' => ! empty($batch->supplier_id) && count($slotsOccupied) > 0 && $sales->isNotEmpty(),
            ],
        ];
    }

    /**
     * Dapatkan asal-usul (origin tracing) dari sebuah transaksi penjualan.
     *
     * @return array<string, mixed>|null
     */
    public function getSaleOrigin(int $saleId): ?array
    {
        $sale = Sale::with(['baglogBatch.supplierRelation', 'baglogBatch.assignments.slot', 'customer'])
            ->find($saleId);

        if (! $sale) {
            return null;
        }

        $batch = $sale->baglogBatch;

        return [
            'sale_id' => $sale->id,
            'sale_date' => $sale->sale_date,
            'quantity_kg' => (float) $sale->quantity_kg,
            'price_per_kg' => (float) $sale->price_per_kg,
            'total_revenue' => (float) $sale->total_revenue,
            'buyer' => [
                'buyer_name' => $sale->buyer_name,
                'customer_id' => $sale->customer_id,
                'category' => $sale->customer?->category ?? 'UNSPECIFIED',
                'phone' => $sale->customer?->phone,
            ],
            'origin' => $batch ? [
                'batch_code' => $batch->batch_code,
                'entry_date' => $batch->entry_date,
                'supplier_name' => $batch->supplierRelation?->name ?? $batch->supplier,
                'racks_grown' => $batch->assignments->map(fn ($a) => $a->slot?->row)->filter()->unique()->values(),
                'slots_grown' => $batch->assignments->map(fn ($a) => $a->slot?->slot_code)->filter()->values(),
            ] : [
                'batch_code' => null,
                'supplier_name' => null,
                'notes' => 'Penjualan ini tidak ditautkan ke satu batch spesifik (berasal dari stok panen gabungan farm).',
            ],
        ];
    }

    /**
     * Analisis segmentasi dan performa pelanggan (Tengkulak vs Restoran vs Pasar Induk).
     *
     * @return array<string, mixed>
     */
    public function getCustomerAnalytics(): array
    {
        $sales = Sale::whereNull('voided_at')->with('customer')->get();

        $byCategory = [
            Customer::CATEGORY_TENGKULAK => ['count' => 0, 'total_kg' => 0.0, 'total_revenue' => 0.0],
            Customer::CATEGORY_RESTO => ['count' => 0, 'total_kg' => 0.0, 'total_revenue' => 0.0],
            Customer::CATEGORY_PASAR_INDUK => ['count' => 0, 'total_kg' => 0.0, 'total_revenue' => 0.0],
            Customer::CATEGORY_ECERAN => ['count' => 0, 'total_kg' => 0.0, 'total_revenue' => 0.0],
            'LAINNYA' => ['count' => 0, 'total_kg' => 0.0, 'total_revenue' => 0.0],
        ];

        foreach ($sales as $sale) {
            $cat = $sale->customer?->category ?? 'LAINNYA';
            if (! isset($byCategory[$cat])) {
                $cat = 'LAINNYA';
            }

            $byCategory[$cat]['count']++;
            $byCategory[$cat]['total_kg'] += (float) $sale->quantity_kg;
            $byCategory[$cat]['total_revenue'] += (float) $sale->total_revenue;
        }

        // Hitung rata-rata harga serap per kg
        foreach ($byCategory as $catKey => $data) {
            $byCategory[$catKey]['avg_price_per_kg'] = $data['total_kg'] > 0
                ? round($data['total_revenue'] / $data['total_kg'], 2)
                : 0.0;
            $byCategory[$catKey]['total_kg'] = round($data['total_kg'], 2);
            $byCategory[$catKey]['total_revenue'] = round($data['total_revenue'], 2);
        }

        return [
            'total_sales_records' => $sales->count(),
            'total_volume_sold_kg' => round((float) $sales->sum('quantity_kg'), 2),
            'total_revenue_idr' => round((float) $sales->sum('total_revenue'), 2),
            'segments' => $byCategory,
        ];
    }
}
