<?php

namespace Database\Factories;

use App\Models\SensorData;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory untuk model SensorData.
 * Default: data sensor dalam kondisi normal (suhu 25-29°C, kelembaban 70-85%).
 *
 * @extends Factory<SensorData>
 */
class SensorDataFactory extends Factory
{
    protected $model = SensorData::class;

    public function definition(): array
    {
        return [
            'temperature' => fake()->randomFloat(2, 25, 29),
            'humidity' => fake()->randomFloat(2, 70, 85),
            'co2_level' => fake()->randomFloat(2, 400, 800),
            'light_intensity' => fake()->randomFloat(2, 100, 500),
            'device_id' => 'ESP32-TEST-'.fake()->unique()->numberBetween(1, 999),
            'recorded_at' => now(),
        ];
    }

    /**
     * State: suhu tinggi (bahaya).
     */
    public function hotTemperature(float $temp = 35.0): static
    {
        return $this->state(fn () => ['temperature' => $temp]);
    }

    /**
     * State: suhu rendah (bahaya).
     */
    public function coldTemperature(float $temp = 15.0): static
    {
        return $this->state(fn () => ['temperature' => $temp]);
    }

    /**
     * State: kelembaban tinggi (bahaya).
     */
    public function highHumidity(float $humidity = 95.0): static
    {
        return $this->state(fn () => ['humidity' => $humidity]);
    }

    /**
     * State: kelembaban rendah (bahaya).
     */
    public function lowHumidity(float $humidity = 50.0): static
    {
        return $this->state(fn () => ['humidity' => $humidity]);
    }
}
