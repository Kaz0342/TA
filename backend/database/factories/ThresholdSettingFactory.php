<?php

namespace Database\Factories;

use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory untuk model ThresholdSetting.
 * Default: batas optimal jamur tiram (20-30°C, 70-90%).
 *
 * @extends Factory<ThresholdSetting>
 */
class ThresholdSettingFactory extends Factory
{
    protected $model = ThresholdSetting::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'temp_min' => 20.00,
            'temp_max' => 30.00,
            'humidity_min' => 70.00,
            'humidity_max' => 90.00,
            'is_active' => true,
        ];
    }

    /**
     * State: threshold tidak aktif.
     */
    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /**
     * State: threshold ketat (range sempit).
     */
    public function strict(): static
    {
        return $this->state(fn () => [
            'temp_min' => 24.00,
            'temp_max' => 26.00,
            'humidity_min' => 80.00,
            'humidity_max' => 85.00,
        ]);
    }
}
