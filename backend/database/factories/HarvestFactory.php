<?php

namespace Database\Factories;

use App\Models\BaglogBatch;
use App\Models\Harvest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory untuk model Harvest.
 *
 * @extends Factory<Harvest>
 */
class HarvestFactory extends Factory
{
    protected $model = Harvest::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'baglog_batch_id' => BaglogBatch::factory(),
            'harvest_date' => fake()->dateTimeBetween('-14 days', 'now'),
            // Panen jamur tiram per hari: 0.5 - 15 Kg (realistis untuk skala kecil)
            'weight_kg' => fake()->randomFloat(2, 0.5, 15),
            'notes' => fake()->optional(0.2)->randomElement([
                'Panen pagi, kualitas bagus',
                'Jamur sedikit kecil',
                'Panen sore, kondisi normal',
                'Kualitas premium, cocok untuk restoran',
            ]),
        ];
    }

    /**
     * State: panen tanpa batch (pekerja tidak tahu batch-nya).
     */
    public function withoutBatch(): static
    {
        return $this->state(fn () => [
            'baglog_batch_id' => null,
        ]);
    }
}
