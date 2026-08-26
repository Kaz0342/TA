<?php

namespace Tests\Unit;

use App\Models\SensorData;
use App\Models\ThresholdSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ThresholdViolationTest — Unit test logika deteksi pelanggaran threshold.
 *
 * Menguji bahwa fungsi ThresholdSetting::checkViolations() menghasilkan
 * output yang benar berdasarkan data sensor yang diberikan.
 *
 * Skenario:
 * 1. Data sensor normal → tidak ada violation.
 * 2. Suhu di atas batas → violation 'temp_high' (severity: danger).
 * 3. Suhu di bawah batas → violation 'temp_low' (severity: warning).
 * 4. Kelembaban di atas batas → violation 'humidity_high' (severity: warning).
 * 5. Kelembaban di bawah batas → violation 'humidity_low' (severity: danger).
 * 6. Multiple violations (suhu & kelembaban bermasalah bersamaan).
 * 7. Edge case: data sensor tepat di batas threshold.
 *
 * @see App\Models\ThresholdSetting::checkViolations()
 * @see App\Models\SensorData (helper methods)
 */
class ThresholdViolationTest extends TestCase
{
    use RefreshDatabase;

    private ThresholdSetting $threshold;

    protected function setUp(): void
    {
        parent::setUp();

        // Threshold default: Suhu 20-30°C, Kelembaban 70-90%
        $this->threshold = ThresholdSetting::factory()->create();
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 1: Data Sensor Normal (Tidak ada pelanggaran)
    // ════════════════════════════════════════════════════════════

    /**
     * Sensor data dalam range normal HARUS menghasilkan 0 violation.
     */
    public function test_no_violations_when_sensor_data_is_normal(): void
    {
        $sensor = SensorData::factory()->create([
            'temperature' => 25.00,
            'humidity' => 80.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $this->assertEmpty($violations);
        $this->assertCount(0, $violations);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 2: Suhu Terlalu Tinggi (temp_high — danger)
    // ════════════════════════════════════════════════════════════

    /**
     * Suhu di atas temp_max (30°C) HARUS memicu violation 'temp_high'.
     */
    public function test_violation_when_temperature_exceeds_max(): void
    {
        $sensor = SensorData::factory()->hotTemperature(35.50)->create([
            'humidity' => 80.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $this->assertNotEmpty($violations);

        $tempHigh = collect($violations)->firstWhere('type', 'temp_high');
        $this->assertNotNull($tempHigh);
        $this->assertEquals('danger', $tempHigh['severity']);
        $this->assertStringContainsString('35.50', $tempHigh['message']);
        $this->assertStringContainsString('30.00', $tempHigh['message']);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 3: Suhu Terlalu Rendah (temp_low — warning)
    // ════════════════════════════════════════════════════════════

    /**
     * Suhu di bawah temp_min (20°C) HARUS memicu violation 'temp_low'.
     */
    public function test_violation_when_temperature_below_min(): void
    {
        $sensor = SensorData::factory()->coldTemperature(15.00)->create([
            'humidity' => 80.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $tempLow = collect($violations)->firstWhere('type', 'temp_low');
        $this->assertNotNull($tempLow);
        $this->assertEquals('warning', $tempLow['severity']);
        $this->assertStringContainsString('15.00', $tempLow['message']);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 4: Kelembaban Terlalu Tinggi (humidity_high — warning)
    // ════════════════════════════════════════════════════════════

    /**
     * Kelembaban di atas humidity_max (90%) HARUS memicu violation.
     */
    public function test_violation_when_humidity_exceeds_max(): void
    {
        $sensor = SensorData::factory()->highHumidity(96.50)->create([
            'temperature' => 25.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $humidityHigh = collect($violations)->firstWhere('type', 'humidity_high');
        $this->assertNotNull($humidityHigh);
        $this->assertEquals('warning', $humidityHigh['severity']);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 5: Kelembaban Terlalu Rendah (humidity_low — danger)
    // ════════════════════════════════════════════════════════════

    /**
     * Kelembaban di bawah humidity_min (70%) HARUS memicu violation.
     */
    public function test_violation_when_humidity_below_min(): void
    {
        $sensor = SensorData::factory()->lowHumidity(50.00)->create([
            'temperature' => 25.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $humidityLow = collect($violations)->firstWhere('type', 'humidity_low');
        $this->assertNotNull($humidityLow);
        $this->assertEquals('danger', $humidityLow['severity']);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 6: Multiple Violations (Suhu DAN Kelembaban bermasalah)
    // ════════════════════════════════════════════════════════════

    /**
     * Jika suhu DAN kelembaban melebihi batas, HARUS ada 2 violations.
     */
    public function test_multiple_violations_when_both_exceed(): void
    {
        $sensor = SensorData::factory()->create([
            'temperature' => 35.00, // Di atas max 30
            'humidity' => 95.00,    // Di atas max 90
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $this->assertCount(2, $violations);

        $types = collect($violations)->pluck('type')->all();
        $this->assertContains('temp_high', $types);
        $this->assertContains('humidity_high', $types);
    }

    /**
     * Jika suhu rendah DAN kelembaban rendah, HARUS ada 2 violations.
     */
    public function test_multiple_violations_when_both_below(): void
    {
        $sensor = SensorData::factory()->create([
            'temperature' => 10.00, // Di bawah min 20
            'humidity' => 50.00,    // Di bawah min 70
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $this->assertCount(2, $violations);

        $types = collect($violations)->pluck('type')->all();
        $this->assertContains('temp_low', $types);
        $this->assertContains('humidity_low', $types);
    }

    /**
     * Worst case: semua 4 parameter bermasalah (suhu tinggi, kelembaban rendah, dll)
     * seharusnya TIDAK mungkin karena suhu tidak bisa tinggi DAN rendah.
     * Tapi kalau suhu tinggi + kelembaban rendah → 2 violations.
     */
    public function test_cross_violations_temp_high_humidity_low(): void
    {
        $sensor = SensorData::factory()->create([
            'temperature' => 40.00, // Di atas max 30
            'humidity' => 50.00,    // Di bawah min 70
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $this->assertCount(2, $violations);

        $types = collect($violations)->pluck('type')->all();
        $this->assertContains('temp_high', $types);
        $this->assertContains('humidity_low', $types);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 7: Edge Case — Tepat di Batas Threshold
    // ════════════════════════════════════════════════════════════

    /**
     * Suhu tepat di batas maksimal (30°C) TIDAK boleh memicu violation.
     * Karena checkViolations pakai operator > (strictly greater than).
     */
    public function test_no_violation_when_temperature_equals_max(): void
    {
        $sensor = SensorData::factory()->create([
            'temperature' => 30.00, // Tepat di max
            'humidity' => 80.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $this->assertEmpty($violations);
    }

    /**
     * Suhu tepat di batas minimal (20°C) TIDAK boleh memicu violation.
     * Karena checkViolations pakai operator < (strictly less than).
     */
    public function test_no_violation_when_temperature_equals_min(): void
    {
        $sensor = SensorData::factory()->create([
            'temperature' => 20.00, // Tepat di min
            'humidity' => 80.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $this->assertEmpty($violations);
    }

    /**
     * Kelembaban tepat di batas (70% dan 90%) TIDAK boleh memicu violation.
     */
    public function test_no_violation_when_humidity_at_exact_boundaries(): void
    {
        // Test batas bawah
        $sensorLow = SensorData::factory()->create([
            'temperature' => 25.00,
            'humidity' => 70.00, // Tepat di min
        ]);

        $this->assertEmpty($this->threshold->checkViolations($sensorLow));

        // Test batas atas
        $sensorHigh = SensorData::factory()->create([
            'temperature' => 25.00,
            'humidity' => 90.00, // Tepat di max
        ]);

        $this->assertEmpty($this->threshold->checkViolations($sensorHigh));
    }

    /**
     * Suhu 30.01°C (0.01 di atas max) HARUS memicu violation.
     * Boundary precision test — pastikan DECIMAL tidak bikin rounding error.
     */
    public function test_violation_at_boundary_precision(): void
    {
        $sensor = SensorData::factory()->create([
            'temperature' => 30.01, // Tepat sedikit di atas max
            'humidity' => 80.00,
        ]);

        $violations = $this->threshold->checkViolations($sensor);

        $tempHigh = collect($violations)->firstWhere('type', 'temp_high');
        $this->assertNotNull($tempHigh, 'Suhu 30.01°C (di atas max 30°C) seharusnya memicu violation');
    }
}
