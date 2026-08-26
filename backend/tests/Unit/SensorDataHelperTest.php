<?php

namespace Tests\Unit;

use App\Models\SensorData;
use Tests\TestCase;

/**
 * SensorDataHelperTest — Unit test untuk helper methods di SensorData model.
 *
 * Menguji bahwa method perbandingan suhu/kelembaban menghasilkan
 * boolean yang akurat sesuai data sensor yang masuk.
 *
 * @see App\Models\SensorData::isTemperatureAbove()
 * @see App\Models\SensorData::isTemperatureBelow()
 * @see App\Models\SensorData::isHumidityAbove()
 * @see App\Models\SensorData::isHumidityBelow()
 */
class SensorDataHelperTest extends TestCase
{
    // ════════════════════════════════════════════════════════════
    // Temperature Comparison Methods
    // ════════════════════════════════════════════════════════════

    /**
     * isTemperatureAbove HARUS return true jika suhu > threshold.
     */
    public function test_is_temperature_above_returns_true_when_exceeded(): void
    {
        $sensor = new SensorData(['temperature' => 35.00]);

        $this->assertTrue($sensor->isTemperatureAbove(30.00));
    }

    /**
     * isTemperatureAbove HARUS return false jika suhu <= threshold.
     */
    public function test_is_temperature_above_returns_false_when_equal(): void
    {
        $sensor = new SensorData(['temperature' => 30.00]);

        $this->assertFalse($sensor->isTemperatureAbove(30.00));
    }

    public function test_is_temperature_above_returns_false_when_below(): void
    {
        $sensor = new SensorData(['temperature' => 25.00]);

        $this->assertFalse($sensor->isTemperatureAbove(30.00));
    }

    /**
     * isTemperatureBelow HARUS return true jika suhu < threshold.
     */
    public function test_is_temperature_below_returns_true_when_under(): void
    {
        $sensor = new SensorData(['temperature' => 15.00]);

        $this->assertTrue($sensor->isTemperatureBelow(20.00));
    }

    /**
     * isTemperatureBelow HARUS return false jika suhu >= threshold.
     */
    public function test_is_temperature_below_returns_false_when_equal(): void
    {
        $sensor = new SensorData(['temperature' => 20.00]);

        $this->assertFalse($sensor->isTemperatureBelow(20.00));
    }

    public function test_is_temperature_below_returns_false_when_above(): void
    {
        $sensor = new SensorData(['temperature' => 25.00]);

        $this->assertFalse($sensor->isTemperatureBelow(20.00));
    }

    // ════════════════════════════════════════════════════════════
    // Humidity Comparison Methods
    // ════════════════════════════════════════════════════════════

    /**
     * isHumidityAbove HARUS return true jika kelembaban > threshold.
     */
    public function test_is_humidity_above_returns_true_when_exceeded(): void
    {
        $sensor = new SensorData(['humidity' => 95.00]);

        $this->assertTrue($sensor->isHumidityAbove(90.00));
    }

    public function test_is_humidity_above_returns_false_when_equal(): void
    {
        $sensor = new SensorData(['humidity' => 90.00]);

        $this->assertFalse($sensor->isHumidityAbove(90.00));
    }

    public function test_is_humidity_above_returns_false_when_below(): void
    {
        $sensor = new SensorData(['humidity' => 80.00]);

        $this->assertFalse($sensor->isHumidityAbove(90.00));
    }

    /**
     * isHumidityBelow HARUS return true jika kelembaban < threshold.
     */
    public function test_is_humidity_below_returns_true_when_under(): void
    {
        $sensor = new SensorData(['humidity' => 50.00]);

        $this->assertTrue($sensor->isHumidityBelow(70.00));
    }

    public function test_is_humidity_below_returns_false_when_equal(): void
    {
        $sensor = new SensorData(['humidity' => 70.00]);

        $this->assertFalse($sensor->isHumidityBelow(70.00));
    }

    public function test_is_humidity_below_returns_false_when_above(): void
    {
        $sensor = new SensorData(['humidity' => 80.00]);

        $this->assertFalse($sensor->isHumidityBelow(70.00));
    }

    // ════════════════════════════════════════════════════════════
    // Precision Edge Cases (DECIMAL vs FLOAT)
    // ════════════════════════════════════════════════════════════

    /**
     * Presisi 0.01 HARUS tetap akurat (DECIMAL, bukan float).
     */
    public function test_precision_at_001_difference(): void
    {
        $sensor = new SensorData(['temperature' => 30.01]);

        $this->assertTrue($sensor->isTemperatureAbove(30.00));
    }

    /**
     * Presisi negatif HARUS tetap akurat.
     */
    public function test_negative_temperature_comparison(): void
    {
        $sensor = new SensorData(['temperature' => -5.00]);

        $this->assertTrue($sensor->isTemperatureBelow(0.00));
        $this->assertFalse($sensor->isTemperatureAbove(0.00));
    }
}
