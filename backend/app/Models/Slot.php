<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Model Slot — master koordinat fisik rak kumbung 3D (Row-Bay-Tier).
 *
 * Koordinat bersifat fisik statis/immutable:
 * - Row: A, B, C (3 Rak)
 * - Bay: 1 s/d 10 (10 Seksi horizontal)
 * - Tier: 1 s/d 10 (10 Tingkat vertikal)
 * Kapasitas default: 10 baglog per slot.
 *
 * @property string $slot_code — contoh 'B-05-03'
 * @property string $row — 'A', 'B', 'C'
 * @property int $bay — 1-10
 * @property int $tier — 1-10
 * @property int $max_capacity — default 10
 */
class Slot extends Model
{
    use HasFactory;

    protected $primaryKey = 'slot_code';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'slot_code',
        'row',
        'bay',
        'tier',
        'max_capacity',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'bay' => 'integer',
            'tier' => 'integer',
            'max_capacity' => 'integer',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Seluruh histori assignment batch di slot ini.
     *
     * @return HasMany<BatchSlotAssignment, $this>
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(BatchSlotAssignment::class, 'slot_code', 'slot_code');
    }

    /**
     * Assignment aktif saat ini di slot ini (fase inkubasi atau fruiting).
     *
     * @return HasOne<BatchSlotAssignment, $this>
     */
    public function activeAssignment(): HasOne
    {
        return $this->hasOne(BatchSlotAssignment::class, 'slot_code', 'slot_code')
            ->whereIn('current_status', ['INCUBATION', 'FRUITING'])
            ->latestOfMany();
    }

    /**
     * Histori baglog afkir/mati yang terjadi di slot ini.
     *
     * @return HasMany<BaglogCull, $this>
     */
    public function culls(): HasMany
    {
        return $this->hasMany(BaglogCull::class, 'slot_code', 'slot_code');
    }

    /**
     * Histori hasil panen dari slot ini.
     *
     * @return HasMany<Harvest, $this>
     */
    public function harvests(): HasMany
    {
        return $this->hasMany(Harvest::class, 'slot_code', 'slot_code');
    }

    // ─── Scopes ─────────────────────────────────────────────────

    /**
     * Scope: filter berdasarkan lorong/rak (Row A, B, atau C).
     */
    public function scopeByRow(Builder $query, string $row): Builder
    {
        return $query->where('row', strtoupper($row));
    }

    /**
     * Scope: slot yang sedang terisi batch aktif.
     */
    public function scopeOccupied(Builder $query): Builder
    {
        return $query->whereHas('assignments', function ($q) {
            $q->whereIn('current_status', ['INCUBATION', 'FRUITING']);
        });
    }

    /**
     * Scope: slot yang sedang kosong.
     */
    public function scopeEmpty(Builder $query): Builder
    {
        return $query->whereDoesntHave('assignments', function ($q) {
            $q->whereIn('current_status', ['INCUBATION', 'FRUITING']);
        });
    }

    // ─── Helpers ────────────────────────────────────────────────

    /**
     * Cek apakah slot sedang terisi batch aktif.
     */
    public function isOccupied(): bool
    {
        return $this->activeAssignment !== null;
    }
}
