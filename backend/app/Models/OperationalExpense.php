<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Model OperationalExpense — pencatatan biaya operasional nyata
 * (listrik, misting, plastik packing, dll).
 *
 * Digunakan dalam perhitungan HPP & Margin Kontribusi.
 *
 * @property int $id
 * @property int|null $baglog_batch_id
 * @property string $expense_date
 * @property string $category
 * @property string $amount
 * @property string|null $notes
 */
class OperationalExpense extends Model
{
    use HasFactory;

    public const CATEGORY_LISTRIK = 'LISTRIK';
    public const CATEGORY_MISTING = 'MISTING';
    public const CATEGORY_PLASTIK = 'PLASTIK';
    public const CATEGORY_LAINNYA = 'LAINNYA';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'baglog_batch_id',
        'expense_date',
        'category',
        'amount',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expense_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Batch baglog terkait (jika biaya spesifik batch).
     * Null jika merupakan biaya overhead umum kumbung.
     *
     * @return BelongsTo<BaglogBatch, $this>
     */
    public function baglogBatch(): BelongsTo
    {
        return $this->belongsTo(BaglogBatch::class, 'baglog_batch_id');
    }

    // ─── Scopes ─────────────────────────────────────────────────

    public function scopeByCategory(Builder $query, string $category): Builder
    {
        return $query->where('category', strtoupper($category));
    }

    public function scopeForBatch(Builder $query, int $batchId): Builder
    {
        return $query->where('baglog_batch_id', $batchId);
    }

    public function scopeShared(Builder $query): Builder
    {
        return $query->whereNull('baglog_batch_id');
    }
}
