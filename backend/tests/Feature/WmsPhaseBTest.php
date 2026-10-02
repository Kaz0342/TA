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

class WmsPhaseBTest extends TestCase
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

    public function test_legal_status_transitions(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create(['user_id' => $this->admin->id]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
            'assigned_at' => now()->toDateString(),
        ]);

        // 1. INCUBATION -> FRUITING
        $res1 = $this->patchJson("/api/batch-slot-assignments/{$assignment->id}/status", [
            'status' => BatchSlotAssignment::STATUS_FRUITING,
        ]);
        $res1->assertStatus(200)
            ->assertJsonPath('data.current_status', BatchSlotAssignment::STATUS_FRUITING);

        // 2. FRUITING -> COMPLETED
        $res2 = $this->patchJson("/api/batch-slot-assignments/{$assignment->id}/status", [
            'status' => BatchSlotAssignment::STATUS_COMPLETED,
            'reason' => 'EXHAUSTED',
        ]);
        $res2->assertStatus(200)
            ->assertJsonPath('data.current_status', BatchSlotAssignment::STATUS_COMPLETED);

        // Slot harus sudah bebas (empty)
        $this->assertFalse(Slot::find('A-01-01')->isOccupied());
    }

    public function test_illegal_status_transitions_are_rejected(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create(['user_id' => $this->admin->id]);

        // Slot 1: sudah FRUITING, coba mundur ke INCUBATION
        $assignment1 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_3',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        $res1 = $this->patchJson("/api/batch-slot-assignments/{$assignment1->id}/status", [
            'status' => BatchSlotAssignment::STATUS_INCUBATION,
        ]);
        $res1->assertStatus(422)
            ->assertJsonPath('success', false);

        // Slot 2: sudah COMPLETED, coba dihidupkan lagi ke FRUITING atau INCUBATION
        $assignment2 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-02',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_3',
            'current_status' => BatchSlotAssignment::STATUS_COMPLETED,
            'assigned_at' => now()->subDays(30)->toDateString(),
            'completed_at' => now()->toDateString(),
            'completed_reason' => 'EXHAUSTED',
        ]);

        $res2 = $this->patchJson("/api/batch-slot-assignments/{$assignment2->id}/status", [
            'status' => BatchSlotAssignment::STATUS_FRUITING,
        ]);
        $res2->assertStatus(422)
            ->assertJsonPath('success', false);

        $res3 = $this->patchJson("/api/batch-slot-assignments/{$assignment2->id}/status", [
            'status' => BatchSlotAssignment::STATUS_INCUBATION,
        ]);
        $res3->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_complete_cycle_endpoint_and_slot_can_be_reassigned(): void
    {
        Sanctum::actingAs($this->admin);

        $batch1 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 50,
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch1->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(20)->toDateString(),
        ]);

        $this->assertTrue(Slot::find('A-01-01')->isOccupied());

        // Panggil endpoint tutup siklus
        $res = $this->postJson("/api/batch-slot-assignments/{$assignment->id}/complete", [
            'reason' => 'EXHAUSTED',
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_now_empty', true);

        // Verifikasi assignment & slot
        $assignment->refresh();
        $this->assertEquals(BatchSlotAssignment::STATUS_COMPLETED, $assignment->current_status);
        $this->assertEquals('EXHAUSTED', $assignment->completed_reason);
        $this->assertEquals(0, $assignment->kapasitasAktif());
        $this->assertFalse(Slot::find('A-01-01')->isOccupied());

        // Verifikasi alokasi ulang slot yang sama oleh batch baru berhasil tanpa error!
        $batch2 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 50,
        ]);

        $reassignRes = $this->postJson('/api/batch-slot-assignments', [
            'baglog_batch_id' => $batch2->id,
            'assigned_at' => now()->toDateString(),
            'slots' => [
                [
                    'slot_code' => 'A-01-01',
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => 'LEVEL_1',
                ],
            ],
        ]);

        $reassignRes->assertStatus(201);
        $this->assertTrue(Slot::find('A-01-01')->isOccupied());
    }

    public function test_cascade_complete_when_batch_disposed_or_contaminated(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        $a1 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        $a2 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-02',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        $this->assertTrue(Slot::find('A-01-01')->isOccupied());
        $this->assertTrue(Slot::find('A-01-02')->isOccupied());

        // Ubah status batch menjadi contaminated via API
        $res = $this->patchJson("/api/baglogs/{$batch->id}/status", [
            'status' => BaglogBatch::STATUS_CONTAMINATED,
            'notes' => 'Terkontaminasi spora liar di kumbung',
        ]);

        $res->assertStatus(200);

        // Kedua assignment harus otomatis COMPLETED
        $a1->refresh();
        $a2->refresh();
        $this->assertEquals(BatchSlotAssignment::STATUS_COMPLETED, $a1->current_status);
        $this->assertEquals(BatchSlotAssignment::STATUS_COMPLETED, $a2->current_status);
        $this->assertEquals('CONTAMINATED', $a1->completed_reason);
        $this->assertEquals('CONTAMINATED', $a2->completed_reason);

        // Kedua slot langsung bebas
        $this->assertFalse(Slot::find('A-01-01')->isOccupied());
        $this->assertFalse(Slot::find('A-01-02')->isOccupied());
    }

    public function test_batch_automatically_completed_when_all_assignments_are_completed(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        $a1 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        $a2 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-02',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        // Selesaikan slot 1 -> batch harus tetap active
        $this->postJson("/api/batch-slot-assignments/{$a1->id}/complete", ['reason' => 'EXHAUSTED']);
        $batch->refresh();
        $this->assertEquals(BaglogBatch::STATUS_ACTIVE, $batch->status);

        // Selesaikan slot 2 -> semua slot batch sudah selesai -> batch otomatis completed!
        $this->postJson("/api/batch-slot-assignments/{$a2->id}/complete", ['reason' => 'EXHAUSTED']);
        $batch->refresh();
        $this->assertEquals(BaglogBatch::STATUS_COMPLETED, $batch->status);
    }
}
