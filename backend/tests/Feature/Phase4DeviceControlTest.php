<?php

namespace Tests\Feature;

use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase4DeviceControlTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $worker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        $this->worker = User::factory()->create();

        ThresholdSetting::factory()->create([
            'user_id' => $this->admin->id,
            'is_active' => true,
        ]);

        Cache::flush();
    }

    /**
     * Test default device status saat boot (AUTO).
     */
    public function test_default_device_status_is_auto(): void
    {
        $response = $this->getJson('/api/device/command');
        $response->assertStatus(200)
            ->assertJsonPath('data.command', 'AUTO')
            ->assertJsonPath('data.is_paused', false);

        // Threshold active endpoint juga include command
        $threshResponse = $this->getJson('/api/thresholds/active');
        $threshResponse->assertStatus(200)
            ->assertJsonPath('data.device_command.command', 'AUTO');
    }

    /**
     * Test pause mode dengan preset durasi (misal 2 Jam = 7200s).
     */
    public function test_pause_mode_activation(): void
    {
        Sanctum::actingAs($this->worker);

        $response = $this->postJson('/api/device/pause', [
            'duration_seconds' => 7200,
            'reason' => 'Panen Raya Jamur Kuping Lorong B',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.command', 'PAUSE')
            ->assertJsonPath('data.is_paused', true)
            ->assertJsonPath('data.duration_seconds', 7200);

        $this->assertGreaterThan(7100, $response->json('data.remaining_seconds'));

        // Cek log aktuator tercatat di database
        $this->assertDatabaseHas('sprinkler_logs', [
            'actuator' => 'system',
            'duration_seconds' => 7200,
        ]);

        // Cek bahwa ESP32 saat fetch threshold dapat perintah PAUSE
        $threshResponse = $this->getJson('/api/thresholds/active');
        $threshResponse->assertStatus(200)
            ->assertJsonPath('data.device_command.command', 'PAUSE')
            ->assertJsonPath('data.device_command.is_paused', true);
    }

    /**
     * Test resume mode untuk mengakhiri jeda seketika dan kembali ke AUTO.
     */
    public function test_resume_mode_deactivation(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Pause dulu
        $this->postJson('/api/device/pause', [
            'duration_seconds' => 14400,
            'reason' => 'Pembersihan kumbung',
        ]);

        // 2. Resume seketika
        $resumeResponse = $this->postJson('/api/device/resume');
        $resumeResponse->assertStatus(200)
            ->assertJsonPath('data.command', 'AUTO')
            ->assertJsonPath('data.is_paused', false);

        // Cek di threshold active sudah bersih
        $threshResponse = $this->getJson('/api/thresholds/active');
        $threshResponse->assertStatus(200)
            ->assertJsonPath('data.device_command.command', 'AUTO');
    }

    /**
     * Test validasi batas durasi pause: min 60s, max 28800s (8 jam).
     */
    public function test_pause_mode_duration_validation_boundaries(): void
    {
        Sanctum::actingAs($this->worker);

        // 1. Kurang dari 60 detik -> 422
        $resTooShort = $this->postJson('/api/device/pause', [
            'duration_seconds' => 59,
        ]);
        $resTooShort->assertStatus(422)
            ->assertJsonValidationErrors(['duration_seconds']);

        // 2. Lebih dari 8 jam (28801 detik) -> 422
        $resTooLong = $this->postJson('/api/device/pause', [
            'duration_seconds' => 28801,
        ]);
        $resTooLong->assertStatus(422)
            ->assertJsonValidationErrors(['duration_seconds']);

        // 3. Tepat 8 jam (28800 detik) -> 200
        $resExactMax = $this->postJson('/api/device/pause', [
            'duration_seconds' => 28800,
            'reason' => 'Maksimal 8 Jam',
        ]);
        $resExactMax->assertStatus(200)
            ->assertJsonPath('data.duration_seconds', 28800);
    }

    /**
     * Test persistensi state pause saat menggunakan database cache driver (F-04).
     */
    public function test_pause_mode_persistence_with_database_cache_driver(): void
    {
        Sanctum::actingAs($this->worker);

        config(['cache.default' => 'database']);

        $response = $this->postJson('/api/device/pause', [
            'duration_seconds' => 3600,
            'reason' => 'Test Persistensi DB Cache',
        ]);
        $response->assertStatus(200);

        // Pastikan key tersimpan di tabel cache database
        $this->assertDatabaseHas('cache', [
            'key' => config('cache.prefix') . \App\Services\DeviceControlService::CACHE_KEY,
        ]);

        // Pastikan endpoint thresholds/active bisa membaca state pause dari DB cache
        $threshResponse = $this->getJson('/api/thresholds/active');
        $threshResponse->assertStatus(200)
            ->assertJsonPath('data.device_command.command', 'PAUSE')
            ->assertJsonPath('data.device_command.is_paused', true);
    }
}
