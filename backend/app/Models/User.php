<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Carbon\Carbon;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Model User — Petani/Pemilik Kumbung (Admin) atau Pekerja (Worker).
 *
 * Role 'admin' = pemilik kumbung, bisa kelola semua modul.
 * Role 'worker' = buruh tani, hanya bisa input data panen.
 *
 * @see PRD Section 2 (Target Users)
 *
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $password
 * @property string $role — 'admin' | 'worker'
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['name', 'email', 'password', 'role'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Role constants — hindari magic string di seluruh codebase.
     */
    public const ROLE_ADMIN = 'admin';

    public const ROLE_WORKER = 'worker';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // ─── Role Helper Methods ────────────────────────────────────

    /**
     * Cek apakah user adalah admin (pemilik kumbung).
     */
    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /**
     * Cek apakah user adalah worker (buruh tani).
     */
    public function isWorker(): bool
    {
        return $this->role === self::ROLE_WORKER;
    }

    // ─── Relationships (ERD) ────────────────────────────────────

    /**
     * User memiliki banyak batch baglog yang dikelola.
     *
     * @return HasMany<BaglogBatch, $this>
     */
    public function baglogBatches(): HasMany
    {
        return $this->hasMany(BaglogBatch::class);
    }

    /**
     * User memiliki banyak record panen.
     *
     * @return HasMany<Harvest, $this>
     */
    public function harvests(): HasMany
    {
        return $this->hasMany(Harvest::class);
    }

    /**
     * User memiliki banyak record penjualan.
     *
     * @return HasMany<Sale, $this>
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    /**
     * User memiliki banyak threshold setting.
     *
     * @return HasMany<ThresholdSetting, $this>
     */
    public function thresholdSettings(): HasMany
    {
        return $this->hasMany(ThresholdSetting::class);
    }
}
