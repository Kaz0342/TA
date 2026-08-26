<?php

namespace Database\Factories;

use App\Models\BaglogBatch;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory untuk model BaglogBatch.
 * Default: batch aktif, ditanam hari ini.
 *
 * @extends Factory<BaglogBatch>
 */
class BaglogBatchFactory extends Factory
{
    protected $model = BaglogBatch::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'batch_code' => 'BL-'.now()->format('Ymd').'-'.str_pad((string) fake()->unique()->numberBetween(1, 999), 3, '0', STR_PAD_LEFT),
            'entry_date' => now()->toDateString(),
            'quantity' => fake()->numberBetween(50, 500),
            'supplier' => fake()->company(),
            'status' => BaglogBatch::STATUS_ACTIVE,
            'notes' => null,
        ];
    }

    /**
     * State: batch terkontaminasi.
     */
    public function contaminated(): static
    {
        return $this->state(fn () => ['status' => BaglogBatch::STATUS_CONTAMINATED]);
    }

    /**
     * State: batch sudah dibuang.
     */
    public function disposed(): static
    {
        return $this->state(fn () => ['status' => BaglogBatch::STATUS_DISPOSED]);
    }

    /**
     * State: batch tua (ditanam X hari lalu).
     */
    public function daysOld(int $days): static
    {
        return $this->state(fn () => ['entry_date' => now()->subDays($days)->toDateString()]);
    }
}
