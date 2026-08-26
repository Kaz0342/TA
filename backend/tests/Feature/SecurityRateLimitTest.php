<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SecurityRateLimitTest — Skenario pengujian Rate Limiting (Throttle).
 *
 * Menguji bahwa:
 * 1. Endpoint IoT (POST /api/sensor-data) menerapkan throttle:20,1 (20 req/menit).
 * 2. Request ke-21 dalam 1 menit mendapat response 429 (Too Many Requests).
 * 3. Request dalam batas throttle tetap berhasil.
 *
 * @see routes/api.php → Route::middleware('throttle:20,1')
 */
class SecurityRateLimitTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Endpoint sensor-data HARUS menerapkan rate limit 20 request per menit.
     * Request ke-21 dan seterusnya HARUS dikembalikan dengan status 429.
     */
    public function test_sensor_data_rate_limited_after_20_requests(): void
    {
        $validPayload = [
            'temperature' => 28.5,
            'humidity' => 75.0,
            'device_id' => 'ESP32-RATE-TEST',
        ];

        // Kirim 20 request — semua HARUS berhasil (201/200)
        for ($i = 1; $i <= 20; $i++) {
            $response = $this->postJson('/api/sensor-data', $validPayload);

            $response->assertSuccessful();
        }

        // Request ke-21 — HARUS ditolak dengan 429 Too Many Requests
        $response = $this->postJson('/api/sensor-data', $validPayload);
        $response->assertStatus(429);
    }

    /**
     * Endpoint sprinkler-logs juga HARUS menerapkan rate limit yang sama.
     * (Satu group throttle: 'throttle:20,1')
     */
    public function test_sprinkler_logs_share_throttle_group(): void
    {
        // Habiskan kuota throttle dulu via sensor-data
        $sensorPayload = [
            'temperature' => 28.5,
            'humidity' => 75.0,
            'device_id' => 'ESP32-RATE-TEST',
        ];

        for ($i = 1; $i <= 20; $i++) {
            $this->postJson('/api/sensor-data', $sensorPayload);
        }

        // Karena throttle grup sama, sprinkler-logs juga kena limit
        $response = $this->postJson('/api/sprinkler-logs', [
            'device_id' => 'ESP32-RATE-TEST',
            'action' => 'spray',
            'trigger_type' => 'auto',
            'duration_seconds' => 30,
        ]);

        $response->assertStatus(429);
    }

    /**
     * Memastikan 429 response berisi header Retry-After yang valid.
     */
    public function test_rate_limited_response_includes_retry_after_header(): void
    {
        $validPayload = [
            'temperature' => 28.5,
            'humidity' => 75.0,
            'device_id' => 'ESP32-HEADER-TEST',
        ];

        // Habiskan kuota
        for ($i = 1; $i <= 20; $i++) {
            $this->postJson('/api/sensor-data', $validPayload);
        }

        // Request ke-21 harus punya Retry-After header
        $response = $this->postJson('/api/sensor-data', $validPayload);

        $response->assertStatus(429)
            ->assertHeader('Retry-After');
    }

    /**
     * Request di bawah limit (misalnya 5 request) HARUS tetap berhasil.
     */
    public function test_requests_within_limit_succeed(): void
    {
        $validPayload = [
            'temperature' => 28.5,
            'humidity' => 75.0,
            'device_id' => 'ESP32-NORMAL',
        ];

        // Kirim hanya 5 request — jauh di bawah limit
        for ($i = 1; $i <= 5; $i++) {
            $response = $this->postJson('/api/sensor-data', $validPayload);
            $response->assertSuccessful();
        }
    }
}
