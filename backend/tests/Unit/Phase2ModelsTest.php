<?php

namespace Tests\Unit;

use App\Models\BaglogBatch;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Models\Harvest;
use App\Models\OperationalExpense;
use App\Models\Sale;
use App\Models\Slot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Phase2ModelsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\SlotSeeder::class);
    }

    /**
     * Test model Slot dan 300 slot yang sudah di-seed.
     */
    public function test_slot_model_and_seeded_coordinates(): void
    {
        $slot = Slot::where('slot_code', 'B-05-03')->first();
        $this->assertNotNull($slot);
        $this->assertEquals('B', $slot->row);
        $this->assertEquals(5, $slot->bay);
        $this->assertEquals(3, $slot->tier);
        $this->assertEquals(10, $slot->max_capacity);
        $this->assertFalse($slot->isOccupied());
    }

    /**
     * Test alokasi batch ke slot, kapasitas aktif, dan cull ledger.
     */
    public function test_batch_slot_assignment_and_capacity(): void
    {
        $user = User::first() ?? User::factory()->create();

        $batch = BaglogBatch::create([
            'user_id' => $user->id,
            'batch_code' => 'BL-TEST-001',
            'entry_date' => now()->toDateString(),
            'quantity' => 20,
            'supplier' => 'Test Supplier',
            'price_per_baglog' => 3500.00,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_2,
            'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
            'assigned_at' => now()->toDateString(),
        ]);

        $slot = Slot::find('A-01-01');
        $this->assertTrue($slot->isOccupied());
        $this->assertEquals(10, $assignment->kapasitasAktif());

        // Catat cull (afkir 2 baglog)
        BaglogCull::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 2,
            'reason' => BaglogCull::REASON_TRICHODERMA,
            'notes' => 'Ada jamur hijau',
        ]);

        // Kapasitas aktif harus berkurang jadi 8
        $this->assertEquals(8, $assignment->kapasitasAktif());
        $this->assertEquals(18, $batch->totalActiveCapacity());

        // Test Badge logic (inkubasi awal)
        $badge = $assignment->badgeStatus();
        $this->assertEquals('gray', $badge['color']);

        // Tambah panen flush 2
        Harvest::create([
            'user_id' => $user->id,
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 4.50,
            'flush_number' => 2,
            'quality_grade' => 'A',
        ]);

        // Badge harus berubah jadi emerald (Aktif / Panen Raya) berdasarkan flush riil
        $badgeAfterHarvest = $assignment->badgeStatus();
        $this->assertEquals('emerald', $badgeAfterHarvest['color']);
        $this->assertEquals(2, $badgeAfterHarvest['flush']);

        // Clean up test records
        Harvest::where('baglog_batch_id', $batch->id)->delete();
        BaglogCull::where('baglog_batch_id', $batch->id)->delete();
        $assignment->delete();
        $batch->delete();
    }

    /**
     * Test kalkulasi HPP dan Margin Kontribusi pada BaglogBatch.
     */
    public function test_margin_kontribusi_calculation(): void
    {
        $user = User::first() ?? User::factory()->create();

        $batch = BaglogBatch::create([
            'user_id' => $user->id,
            'batch_code' => 'BL-TEST-HPP',
            'entry_date' => now()->subDays(45)->toDateString(),
            'quantity' => 100,
            'supplier' => 'UD Jamur Makmur',
            'price_per_baglog' => 3000.00, // Modal awal: 100 x 3000 = 300.000
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        // Biaya operasional: Listrik 50.000 + Plastik 25.000 = 75.000
        OperationalExpense::create([
            'baglog_batch_id' => $batch->id,
            'expense_date' => now()->toDateString(),
            'category' => OperationalExpense::CATEGORY_LISTRIK,
            'amount' => 50000.00,
        ]);
        OperationalExpense::create([
            'baglog_batch_id' => $batch->id,
            'expense_date' => now()->toDateString(),
            'category' => OperationalExpense::CATEGORY_PLASTIK,
            'amount' => 25000.00,
        ]);

        // Penjualan: 20 Kg x Rp 25.000 = Rp 500.000
        Sale::create([
            'user_id' => $user->id,
            'baglog_batch_id' => $batch->id,
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 20.00,
            'price_per_kg' => 25000.00,
            'total_revenue' => 500000.00,
            'buyer_name' => 'Pak Joko',
        ]);

        $margin = $batch->marginKontribusi();

        $this->assertEquals(300000.00, $margin['modal_baglog_awal']);
        $this->assertEquals(75000.00, $margin['biaya_operasional']);
        $this->assertEquals(375000.00, $margin['total_biaya']);
        $this->assertEquals(500000.00, $margin['omzet_kotor']);
        // Margin kontribusi = 500.000 - 375.000 = 125.000
        $this->assertEquals(125000.00, $margin['margin_kontribusi']);
        $this->assertEquals(37.5, $margin['persen_siklus']); // 45 / 120 * 100

        // Clean up test records
        Sale::where('baglog_batch_id', $batch->id)->delete();
        OperationalExpense::where('baglog_batch_id', $batch->id)->delete();
        $batch->delete();
    }
}
