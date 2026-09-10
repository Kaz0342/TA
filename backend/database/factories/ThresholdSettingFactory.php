<?php

namespace Database\Factories;

use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory untuk model ThresholdSetting.
 * Default: batas optimal jamur kuping (24-32°C, 80-95%).
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
            'temp_min' => 24.00,
            'temp_max' => 32.00,
            'humidity_min' => 80.00,
            'humidity_max' => 95.00,
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
            'temp_min' => 26.00,
            'temp_max' => 30.00,
            'humidity_min' => 85.00,
            'humidity_max' => 92.00,
        ]);
    }
}
