<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
use App\Models\BatchSlotAssignment;
use App\Models\Harvest;
use App\Models\Slot;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\SlotSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WmsPhaseATest extends TestCase
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

    // ─────────────────────────────────────────────────────────────
    // 1. W-01 & W-08 & W-11: Harvest Guards & Auto-Flush
    // ─────────────────────────────────────────────────────────────

    public function test_harvest_with_unmatched_slot_is_rejected(): void
    {
        Sanctum::actingAs($this->worker);

        $batch1 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(10)->toDateString(),
            'quantity' => 100,
        ]);
        $batch2 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(10)->toDateString(),
            'quantity' => 100,
        ]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch1->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
            'assigned_at' => now()->subDays(5)->toDateString(),
        ]);

        // Coba panen slot A-01-01 tapi mengaitkannya ke batch2
        $response = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch2->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 2.5,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['slot_code']);
    }

    public function test_harvest_before_assigned_at_is_rejected(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(10)->toDateString(),
            'quantity' => 100,
        ]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
            'assigned_at' => now()->subDays(3)->toDateString(),
        ]);

        // Tanggal panen 5 hari lalu (sebelum assigned_at)
        $response = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->subDays(5)->toDateString(),
            'weight_kg' => 2.0,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['harvest_date']);
    }

    public function test_harvest_in_the_future_is_rejected(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(10)->toDateString(),
            'quantity' => 100,
        ]);

        $response = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->addDays(1)->toDateString(),
            'weight_kg' => 2.0,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['harvest_date']);
    }

    public function test_harvest_auto_increments_flush_and_transitions_to_fruiting(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(20)->toDateString(),
            'quantity' => 100,
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        $this->assertEquals(BatchSlotAssignment::STATUS_INCUBATION, $assignment->fresh()->current_status);

        // 1. Panen pertama tanpa kirim flush_number
        $res1 = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->subDays(2)->toDateString(),
            'weight_kg' => 1.5,
        ]);
        $res1->assertStatus(201)
            ->assertJsonPath('data.flush_number', 1);

        // Status assignment otomatis transisi ke FRUITING
        $this->assertEquals(BatchSlotAssignment::STATUS_FRUITING, $assignment->fresh()->current_status);

        // 2. Panen kedua tanpa kirim flush_number -> otomatis flush 2
        $res2 = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 1.8,
        ]);
        $res2->assertStatus(201)
            ->assertJsonPath('data.flush_number', 2);
    }

    public function test_harvest_weighed_per_batch_without_slot_is_allowed(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(15)->toDateString(),
            'quantity' => 1500,
        ]);

        // Sesuai Keputusan Desain #1: penimbangan per batch di lapangan (slot_code opsional)
        $response = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 25.5,
            'quality_grade' => 'A',
            'notes' => 'Panen total kumbung batch 1',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.slot_code', null)
            ->assertJsonPath('data.weight_kg', '25.50');
    }

    public function test_harvest_rejects_exceeding_max_flush(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(30)->toDateString(),
            'quantity' => 100,
        ]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(20)->toDateString(),
        ]);

        // Simulasikan sudah panen sampai flush 7
        for ($i = 1; $i <= 7; $i++) {
            Harvest::create([
                'user_id' => $this->worker->id,
                'baglog_batch_id' => $batch->id,
                'slot_code' => 'A-01-01',
                'harvest_date' => now()->subDays(8 - $i)->toDateString(),
                'weight_kg' => 1.0,
                'flush_number' => $i,
                'quality_grade' => 'A',
            ]);
        }

        // Coba panen flush berikutnya (otomatis jadi 8 > max 7) -> ditolak 422
        $response = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 0.5,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['flush_number']);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. W-04: Allocation Reconciliation & Guards
    // ─────────────────────────────────────────────────────────────

    public function test_allocation_exceeding_batch_quantity_is_rejected(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 15, // Hanya beli 15 baglog
        ]);

        // Coba alokasikan 2 slot masing-masing 10 baglog (total 20 > 15)
        $payload = [
            'baglog_batch_id' => $batch->id,
            'assigned_at' => now()->toDateString(),
            'slots' => [
                [
                    'slot_code' => 'A-01-01',
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => 'LEVEL_2',
                ],
                [
                    'slot_code' => 'A-01-02',
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => 'LEVEL_2',
                ],
            ],
        ];

        $response = $this->postJson('/api/batch-slot-assignments', $payload);
        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_allocation_exceeding_slot_max_capacity_is_rejected(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
        ]);

        // Slot default max_capacity = 10, coba masukkan 15
        $payload = [
            'baglog_batch_id' => $batch->id,
            'assigned_at' => now()->toDateString(),
            'slots' => [
                [
                    'slot_code' => 'A-01-01',
                    'initial_quantity' => 15,
                    'initial_mycelium_stage' => 'LEVEL_2',
                ],
            ],
        ];

        $response = $this->postJson('/api/batch-slot-assignments', $payload);
        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_allocation_on_inactive_batch_is_rejected(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->disposed()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
        ]);

        $payload = [
            'baglog_batch_id' => $batch->id,
            'assigned_at' => now()->toDateString(),
            'slots' => [
                [
                    'slot_code' => 'A-01-01',
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => 'LEVEL_2',
                ],
            ],
        ];

        $response = $this->postJson('/api/batch-slot-assignments', $payload);
        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. W-07 & W-11: Cull Guards & Auto-Complete On 0 Capacity
    // ─────────────────────────────────────────────────────────────

    public function test_cull_before_assigned_at_is_rejected(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(10)->toDateString(),
        ]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
            'assigned_at' => now()->subDays(3)->toDateString(),
        ]);

        $response = $this->postJson('/api/baglog-culls', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->subDays(5)->toDateString(), // sebelum assigned_at
            'quantity' => 2,
            'reason' => 'TRICHODERMA',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_cull_with_habis_produksi_reason_and_auto_completes_slot(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(120)->toDateString(),
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_3',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(110)->toDateString(),
        ]);

        // Afkir habis produksi seluruh sisa 10 baglog
        $response = $this->postJson('/api/baglog-culls', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 10,
            'reason' => 'HABIS_PRODUKSI',
            'notes' => 'Siklus hidup berakhir, media dikosongkan',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.slot_active_capacity_remaining', 0);

        // Status slot otomatis COMPLETED dan terisi completed_at
        $assignment->refresh();
        $this->assertEquals(BatchSlotAssignment::STATUS_COMPLETED, $assignment->current_status);
        $this->assertEquals(now()->toDateString(), $assignment->completed_at?->toDateString());
        $this->assertEquals('EXHAUSTED', $assignment->completed_reason);

        // Sekarang slot A-01-01 sudah bebas dan bisa dialokasikan kembali!
        $this->assertFalse(Slot::find('A-01-01')->isOccupied());
    }
}
