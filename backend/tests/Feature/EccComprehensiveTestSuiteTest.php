<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
use App\Models\Harvest;
use App\Models\Sale;
use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * EccComprehensiveTestSuiteTest
 *
 * Test suite komprehensif berstandar ECC (Engineering/Coding Companion):
 * 1. Positive Tests (Happy path, bisnis logic normal, validasi decimal, preset 1-klik)
 * 2. Negative Tests (Boundary testing, validasi error 422, otorisasi RBAC 401 & 403)
 * 3. Chaos & Absurd Tests ("Test Ga Masuk Akal", input ekstrem, XSS, SQLi, floating-point traps)
 *
 * Mengikuti standar AAA (Arrange - Act - Assert) sesuai ECC rules/common/testing.md.
 */
class EccComprehensiveTestSuiteTest extends TestCase
{
    use RefreshDatabase;

    // ══════════════════════════════════════════════════════════════════
    // BAGIAN 1: POSITIVE TESTS (Happy Path & Skenario Normal)
    // ══════════════════════════════════════════════════════════════════

    /**
     * [Positive Auth] Admin dapat login dengan kredensial valid dan menerima Bearer token.
     */
    public function test_positive_auth_admin_login_success(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create([
            'email' => 'admin@smartshroom.test',
            'password' => bcrypt('password123'),
        ]);

        // Act
        $response = $this->postJson('/api/login', [
            'email' => 'admin@smartshroom.test',
            'password' => 'password123',
        ]);

        // Assert
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.role', 'admin')
            ->assertJsonStructure(['data' => ['token', 'user']]);
    }

    /**
     * [Positive Auth] Worker dapat login dengan kredensial valid dan role worker.
     */
    public function test_positive_auth_worker_login_success(): void
    {
        // Arrange
        $worker = User::factory()->create([
            'email' => 'worker@smartshroom.test',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_WORKER,
        ]);

        // Act
        $response = $this->postJson('/api/login', [
            'email' => 'worker@smartshroom.test',
            'password' => 'password123',
        ]);

        // Assert
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.role', 'worker');
    }

    /**
     * [Positive Preset] Admin menerapkan Preset Fase Inkubasi (26-30°C, 60-70%).
     */
    public function test_positive_threshold_apply_preset_incubation(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => 26.00,
            'temp_max' => 30.00,
            'humidity_min' => 60.00,
            'humidity_max' => 70.00,
            'phase_mode' => 'incubation',
        ]);

        // Assert
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.phase_mode', 'incubation');

        $this->assertDatabaseHas('threshold_settings', [
            'phase_mode' => 'incubation',
            'temp_min' => '26.00',
            'temp_max' => '30.00',
        ]);
    }

    /**
     * [Positive Preset] Admin menerapkan Preset Fase Primordia (24-28°C, 85-90%).
     */
    public function test_positive_threshold_apply_preset_primordia(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => 24.00,
            'temp_max' => 28.00,
            'humidity_min' => 85.00,
            'humidity_max' => 90.00,
            'phase_mode' => 'primordia',
        ]);

        // Assert
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.phase_mode', 'primordia');
    }

    /**
     * [Positive Preset] Admin menerapkan Preset Fase Fruiting (24-32°C, 85-95%).
     */
    public function test_positive_threshold_apply_preset_fruiting(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => 24.00,
            'temp_max' => 32.00,
            'humidity_min' => 85.00,
            'humidity_max' => 95.00,
            'phase_mode' => 'fruiting',
        ]);

        // Assert
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.phase_mode', 'fruiting');
    }

    /**
     * [Positive IoT] Perangkat IoT (ESP32/Simulator) dapat membaca threshold aktif tanpa login.
     */
    public function test_positive_threshold_public_iot_active_read(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();
        ThresholdSetting::create([
            'user_id' => $admin->id,
            'temp_min' => 24.00,
            'temp_max' => 32.00,
            'humidity_min' => 85.00,
            'humidity_max' => 95.00,
            'phase_mode' => 'fruiting',
            'is_active' => true,
        ]);

        // Act
        $response = $this->getJson('/api/thresholds/active');

        // Assert
        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.phase_mode', 'fruiting')
            ->assertJsonPath('data.is_active', true);
    }

    /**
     * [Positive Baglog] Admin dapat membuat batch baglog baru dengan batch_code otomatis.
     */
    public function test_positive_baglog_create_valid_batch(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/baglogs', [
            'entry_date' => '2026-09-10',
            'quantity' => 500,
            'supplier' => 'CV Jamur Makmur Sentosa',
            'notes' => 'Batch baru kualitas bibit F2 premium',
        ]);

        // Assert
        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quantity', 500)
            ->assertJsonPath('data.supplier', 'CV Jamur Makmur Sentosa');

        $this->assertDatabaseHas('baglog_batches', [
            'supplier' => 'CV Jamur Makmur Sentosa',
            'quantity' => 500,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);
    }

    /**
     * [Positive Harvest] Worker dapat mencatat panen jamur pada batch aktif.
     */
    public function test_positive_harvest_worker_can_record_harvest(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);
        $batch = BaglogBatch::factory()->create([
            'user_id' => $admin->id,
            'status' => BaglogBatch::STATUS_ACTIVE,
            'quantity' => 300,
        ]);

        // Act
        $response = $this->actingAs($worker, 'sanctum')->postJson('/api/harvests', [
            'harvest_date' => '2026-09-10',
            'weight_kg' => 7.25,
            'baglog_batch_id' => $batch->id,
            'notes' => 'Panen pagi hari pertama',
        ]);

        // Assert
        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.weight_kg', '7.25');

        $this->assertDatabaseHas('harvests', [
            'baglog_batch_id' => $batch->id,
            'weight_kg' => '7.25',
        ]);
    }

    /**
     * [Positive Sales] Admin mencatat penjualan dengan akurasi Decimal (BCMath) tanpa floating-point bug.
     */
    public function test_positive_sales_decimal_revenue_calculation(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act: 12.5 Kg @ Rp 24.500 = Rp 306.250,00 tepat
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/sales', [
            'sale_date' => '2026-09-10',
            'quantity_kg' => 12.50,
            'price_per_kg' => 24500,
            'buyer_name' => 'Resto Jamur Nusantara',
            'notes' => 'Pembayaran tunai',
        ]);

        // Assert
        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_revenue', '306250.00');

        $this->assertDatabaseHas('sales', [
            'buyer_name' => 'Resto Jamur Nusantara',
            'total_revenue' => '306250.00',
        ]);
    }

    /**
     * [Positive IoT] Ingest data sensor berhasil disimpan ke database.
     */
    public function test_positive_iot_sensor_data_ingestion(): void
    {
        // Arrange & Act
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 27.50,
            'humidity' => 88.00,
            'co2_level' => 450.00,
            'light_intensity' => 200.00,
            'device_id' => 'ESP32-KUMBUNG-01',
            'recorded_at' => now()->toIso8601String(),
        ]);

        // Assert
        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sensor_data.temperature', '27.50')
            ->assertJsonPath('data.sensor_data.humidity', '88.00');
    }

    /**
     * [Positive IoT] Ingest log aktuator (misting & fan) dengan durasi dan pemicu berhasil disimpan.
     */
    public function test_positive_iot_actuator_misting_and_fan_logs(): void
    {
        // Arrange & Act: Misting Log
        $resMisting = $this->postJson('/api/sprinkler-logs', [
            'device_id' => 'ESP32-KUMBUNG-01',
            'actuator' => 'misting',
            'started_at' => now()->subSeconds(45)->toIso8601String(),
            'duration_seconds' => 45,
            'trigger_reason' => 'Kelembaban Rendah (82.4% < 85.0%)',
            'stop_reason' => 'Target tercapai (RH:89.0% T:27.5°C)',
        ]);

        // Assert
        $resMisting->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.actuator', 'misting')
            ->assertJsonPath('data.duration_seconds', 45);

        // Arrange & Act: Fan Log
        $resFan = $this->postJson('/api/sprinkler-logs', [
            'device_id' => 'ESP32-KUMBUNG-01',
            'actuator' => 'fan',
            'started_at' => now()->subSeconds(90)->toIso8601String(),
            'duration_seconds' => 90,
            'trigger_reason' => 'Suhu Panas (29.5°C > 28.0°C)',
            'stop_reason' => 'Suhu normal (27.8°C <= 28.0°C)',
        ]);

        // Assert
        $resFan->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.actuator', 'fan');
    }

    // ══════════════════════════════════════════════════════════════════
    // BAGIAN 2: NEGATIVE TESTS (Boundary, Validasi & Hak Akses)
    // ══════════════════════════════════════════════════════════════════

    /**
     * [Negative Auth] Login dengan password salah ditolak (401).
     */
    public function test_negative_auth_login_invalid_password(): void
    {
        // Arrange
        User::factory()->create([
            'email' => 'admin@smartshroom.test',
            'password' => bcrypt('password123'),
        ]);

        // Act
        $response = $this->postJson('/api/login', [
            'email' => 'admin@smartshroom.test',
            'password' => 'password_ngaco_salah',
        ]);

        // Assert
        $response->assertStatus(401)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Email atau password salah');
    }

    /**
     * [Negative RBAC] Worker DILARANG mengubah konfigurasi threshold (403 Forbidden).
     */
    public function test_negative_rbac_worker_cannot_update_thresholds(): void
    {
        // Arrange
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        // Act
        $response = $this->actingAs($worker, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => 24.00,
            'temp_max' => 30.00,
            'humidity_min' => 80.00,
            'humidity_max' => 90.00,
        ]);

        // Assert
        $response->assertStatus(403);
    }

    /**
     * [Negative RBAC] Worker DILARANG membuat batch baglog baru (403 Forbidden).
     */
    public function test_negative_rbac_worker_cannot_create_baglog(): void
    {
        // Arrange
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        // Act
        $response = $this->actingAs($worker, 'sanctum')->postJson('/api/baglogs', [
            'entry_date' => '2026-09-10',
            'quantity' => 100,
            'supplier' => 'Toko Tani',
        ]);

        // Assert
        $response->assertStatus(403);
    }

    /**
     * [Negative RBAC] Worker DILARANG mencatat penjualan keuangan (403 Forbidden).
     */
    public function test_negative_rbac_worker_cannot_create_sale(): void
    {
        // Arrange
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        // Act
        $response = $this->actingAs($worker, 'sanctum')->postJson('/api/sales', [
            'sale_date' => '2026-09-10',
            'quantity_kg' => 5.0,
            'price_per_kg' => 25000,
            'buyer_name' => 'Tengkulak',
        ]);

        // Assert
        $response->assertStatus(403);
    }

    /**
     * [Negative Boundary] Batas atas suhu lebih kecil dari batas bawah (temp_max < temp_min) ditolak (422).
     */
    public function test_negative_threshold_inverted_temperature_bounds(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act: temp_min 30, temp_max 20 (logika terbalik)
        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => 30.00,
            'temp_max' => 20.00,
            'humidity_min' => 80.00,
            'humidity_max' => 90.00,
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonValidationErrors(['temp_max']);
    }

    /**
     * [Negative Boundary] Batas atas kelembaban lebih kecil dari batas bawah ditolak (422).
     */
    public function test_negative_threshold_inverted_humidity_bounds(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act: humidity_min 90, humidity_max 70
        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => 24.00,
            'temp_max' => 30.00,
            'humidity_min' => 90.00,
            'humidity_max' => 70.00,
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonValidationErrors(['humidity_max']);
    }

    /**
     * [Negative Validation] Panen dengan berat negatif atau nol ditolak (422).
     */
    public function test_negative_harvest_negative_weight(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/harvests', [
            'harvest_date' => '2026-09-10',
            'weight_kg' => -5.00,
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['weight_kg']);
    }

    /**
     * [Negative Validation] Penjualan dengan harga negatif ditolak (422).
     */
    public function test_negative_sale_negative_price(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/sales', [
            'sale_date' => '2026-09-10',
            'quantity_kg' => 10.00,
            'price_per_kg' => -25000,
            'buyer_name' => 'Pembeli',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['price_per_kg']);
    }

    // ══════════════════════════════════════════════════════════════════
    // BAGIAN 3: "TEST YANG GA MASUK AKAL" (Chaos, Injeksi & Edge Cases)
    // ══════════════════════════════════════════════════════════════════

    /**
     * [Chaos Numerik] Input suhu dan kelembaban di luar batas fisika bumi ditolak tegas (422).
     * Contoh: Suhu 1.000.000°C atau -999°C, Kelembaban 500% atau -100%.
     */
    public function test_chaos_threshold_extreme_astronomical_numbers(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act: Suhu matahari & kelembaban planet asing
        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => -99999.00,
            'temp_max' => 1000000.00,
            'humidity_min' => -500.00,
            'humidity_max' => 99999.00,
        ]);

        // Assert: Framework boundary harus menolak tanpa meledakkan database
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temp_min', 'temp_max', 'humidity_min', 'humidity_max']);
    }

    /**
     * [Chaos Type Juggling] Mengirim string gaul / emoji ke parameter numerik ditolak (422).
     */
    public function test_chaos_threshold_string_and_emoji_injection(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/thresholds', [
            'temp_min' => 'dingin_banget_skena',
            'temp_max' => '🍄🔥',
            'humidity_min' => 'becek_ngab',
            'humidity_max' => 'NaN',
            'phase_mode' => 'super_saiyan_phase',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'phase_mode']);
    }

    /**
     * [Chaos Integer Overflow] Jumlah baglog 999 triliun dicegat agar tidak merusak kolom database (422).
     */
    public function test_chaos_baglog_integer_overflow_attempt(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/baglogs', [
            'entry_date' => '2026-09-10',
            'quantity' => '99999999999999999999999999999999',
            'supplier' => 'UD Baglog Tak Hingga',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['quantity']);
    }

    /**
     * [Chaos Security XSS] Serangan XSS pada nama supplier dan catatan baglog tidak dieksekusi.
     */
    public function test_chaos_xss_injection_in_supplier_and_notes(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();
        $xssPayload = "<script>alert('Pwned By Hacker');</script><img src=x onerror=alert(1)>";

        // Act
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/baglogs', [
            'entry_date' => '2026-09-10',
            'quantity' => 200,
            'supplier' => 'Toko Aman ' . $xssPayload,
            'notes' => $xssPayload,
        ]);

        // Assert: Data tersimpan aman sebagai string literal, bukan script executable
        $response->assertStatus(201);
        $this->assertDatabaseHas('baglog_batches', [
            'quantity' => 200,
            'supplier' => 'Toko Aman ' . $xssPayload,
        ]);
        
        // Verifikasi pembacaan API aman dalam representasi JSON (literal string)
        $readRes = $this->actingAs($admin, 'sanctum')->getJson('/api/baglogs');
        $readRes->assertStatus(200)
            ->assertJsonFragment([
                'supplier' => 'Toko Aman ' . $xssPayload,
            ]);
    }

    /**
     * [Chaos Security SQLi] Serangan SQL Injection klasik pada nama pembeli penjualan.
     */
    public function test_chaos_sqli_attack_in_buyer_name(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();
        $sqliPayload = "Pak Budi' OR '1'='1'; DROP TABLE users; --";

        // Act
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/sales', [
            'sale_date' => '2026-09-10',
            'quantity_kg' => 10.0,
            'price_per_kg' => 25000,
            'buyer_name' => $sqliPayload,
        ]);

        // Assert: Tabel users TIDAK BOLEH terhapus dan query berhasil tanpa celah SQLi
        $response->assertStatus(201);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('sales', ['buyer_name' => $sqliPayload]);
    }

    /**
     * [Chaos Floating-Point Trap] Penjualan dengan pecahan desimal rumit (0.1 + 0.2 precision test).
     * Memastikan sistem tidak terkena IEEE 754 float precision error (misal 0.30000000000000004).
     */
    public function test_chaos_decimal_floating_point_precision_trap(): void
    {
        // Arrange
        $admin = User::factory()->admin()->create();

        // Act: 3.33 Kg @ Rp 33.333,00 = Rp 110.998,89 (dihitung presisi Decimal)
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/sales', [
            'sale_date' => '2026-09-10',
            'quantity_kg' => 3.33,
            'price_per_kg' => 33333,
            'buyer_name' => 'Kolektor Pecahan Presisi',
        ]);

        // Assert: bcmul(3.33, 33333, 2) = 110998.89
        $response->assertStatus(201)
            ->assertJsonPath('data.total_revenue', '110998.89');
    }

    /**
     * [Chaos Privilege Escalation & Quota] Percobaan mendaftarkan akun Admin kedua saat kuota penuh
     * dinetralisir: penyerang TIDAK BISA menjadi admin (otomatis di-force jadi worker),
     * dan jika kuota worker (5) penuh, pendaftaran diblokir dengan 422.
     */
    public function test_chaos_admin_quota_privilege_escalation(): void
    {
        // Arrange: Sudah ada 1 Admin
        User::factory()->admin()->create([
            'email' => 'admin.pertama@smartshroom.test',
        ]);

        // Act 1: Hacker mencoba register akun baru dengan menyisipkan role=admin
        $response = $this->postJson('/api/register', [
            'name' => 'Hacker Mau Jadi Admin',
            'email' => 'hacker@smartshroom.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => User::ROLE_ADMIN,
        ]);

        // Assert 1: User berhasil dibuat tapi rolenya WAJIB dinetralisir jadi 'worker', bukan 'admin'
        $response->assertStatus(201)
            ->assertJsonPath('data.user.role', 'worker');

        $this->assertDatabaseHas('users', [
            'email' => 'hacker@smartshroom.test',
            'role' => 'worker',
        ]);

        // Act 2: Buat 4 worker lagi sehingga kuota worker (5) penuh
        User::factory()->count(4)->create(['role' => User::ROLE_WORKER]);

        // Act 3: Coba daftar user ke-6 saat kuota penuh
        $resFull = $this->postJson('/api/register', [
            'name' => 'Worker Ke-6',
            'email' => 'worker6@smartshroom.test',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        // Assert 3: Ditolak dengan 422 (Kuota pekerja telah tercapai)
        $resFull->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    /**
     * [Chaos IoT Absurdity] Sensor IoT mengirim suhu magma gunung berapi (5000°C).
     */
    public function test_chaos_sensor_temperature_exceeding_physical_limits(): void
    {
        // Arrange & Act
        $response = $this->postJson('/api/sensor-data', [
            'temperature' => 5000.0,
            'humidity' => -50.0,
            'device_id' => 'ESP32-CHAOS',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temperature', 'humidity']);
    }
}
