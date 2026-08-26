<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Model Sale — catatan penjualan jamur ke tengkulak/pembeli.
 *
 * total_revenue dihitung di backend (Service layer):
 * total_revenue = quantity_kg × price_per_kg
 *
 * Sesuai ECC Rule: "Business logic (calculations) belongs
 * in the Backend/API, not the Frontend."
 *
 * Semua field uang/berat pakai DECIMAL:
 * - quantity_kg:    DECIMAL(8,2)
 * - price_per_kg:   DECIMAL(10,2) — harga dalam IDR
 * - total_revenue:  DECIMAL(12,2) — total pendapatan IDR
 *
 * @see PRD FR-3.2 (Input Penjualan)
 * @see PRD FR-3.3 (Report — Panen vs Terjual)
 *
 * @property int $id
 * @property int $user_id
 * @property string $sale_date
 * @property string $quantity_kg
 * @property string $price_per_kg
 * @property string $total_revenue
 * @property string $buyer_name
 * @property string|null $notes
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class Sale extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'sale_date',
        'quantity_kg',
        'price_per_kg',
        'total_revenue',
        'buyer_name',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sale_date' => 'date',
            'quantity_kg' => 'decimal:2',
            'price_per_kg' => 'decimal:2',
            'total_revenue' => 'decimal:2',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Penjualan dicatat oleh user (admin).
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Scopes ─────────────────────────────────────────────────

    /**
     * Scope: filter penjualan dalam rentang tanggal.
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeBetweenDates($query, string $from, string $to)
    {
        return $query->whereBetween('sale_date', [$from, $to]);
    }

    /**
     * Scope: penjualan minggu ini.
     * Dipakai untuk FR-3.3 (Report Mingguan — Panen vs Terjual).
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeThisWeek($query)
    {
        return $query->whereBetween('sale_date', [
            now()->startOfWeek()->toDateString(),
            now()->endOfWeek()->toDateString(),
        ]);
    }

    /**
     * Scope: penjualan bulan ini.
     * Dipakai untuk Dashboard (FR-1.3 — revenue bulan ini).
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeThisMonth($query)
    {
        return $query->whereMonth('sale_date', now()->month)
            ->whereYear('sale_date', now()->year);
    }

    // ─── Helper Methods ─────────────────────────────────────────

    /**
     * Hitung total_revenue dari quantity × price.
     * Dipanggil di Service layer sebelum save.
     */
    public function calculateRevenue(): string
    {
        return bcmul($this->quantity_kg, $this->price_per_kg, 2);
    }
}
