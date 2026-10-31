<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Model Customer — master pembeli komoditas jamur.
 *
 * @property int $id
 * @property string $name
 * @property string $category
 * @property string|null $phone
 * @property string|null $address
 * @property bool $is_active
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class Customer extends Model
{
    use HasFactory;

    public const CATEGORY_TENGKULAK = 'TENGKULAK';

    public const CATEGORY_RESTO = 'RESTO';

    public const CATEGORY_PASAR_INDUK = 'PASAR_INDUK';

    public const CATEGORY_ECERAN = 'ECERAN';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'category',
        'phone',
        'address',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * Relasi ke seluruh transaksi penjualan untuk pembeli ini.
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class, 'customer_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeByCategory(Builder $query, string $category): Builder
    {
        return $query->where('category', $category);
    }
}

