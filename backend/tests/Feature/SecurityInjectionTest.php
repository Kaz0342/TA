<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SecurityInjectionTest — Skenario pengujian keamanan Input Validation.
 *
 * Menguji bahwa:
 * 1. Payload SQL Injection ditolak oleh FormRequest (422 Unprocessable).
 * 2. Payload XSS (script tag) ditolak oleh validasi tipe data (422).
 * 3. Payload dengan tipe data salah (string di field numerik) ditolak (422).
 * 4. Payload kosong ditolak (422).
 * 5. Payload edge-case (angka negatif, overflow) ditolak oleh rule between/min (422).
 *
 * @see App\Http\Requests\StoreSensorDataRequest
 * @see App\Http\Requests\StoreHarvestRequest
 * @see App\Http\Requests\StoreSaleRequest
 * @see App\Http\Requests\StoreBaglogRequest
 */
class SecurityInjectionTest extends TestCase
{
    use RefreshDatabase;

    // ════════════════════════════════════════════════════════════
    // TARGET: POST /api/sensor-data (Public — ESP32 Endpoint)
    // ════════════════════════════════════════════════════════════

    /**
     * SQL Injection pada field temperature HARUS ditolak (bukan numerik).
     */
    public function test_sensor_data_rejects_sql_injection_in_temperature(): void
    {
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => "' OR 1=1 --",
            'humidity' => 75,
            'device_id' => 'ESP32-001',
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['success' => false])
            ->assertJsonValidationErrors(['temperature']);
    }

    /**
     * SQL Injection pada field humidity HARUS ditolak (bukan numerik).
     */
    public function test_sensor_data_rejects_sql_injection_in_humidity(): void
    {
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 28.5,
            'humidity' => "'; DROP TABLE sensor_data; --",
            'device_id' => 'ESP32-001',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['humidity']);
    }

    /**
     * device_id melebihi max:50 karakter HARUS ditolak.
     */
    public function test_sensor_data_rejects_oversized_device_id(): void
    {
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 28.5,
            'humidity' => 75,
            'device_id' => str_repeat('A', 51), // Melebihi max:50
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['device_id']);
    }

    /**
     * XSS payload (<script>) pada device_id yang melebihi max:50 HARUS ditolak.
     */
    public function test_sensor_data_rejects_xss_in_device_id(): void
    {
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 28.5,
            'humidity' => 75,
            'device_id' => '<script>alert("xss")</script><script>document.cookie</script>',
        ]);

        // Ditolak karena melebihi max:50 karakter
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['device_id']);
    }

    /**
     * Payload kosong total HARUS ditolak.
     */
    public function test_sensor_data_rejects_empty_payload(): void
    {
        $response = $this->postJson('/api/sensor-data', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temperature', 'humidity', 'device_id']);
    }

    /**
     * Suhu di luar range (-50 s/d 100) HARUS ditolak.
     */
    public function test_sensor_data_rejects_temperature_out_of_range(): void
    {
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 999, // Jauh di luar range 100
            'humidity' => 75,
            'device_id' => 'ESP32-001',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temperature']);
    }

    /**
     * Kelembaban di luar range (0 s/d 100) HARUS ditolak.
     */
    public function test_sensor_data_rejects_humidity_out_of_range(): void
    {
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 28.5,
            'humidity' => -10, // Negatif, di luar range 0-100
            'device_id' => 'ESP32-001',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['humidity']);
    }

    /**
     * Payload valid HARUS diterima (201 Created).
     */
    public function test_sensor_data_accepts_valid_payload(): void
    {
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 28.5,
            'humidity' => 75.2,
            'device_id' => 'ESP32-001',
        ]);

        $response->assertSuccessful()
            ->assertJsonFragment(['success' => true]);
    }

    // ════════════════════════════════════════════════════════════
    // TARGET: POST /api/harvests (Auth Required — Worker/Admin)
    // ════════════════════════════════════════════════════════════

    /**
     * SQL Injection pada weight_kg panen HARUS ditolak.
     */
    public function test_harvest_rejects_sql_injection_in_weight(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/harvests', [
                'harvest_date' => '2026-08-15',
                'weight_kg' => "' OR 1=1 --",
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['weight_kg']);
    }

    /**
     * harvest_date dengan format salah HARUS ditolak.
     */
    public function test_harvest_rejects_invalid_date_format(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/harvests', [
                'harvest_date' => 'bukan-tanggal',
                'weight_kg' => 5.0,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['harvest_date']);
    }

    /**
     * weight_kg negatif (di bawah min:0.1) HARUS ditolak.
     */
    public function test_harvest_rejects_negative_weight(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/harvests', [
                'harvest_date' => '2026-08-15',
                'weight_kg' => -5,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['weight_kg']);
    }

    /**
     * weight_kg bernilai 0 (di bawah min:0.1) HARUS ditolak.
     */
    public function test_harvest_rejects_zero_weight(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/harvests', [
                'harvest_date' => '2026-08-15',
                'weight_kg' => 0,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['weight_kg']);
    }

    // ════════════════════════════════════════════════════════════
    // TARGET: POST /api/sales (Auth Required — Admin Only)
    // ════════════════════════════════════════════════════════════

    /**
     * SQL Injection pada field numerik penjualan HARUS ditolak.
     */
    public function test_sale_rejects_sql_injection_in_numeric_fields(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/sales', [
                'sale_date' => '2026-08-15',
                'quantity_kg' => "' OR 1=1 --",   // Harus numerik
                'price_per_kg' => "'; DROP TABLE sales; --", // Harus numerik
                'buyer_name' => 'Pembeli Valid',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity_kg', 'price_per_kg']);
    }

    /**
     * price_per_kg di bawah minimum (1000) HARUS ditolak.
     */
    public function test_sale_rejects_price_below_minimum(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/sales', [
                'sale_date' => '2026-08-15',
                'quantity_kg' => 5,
                'price_per_kg' => 500, // Min 1000
                'buyer_name' => 'Pembeli Test',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['price_per_kg']);
    }

    /**
     * buyer_name melebihi max:100 karakter HARUS ditolak.
     */
    public function test_sale_rejects_oversized_buyer_name(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/sales', [
                'sale_date' => '2026-08-15',
                'quantity_kg' => 5,
                'price_per_kg' => 15000,
                'buyer_name' => str_repeat('A', 101), // Melebihi max:100
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['buyer_name']);
    }

    // ════════════════════════════════════════════════════════════
    // TARGET: POST /api/baglogs (Auth Required — Admin Only)
    // ════════════════════════════════════════════════════════════

    /**
     * SQL Injection pada quantity baglog HARUS ditolak (bukan integer).
     */
    public function test_baglog_rejects_sql_injection_in_quantity(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/baglogs', [
                'entry_date' => '2026-08-15',
                'quantity' => "' UNION SELECT * FROM users --",
                'supplier' => 'Supplier Test',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    /**
     * Status baglog yang tidak ada di enum HARUS ditolak.
     */
    public function test_baglog_rejects_invalid_status_enum(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/baglogs', [
                'entry_date' => '2026-08-15',
                'quantity' => 100,
                'supplier' => 'Supplier Test',
                'status' => 'hacked_status', // Tidak ada di enum
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    // ════════════════════════════════════════════════════════════
    // TARGET: PUT /api/thresholds (Auth Required — Admin Only)
    // ════════════════════════════════════════════════════════════

    /**
     * SQL Injection pada threshold temp_min HARUS ditolak (bukan numerik).
     */
    public function test_threshold_rejects_sql_injection(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson('/api/thresholds', [
                'temp_min' => "' OR 1=1 --",
                'temp_max' => 30,
                'humidity_min' => 60,
                'humidity_max' => 90,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temp_min']);
    }

    /**
     * temp_max < temp_min HARUS ditolak (rule: gte:temp_min).
     */
    public function test_threshold_rejects_max_less_than_min(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson('/api/thresholds', [
                'temp_min' => 35,
                'temp_max' => 20, // Lebih kecil dari temp_min
                'humidity_min' => 60,
                'humidity_max' => 90,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temp_max']);
    }

    /**
     * Suhu di luar range (between:0,50) HARUS ditolak.
     */
    public function test_threshold_rejects_temperature_out_of_range(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson('/api/thresholds', [
                'temp_min' => -10,   // Di bawah 0
                'temp_max' => 60,    // Di atas 50
                'humidity_min' => 60,
                'humidity_max' => 90,
            ]);

        $response->assertStatus(422);
    }
}
