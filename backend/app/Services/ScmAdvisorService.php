<?php

namespace App\Services;

use App\Models\BaglogBatch;
use App\Models\BatchSlotAssignment;
use App\Models\Slot;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Service Domain SCM Advisor — Sistem Pendukung Keputusan (Decision Support System)
 * untuk perencanaan kapasitas kumbung (Rolling Capacity Forecast) dan rekomendasi Purchase Order (PO)
 * restock bibit baglog tanpa melanggar batasan fisik 3.000 baglog.
 */
class ScmAdvisorService
{
    public function __construct(
        private readonly SupplierService $supplierService
    ) {}

    /**
     * Snapshot kapasitas fisik dan okupansi kumbung real-time.
     *
     * @return array<string, mixed>
     */
    public function getCapacitySnapshot(): array
    {
        $maxCapacity = (int) config('baglog.capacity.max_capacity', 3000);
        $maxSlots = (int) config('baglog.capacity.max_slots', 300);
        $capacityPerSlot = (int) config('baglog.capacity.capacity_per_slot', 10);

        // 1. Status slot rak kumbung
        $totalConfiguredSlots = Slot::count();
        $occupiedSlotsCount = Slot::occupied()->count();
        $emptySlotsCount = max(0, $totalConfiguredSlots - $occupiedSlotsCount);

        // 2. Kuantitas baglog aktif di rak (dikurangi afkir riil)
        $activeBaglogsOnRack = 0;
        $activeAssignments = BatchSlotAssignment::active()
            ->whereNull('completed_at')
            ->get();

        foreach ($activeAssignments as $assignment) {
            $activeBaglogsOnRack += $assignment->kapasitasAktif();
        }

        // 3. Kuantitas baglog yang belum dialokasikan ke slot rak (antrean masuk)
        $activeBatches = BaglogBatch::active()->get();
        $unassignedBaglogs = (int) $activeBatches->sum('unassigned_quantity');

        // Total baglog aktif di farm
        $totalActiveBaglogs = $activeBaglogsOnRack + $unassignedBaglogs;
        $currentFreeCapacity = max(0, $maxCapacity - $totalActiveBaglogs);
        $occupancyRatePercent = $maxCapacity > 0
            ? round(($totalActiveBaglogs / $maxCapacity) * 100, 2)
            : 0.0;

        return [
            'max_farm_capacity' => $maxCapacity,
            'max_slots' => $maxSlots,
            'capacity_per_slot' => $capacityPerSlot,
            'total_configured_slots' => $totalConfiguredSlots,
            'occupied_slots' => $occupiedSlotsCount,
            'empty_slots' => $emptySlotsCount,
            'active_baglogs_on_rack' => $activeBaglogsOnRack,
            'unassigned_baglogs' => $unassignedBaglogs,
            'total_active_baglogs' => $totalActiveBaglogs,
            'current_free_capacity' => $currentFreeCapacity,
            'occupancy_rate_percent' => $occupancyRatePercent,
            'status' => $occupancyRatePercent >= 90.0 ? 'CRITICAL_HIGH' : ($occupancyRatePercent >= 70.0 ? 'OPTIMAL' : 'UNDER_UTILIZED'),
        ];
    }

    /**
     * Proyeksi Pelepasan Slot Kumbung (Rolling Vacancy Forecast)
     * Mengestimasi kapan slot-slot aktif akan tuntas panen (flush 5–7 atau umur > 110 hari)
     * dan memproyeksikan kapasitas bebas dalam rentang waktu 7, 14, 21, dan 30 hari.
     *
     * @return array<string, mixed>
     */
    public function getRollingCapacityForecast(): array
    {
        $snapshot = $this->getCapacitySnapshot();
        $now = Carbon::now('Asia/Jakarta');

        $activeAssignments = BatchSlotAssignment::with(['baglogBatch', 'harvests'])
            ->active()
            ->whereNull('completed_at')
            ->get();

        $slotsRelease7Days = 0;
        $slotsRelease14Days = 0;
        $slotsRelease21Days = 0;
        $slotsRelease30Days = 0;

        $capacityPerSlot = (int) config('baglog.capacity.capacity_per_slot', 10);

        foreach ($activeAssignments as $assignment) {
            $batch = $assignment->baglogBatch;
            if (! $batch) {
                continue;
            }

            $ageDays = Carbon::parse($batch->entry_date)->diffInDays($now);
            $maxFlush = (int) $assignment->harvests->max('flush_number');

            // Model deterministik penyelesaian siklus hidup jamur kuping
            $daysToComplete = 999;

            if ($maxFlush >= 7) {
                $daysToComplete = 3; // Flush terakhir tuntas dalam 3 hari
            } elseif ($maxFlush >= 6) {
                $daysToComplete = 7;
            } elseif ($maxFlush >= 5) {
                $daysToComplete = 14;
            } elseif ($ageDays >= 120) {
                $daysToComplete = 5;
            } elseif ($ageDays >= 110) {
                $daysToComplete = 12;
            } elseif ($ageDays >= 95) {
                $daysToComplete = 21;
            } elseif ($ageDays >= 80) {
                $daysToComplete = 30;
            }

            if ($daysToComplete <= 7) {
                $slotsRelease7Days++;
            }
            if ($daysToComplete <= 14) {
                $slotsRelease14Days++;
            }
            if ($daysToComplete <= 21) {
                $slotsRelease21Days++;
            }
            if ($daysToComplete <= 30) {
                $slotsRelease30Days++;
            }
        }

        $baseFreeCapacity = $snapshot['current_free_capacity'];

        return [
            'current_state' => $snapshot,
            'forecast_windows' => [
                '7_days' => [
                    'days' => 7,
                    'target_date' => $now->copy()->addDays(7)->toDateString(),
                    'projected_released_slots' => $slotsRelease7Days,
                    'projected_released_baglogs' => $slotsRelease7Days * $capacityPerSlot,
                    'projected_total_free_capacity' => min($snapshot['max_farm_capacity'], $baseFreeCapacity + ($slotsRelease7Days * $capacityPerSlot)),
                ],
                '14_days' => [
                    'days' => 14,
                    'target_date' => $now->copy()->addDays(14)->toDateString(),
                    'projected_released_slots' => $slotsRelease14Days,
                    'projected_released_baglogs' => $slotsRelease14Days * $capacityPerSlot,
                    'projected_total_free_capacity' => min($snapshot['max_farm_capacity'], $baseFreeCapacity + ($slotsRelease14Days * $capacityPerSlot)),
                ],
                '21_days' => [
                    'days' => 21,
                    'target_date' => $now->copy()->addDays(21)->toDateString(),
                    'projected_released_slots' => $slotsRelease21Days,
                    'projected_released_baglogs' => $slotsRelease21Days * $capacityPerSlot,
                    'projected_total_free_capacity' => min($snapshot['max_farm_capacity'], $baseFreeCapacity + ($slotsRelease21Days * $capacityPerSlot)),
                ],
                '30_days' => [
                    'days' => 30,
                    'target_date' => $now->copy()->addDays(30)->toDateString(),
                    'projected_released_slots' => $slotsRelease30Days,
                    'projected_released_baglogs' => $slotsRelease30Days * $capacityPerSlot,
                    'projected_total_free_capacity' => min($snapshot['max_farm_capacity'], $baseFreeCapacity + ($slotsRelease30Days * $capacityPerSlot)),
                ],
            ],
        ];
    }

    /**
     * Hitung Rekomendasi Restock / Purchase Order (PO).
     *
     * Menghitung kuantitas optimal dan tanggal pemesanan dengan mempertimbangkan
     * estimasi lead time supplier terbaik agar saat bibit tiba di kumbung,
     * slot rak sudah kosong tanpa ada bibit menganggur atau melebihi limit 3.000 baglog.
     *
     * @return array<string, mixed>
     */
    public function getRestockRecommendations(): array
    {
        $forecast = $this->getRollingCapacityForecast();
        $snapshot = $forecast['current_state'];
        $now = Carbon::now('Asia/Jakarta');

        // Ambil pemasok rekomendasi terbaik dari scorecard
        $comparison = $this->supplierService->getComparison();
        $bestSupplierData = null;

        foreach ($comparison['suppliers'] as $s) {
            if ($s['is_active']) {
                $bestSupplierData = $s;
                break;
            }
        }

        $leadTimeDays = $bestSupplierData['lead_time_days'] ?? 7;

        // Tentukan horizon kebutuhan:
        // Jika kapasitas kosong saat ini >= 300 baglog -> Butuh order segera (Target arrival = now + lead_time)
        // Jika tidak, gunakan proyeksi 14 hari ke depan
        $currentFree = $snapshot['current_free_capacity'];
        $free14Days = $forecast['forecast_windows']['14_days']['projected_total_free_capacity'];

        $actionRequired = false;
        $urgency = 'LOW';
        $recommendedQuantity = 0;
        $targetArrivalDate = null;
        $recommendedOrderDate = null;
        $justification = 'Kapasitas kumbung saat ini optimal. Belum diperlukan pemesanan baglog baru.';

        if ($currentFree >= 500) {
            // Ada ruang kosong besar saat ini
            $actionRequired = true;
            $urgency = 'HIGH';
            $recommendedQuantity = min($currentFree, 1000);
            $recommendedOrderDate = $now->toDateString();
            $targetArrivalDate = $now->copy()->addDays($leadTimeDays)->toDateString();
            $justification = "Tersedia kapasitas kosong sebanyak {$currentFree} baglog di kumbung. Disarankan segera terbitkan PO untuk memaksimalkan utilitas rak.";
        } elseif ($free14Days >= 500) {
            // Proyeksi 14 hari ke depan akan kosong >= 500 baglog
            $actionRequired = true;
            $urgency = 'MEDIUM';
            $recommendedQuantity = min($free14Days, 1000);
            $targetArrival = $now->copy()->addDays(14);
            $targetArrivalDate = $targetArrival->toDateString();
            $orderDate = $targetArrival->copy()->subDays($leadTimeDays);

            if ($orderDate->isPast() || $orderDate->isToday()) {
                $recommendedOrderDate = $now->toDateString();
                $urgency = 'HIGH';
            } else {
                $recommendedOrderDate = $orderDate->toDateString();
            }

            $justification = "Diproyeksikan {$forecast['forecast_windows']['14_days']['projected_released_baglogs']} baglog akan tuntas panen dalam 14 hari ke depan. Lakukan pemesanan pada {$recommendedOrderDate} agar bibit baru tiba tepat saat slot rak dibersihkan.";
        }

        // Bulatkan kuantitas pesanan ke kelipatan 50 baglog
        if ($recommendedQuantity > 0) {
            $recommendedQuantity = (int) (ceil($recommendedQuantity / 50) * 50);
            // Hard cap: tidak boleh membuat total melampaui 3.000
            $maxAllowed = max(0, $snapshot['max_farm_capacity'] - $snapshot['total_active_baglogs']);
            if ($recommendedQuantity > $maxAllowed && $currentFree >= $recommendedQuantity) {
                $recommendedQuantity = $maxAllowed;
            }
        }

        return [
            'action_required' => $actionRequired,
            'urgency' => $urgency,
            'recommended_quantity' => $recommendedQuantity,
            'recommended_order_date' => $recommendedOrderDate,
            'target_arrival_date' => $targetArrivalDate,
            'projected_capacity_snapshot' => $snapshot,
            'recommended_supplier' => $bestSupplierData ? [
                'id' => $bestSupplierData['supplier_id'],
                'name' => $bestSupplierData['supplier_name'],
                'lead_time_days' => $bestSupplierData['lead_time_days'],
                'performance_grade' => $bestSupplierData['performance_grade'],
                'arrival_defect_rate' => $bestSupplierData['arrival_defect_rate_percent'],
                'avg_yield_kg' => $bestSupplierData['avg_yield_kg_per_baglog'],
            ] : null,
            'justification' => $justification,
        ];
    }
}
