<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Model BaglogCull — ledger mutasi kematian / afkir baglog per slot.
 *
 * Mencatat setiap pengurangan kapasitas baglog beserta alasan spesifik
 * untuk keperluan audit garansi supplier & pencegahan wabah kontaminasi.
 *
 * @property int $id
 * @property int $baglog_batch_id
 * @property string $slot_code
 * @property string $cull_date
 * @property int $quantity
 * @property string $reason
 * @property string|null $notes
 */
class BaglogCull extends Model
{
    use HasFactory;

    public const REASON_TRICHODERMA = 'TRICHODERMA';
    public const REASON_BUSUK_BASAH = 'BUSUK_BASAH';
    public const REASON_HAMA = 'HAMA';
    public const REASON_KERING = 'KERING';
    public const REASON_LAINNYA = 'LAINNYA';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'baglog_batch_id',
        'slot_code',
        'cull_date',
        'quantity',
        'reason',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cull_date' => 'date',
            'quantity' => 'integer',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Batch baglog yang diafkir.
     *
     * @return BelongsTo<BaglogBatch, $this>
     */
    public function baglogBatch(): BelongsTo
    {
        return $this->belongsTo(BaglogBatch::class, 'baglog_batch_id');
    }

    /**
     * Koordinat fisik slot rak tempat afkir terjadi.
     *
     * @return BelongsTo<Slot, $this>
     */
    public function slot(): BelongsTo
    {
        return $this->belongsTo(Slot::class, 'slot_code', 'slot_code');
    }
}
