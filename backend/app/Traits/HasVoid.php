<?php

namespace App\Traits;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trait HasVoid — Standar audit void untuk entitas ledger akuntansi (W-09).
 *
 * Menerapkan Global Scope 'notVoided' secara otomatis sehingga seluruh query
 * agregat, list, dan relasi bisnis hanya memperhitungkan transaksi valid.
 */
trait HasVoid
{
    /**
     * Boot the trait: pasang global scope mengecualikan data voided.
     */
    public static function bootHasVoid(): void
    {
        static::addGlobalScope('notVoided', function (Builder $builder) {
            $builder->whereNull($builder->getModel()->getTable().'.voided_at');
        });
    }

    /**
     * Scope: sertakan data yang sudah di-void.
     */
    public function scopeWithVoided(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notVoided');
    }

    /**
     * Scope: hanya data yang di-void.
     */
    public function scopeOnlyVoided(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notVoided')
            ->whereNotNull($this->getTable().'.voided_at');
    }

    /**
     * Cek apakah transaksi ini sudah dibatalkan (voided).
     */
    public function isVoided(): bool
    {
        return $this->voided_at !== null;
    }

    /**
     * Lakukan pembatalan (void) dengan jejak audit akuntansi.
     */
    public function void(int $userId, string $reason): void
    {
        $this->update([
            'voided_at' => now(),
            'voided_by' => $userId,
            'void_reason' => $reason,
        ]);
    }

    /**
     * User yang membatalkan transaksi ini.
     *
     * @return BelongsTo<User, $this>
     */
    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }
}
