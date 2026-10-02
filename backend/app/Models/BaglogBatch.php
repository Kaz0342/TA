<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Model BaglogBatch — batch media tanam jamur kuping.
 *
 * Baglog = kantong plastik berisi serbuk kayu + dedak + kapur
 * yang sudah disterilisasi, siap ditanami bibit jamur.
 *
 * Umur baglog (age_days) dihitung otomatis dari entry_date
 * via accessor — tidak disimpan di DB agar tidak stale.
 *
 * Status lifecycle:
 * 1. active → baglog produktif, masih bisa panen
 * 2. contaminated → terkontaminasi (jamur hijau/bakteri)
 * 3. disposed → sudah dibuang/diafkir
 *
 * @see PRD FR-2.1 (Input Batch Baglog)
 * @see PRD FR-2.2 (Status Baglog)
 *
 * @property int $id
 * @property int $user_id
 * @property string $batch_code
 * @property string $entry_date
 * @property int $quantity
 * @property string $supplier
 * @property string $status
 * @property string|null $notes
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read int $age_days — umur baglog dalam hari (computed)
 */
class BaglogBatch extends Model
{
    use HasFactory;

    /**
     * Status constants — hindari magic string.
     */
    public const STATUS_ACTIVE = 'active';

    public const STATUS_CONTAMINATED = 'contaminated';

    public const STATUS_DISPOSED = 'disposed';

    public const STATUS_COMPLETED = 'completed';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'batch_code',
        'entry_date',
        'quantity',
        'supplier',
        'price_per_baglog',
        'status',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'quantity' => 'integer',
            'price_per_baglog' => 'decimal:2',
        ];
    }

    /**
     * @var list<string>
     */
    protected $appends = [
        'age_days',
        'assigned_quantity',
        'unassigned_quantity',
        'assigned_slots_count',
    ];

    // ─── Accessors ──────────────────────────────────────────────

    /**
     * Hitung umur baglog dalam hari dari entry_date sampai sekarang.
     * Computed accessor — tidak disimpan di DB.
     *
     * Contoh: entry_date = 2026-07-01, hari ini = 2026-08-08 → age_days = 38
     */
    public function getAgeDaysAttribute(): int
    {
        return (int) Carbon::parse($this->entry_date)->diffInDays(now());
    }

    /**
     * Hitung total baglog yang sudah teralokasi ke slot rak kumbung.
     */
    public function getAssignedQuantityAttribute(): int
    {
        if (array_key_exists('assigned_quantity', $this->attributes)) {
            return (int) ($this->attributes['assigned_quantity'] ?? 0);
        }

        return (int) $this->assignments()->sum('initial_quantity');
    }

    /**
     * Hitung sisa baglog yang belum dialokasikan ke slot rak mana pun.
     */
    public function getUnassignedQuantityAttribute(): int
    {
        return max(0, $this->quantity - $this->assigned_quantity);
    }

    /**
     * Hitung jumlah slot yang ditempati oleh batch ini.
     */
    public function getAssignedSlotsCountAttribute(): int
    {
        if (array_key_exists('assigned_slots_count', $this->attributes)) {
            return (int) ($this->attributes['assigned_slots_count'] ?? 0);
        }

        return (int) $this->assignments()->count();
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Batch dimiliki oleh user (admin yang menginput).
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Batch menghasilkan banyak record panen.
     *
     * @return HasMany<Harvest, $this>
     */
    public function harvests(): HasMany
    {
        return $this->hasMany(Harvest::class);
    }

    /**
     * Alokasi slot rak yang ditempati oleh batch ini.
     *
     * @return HasMany<BatchSlotAssignment, $this>
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(BatchSlotAssignment::class, 'baglog_batch_id');
    }

    /**
     * Ledger kematian / afkir baglog dari batch ini.
     *
     * @return HasMany<BaglogCull, $this>
     */
    public function culls(): HasMany
    {
        return $this->hasMany(BaglogCull::class, 'baglog_batch_id');
    }

    /**
     * Biaya operasional yang diatribusikan ke batch ini.
     *
     * @return HasMany<OperationalExpense, $this>
     */
    public function operationalExpenses(): HasMany
    {
        return $this->hasMany(OperationalExpense::class, 'baglog_batch_id');
    }

    /**
     * Transaksi penjualan yang bersumber dari batch ini.
     *
     * @return HasMany<Sale, $this>
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class, 'baglog_batch_id');
    }

    // ─── Scopes ─────────────────────────────────────────────────

    /**
     * Scope: filter by status.
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope: hanya baglog yang masih aktif.
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    // ─── Helper Methods ─────────────────────────────────────────

    /**
     * Cek apakah baglog ini masih aktif.
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Cek apakah baglog ini terkontaminasi.
     */
    public function isContaminated(): bool
    {
        return $this->status === self::STATUS_CONTAMINATED;
    }

    /**
     * Cek apakah baglog ini sudah dibuang.
     */
    public function isDisposed(): bool
    {
        return $this->status === self::STATUS_DISPOSED;
    }

    /**
     * Cek apakah siklus hidup batch ini sudah selesai.
     */
    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Sinkronkan status lifecycle batch.
     * Jika seluruh assignment slot sudah selesai (COMPLETED) dan tidak ada slot aktif,
     * batch otomatis ditandai 'completed' (W-02).
     */
    public function refreshLifecycle(): void
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return;
        }

        $placed = (int) $this->assignments()->sum('initial_quantity');
        $hasActive = $this->assignments()->active()->exists();

        if ($placed > 0 && ! $hasActive) {
            $this->update(['status' => self::STATUS_COMPLETED]);
        }
    }

    /**
     * Total panen (Kg) dari batch ini.
     * Dipakai untuk analisis produktivitas per batch.
     */
    public function totalHarvestKg(): float
    {
        return (float) $this->harvests()->sum('weight_kg');
    }

    /**
     * Generate batch code otomatis (W-12).
     * Format: BL-YYYYMMDD-XXX (3 digit sequential per tanggal entry).
     */
    public static function generateBatchCode(?string $entryDate = null): string
    {
        $dateStr = $entryDate ? Carbon::parse($entryDate)->format('Ymd') : now()->format('Ymd');
        $prefix = "BL-{$dateStr}-";

        $lastBatch = static::where('batch_code', 'like', "{$prefix}%")
            ->orderByDesc('batch_code')
            ->first();

        if ($lastBatch) {
            $lastNumber = (int) substr($lastBatch->batch_code, -3);
            $nextNumber = $lastNumber + 1;
        } else {
            $nextNumber = 1;
        }

        return $prefix.str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
    }

    /**
     * Hitung total modal awal pembelian baglog (IDR).
     * Modal = quantity × price_per_baglog.
     */
    public function totalModalAwal(): string
    {
        return bcmul((string) $this->quantity, (string) ($this->price_per_baglog ?? 0), 2);
    }

    /**
     * Hitung Margin Kontribusi & status HPP batch ini.
     *
     * Sesuai Audit #5: dinamakan Margin Kontribusi (bukan laba bersih riil
     * karena belum memasukkan depresiasi infrastruktur rak/kumbung/IoT).
     * Sesuai Audit #7: menyertakan indikator persentase siklus agar
     * batch yang baru sebulan tidak salah dinilai merugi.
     */
    public function marginKontribusi(): array
    {
        $modalAwal = $this->totalModalAwal();
        
        $directOps = (float) $this->operationalExpenses()->sum('amount');
        $totalOverhead = (float) OperationalExpense::whereNull('baglog_batch_id')->sum('amount');
        $totalBatchesCount = BaglogBatch::count();
        $prorataOverhead = $totalBatchesCount > 0 ? ($totalOverhead / $totalBatchesCount) : 0;
        
        $biayaOps = (string) ($directOps + $prorataOverhead);
        
        $omzetKotor = (string) ($this->sales()->sum('total_revenue') ?? '0.00');

        // Margin Kontribusi = Omzet - Modal Awal - Biaya Operasional Variabel
        $totalBiaya = bcadd($modalAwal, $biayaOps, 2);
        $margin = bcsub($omzetKotor, $totalBiaya, 2);

        // Siklus hidup jamur kuping (berdasarkan config baglog.cycle_days)
        $cycleDays = (int) config('baglog.cycle_days', 120);
        $persenSiklus = min(100.0, round(($this->age_days / $cycleDays) * 100, 1));

        $totalPanenKg = $this->totalHarvestKg();
        $totalCulls = (int) $this->culls()->sum('quantity');
        $activeCapacity = max(0, $this->quantity - $totalCulls);
        $mortalityRate = $this->quantity > 0 ? round(($totalCulls / $this->quantity) * 100, 1) : 0.0;

        $totalSalesKg = (float) ($this->sales()->sum('quantity_kg') ?? 0);
        $avgSellingPrice = $totalSalesKg > 0 ? round((float) $omzetKotor / $totalSalesKg, 2) : 25000.0;

        $bepHarvestKg = $avgSellingPrice > 0 ? round((float) $totalBiaya / $avgSellingPrice, 2) : 0.0;
        $bepProgress = $bepHarvestKg > 0 ? min(100.0, round(($totalPanenKg / $bepHarvestKg) * 100, 1)) : 0.0;
        $hppPerKg = $totalPanenKg > 0 ? round((float) $totalBiaya / $totalPanenKg, 2) : 0.0;

        return [
            // Standard identifiers
            'batch_id' => $this->id,
            'batch_code' => $this->batch_code,
            'entry_date' => $this->entry_date,
            'age_days' => $this->age_days,
            'cycle_target_days' => $cycleDays,
            'cycle_progress_percent' => $persenSiklus,
            'persen_siklus' => $persenSiklus,
            'is_completed' => in_array($this->status, [self::STATUS_DISPOSED, 'completed']),

            // Quantities & Capacity
            'total_quantity' => $this->quantity,
            'initial_quantity' => $this->quantity,
            'active_capacity' => $activeCapacity,
            'culled_quantity' => $totalCulls,
            'total_culls_qty' => $totalCulls,
            'mortality_rate_percent' => $mortalityRate,

            // Financial & Capital
            'price_missing' => $this->price_per_baglog === null || (float) $this->price_per_baglog <= 0,
            'price_per_baglog' => (float) $this->price_per_baglog,
            'modal_baglog_awal' => (float) $modalAwal,
            'baglog_capital_cost' => (float) $modalAwal,
            'biaya_operasional' => (float) $biayaOps,
            'operational_expense_allocated' => (float) $biayaOps,
            'total_biaya' => (float) $totalBiaya,
            'total_modal_investasi' => (float) $totalBiaya,

            // Harvest & HPP
            'total_panen_kg' => $totalPanenKg,
            'total_harvest_kg' => $totalPanenKg,
            'hpp_per_kg_harvested' => $hppPerKg,

            // Sales & Omzet
            'omzet_kotor' => (float) $omzetKotor,
            'total_sales_revenue' => (float) $omzetKotor,
            'total_sales_kg' => $totalSalesKg,
            'avg_selling_price_per_kg' => $avgSellingPrice,

            // Margin & BEP
            'margin_kontribusi' => (float) $margin,
            'bep_harvest_kg' => $bepHarvestKg,
            'bep_progress_percent' => $bepProgress,
        ];
    }

    /**
     * Hitung sisa total baglog aktif di seluruh slot yang ditempati batch ini.
     */
    public function totalActiveCapacity(): int
    {
        $totalCulls = (int) $this->culls()->sum('quantity');

        return max(0, $this->quantity - $totalCulls);
    }
}
