<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Model BatchSlotAssignment — pivot alokasi batch baglog ke koordinat slot rak.
 *
 * Mengatur siklus hidup baglog di tiap slot (Inkubasi -> Fruiting -> Completed)
 * dan menghitung kapasitas aktif serta visual badge status.
 *
 * @property int $id
 * @property int $baglog_batch_id
 * @property string $slot_code
 * @property int $initial_quantity
 * @property string $initial_mycelium_stage
 * @property string $current_status
 * @property string $assigned_at
 */
class BatchSlotAssignment extends Model
{
    use HasFactory;

    public const STATUS_INCUBATION = 'INCUBATION';
    public const STATUS_FRUITING = 'FRUITING';
    public const STATUS_COMPLETED = 'COMPLETED';

    public const MYCELIUM_LEVEL_1 = 'LEVEL_1'; // < 50%
    public const MYCELIUM_LEVEL_2 = 'LEVEL_2'; // 50% - 80%
    public const MYCELIUM_LEVEL_3 = 'LEVEL_3'; // > 80%

    /**
     * @var list<string>
     */
    protected $fillable = [
        'baglog_batch_id',
        'slot_code',
        'initial_quantity',
        'initial_mycelium_stage',
        'current_status',
        'assigned_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'initial_quantity' => 'integer',
            'assigned_at' => 'date',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Batch baglog pemilik assignment ini.
     *
     * @return BelongsTo<BaglogBatch, $this>
     */
    public function baglogBatch(): BelongsTo
    {
        return $this->belongsTo(BaglogBatch::class, 'baglog_batch_id');
    }

    /**
     * Koordinat fisik slot rak.
     *
     * @return BelongsTo<Slot, $this>
     */
    public function slot(): BelongsTo
    {
        return $this->belongsTo(Slot::class, 'slot_code', 'slot_code');
    }

    /**
     * Afkir baglog yang dicatat khusus untuk slot dan batch ini.
     *
     * @return HasMany<BaglogCull, $this>
     */
    public function culls(): HasMany
    {
        return $this->hasMany(BaglogCull::class, 'slot_code', 'slot_code')
            ->where('baglog_batch_id', $this->baglog_batch_id);
    }

    /**
     * Hasil panen yang tercatat dari slot dan batch ini.
     *
     * @return HasMany<Harvest, $this>
     */
    public function harvests(): HasMany
    {
        return $this->hasMany(Harvest::class, 'slot_code', 'slot_code')
            ->where('baglog_batch_id', $this->baglog_batch_id);
    }

    // ─── Scopes ─────────────────────────────────────────────────

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('current_status', [self::STATUS_INCUBATION, self::STATUS_FRUITING]);
    }

    public function scopeIncubation(Builder $query): Builder
    {
        return $query->where('current_status', self::STATUS_INCUBATION);
    }

    public function scopeFruiting(Builder $query): Builder
    {
        return $query->where('current_status', self::STATUS_FRUITING);
    }

    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('current_status', self::STATUS_COMPLETED);
    }

    // ─── Business Logic Methods ─────────────────────────────────

    /**
     * Hitung sisa kapasitas baglog aktif di slot ini.
     * Rumus: initial_quantity - SUM(culls.quantity).
     * Sesuai Audit #6: tidak hardcode 10.
     */
    public function kapasitasAktif(): int
    {
        $totalCulls = (int) BaglogCull::where('baglog_batch_id', $this->baglog_batch_id)
            ->where('slot_code', $this->slot_code)
            ->sum('quantity');

        return max(0, $this->initial_quantity - $totalCulls);
    }

    /**
     * Hitung total berat panen (Kg) yang dihasilkan dari slot ini.
     */
    public function totalHarvestKg(): float
    {
        return (float) Harvest::where('baglog_batch_id', $this->baglog_batch_id)
            ->where('slot_code', $this->slot_code)
            ->sum('weight_kg');
    }

    /**
     * Status Visual Badge untuk Dashboard UI.
     *
     * Sesuai Audit #4:
     * - Jika sudah ada data di harvest_logs, prioritaskan MAX(flush_number) asli.
     * - Jika belum pernah panen, gunakan estimasi umur kalender sejak assigned_at.
     */
    public function badgeStatus(): array
    {
        $maxFlush = Harvest::where('baglog_batch_id', $this->baglog_batch_id)
            ->where('slot_code', $this->slot_code)
            ->max('flush_number');

        $ageDays = (int) Carbon::parse($this->assigned_at)->diffInDays(now());

        // 1. Data panen riil sudah tersedia (Truth-based)
        if ($maxFlush !== null && $maxFlush > 0) {
            return match (true) {
                $maxFlush >= 6 => [
                    'color' => 'red',
                    'label' => "● Panen Ke-{$maxFlush} (Tua)",
                    'description' => 'Siklus panen sudah banyak, pertimbangkan untuk buang',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => true,
                ],
                $maxFlush === 5 => [
                    'color' => 'amber',
                    'label' => "● Panen Ke-{$maxFlush} (Menurun)",
                    'description' => 'Produktivitas menurun, persiapkan PO baglog baru',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => true,
                ],
                $maxFlush >= 2 => [
                    'color' => 'emerald',
                    'label' => "● Panen Ke-{$maxFlush} (Aktif)",
                    'description' => 'Masa keemasan masa panen / panen raya',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => false,
                ],
                default => [
                    'color' => 'blue',
                    'label' => "● Panen Ke-{$maxFlush} (Perdana)",
                    'description' => 'Panen pertama dimulai',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => false,
                ],
            };
        }

        // 2. Belum ada panen: fallback estimasi kalender
        return match (true) {
            $ageDays <= 14 => [
                'color' => 'gray',
                'label' => "● H+{$ageDays} • Masa Tumbuh",
                'description' => 'Fase pertumbuhan awal (Misting OFF/Minimal)',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => false,
            ],
            $ageDays <= 90 => [
                'color' => 'emerald',
                'label' => "● H+{$ageDays} • Siap Panen",
                'description' => 'Fase pembentukan tubuh buah jamur',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => false,
            ],
            $ageDays <= 110 => [
                'color' => 'amber',
                'label' => "● H+{$ageDays} • Siklus Lanjut",
                'description' => 'Alert lead-time PO baglog baru',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => true,
            ],
            default => [
                'color' => 'red',
                'label' => "● {$ageDays} Hari • Tua (Dibuang)",
                'description' => 'Melebihi umur produktif standar',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => true,
            ],
        };
    }
}
