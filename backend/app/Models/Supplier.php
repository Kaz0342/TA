<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Model Supplier — data master pemasok bibit baglog.
 *
 * @property int $id
 * @property string $name
 * @property string|null $contact_person
 * @property string|null $phone
 * @property string|null $address
 * @property int $lead_time_days
 * @property bool $is_active
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class Supplier extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'contact_person',
        'phone',
        'address',
        'lead_time_days',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'lead_time_days' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Relasi ke seluruh batch baglog yang dipasok oleh supplier ini.
     */
    public function batches(): HasMany
    {
        return $this->hasMany(BaglogBatch::class, 'supplier_id');
    }

    /**
     * Scope supplier aktif untuk pemilihan pengadaan / PO.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}

