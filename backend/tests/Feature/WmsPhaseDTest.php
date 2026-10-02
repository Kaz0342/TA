<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Models\Harvest;
use App\Models\Sale;
use App\Models\User;
use Database\Seeders\SlotSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Test Suite WMS Fase D: Void Mechanism, Sequence Safety & Price Fallback.
 * Menguji W-09 (Voiding ledger harvests, culls, sales), W-12 (Batch code sequence), dan W-13 (price_missing flag).
 */
class WmsPhaseDTest extends TestCase
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

    /**
     * W-09: Voiding panen mengecualikan berat dari agregasi dan mencatat jejak audit.
     */
    public function test_w09_void_harvest_deducts_weight_and_records_audit(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create(['user_id' => $this->admin->id]);
        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->toDateString(),
        ]);

        $harvest = Harvest::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 12.50,
            'flush_number' => 1,
            'quality_grade' => 'A',
        ]);

        $this->assertEquals(12.50, $assignment->totalHarvestKg());

        // Lakukan void
        $res = $this->postJson("/api/harvests/{$harvest->id}/void", [
            'reason' => 'Salah input berat panen, seharusnya 1.25 kg',
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('data.void_reason', 'Salah input berat panen, seharusnya 1.25 kg');

        $harvest->refresh();
        $this->assertTrue($harvest->isVoided());
        $this->assertEquals($this->admin->id, $harvest->voided_by);

        // Agregasi model otomatis mengecualikan data void
        $this->assertEquals(0.00, $assignment->totalHarvestKg());
        $this->assertEquals(0, Harvest::count());
        $this->assertEquals(1, Harvest::withVoided()->count());
    }

    /**
     * W-09: Voiding afkir memulihkan sisa kapasitas dan membuka kembali slot jika sempat EXHAUSTED.
     */
    public function test_w09_void_cull_restores_capacity_and_reopens_exhausted_slot(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 10,
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->toDateString(),
        ]);

        // Input cull 10 baglog -> otomatis habis dan completed
        $cullRes = $this->postJson('/api/baglog-culls', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 10,
            'reason' => BaglogCull::REASON_TRICHODERMA,
        ]);
        $cullRes->assertStatus(201);
        $cullId = $cullRes->json('data.cull.id');

        $assignment->refresh();
        $this->assertEquals(BatchSlotAssignment::STATUS_COMPLETED, $assignment->current_status);
        $this->assertEquals('EXHAUSTED', $assignment->completed_reason);
        $this->assertEquals(0, $assignment->kapasitasAktif());

        // Lakukan void terhadap mutasi afkir yang salah tadi
        $voidRes = $this->postJson("/api/baglog-culls/{$cullId}/void", [
            'reason' => 'Salah input koordinat slot rak kumbung',
        ]);
        $voidRes->assertStatus(200);

        $assignment->refresh();
        // Slot harus pulih kembali ke FRUITING dan kapasitasnya kembali 10
        $this->assertEquals(BatchSlotAssignment::STATUS_FRUITING, $assignment->current_status);
        $this->assertNull($assignment->completed_at);
        $this->assertNull($assignment->completed_reason);
        $this->assertEquals(10, $assignment->kapasitasAktif());
    }

    /**
     * W-09: Voiding penjualan mengecualikan omzet dari laporan pendapatan.
     */
    public function test_w09_void_sale_deducts_revenue(): void
    {
        Sanctum::actingAs($this->admin);

        $sale = Sale::create([
            'user_id' => $this->admin->id,
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 20.0,
            'price_per_kg' => 25000.0,
            'total_revenue' => 500000.0,
            'buyer_name' => 'Tengkulak Budi',
        ]);

        $this->assertEquals(500000.0, Sale::sum('total_revenue'));

        $res = $this->postJson("/api/sales/{$sale->id}/void", [
            'reason' => 'Transaksi dibatalkan karena pesanan di-cancel',
        ]);
        $res->assertStatus(200);

        // Omzet aktif harus 0
        $this->assertEquals(0, Sale::sum('total_revenue'));
        $this->assertEquals(1, Sale::withVoided()->count());
    }

    /**
     * W-09: Menolak pembatalan ganda (double void) dengan HTTP 422.
     */
    public function test_w09_cannot_void_already_voided_record(): void
    {
        Sanctum::actingAs($this->admin);

        $harvest = Harvest::create([
            'user_id' => $this->admin->id,
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 5.0,
            'flush_number' => 1,
            'quality_grade' => 'A',
        ]);

        $this->postJson("/api/harvests/{$harvest->id}/void", [
            'reason' => 'Void pertama kali',
        ])->assertStatus(200);

        // Percobaan void kedua kali
        $this->postJson("/api/harvests/{$harvest->id}/void", [
            'reason' => 'Mencoba void kedua kali',
        ])->assertStatus(422);
    }

    /**
     * W-12: Batch code generation menggunakan entry_date dan mengurutkan secara berurutan.
     */
    public function test_w12_batch_code_uses_entry_date(): void
    {
        $code = BaglogBatch::generateBatchCode('2026-04-10');
        $this->assertEquals('BL-20260410-001', $code);

        BaglogBatch::factory()->create([
            'batch_code' => 'BL-20260410-001',
            'entry_date' => '2026-04-10',
        ]);

        $nextCode = BaglogBatch::generateBatchCode('2026-04-10');
        $this->assertEquals('BL-20260410-002', $nextCode);
    }

    /**
     * W-13: Deteksi harga modal baglog yang kosong atau 0 (price_missing flag).
     */
    public function test_w13_price_missing_flag_in_margin_kontribusi(): void
    {
        $batchZero = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'price_per_baglog' => 0.00,
        ]);

        $marginZero = $batchZero->marginKontribusi();
        $this->assertTrue($marginZero['price_missing']);

        $batchValid = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'price_per_baglog' => 3200.00,
        ]);

        $marginValid = $batchValid->marginKontribusi();
        $this->assertFalse($marginValid['price_missing']);
    }
}
