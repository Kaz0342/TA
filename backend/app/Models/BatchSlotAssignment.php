<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

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

    /**
     * Matriks transisi status legal (W-10).
     * Mencegah lompat status liar atau membuka kembali slot yang sudah selesai.
     */
    public const TRANSITIONS = [
        self::STATUS_INCUBATION => [self::STATUS_FRUITING, self::STATUS_COMPLETED],
        self::STATUS_FRUITING => [self::STATUS_COMPLETED],
        self::STATUS_COMPLETED => [],
    ];

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
        'completed_at',
        'completed_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'initial_quantity' => 'integer',
            'assigned_at' => 'date',
            'completed_at' => 'date',
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
     * Mendukung injeksi $totalCulls untuk eliminasi query N+1 pada list slots.
     */
    public function kapasitasAktif(int|null|false $totalCulls = false): int
    {
        if ($totalCulls === false) {
            $totalCulls = (int) BaglogCull::where('baglog_batch_id', $this->baglog_batch_id)
                ->where('slot_code', $this->slot_code)
                ->sum('quantity');
        }

        return max(0, $this->initial_quantity - ($totalCulls ?? 0));
    }

    /**
     * Hitung total berat panen (Kg) yang dihasilkan dari slot ini.
     * Mendukung injeksi $totalHarvestKg untuk eliminasi query N+1.
     */
    public function totalHarvestKg(float|null|false $totalHarvestKg = false): float
    {
        if ($totalHarvestKg === false) {
            $totalHarvestKg = (float) Harvest::where('baglog_batch_id', $this->baglog_batch_id)
                ->where('slot_code', $this->slot_code)
                ->sum('weight_kg');
        }

        return (float) ($totalHarvestKg ?? 0.0);
    }

    /**
     * Selesaikan siklus hidup slot ini (W-02).
     * Mengalirkan seluruh sisa baglog aktif ke jurnal afkir (HABIS_PRODUKSI atau sesuai reason)
     * sesuai prinsip akuntansi ledger (ERD §1), mencatat completed_at dan completed_reason,
     * lalu memicu refresh status pada batch.
     */
    public function complete(string $reason = 'EXHAUSTED', ?string $date = null): void
    {
        DB::transaction(function () use ($reason, $date) {
            $date = $date ?? now()->toDateString();
            $sisa = $this->kapasitasAktif();

            if ($sisa > 0) {
                $cullReason = match ($reason) {
                    'EXHAUSTED' => 'HABIS_PRODUKSI',
                    'CONTAMINATED' => 'LAINNYA',
                    'DISPOSED' => 'LAINNYA',
                    default => 'HABIS_PRODUKSI',
                };

                BaglogCull::create([
                    'baglog_batch_id' => $this->baglog_batch_id,
                    'slot_code' => $this->slot_code,
                    'cull_date' => $date,
                    'quantity' => $sisa,
                    'reason' => $cullReason,
                    'notes' => "Penutupan siklus slot ({$reason})",
                ]);
            }

            $this->update([
                'current_status' => self::STATUS_COMPLETED,
                'completed_at' => $date,
                'completed_reason' => $reason,
            ]);

            $this->baglogBatch?->refreshLifecycle();
        });
    }

    /**
     * Status Visual Badge untuk Dashboard UI.
     *
     * Sesuai Audit #4 & W-05:
     * - Jika sudah ada data di harvest_logs, prioritaskan MAX(flush_number) asli.
     * - Jika belum pernah panen, gunakan estimasi umur kalender sejak assigned_at.
     * Mendukung injeksi $maxFlush (int|null|false) untuk eliminasi query N+1 pada list slots.
     */
    public function badgeStatus(int|null|false $maxFlush = false): array
    {
        if ($maxFlush === false) {
            $maxFlush = Harvest::where('baglog_batch_id', $this->baglog_batch_id)
                ->where('slot_code', $this->slot_code)
                ->max('flush_number');
        }

        $ageDays = (int) Carbon::parse($this->assigned_at)->diffInDays(now());

        $decliningFlush = (int) config('baglog.flush.declining', 5);
        $oldFlush = (int) config('baglog.flush.old', 6);
        $incubationDays = (int) config('baglog.age.incubation', 35);
        $productiveDays = (int) config('baglog.age.productive', 110);
        $lateDays = (int) config('baglog.age.late', 130);

        // 1. Data panen riil sudah tersedia (Truth-based)
        if ($maxFlush !== null && $maxFlush > 0) {
            return match (true) {
                $maxFlush >= $oldFlush => [
                    'color' => 'red',
                    'dot' => 'bg-rose-500',
                    'class' => 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
                    'label' => "● Panen Ke-{$maxFlush} (Tua)",
                    'description' => 'Siklus panen sudah banyak, pertimbangkan untuk buang',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => true,
                ],
                $maxFlush >= $decliningFlush => [
                    'color' => 'amber',
                    'dot' => 'bg-amber-500',
                    'class' => 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                    'label' => "● Panen Ke-{$maxFlush} (Menurun)",
                    'description' => 'Produktivitas menurun, persiapkan PO baglog baru',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => true,
                ],
                $maxFlush >= 2 => [
                    'color' => 'emerald',
                    'dot' => 'bg-emerald-500',
                    'class' => 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                    'label' => "● Panen Ke-{$maxFlush} (Aktif)",
                    'description' => 'Masa keemasan masa panen / panen raya',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => false,
                ],
                default => [
                    'color' => 'blue',
                    'dot' => 'bg-blue-500',
                    'class' => 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
                    'label' => "● Panen Ke-{$maxFlush} (Perdana)",
                    'description' => 'Panen pertama dimulai',
                    'flush' => $maxFlush,
                    'age_days' => $ageDays,
                    'needs_po_alert' => false,
                ],
            };
        }

        // 2. Belum ada panen: fallback estimasi kalender spesifik jamur kuping
        return match (true) {
            $ageDays <= $incubationDays => [
                'color' => 'gray',
                'dot' => 'bg-slate-400',
                'class' => 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
                'label' => "● H+{$ageDays} • Inkubasi & Sayat",
                'description' => 'Fase kolonisasi miselium & pembentukan tunas pasca-keratan (Misting Tenang)',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => false,
            ],
            $ageDays <= $productiveDays => [
                'color' => 'emerald',
                'dot' => 'bg-emerald-500',
                'class' => 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                'label' => "● H+{$ageDays} • Masa Produktif",
                'description' => 'Fase pembesaran & pemekaran daun jamur kuping (Misting Aktif)',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => false,
            ],
            $ageDays <= $lateDays => [
                'color' => 'amber',
                'dot' => 'bg-amber-500',
                'class' => 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                'label' => "● H+{$ageDays} • Siklus Lanjut",
                'description' => 'Masa produktif melandai, persiapkan PO baglog baru',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => true,
            ],
            default => [
                'color' => 'red',
                'dot' => 'bg-rose-500',
                'class' => 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
                'label' => "● {$ageDays} Hari • Fase Afkir",
                'description' => 'Melebihi umur ekonomis jamur kuping, siap regenerasi media',
                'flush' => 0,
                'age_days' => $ageDays,
                'needs_po_alert' => true,
            ],
        };
    }
}
