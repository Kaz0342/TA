<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
use App\Models\BatchSlotAssignment;
use App\Models\Slot;
use App\Models\User;
use Database\Seeders\SlotSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RackManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $worker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SlotSeeder::class);

        $this->admin = User::factory()->admin()->create();
        $this->worker = User::factory()->create(['role' => User::ROLE_WORKER]);
    }

    public function test_authenticated_user_can_list_racks(): void
    {
        Sanctum::actingAs($this->worker);

        $response = $this->getJson('/api/racks');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.row', 'A')
            ->assertJsonPath('data.0.total_slots', 100)
            ->assertJsonPath('data.1.row', 'B')
            ->assertJsonPath('data.2.row', 'C');
    }

    public function test_admin_cannot_create_rack_beyond_physical_capacity(): void
    {
        Sanctum::actingAs($this->admin);

        // Kumbung sudah penuh (A, B, C = 300 slot / 3000 baglog)
        $response = $this->postJson('/api/racks', [
            'row' => 'D',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
        $this->assertStringContainsString('Kapasitas kumbung telah mencapai batas maksimal', $response->json('message'));
    }

    public function test_admin_can_auto_assign_missing_alphabet_letter(): void
    {
        Sanctum::actingAs($this->admin);

        // Hapus Rak C sehingga tersisa A dan B
        $this->deleteJson('/api/racks/C')->assertOk();
        $this->assertEquals(200, Slot::count());

        // Tidak mengirimkan 'row', harusnya otomatis dapat 'C' dari allowed_rows
        $response = $this->postJson('/api/racks');

        $response->assertCreated()
            ->assertJsonPath('data.row', 'C')
            ->assertJsonPath('data.slots_created', 100);

        $this->assertEquals(300, Slot::count());

        // Panggil lagi saat kapasitas sudah penuh (A, B, C terpasang), harus ditolak 422
        $response2 = $this->postJson('/api/racks');
        $response2->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_worker_cannot_create_or_delete_rack(): void
    {
        Sanctum::actingAs($this->worker);

        $this->postJson('/api/racks', ['row' => 'B'])
            ->assertForbidden();

        $this->deleteJson('/api/racks/C')
            ->assertForbidden();
    }

    public function test_cannot_create_duplicate_rack(): void
    {
        Sanctum::actingAs($this->admin);

        // Hapus Rak C agar slot tersisa 200 dan kuota rak masih ada
        $this->deleteJson('/api/racks/C')->assertOk();

        // Coba buat Rak A yang sudah ada
        $response = $this->postJson('/api/racks', ['row' => 'A']);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
        $this->assertStringContainsString('Rak A sudah ada', $response->json('message'));
    }

    public function test_cannot_create_rack_outside_allowed_rows(): void
    {
        Sanctum::actingAs($this->admin);

        // Hapus Rak C agar slot tersisa 200
        $this->deleteJson('/api/racks/C')->assertOk();

        // Coba buat Rak D atau Z (di luar A, B, C)
        $response = $this->postJson('/api/racks', ['row' => 'D']);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
        $this->assertStringContainsString('tidak diizinkan', $response->json('message'));
    }

    public function test_admin_can_delete_empty_rack_and_recreate(): void
    {
        Sanctum::actingAs($this->admin);

        // Hapus Rak C
        $response = $this->deleteJson('/api/racks/C');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.deleted_slots', 100);

        $this->assertEquals(200, Slot::count());
        $this->assertFalse(Slot::where('row', 'C')->exists());

        // Buat ulang Rak C
        $respCreate = $this->postJson('/api/racks', ['row' => 'C']);
        $respCreate->assertCreated()
            ->assertJsonPath('data.row', 'C')
            ->assertJsonPath('data.slots_created', 100)
            ->assertJsonPath('data.total_capacity', 1000);

        $this->assertEquals(300, Slot::count());
        $this->assertTrue(Slot::where('slot_code', 'C-01-01')->exists());
        $this->assertTrue(Slot::where('slot_code', 'C-10-10')->exists());
    }

    public function test_admin_cannot_delete_rack_with_active_assignments(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->toDateString(),
            'quantity' => 100,
        ]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'INCUBATION',
            'assigned_at' => now(),
        ]);

        // Coba hapus Rak A yang sedang ada penempatan
        $response = $this->deleteJson('/api/racks/A');

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertTrue(Slot::where('row', 'A')->exists());
    }

    public function test_dashboard_stats_reflects_updated_total_kumbung_capacity(): void
    {
        Sanctum::actingAs($this->admin);

        // Cek awal 3000 kapasitas
        $res1 = $this->getJson('/api/dashboard/stats');
        $res1->assertOk()
            ->assertJsonPath('data.total_kumbung_capacity', 3000)
            ->assertJsonPath('data.total_slots_count', 300);

        // Hapus Rak C (-1000 kapasitas)
        $this->deleteJson('/api/racks/C')->assertOk();

        // Cek lagi, harusnya 2000
        $res2 = $this->getJson('/api/dashboard/stats');
        $res2->assertOk()
            ->assertJsonPath('data.total_kumbung_capacity', 2000)
            ->assertJsonPath('data.total_slots_count', 200);

        // Pasang kembali Rak C (+1000 kapasitas)
        $this->postJson('/api/racks', ['row' => 'C'])->assertCreated();

        $res3 = $this->getJson('/api/dashboard/stats');
        $res3->assertOk()
            ->assertJsonPath('data.total_kumbung_capacity', 3000)
            ->assertJsonPath('data.total_slots_count', 300);
    }
}
