<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Model BaglogBatch — batch media tanam jamur tiram.
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

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'batch_code',
        'entry_date',
        'quantity',
        'supplier',
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
        ];
    }

    // ─── Accessors ──────────────────────────────────────────────

    /**
     * Hitung umur baglog dalam hari dari entry_date sampai sekarang.
     * Computed accessor — tidak disimpan di DB.
     *
     * Contoh: entry_date = 2026-07-01, hari ini = 2026-08-08 → age_days = 38
     */
    public function getAgeDaysAttribute(): int
    {
        return Carbon::parse($this->entry_date)->diffInDays(now());
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
     * Total panen (Kg) dari batch ini.
     * Dipakai untuk analisis produktivitas per batch.
     */
    public function totalHarvestKg(): float
    {
        return (float) $this->harvests()->sum('weight_kg');
    }

    /**
     * Generate batch code otomatis.
     * Format: BL-YYYYMMDD-XXX (3 digit sequential per hari).
     */
    public static function generateBatchCode(): string
    {
        $today = now()->format('Ymd');
        $prefix = "BL-{$today}-";

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
}
