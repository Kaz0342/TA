<?php

namespace App\Services;

use App\Models\BaglogBatch;
use App\Models\BaglogCull;
use App\Models\Harvest;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Service Domain Supplier — mengelola master pemasok dan kalkulasi
 * Supplier Performance Scorecard secara objektif berbasis data panen & afkir nyata.
 */
class SupplierService
{
    /**
     * Ambil daftar pemasok dengan ringkasan jumlah batch dan status.
     */
    public function getAllSuppliers(bool $onlyActive = false): Collection
    {
        $query = Supplier::query()->withCount('batches');

        if ($onlyActive) {
            $query->active();
        }

        return $query->orderBy('name')->get();
    }

    public function getSupplierById(int $id): ?Supplier
    {
        return Supplier::with('batches')->find($id);
    }

    public function createSupplier(array $data): Supplier
    {
        return Supplier::create($data);
    }

    public function updateSupplier(Supplier $supplier, array $data): Supplier
    {
        $supplier->update($data);

        return $supplier;
    }

    public function deleteSupplier(Supplier $supplier): bool
    {
        // Proteksi integritas: jika supplier sudah memiliki riwayat batch, jangan hapus fisik
        if ($supplier->batches()->exists()) {
            $supplier->update(['is_active' => false]);

            return true;
        }

        return (bool) $supplier->delete();
    }

    /**
     * Hitung Supplier Performance Scorecard (Rapor Kinerja Pemasok).
     *
     * Parameter evaluasi:
     * 1. Arrival Defect Rate (%): baglog rusak/kontaminasi saat pertama kali bongkar muat.
     * 2. Early Mortality Rate (%): kematian baglog dalam 30 hari pertama (kegagalan bibit/sterilisasi supplier).
     * 3. Productivity / Average Yield (kg/baglog): rata-rata kg panen yang dihasilkan per baglog.
     * 4. Average Price per Baglog (IDR).
     * 5. HPP Efisiensi: rata-rata HPP per kg dari batch supplier ini.
     *
     * @return array<string, mixed>
     */
    public function getSupplierScorecard(Supplier $supplier): array
    {
        $batches = $supplier->batches()
            ->with(['harvests', 'culls'])
            ->get();

        $totalBatches = $batches->count();

        if ($totalBatches === 0) {
            return [
                'supplier_id' => $supplier->id,
                'supplier_name' => $supplier->name,
                'lead_time_days' => $supplier->lead_time_days,
                'is_active' => $supplier->is_active,
                'total_batches' => 0,
                'total_baglogs_received' => 0,
                'total_rejected_at_arrival' => 0,
                'arrival_defect_rate_percent' => 0.0,
                'early_mortality_count' => 0,
                'early_mortality_rate_percent' => 0.0,
                'total_harvest_kg' => 0.0,
                'avg_yield_kg_per_baglog' => 0.0,
                'avg_price_per_baglog' => 0.0,
                'performance_grade' => 'NO_DATA',
                'recommendation' => 'Belum ada data batch untuk supplier ini.',
            ];
        }

        $totalBaglogsReceived = (int) $batches->sum('quantity');
        $totalRejectedAtArrival = (int) $batches->sum('rejected_at_arrival');

        // 1. Defect saat kedatangan
        $arrivalDenominator = $totalBaglogsReceived + $totalRejectedAtArrival;
        $arrivalDefectRate = $arrivalDenominator > 0
            ? round(($totalRejectedAtArrival / $arrivalDenominator) * 100, 2)
            : 0.0;

        // 2. Early mortality (afkir dalam 30 hari pasca entry_date, bukan habis produksi)
        $earlyMortalityCount = 0;
        foreach ($batches as $batch) {
            $cutoffDate = Carbon::parse($batch->entry_date)->addDays(30)->toDateString();
            $batchEarlyCulls = $batch->culls
                ->filter(function (BaglogCull $cull) use ($cutoffDate) {
                    return $cull->cull_date <= $cutoffDate
                        && strtoupper((string) $cull->reason) !== BaglogCull::REASON_HABIS_PRODUKSI
                        && is_null($cull->voided_at);
                })
                ->sum('quantity');

            $earlyMortalityCount += (int) $batchEarlyCulls;
        }

        $earlyMortalityRate = $totalBaglogsReceived > 0
            ? round(($earlyMortalityCount / $totalBaglogsReceived) * 100, 2)
            : 0.0;

        // 3. Total panen layak jual (Grade A + B)
        $totalHarvestKg = 0.0;
        foreach ($batches as $batch) {
            $batchHarvest = $batch->harvests
                ->filter(fn (Harvest $h) => is_null($h->voided_at) && strtoupper((string) $h->quality_grade) !== 'REJECT')
                ->sum('weight_kg');
            $totalHarvestKg += (float) $batchHarvest;
        }
        $totalHarvestKg = round($totalHarvestKg, 2);

        $avgYieldPerBaglog = $totalBaglogsReceived > 0
            ? round($totalHarvestKg / $totalBaglogsReceived, 3)
            : 0.0;

        // 4. Rata-rata harga beli baglog
        $avgPricePerBaglog = round((float) $batches->avg('price_per_baglog'), 2);

        // 5. Penentuan Grade Kinerja
        // A: Defect < 3% dan Early Mortality < 5% dan Yield >= 0.35 kg/baglog (atau belum panen penuh tapi kualitas baik)
        // B: Defect < 6% dan Early Mortality < 10%
        // C: Di bawah standar
        $performanceGrade = 'B';
        $recommendation = 'Kualitas memenuhi standar operasional.';

        if ($arrivalDefectRate <= 2.0 && $earlyMortalityRate <= 4.0 && ($avgYieldPerBaglog >= 0.30 || $totalHarvestKg == 0)) {
            $performanceGrade = 'A';
            $recommendation = 'Pemasok prioritas utama untuk restock bibit (kualitas sterilisasi & produktivitas tinggi).';
        } elseif ($arrivalDefectRate > 5.0 || $earlyMortalityRate > 10.0) {
            $performanceGrade = 'C';
            $recommendation = 'Performa di bawah standar. Tingkat kontaminasi/cacat awal tinggi, pertimbangkan klaim garansi atau ganti supplier.';
        }

        return [
            'supplier_id' => $supplier->id,
            'supplier_name' => $supplier->name,
            'contact_person' => $supplier->contact_person,
            'phone' => $supplier->phone,
            'lead_time_days' => $supplier->lead_time_days,
            'is_active' => $supplier->is_active,
            'total_batches' => $totalBatches,
            'total_baglogs_received' => $totalBaglogsReceived,
            'total_rejected_at_arrival' => $totalRejectedAtArrival,
            'arrival_defect_rate_percent' => $arrivalDefectRate,
            'early_mortality_count' => $earlyMortalityCount,
            'early_mortality_rate_percent' => $earlyMortalityRate,
            'total_harvest_kg' => $totalHarvestKg,
            'avg_yield_kg_per_baglog' => $avgYieldPerBaglog,
            'avg_price_per_baglog' => $avgPricePerBaglog,
            'performance_grade' => $performanceGrade,
            'recommendation' => $recommendation,
        ];
    }

    /**
     * Komparasi performa semua supplier aktif untuk pendukung keputusan pemilihan vendor.
     *
     * @return array<string, mixed>
     */
    public function getComparison(): array
    {
        $suppliers = Supplier::with('batches')->get();
        $comparison = [];

        foreach ($suppliers as $supplier) {
            $comparison[] = $this->getSupplierScorecard($supplier);
        }

        // Urutkan berdasarkan Grade (A, B, C, NO_DATA) lalu arrival_defect_rate ASC
        usort($comparison, function ($a, $b) {
            $gradeOrder = ['A' => 1, 'B' => 2, 'C' => 3, 'NO_DATA' => 4];
            $gradeA = $gradeOrder[$a['performance_grade']] ?? 99;
            $gradeB = $gradeOrder[$b['performance_grade']] ?? 99;

            if ($gradeA !== $gradeB) {
                return $gradeA <=> $gradeB;
            }

            return $a['arrival_defect_rate_percent'] <=> $b['arrival_defect_rate_percent'];
        });

        return [
            'total_suppliers' => count($comparison),
            'suppliers' => $comparison,
        ];
    }
}

