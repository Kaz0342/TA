<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Models\Harvest;
use App\Models\Slot;
use App\Models\User;
use Database\Seeders\SlotSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Test Suite WMS Fase C: Derived Metrics & Reporting.
 * Menguji W-03 (Active Baglogs formula), W-15 (N+1 query elimination), dan W-05/W-06 (Badge visual contract).
 */
class WmsPhaseCTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SlotSeeder::class);

        $this->admin = User::factory()->admin()->create();
    }

    /**
     * W-03: Dashboard QuickStats menghitung baglog aktif secara akurat (net surviving baglogs).
     * Rumus: SUM(batch.quantity) batch aktif - SUM(culls.quantity) batch aktif.
     */
    public function test_w03_dashboard_active_baglogs_deducts_culls_correctly(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Buat dua batch aktif
        $b1 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 1000,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        $b2 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 500,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        // 2. Catat kematian/afkir di masing-masing batch
        BaglogCull::create([
            'baglog_batch_id' => $b1->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 50,
            'reason' => BaglogCull::REASON_TRICHODERMA,
        ]);

        BaglogCull::create([
            'baglog_batch_id' => $b2->id,
            'slot_code' => 'A-01-02',
            'cull_date' => now()->toDateString(),
            'quantity' => 30,
            'reason' => BaglogCull::REASON_KERING,
        ]);

        // Total baglog hidup = (1000 - 50) + (500 - 30) = 950 + 470 = 1420
        $response = $this->getJson('/api/dashboard/stats');
        $response->assertStatus(200)
            ->assertJsonPath('data.active_baglogs', 1420)
            ->assertJsonPath('data.active_baglogs_count', 1420);
    }

    /**
     * W-03: Afkir pada batch yang sudah non-aktif (disposed/completed) tidak boleh mengurangi batch aktif.
     */
    public function test_w03_dashboard_ignores_culls_from_non_active_batches(): void
    {
        Sanctum::actingAs($this->admin);

        $activeBatch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 1000,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        $disposedBatch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 500,
            'status' => BaglogBatch::STATUS_DISPOSED,
        ]);

        // Afkir pada disposed batch
        BaglogCull::create([
            'baglog_batch_id' => $disposedBatch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 500,
            'reason' => 'HABIS_PRODUKSI',
        ]);

        $response = $this->getJson('/api/dashboard/stats');
        $response->assertStatus(200)
            ->assertJsonPath('data.active_baglogs', 1000);
    }

    /**
     * W-15: Eliminasi N+1 Query pada GET /api/slots.
     * Query count harus konstan (bounded) dan tidak bertambah seiring banyaknya slot.
     */
    public function test_w15_slot_index_n_plus_one_query_budget(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        $slotCodes = ['A-01-01', 'A-01-02', 'A-01-03', 'A-01-04', 'A-01-05'];

        foreach ($slotCodes as $code) {
            BatchSlotAssignment::create([
                'baglog_batch_id' => $batch->id,
                'slot_code' => $code,
                'initial_quantity' => 10,
                'initial_mycelium_stage' => 'LEVEL_2',
                'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
                'assigned_at' => now()->toDateString(),
            ]);

            BaglogCull::create([
                'baglog_batch_id' => $batch->id,
                'slot_code' => $code,
                'cull_date' => now()->toDateString(),
                'quantity' => 1,
                'reason' => BaglogCull::REASON_TRICHODERMA,
            ]);

            Harvest::create([
                'user_id' => $this->admin->id,
                'baglog_batch_id' => $batch->id,
                'slot_code' => $code,
                'harvest_date' => now()->toDateString(),
                'weight_kg' => 2.5,
                'flush_number' => 1,
                'quality_grade' => 'A',
            ]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->getJson('/api/slots');
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $response->assertStatus(200);

        // Maksimal 5 query:
        // 1. User auth (sanctum)
        // 2. Select slots
        // 3. Eager load activeAssignment
        // 4. Pre-aggregate culls
        // 5. Pre-aggregate harvests
        $this->assertLessThanOrEqual(6, count($queries), 'Query count must not scale with slot count (N+1 query detected!)');

        // Pastikan field payload diperkaya dengan benar
        $firstSlot = collect($response->json('data'))->firstWhere('slot_code', 'A-01-01');
        $this->assertNotNull($firstSlot['assignment']);
        $this->assertEquals(9, $firstSlot['assignment']['active_capacity']);
        $this->assertEquals(2.5, $firstSlot['assignment']['total_harvest_kg']);
        $this->assertEquals(1, $firstSlot['assignment']['last_flush']);
        $this->assertArrayHasKey('dot', $firstSlot['assignment']['badge']);
        $this->assertArrayHasKey('class', $firstSlot['assignment']['badge']);
    }

    /**
     * W-05 & W-06: Verifikasi Badge Status (Truth-based vs Age-based).
     */
    public function test_w05_w06_badge_truth_based_and_config_driven(): void
    {
        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->subDays(20)->toDateString(),
        ]);

        // 1. Tanpa panen, umur 20 hari -> gray (inkubasi)
        $badge = $assignment->badgeStatus();
        $this->assertEquals('gray', $badge['color']);
        $this->assertFalse($badge['needs_po_alert']);

        // 2. Panen flush 1 (Perdana) -> blue
        $badgeFlush1 = $assignment->badgeStatus(1);
        $this->assertEquals('blue', $badgeFlush1['color']);
        $this->assertFalse($badgeFlush1['needs_po_alert']);

        // 3. Panen flush 3 (Aktif) -> emerald
        $badgeFlush3 = $assignment->badgeStatus(3);
        $this->assertEquals('emerald', $badgeFlush3['color']);
        $this->assertFalse($badgeFlush3['needs_po_alert']);

        // 4. Panen flush 5 (Menurun) -> amber & needs_po_alert
        $badgeFlush5 = $assignment->badgeStatus(5);
        $this->assertEquals('amber', $badgeFlush5['color']);
        $this->assertTrue($badgeFlush5['needs_po_alert']);

        // 5. Panen flush 6 (Tua) -> red & needs_po_alert
        $badgeFlush6 = $assignment->badgeStatus(6);
        $this->assertEquals('red', $badgeFlush6['color']);
        $this->assertTrue($badgeFlush6['needs_po_alert']);
    }

    /**
     * GET /api/slots/{code} detail slot mengembalikan histori dan sisa kapasitas yang benar.
     */
    public function test_slot_show_detail_includes_culls_and_harvests(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
        ]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => BatchSlotAssignment::STATUS_FRUITING,
            'assigned_at' => now()->toDateString(),
        ]);

        BaglogCull::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 3,
            'reason' => BaglogCull::REASON_HAMA,
            'notes' => 'Tungau merah',
        ]);

        Harvest::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 4.25,
            'flush_number' => 2,
            'quality_grade' => 'A',
        ]);

        $response = $this->getJson('/api/slots/A-01-01');
        $response->assertStatus(200)
            ->assertJsonPath('data.slot_code', 'A-01-01')
            ->assertJsonPath('data.is_occupied', true)
            ->assertJsonPath('data.active_assignment.active_capacity', 7)
            ->assertJsonPath('data.total_panen_kg', 4.25)
            ->assertJsonPath('data.total_culls_qty', 3);
    }
}
