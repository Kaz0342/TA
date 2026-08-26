<?php

namespace Database\Factories;

use App\Models\Sale;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory untuk model Sale.
 *
 * Harga jamur tiram di pasaran Indonesia: Rp 15.000 - Rp 35.000/Kg
 * total_revenue dihitung otomatis dari quantity × price.
 *
 * @extends Factory<Sale>
 */
class SaleFactory extends Factory
{
    protected $model = Sale::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $quantityKg = fake()->randomFloat(2, 1, 20);
        $pricePerKg = fake()->randomElement([15000, 18000, 20000, 22000, 25000, 28000, 30000, 35000]);
        $totalRevenue = bcmul((string) $quantityKg, (string) $pricePerKg, 2);

        return [
            'user_id' => User::factory(),
            'sale_date' => fake()->dateTimeBetween('-14 days', 'now'),
            'quantity_kg' => $quantityKg,
            'price_per_kg' => $pricePerKg,
            'total_revenue' => $totalRevenue,
            'buyer_name' => fake()->randomElement([
                'Pak Joko (Pasar Induk)',
                'Bu Sari (Resto Jamur)',
                'Mas Adi (Tengkulak)',
                'Ibu Dewi (Toko Sayur)',
                'Pak Budi (Warung Makan)',
                'CV Segar Selalu',
            ]),
            'notes' => fake()->optional(0.3)->sentence(),
        ];
    }
}
