<?php

namespace Tests\Feature;

use App\Models\SensorData;
use App\Models\SprinklerLog;
use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase5IotRuleEngineTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $worker;
    private ThresholdSetting $activeThreshold;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
        $this->worker = User::factory()->create();

        // Preset threshold optimal jamur kuping (Fruiting)
        $this->activeThreshold = ThresholdSetting::create([
            'user_id' => $this->admin->id,
            'temp_min' => 24.00,
            'temp_max' => 32.00,
            'humidity_min' => 85.00,
            'humidity_max' => 95.00,
            'phase_mode' => 'fruiting',
            'is_active' => true,
        ]);

        Cache::flush();
    }

    /**
     * Test 1: Ingesti data sensor IoT (POST /api/sensor-data) dengan presisi DECIMAL(5,2).
     */
    public function test_sensor_data_ingestion_with_decimal_precision(): void
    {
        $payload = [
            'device_id' => 'ESP32-KUMBUNG-01',
            'temperature' => 27.45,
            'humidity' => 88.60,
            'co2_level' => 485.20,
            'light_intensity' => 125.00,
            'recorded_at' => now()->toIso8601String(),
        ];

        $response = $this->postJson('/api/sensor-data', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sensor_data.device_id', 'ESP32-KUMBUNG-01');

        $this->assertDatabaseHas('sensor_data', [
            'device_id' => 'ESP32-KUMBUNG-01',
            'temperature' => 27.45,
            'humidity' => 88.60,
        ]);
    }

    /**
     * Test 2: Ingesti log aktuator (Misting & Fan) dari ESP32 (POST /api/sprinkler-logs).
     */
    public function test_actuator_logs_ingestion_misting_and_fan(): void
    {
        // 1. Log Pompa Misting
        $mistingPayload = [
            'device_id' => 'ESP32-KUMBUNG-01',
            'actuator' => 'misting',
            'duration_seconds' => 45,
            'trigger_reason' => 'Kelembaban Rendah (82.1% < 85.0%)',
            'stop_reason' => 'Target tercapai (RH:90.2% T:27.4C)',
        ];

        $res1 = $this->postJson('/api/sprinkler-logs', $mistingPayload);
        $res1->assertStatus(201)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('sprinkler_logs', [
            'device_id' => 'ESP32-KUMBUNG-01',
            'actuator' => 'misting',
            'duration_seconds' => 45,
        ]);

        // 2. Log Exhaust Fan
        $fanPayload = [
            'device_id' => 'ESP32-KUMBUNG-01',
            'actuator' => 'fan',
            'duration_seconds' => 30,
            'trigger_reason' => 'Homogenisasi Sirkulasi (Disparitas RH 13.5% > 12.0%)',
            'stop_reason' => 'Homogenisasi selesai 30s',
        ];

        $res2 = $this->postJson('/api/sprinkler-logs', $fanPayload);
        $res2->assertStatus(201);

        $this->assertDatabaseHas('sprinkler_logs', [
            'device_id' => 'ESP32-KUMBUNG-01',
            'actuator' => 'fan',
            'duration_seconds' => 30,
        ]);
    }

    /**
     * Test 3: Endpoint threshold aktif (GET /api/thresholds/active) sinkron dengan ESP32.
     */
    public function test_active_threshold_endpoint_structure(): void
    {
        $response = $this->getJson('/api/thresholds/active');

        $response->assertStatus(200)
            ->assertJsonPath('data.temp_min', '24.00')
            ->assertJsonPath('data.temp_max', '32.00')
            ->assertJsonPath('data.humidity_min', '85.00')
            ->assertJsonPath('data.humidity_max', '95.00')
            ->assertJsonPath('data.phase_mode', 'fruiting')
            ->assertJsonPath('data.device_command.command', 'AUTO')
            ->assertJsonPath('data.device_command.is_paused', false);
    }

    /**
     * Test 4: Rate Limiter pada endpoint publik IoT (Maks 20 request per menit).
     */
    public function test_iot_rate_limiting_enforcement(): void
    {
        // Kirim 20 request valid
        for ($i = 0; $i < 20; $i++) {
            $response = $this->postJson('/api/sensor-data', [
                'device_id' => 'ESP32-KUMBUNG-01',
                'temperature' => 26.50,
                'humidity' => 88.00,
            ]);
            $response->assertStatus(201);
        }

        // Request ke-21 harus diblokir oleh throttle:20,1
        $blockedResponse = $this->postJson('/api/sensor-data', [
            'device_id' => 'ESP32-KUMBUNG-01',
            'temperature' => 26.50,
            'humidity' => 88.00,
        ]);

        $blockedResponse->assertStatus(429);
    }

    /**
     * Test 5: Pengambilan data sensor terkini (GET /api/sensor-data/latest).
     */
    public function test_sensor_data_latest_endpoint(): void
    {
        Sanctum::actingAs($this->worker);

        SensorData::create([
            'device_id' => 'ESP32-KUMBUNG-01',
            'temperature' => 28.20,
            'humidity' => 89.10,
            'co2_level' => 450,
            'recorded_at' => now()->subMinute(),
        ]);

        $latestData = SensorData::create([
            'device_id' => 'ESP32-KUMBUNG-01',
            'temperature' => 27.80,
            'humidity' => 90.50,
            'co2_level' => 460,
            'recorded_at' => now(),
        ]);

        $response = $this->getJson('/api/sensor-data/latest');

        $response->assertStatus(200)
            ->assertJsonPath('data.temperature', '27.80')
            ->assertJsonPath('data.humidity', '90.50');
    }

    /**
     * Test 6: Integrasi Device Control Command (PAUSE & RESUME) dengan respons threshold.
     */
    public function test_device_control_and_threshold_command_sync(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Pause selama 1 jam (3600s)
        $pauseRes = $this->postJson('/api/device/pause', [
            'duration_seconds' => 3600,
            'reason' => 'Panen Batch C',
        ]);
        $pauseRes->assertStatus(200);

        // 2. Cek endpoint thresholds/active — command harus PAUSE
        $threshRes = $this->getJson('/api/thresholds/active');
        $threshRes->assertStatus(200)
            ->assertJsonPath('data.device_command.command', 'PAUSE')
            ->assertJsonPath('data.device_command.is_paused', true)
            ->assertJsonPath('data.device_command.duration_seconds', 3600);

        // 3. Resume kembali ke AUTO
        $resumeRes = $this->postJson('/api/device/resume');
        $resumeRes->assertStatus(200);

        // 4. Cek endpoint thresholds/active — command kembali ke AUTO
        $threshRes2 = $this->getJson('/api/thresholds/active');
        $threshRes2->assertStatus(200)
            ->assertJsonPath('data.device_command.command', 'AUTO')
            ->assertJsonPath('data.device_command.is_paused', false);
    }
}
