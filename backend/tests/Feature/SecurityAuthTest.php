<?php

namespace Tests\Feature;

use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SecurityAuthTest — Skenario pengujian keamanan Authentication & Authorization.
 *
 * Menguji bahwa:
 * 1. Endpoint terproteksi menolak akses tanpa token (401 Unauthenticated).
 * 2. Endpoint admin-only menolak akses dari user ber-role 'worker' (403 Forbidden).
 * 3. User admin berhasil mengakses endpoint admin-only (200 OK).
 *
 * @see App\Http\Middleware\RoleCheck
 * @see routes/api.php → middleware('auth:sanctum') & middleware('role:admin')
 */
class SecurityAuthTest extends TestCase
{
    use RefreshDatabase;

    // ════════════════════════════════════════════════════════════
    // SKENARIO 1: Akses TANPA Token (Unauthenticated — 401)
    // ════════════════════════════════════════════════════════════

    /**
     * Endpoint GET /api/thresholds HARUS menolak request tanpa token Sanctum.
     */
    public function test_unauthenticated_user_cannot_access_thresholds(): void
    {
        $response = $this->getJson('/api/thresholds');

        $response->assertStatus(401);
    }

    /**
     * Endpoint PUT /api/thresholds HARUS menolak request tanpa token Sanctum.
     */
    public function test_unauthenticated_user_cannot_update_thresholds(): void
    {
        $response = $this->putJson('/api/thresholds', [
            'temp_min' => 20,
            'temp_max' => 30,
            'humidity_min' => 60,
            'humidity_max' => 90,
        ]);

        $response->assertStatus(401);
    }

    /**
     * Endpoint POST /api/baglogs HARUS menolak request tanpa token.
     */
    public function test_unauthenticated_user_cannot_create_baglog(): void
    {
        $response = $this->postJson('/api/baglogs', [
            'entry_date' => '2026-08-15',
            'quantity' => 100,
            'supplier' => 'Toko Bibit',
        ]);

        $response->assertStatus(401);
    }

    /**
     * Endpoint POST /api/sales HARUS menolak request tanpa token.
     */
    public function test_unauthenticated_user_cannot_create_sale(): void
    {
        $response = $this->postJson('/api/sales', [
            'sale_date' => '2026-08-15',
            'quantity_kg' => 10,
            'price_per_kg' => 15000,
            'buyer_name' => 'Pembeli Test',
        ]);

        $response->assertStatus(401);
    }

    /**
     * Endpoint GET /api/me HARUS menolak request tanpa token.
     */
    public function test_unauthenticated_user_cannot_access_profile(): void
    {
        $response = $this->getJson('/api/me');

        $response->assertStatus(401);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 2: Akses dengan Role SALAH (Forbidden — 403)
    // ════════════════════════════════════════════════════════════

    /**
     * Worker TIDAK BOLEH mengakses GET /api/thresholds (admin-only).
     */
    public function test_worker_cannot_access_admin_thresholds(): void
    {
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($worker, 'sanctum')
            ->getJson('/api/thresholds');

        $response->assertStatus(403)
            ->assertJsonFragment(['success' => false]);
    }

    /**
     * Worker TIDAK BOLEH mengupdate PUT /api/thresholds (admin-only).
     */
    public function test_worker_cannot_update_thresholds(): void
    {
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($worker, 'sanctum')
            ->putJson('/api/thresholds', [
                'temp_min' => 20,
                'temp_max' => 30,
                'humidity_min' => 60,
                'humidity_max' => 90,
            ]);

        $response->assertStatus(403);
    }

    /**
     * Worker TIDAK BOLEH membuat baglog baru (admin-only).
     */
    public function test_worker_cannot_create_baglog(): void
    {
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($worker, 'sanctum')
            ->postJson('/api/baglogs', [
                'entry_date' => '2026-08-15',
                'quantity' => 100,
                'supplier' => 'Test Supplier',
            ]);

        $response->assertStatus(403);
    }

    /**
     * Worker TIDAK BOLEH membuat penjualan baru (admin-only).
     */
    public function test_worker_cannot_create_sale(): void
    {
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($worker, 'sanctum')
            ->postJson('/api/sales', [
                'sale_date' => '2026-08-15',
                'quantity_kg' => 5,
                'price_per_kg' => 15000,
                'buyer_name' => 'Worker Nakal',
            ]);

        $response->assertStatus(403);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 3: Akses dengan Role BENAR (Success — 200)
    // ════════════════════════════════════════════════════════════

    /**
     * Admin HARUS bisa mengakses GET /api/thresholds.
     */
    public function test_admin_can_access_thresholds(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        // Seed data threshold aktif (controller return 404 jika belum ada)
        ThresholdSetting::create([
            'user_id' => $admin->id,
            'temp_min' => 20,
            'temp_max' => 30,
            'humidity_min' => 70,
            'humidity_max' => 90,
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/thresholds');

        $response->assertStatus(200)
            ->assertJsonFragment(['success' => true]);
    }

    /**
     * Admin HARUS bisa mengakses GET /api/me.
     */
    public function test_authenticated_user_can_access_profile(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/me');

        $response->assertStatus(200)
            ->assertJsonFragment(['success' => true]);
    }

    /**
     * Worker HARUS bisa mengakses GET /api/baglogs (read-only allowed).
     */
    public function test_worker_can_read_baglogs(): void
    {
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($worker, 'sanctum')
            ->getJson('/api/baglogs');

        $response->assertStatus(200);
    }

    /**
     * Worker HARUS bisa membuat record panen (POST /api/harvests).
     */
    public function test_worker_can_create_harvest(): void
    {
        $worker = User::factory()->create(['role' => User::ROLE_WORKER]);

        $response = $this->actingAs($worker, 'sanctum')
            ->postJson('/api/harvests', [
                'harvest_date' => '2026-08-15',
                'weight_kg' => 5.5,
            ]);

        // 201 Created (berhasil) atau 200
        $response->assertSuccessful();
    }
}
