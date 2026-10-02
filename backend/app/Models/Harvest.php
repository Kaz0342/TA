<?php

namespace App\Models;

use App\Traits\HasVoid;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Model Harvest — catatan hasil panen harian.
 *
 * Pekerja/admin menginput berat panen harian (Kg)
 * dan mengaitkan ke batch baglog tertentu (jika diketahui).
 *
 * Data ini jadi fondasi untuk:
 * - FR-1.3: Quick Stats (total panen hari ini)
 * - FR-3.3: Report mingguan (panen vs terjual)
 * - Phase 2: AI Analytics (prediksi panen)
 *
 * @see PRD FR-3.1 (Input Hasil Panen)
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $baglog_batch_id
 * @property string $harvest_date
 * @property string $weight_kg
 * @property string|null $notes
 * @property Carbon|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class Harvest extends Model
{
    use HasFactory, HasVoid;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'baglog_batch_id',
        'slot_code',
        'harvest_date',
        'weight_kg',
        'flush_number',
        'quality_grade',
        'notes',
        'voided_at',
        'voided_by',
        'void_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'harvest_date' => 'date',
            'weight_kg' => 'decimal:2',
            'flush_number' => 'integer',
            'voided_at' => 'datetime',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Panen dicatat oleh user (pekerja/admin).
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Panen berasal dari batch baglog tertentu (opsional).
     *
     * @return BelongsTo<BaglogBatch, $this>
     */
    public function baglogBatch(): BelongsTo
    {
        return $this->belongsTo(BaglogBatch::class);
    }

    /**
     * Panen bersumber dari koordinat slot rak tertentu.
     *
     * @return BelongsTo<Slot, $this>
     */
    public function slot(): BelongsTo
    {
        return $this->belongsTo(Slot::class, 'slot_code', 'slot_code');
    }

    // ─── Scopes ─────────────────────────────────────────────────

    /**
     * Scope: filter panen hari ini saja.
     * Dipakai untuk FR-1.3 (Quick Stats — total panen hari ini).
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeToday($query)
    {
        return $query->whereDate('harvest_date', now()->toDateString());
    }

    /**
     * Scope: filter panen dalam rentang tanggal.
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeBetweenDates($query, string $from, string $to)
    {
        return $query->whereBetween('harvest_date', [$from, $to]);
    }

    /**
     * Scope: filter panen minggu ini.
     * Dipakai untuk FR-3.3 (Report Mingguan).
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeThisWeek($query)
    {
        return $query->whereBetween('harvest_date', [
            now()->startOfWeek()->toDateString(),
            now()->endOfWeek()->toDateString(),
        ]);
    }
}
