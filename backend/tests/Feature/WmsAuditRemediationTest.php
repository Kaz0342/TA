<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Models\Harvest;
use App\Models\OperationalExpense;
use App\Models\Sale;
use App\Models\Slot;
use App\Models\User;
use Database\Seeders\SlotSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Suite Tes Remediasi Temuan Audit WMS & SCM (AUD-01 s/d AUD-17).
 *
 * @see docs/update/IMPLEMENTATION_PLAN_WMS_SCM.md
 * @see docs/update/AUDIT_WMS_SCM.md
 */
class WmsAuditRemediationTest extends TestCase
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
    // SPRINT 1: RBAC SHIELD (AUD-01) & TIMEZONE SERIALIZATION (AUD-05)
    // ─────────────────────────────────────────────────────────────

    /**
     * AUD-01: Pekerja (Worker) HARUS ditolak HTTP 403 Forbidden pada seluruh rute sensitif:
     * status batch, void panen, void afkir, penjualan, HPP summary, dan pengeluaran operasional.
     */
    public function test_aud01_worker_forbidden_on_admin_only_routes(): void
    {
        // Setup data uji oleh Admin
        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
            'status' => 'active',
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'FRUITING',
            'assigned_at' => now()->toDateString(),
        ]);

        $harvest = Harvest::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 3.5,
            'flush_number' => 1,
            'quality_grade' => 'A',
        ]);

        $cull = BaglogCull::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 2,
            'reason' => 'TRICHODERMA',
        ]);

        $sale = Sale::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 2.0,
            'price_per_kg' => 25000,
            'total_revenue' => 50000,
            'buyer_name' => 'Tengkulak Test',
        ]);

        $expense = OperationalExpense::create([
            'expense_date' => now()->toDateString(),
            'category' => 'LISTRIK',
            'amount' => 150000,
        ]);

        // Bertindak sebagai WORKER
        Sanctum::actingAs($this->worker);

        // 1. Worker tidak boleh mengubah status batch (misal membuang batch)
        $this->patchJson("/api/baglogs/{$batch->id}/status", ['status' => 'disposed'])
            ->assertStatus(403);

        // 2. Worker tidak boleh void catatan panen
        $this->postJson("/api/harvests/{$harvest->id}/void", ['reason' => 'Worker coba void'])
            ->assertStatus(403);

        // 3. Worker tidak boleh void catatan afkir
        $this->postJson("/api/baglog-culls/{$cull->id}/void", ['reason' => 'Worker coba void'])
            ->assertStatus(403);

        // 4. Worker tidak boleh mengakses data penjualan dan laporan keuangan
        $this->getJson('/api/sales')->assertStatus(403);
        $this->getJson('/api/sales/weekly-report')->assertStatus(403);
        $this->getJson('/api/sales/buyer-ranking')->assertStatus(403);
        $this->getJson('/api/sales/price-trend')->assertStatus(403);

        // 5. Worker tidak boleh mengakses HPP summary dan detail HPP batch
        $this->getJson('/api/baglogs/hpp-summary')->assertStatus(403);
        $this->getJson("/api/baglogs/{$batch->id}/hpp")->assertStatus(403);

        // 6. Worker tidak boleh melihat atau menghapus biaya operasional
        $this->getJson('/api/operational-expenses')->assertStatus(403);

        // ── Verifikasi sebaliknya: Admin BISA mengakses rute-rute tersebut ──
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/sales')->assertStatus(200);
        $this->getJson('/api/sales/weekly-report')->assertStatus(200);
        $this->getJson('/api/baglogs/hpp-summary')->assertStatus(200);
        $this->getJson("/api/baglogs/{$batch->id}/hpp")->assertStatus(200);
        $this->getJson('/api/operational-expenses')->assertStatus(200);
    }

    /**
     * AUD-05: Kolom tanggal HARUS diserialisasi sebagai format Y-m-d murni (tanpa ISO timestamp UTC T..Z).
     */
    public function test_aud05_date_columns_serialize_as_ymd(): void
    {
        $testDate = '2026-10-10';

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => $testDate,
            'quantity' => 10,
        ]);

        Harvest::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'harvest_date' => $testDate,
            'weight_kg' => 2.5,
            'flush_number' => 1,
            'quality_grade' => 'A',
        ]);

        Sale::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'sale_date' => $testDate,
            'quantity_kg' => 1.0,
            'price_per_kg' => 25000,
            'total_revenue' => 25000,
            'buyer_name' => 'Pembeli Tanggal',
        ]);

        OperationalExpense::create([
            'expense_date' => $testDate,
            'category' => 'AIR',
            'amount' => 50000,
        ]);

        Sanctum::actingAs($this->admin);

        // 1. Cek harvest_date di list panen
        $harvestsResponse = $this->getJson('/api/harvests')->assertStatus(200);
        $harvestDate = $harvestsResponse->json('data.0.harvest_date');
        $this->assertEquals($testDate, $harvestDate);
        $this->assertDoesNotMatch($harvestDate, '/T|Z/', 'harvest_date tidak boleh mengandung format ISO UTC (T/Z)');

        // 2. Cek entry_date di list baglogs
        $baglogsResponse = $this->getJson('/api/baglogs')->assertStatus(200);
        $entryDate = $baglogsResponse->json('data.0.entry_date');
        $this->assertEquals($testDate, $entryDate);
        $this->assertDoesNotMatch($entryDate, '/T|Z/', 'entry_date tidak boleh mengandung format ISO UTC (T/Z)');

        // 3. Cek sale_date di list sales
        $salesResponse = $this->getJson('/api/sales')->assertStatus(200);
        $saleDate = $salesResponse->json('data.0.sale_date');
        $this->assertEquals($testDate, $saleDate);
        $this->assertDoesNotMatch($saleDate, '/T|Z/', 'sale_date tidak boleh mengandung format ISO UTC (T/Z)');

        // 4. Cek expense_date di list expenses
        $expensesResponse = $this->getJson('/api/operational-expenses')->assertStatus(200);
        $expenseDate = $expensesResponse->json('data.expenses.0.expense_date');
        $this->assertEquals($testDate, $expenseDate);
        $this->assertDoesNotMatch($expenseDate, '/T|Z/', 'expense_date tidak boleh mengandung format ISO UTC (T/Z)');
    }

    /**
     * AUD-17d: Rute utilitas development tidak boleh menerima sembarang rahasia tanpa konfigurasi UTILITY_SECRET.
     */
    public function test_aud17d_utility_endpoint_rejects_missing_or_default_secret(): void
    {
        // Tanpa UTILITY_SECRET di environment, wajib 403 Forbidden
        config(['app.env' => 'local']);
        putenv('UTILITY_SECRET=');

        $this->getJson('/api/make-admin?secret=ta-shroom-migrate-2026')->assertStatus(403);
        $this->getJson('/api/seed-db?secret=ta-shroom-migrate-2026')->assertStatus(403);

        // Dengan rahasia eksplisit
        putenv('UTILITY_SECRET=secret-super-kuat-2026');
        $this->getJson('/api/make-admin?secret=wrong-secret')->assertStatus(403);
        $this->getJson('/api/seed-db?secret=wrong-secret')->assertStatus(403);
    }

    // ─────────────────────────────────────────────────────────────
    // SPRINT 2: VALIDASI STOK, MUTASI AFKIR & INVARIAN BIOLOGI
    // ─────────────────────────────────────────────────────────────

    /**
     * AUD-02: Penjualan yang melebihi stok layak jual wajib ditolak (HTTP 422),
     * kecuali jika flag force: true dan force_reason diberikan oleh Admin.
     */
    public function test_aud02_sale_exceeding_stock_is_rejected_unless_forced(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
            'status' => 'active',
        ]);

        // Catat panen layak jual 5.0 kg
        Harvest::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 5.0,
            'flush_number' => 1,
            'quality_grade' => 'A',
        ]);

        // 1. Coba jual 10.0 kg (melebihi stok 5.0 kg) tanpa force -> ditolak 422
        $respReject = $this->postJson('/api/sales', [
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 10.0,
            'price_per_kg' => 25000,
            'buyer_name' => 'Tengkulak Kelebihan',
        ]);

        $respReject->assertStatus(422)
            ->assertJsonValidationErrors(['quantity_kg']);

        // 2. Coba jual 10.0 kg dengan force: true tapi tanpa force_reason -> ditolak 422
        $respNoReason = $this->postJson('/api/sales', [
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 10.0,
            'price_per_kg' => 25000,
            'buyer_name' => 'Tengkulak Kelebihan',
            'force' => true,
        ]);

        $respNoReason->assertStatus(422)
            ->assertJsonValidationErrors(['force_reason']);

        // 3. Jual 10.0 kg dengan force: true dan alasan valid -> berhasil 201
        $respForced = $this->postJson('/api/sales', [
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 10.0,
            'price_per_kg' => 25000,
            'buyer_name' => 'Tengkulak Kelebihan',
            'force' => true,
            'force_reason' => 'Panen susulan belum diinput staf ke sistem',
        ]);

        $respForced->assertStatus(201);
        $this->assertStringContainsString('[FORCE SALE: Panen susulan belum diinput staf ke sistem]', $respForced->json('data.notes'));
    }

    /**
     * AUD-06: Mutasi afkir penutupan siklus normal (HABIS_PRODUKSI) TIDAK BOLEH
     * dihitung sebagai mortalitas biosekuriti (Probe P06).
     */
    public function test_aud06_mortality_excludes_habis_produksi(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 10,
            'price_per_baglog' => 5000,
            'status' => 'active',
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'FRUITING',
            'assigned_at' => now()->subDays(30)->toDateString(),
        ]);

        // Catat kematian akibat kontaminasi jamur Trichoderma: 2 baglog (20%)
        $this->postJson('/api/baglog-culls', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 2,
            'reason' => 'TRICHODERMA',
        ])->assertStatus(201);

        $beforeClose = $this->getJson("/api/baglogs/{$batch->id}/hpp")->json('data');
        $this->assertEquals(20.0, $beforeClose['mortality_rate_percent']);
        $this->assertEquals(2, $beforeClose['culled_quantity']);
        $this->assertEquals(8, $beforeClose['active_capacity']);

        // Tutup siklus normal kamar rak: 8 sisa baglog menjadi HABIS_PRODUKSI
        $this->postJson("/api/batch-slot-assignments/{$assignment->id}/complete", [
            'reason' => 'EXHAUSTED',
            'date' => now()->toDateString(),
        ])->assertStatus(200);

        $afterClose = $this->getJson("/api/baglogs/{$batch->id}/hpp")->json('data');

        // AUD-06 Fix: Mortalitas TETAP 20.0% (bukan melonjak ke 100%!)
        $this->assertEquals(20.0, $afterClose['mortality_rate_percent']);
        $this->assertEquals(2, $afterClose['culled_quantity']);
        $this->assertEquals(8, $afterClose['habis_produksi_qty']);
        $this->assertEquals(10, $afterClose['total_culls_qty']);
        $this->assertEquals(0, $afterClose['active_capacity']);
        $this->assertTrue($afterClose['is_completed']);
    }

    /**
     * AUD-12: Panen kualitas REJECT dipisahkan dari stok layak jual dan laporan neraca SCM (Probe P10).
     */
    public function test_aud12_reject_grade_excluded_from_sellable_stock(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
            'status' => 'active',
        ]);

        // Panen 5 kg Grade A (Layak jual) dan 5 kg REJECT (Rusak/Busuk)
        $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 5.0,
            'quality_grade' => 'A',
        ])->assertStatus(201);

        $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 5.0,
            'quality_grade' => 'REJECT',
        ])->assertStatus(201);

        // Coba jual 6 kg tanpa force -> ditolak 422 karena stok layak jual hanya 5.0 kg
        $this->postJson('/api/sales', [
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 6.0,
            'price_per_kg' => 25000,
            'buyer_name' => 'Tengkulak A',
        ])->assertStatus(422);

        // Weekly report harus membedakan total_harvest_kg (layak jual) dan total_reject_kg
        $report = $this->getJson('/api/sales/weekly-report')->json('data');
        $this->assertEquals(5.0, $report['total_harvest_kg']);
        $this->assertEquals(5.0, $report['total_reject_kg']);
        $this->assertEquals(5.0, $report['unsold_kg']);
    }

    /**
     * AUD-14: Tanggal transaksi di masa depan dan kuantitas batch > 3000 ditolak validasi.
     */
    public function test_aud14_future_dates_rejected_by_request_validation(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Penjualan tanggal masa depan -> ditolak 422
        $this->postJson('/api/sales', [
            'sale_date' => now()->addDays(5)->toDateString(),
            'quantity_kg' => 1.0,
            'price_per_kg' => 25000,
            'buyer_name' => 'Masa Depan',
        ])->assertStatus(422)->assertJsonValidationErrors(['sale_date']);

        // 2. Batch entry_date di masa depan -> ditolak 422
        $this->postJson('/api/baglogs', [
            'entry_date' => now()->addDays(2)->toDateString(),
            'quantity' => 100,
            'supplier' => 'CV Baglog Maju',
        ])->assertStatus(422)->assertJsonValidationErrors(['entry_date']);

        // 3. Batch kuantitas 5000 (> kapasitas kumbung 3000) -> ditolak 422 (AUD-09)
        $this->postJson('/api/baglogs', [
            'entry_date' => now()->toDateString(),
            'quantity' => 5000,
            'supplier' => 'CV Baglog Maju',
        ])->assertStatus(422)->assertJsonValidationErrors(['quantity']);

        // 4. Biaya operasional tanggal masa depan -> ditolak 422
        $this->postJson('/api/operational-expenses', [
            'expense_date' => now()->addDays(10)->toDateString(),
            'category' => 'LISTRIK',
            'amount' => 100000,
        ])->assertStatus(422)->assertJsonValidationErrors(['expense_date']);
    }

    /**
     * Probe P12: Tanggal panen mode batch tidak boleh mendahului entry_date batch.
     */
    public function test_aud14_batch_mode_harvest_cannot_be_before_entry_date(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->toDateString(),
            'quantity' => 20,
        ]);

        // Coba catat panen 5 hari sebelum batch dibeli
        $response = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->subDays(5)->toDateString(),
            'weight_kg' => 2.0,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['harvest_date']);
    }

    /**
     * Probe P13: Panen yatim (tanpa batch dan tanpa slot) wajib ditolak HTTP 422.
     */
    public function test_aud14_orphan_harvest_rejected(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/harvests', [
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 1.5,
        ]);

        $response->assertStatus(422);
    }

    /**
     * Probe P20: Tanggal tutup siklus tidak boleh mendahului tanggal penempatan (assigned_at).
     */
    public function test_p20_completed_date_cannot_be_before_assigned_at(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'entry_date' => now()->subDays(20)->toDateString(),
            'quantity' => 20,
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'FRUITING',
            'assigned_at' => now()->subDays(5)->toDateString(),
        ]);

        // Coba tutup siklus 15 hari yang lalu (10 hari sebelum baglog masuk rak)
        $response = $this->postJson("/api/batch-slot-assignments/{$assignment->id}/complete", [
            'reason' => 'MANUAL',
            'date' => now()->subDays(15)->toDateString(),
        ]);

        $response->assertStatus(422);
    }

    /**
     * Probe P11: Batas nomor flush maksimal 7 pada mode batch maupun slot.
     */
    public function test_p11_flush_limit_enforced_in_batch_mode(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
        ]);

        // Flush number 8 (> max 7) harus ditolak 422
        $response = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 1.0,
            'flush_number' => 8,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['flush_number']);
    }

    // ─────────────────────────────────────────────────────────────
    // SPRINT 3: WMS LIFECYCLE STATE MACHINE & BATAS SPASIAL 3.000
    // ─────────────────────────────────────────────────────────────

    /**
     * AUD-03 & Probe P11, P28:
     * - Panen mode batch memindahkan seluruh slot kohor dari INCUBATION ke FRUITING.
     * - Nomor flush dibatasi maksimal 7 (flush 8 ditolak HTTP 422).
     * - Panen tingkat batch dialokasikan prorata ke visual heatmap dan badge status slot.
     */
    public function test_aud03_batch_harvest_advances_slots_and_updates_badges(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
            'status' => 'active',
            'entry_date' => now()->subDays(10)->toDateString(),
        ]);

        $asgn1 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'INCUBATION',
            'assigned_at' => now()->subDays(5)->toDateString(),
        ]);

        $asgn2 = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-02',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'INCUBATION',
            'assigned_at' => now()->subDays(5)->toDateString(),
        ]);

        // 1. Catat panen mode batch (tanpa slot_code) seberat 4.0 kg flush 1
        $harvestResp = $this->postJson('/api/harvests', [
            'baglog_batch_id' => $batch->id,
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 4.0,
            'flush_number' => 1,
            'quality_grade' => 'A',
        ]);
        $harvestResp->assertStatus(201);

        // Verifikasi kohor slot otomatis berpindah ke FRUITING (Probe P11)
        $this->assertEquals('FRUITING', $asgn1->fresh()->current_status);
        $this->assertEquals('FRUITING', $asgn2->fresh()->current_status);

        // 2. Cek heatmap: 4.0 kg batch diprorata ke 2 slot aktif (masing-masing 2.0 kg) (Probe P28)
        $heatmapResp = $this->getJson("/api/slots/heatmap?batch_id={$batch->id}")->assertStatus(200);
        $slotsHeatmap = collect($heatmapResp->json('data.slots'))->keyBy('slot_code');
        $this->assertEquals(2.0, (float) $slotsHeatmap['A-01-01']['total_kg']);
        $this->assertEquals(2.0, (float) $slotsHeatmap['A-01-02']['total_kg']);

        // 3. Cek list slots: badge slot mendeteksi flush ke-1 dari panen tingkat batch (Probe P28)
        $slotListResp = $this->getJson('/api/slots?row=A')->assertStatus(200);
        $slotsData = collect($slotListResp->json('data'))->keyBy('slot_code');
        $this->assertEquals(1, $slotsData['A-01-01']['assignment']['last_flush']);
        $this->assertStringContainsString('Panen Ke-1', $slotsData['A-01-01']['assignment']['badge']['label']);
    }

    /**
     * AUD-04 & Probe P03, P04, P05, P18, P19:
     * - Batch TIDAK boleh otomatis 'completed' jika masih ada unassigned_quantity (Probe P19).
     * - Ketika seluruh slot ditutup dan sisa 0, batch menjadi 'completed' (Probe P03).
     * - Ketika penutupan dibatalkan via void cull, batch otomatis kembali 'active' (Probe P04, P05).
     * - Guard transisi status manual: disposed -> active ditolak 422, active -> completed ditolak jika ada slot aktif (Probe P18).
     */
    public function test_aud04_batch_lifecycle_syncs_across_all_closing_paths(): void
    {
        Sanctum::actingAs($this->admin);

        // Skenario A: Batch 100 baglog, baru 10 dialokasikan (sisa 90 belum teralokasi)
        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
            'status' => 'active',
            'entry_date' => now()->subDays(10)->toDateString(),
        ]);

        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'FRUITING',
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        // Tutup siklus slot A-01-01
        $this->postJson("/api/batch-slot-assignments/{$assignment->id}/complete", [
            'reason' => 'EXHAUSTED',
            'date' => now()->toDateString(),
        ])->assertStatus(200);

        // Probe P19: Batch HARUS TETAP 'active' karena masih ada 90 baglog unassigned!
        $this->assertEquals('active', $batch->fresh()->status);

        // Skenario B: Batch di mana seluruh baglog sudah ditempatkan (unassigned = 0)
        $batchFull = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 10,
            'status' => 'active',
            'entry_date' => now()->subDays(10)->toDateString(),
        ]);

        $assignmentFull = BatchSlotAssignment::create([
            'baglog_batch_id' => $batchFull->id,
            'slot_code' => 'B-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'FRUITING',
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        // Tutup siklus slot B-01-01
        $this->postJson("/api/batch-slot-assignments/{$assignmentFull->id}/complete", [
            'reason' => 'EXHAUSTED',
            'date' => now()->toDateString(),
        ])->assertStatus(200);

        // Seluruh baglog telah selesai dan unassigned 0 -> status batch otomatis 'completed'
        $this->assertEquals('completed', $batchFull->fresh()->status);

        // Ambil ID cull penutupan (HABIS_PRODUKSI)
        $cull = BaglogCull::where('baglog_batch_id', $batchFull->id)->latest('id')->first();
        $this->assertNotNull($cull);

        // Probe P04, P05: Void catatan cull untuk memulihkan slot
        $this->postJson("/api/baglog-culls/{$cull->id}/void", [
            'reason' => 'Salah klik tutup siklus, mau dipulihkan',
        ])->assertStatus(200);

        // Slot harus kembali FRUITING dan batch harus sinkron kembali menjadi 'active'
        $this->assertEquals('FRUITING', $assignmentFull->fresh()->current_status);
        $this->assertEquals('active', $batchFull->fresh()->status);

        // Probe P18: Guard transisi status batch
        // 1. Coba ubah batch menjadi completed manual saat slot masih aktif -> ditolak 422
        $this->patchJson("/api/baglogs/{$batchFull->id}/status", [
            'status' => 'completed',
        ])->assertStatus(422);

        // 2. Buang batch (disposed)
        $this->patchJson("/api/baglogs/{$batchFull->id}/status", [
            'status' => 'disposed',
            'notes' => 'Terkontaminasi massal dibuang',
        ])->assertStatus(200);
        $this->assertEquals('disposed', $batchFull->fresh()->status);

        // 3. Coba balikkan status dari disposed ke active -> ditolak 422
        $this->patchJson("/api/baglogs/{$batchFull->id}/status", [
            'status' => 'active',
        ])->assertStatus(422);
    }

    /**
     * AUD-09 & Probe P14, P15, P17:
     * - Kumbung dibatasi maksimal 3 rak / 300 slot / 3.000 baglog.
     * - Penambahan rak melampaui batas atau di luar abjad A, B, C ditolak HTTP 422.
     * - Endpoint GET /api/racks tidak boleh mengembalikan data hantu jika DB kosong.
     */
    public function test_aud09_rack_hard_cap_300_slots_enforced(): void
    {
        Sanctum::actingAs($this->admin);

        // Database sudah memiliki 300 slot (Rak A, B, C dari seeder)
        $this->assertEquals(300, Slot::count());

        // 1. Coba tambah Rak D -> ditolak 422 karena mencapai hard cap 3 rak / 300 slot
        $respCap = $this->postJson('/api/racks', ['row' => 'D']);
        $respCap->assertStatus(422);
        $this->assertStringContainsString('Kapasitas kumbung telah mencapai batas maksimal', $respCap->json('message'));

        // 2. Hapus Rak C agar slot tersisa 200
        $this->deleteJson('/api/racks/C')->assertStatus(200);
        $this->assertEquals(200, Slot::count());

        // 3. Coba tambah rak dengan kode di luar A, B, C (misal 'D') -> ditolak 422
        $respInvalidRow = $this->postJson('/api/racks', ['row' => 'D']);
        $respInvalidRow->assertStatus(422);
        $this->assertStringContainsString('tidak diizinkan', $respInvalidRow->json('message'));

        // 4. Tambah kembali Rak C -> berhasil 201 dengan 100 slot
        $respOk = $this->postJson('/api/racks', ['row' => 'C']);
        $respOk->assertStatus(201);
        $this->assertEquals(300, Slot::count());

        // 5. Probe P17: Jika seluruh slot dihapus, /api/racks mengembalikan array kosong []
        Slot::query()->delete();
        $emptyResp = $this->getJson('/api/racks')->assertStatus(200);
        $this->assertEmpty($emptyResp->json('data'));
    }

    /**
     * AUD-09 & Probe P16:
     * - Rak TIDAK boleh dihapus jika memiliki riwayat penempatan, panen, atau afkir (termasuk yang di-void).
     */
    public function test_aud09_destroy_rack_protects_voided_history(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 10,
        ]);

        // Kasus 1: Rak dengan riwayat panen yang sudah di-void
        Harvest::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => now()->toDateString(),
            'weight_kg' => 2.0,
            'flush_number' => 1,
            'quality_grade' => 'A',
            'voided_at' => now(),
            'void_reason' => 'Panen void audit trail',
        ]);

        $respA = $this->deleteJson('/api/racks/A');
        $respA->assertStatus(422);
        $this->assertStringContainsString('audit trail', $respA->json('message'));

        // Kasus 2: Rak dengan riwayat afkir yang sudah di-void
        BaglogCull::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'B-01-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 1,
            'reason' => 'TRICHODERMA',
            'voided_at' => now(),
            'void_reason' => 'Afkir void audit trail',
        ]);

        $respB = $this->deleteJson('/api/racks/B');
        $respB->assertStatus(422);
        $this->assertStringContainsString('audit trail', $respB->json('message'));
    }

    /**
     * AUD-10 & Probe P38:
     * - Penempatan ulang pasangan (batch_id, slot_code) yang sama dilarang (HTTP 422)
     *   untuk mencegah korupsi mutasi afkir yang menyebabkan kapasitas langsung nol.
     */
    public function test_aud10_same_batch_cannot_be_reassigned_to_same_slot(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 50,
            'status' => 'active',
            'entry_date' => now()->subDays(10)->toDateString(),
        ]);

        // 1. Alokasi awal batch ke slot C-01-01
        $assignment = BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'C-01-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'FRUITING',
            'assigned_at' => now()->subDays(10)->toDateString(),
        ]);

        // 2. Tutup siklus slot C-01-01 (menghasilkan afkir HABIS_PRODUKSI 10 baglog di C-01-01)
        $this->postJson("/api/batch-slot-assignments/{$assignment->id}/complete", [
            'reason' => 'EXHAUSTED',
            'date' => now()->toDateString(),
        ])->assertStatus(200);

        // 3. Coba masukkan batch yang sama lagi ke slot C-01-01 yang sama
        $respDuplicate = $this->postJson('/api/batch-slot-assignments', [
            'baglog_batch_id' => $batch->id,
            'assigned_at' => now()->toDateString(),
            'slots' => [
                [
                    'slot_code' => 'C-01-01',
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => 'LEVEL_2',
                ],
            ],
        ]);

        // Harus ditolak HTTP 422 untuk mencegah Probe P38 zero capacity bug
        $respDuplicate->assertStatus(422);
        $this->assertStringContainsString('sudah pernah dialokasikan ke slot', $respDuplicate->json('message'));
    }

    // ─────────────────────────────────────────────────────────────
    // SPRINT 4: OPTIMASI QUERY, HPP STABIL & AUDIT TRAIL EXPENSES
    // ─────────────────────────────────────────────────────────────

    /**
     * AUD-07 & Probe P21:
     * - Model OperationalExpense menggunakan trait HasVoid (soft-void state).
     * - Penghapusan / void biaya operasional menjaga rekaman audit trail di database.
     * - Biaya yang di-void otomatis dikecualikan dari list dan kalkulasi HPP.
     */
    public function test_aud07_operational_expenses_use_void_soft_state(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
            'price_per_baglog' => 5000,
            'entry_date' => now()->toDateString(),
        ]);

        $exp1 = OperationalExpense::create([
            'baglog_batch_id' => $batch->id,
            'expense_date' => now()->toDateString(),
            'category' => 'LISTRIK',
            'amount' => 100000,
            'notes' => 'Listrik Kumbung',
        ]);

        $exp2 = OperationalExpense::create([
            'baglog_batch_id' => $batch->id,
            'expense_date' => now()->toDateString(),
            'category' => 'NUTRISI',
            'amount' => 50000,
            'notes' => 'Nutrisi Tambahan',
        ]);

        // Cek awal biaya operasional pada HPP
        $hppBefore = $this->getJson("/api/baglogs/{$batch->id}/hpp")->json('data');
        $this->assertEquals(150000, $hppBefore['biaya_operasional']);

        // 1. Batalkan exp1 via rute void eksplisit
        $respVoid = $this->postJson("/api/operational-expenses/{$exp1->id}/void", [
            'reason' => 'Salah catat nota listrik ganda',
        ]);
        $respVoid->assertStatus(200);

        // Rekaman exp1 harus tetap ada di DB (tidak hard delete) tapi ter-void
        $exp1Db = OperationalExpense::withVoided()->find($exp1->id);
        $this->assertNotNull($exp1Db);
        $this->assertTrue($exp1Db->isVoided());
        $this->assertEquals('Salah catat nota listrik ganda', $exp1Db->void_reason);
        $this->assertEquals($this->admin->id, $exp1Db->voided_by);

        // 2. Batalkan exp2 via HTTP DELETE (soft-void)
        $respDel = $this->deleteJson("/api/operational-expenses/{$exp2->id}", [
            'reason' => 'Dibatalkan admin via tombol hapus',
        ]);
        $respDel->assertStatus(200);

        $exp2Db = OperationalExpense::withVoided()->find($exp2->id);
        $this->assertNotNull($exp2Db);
        $this->assertTrue($exp2Db->isVoided());

        // 3. Verifikasi list /api/operational-expenses kosong dari data valid
        $listResp = $this->getJson('/api/operational-expenses')->assertStatus(200);
        $this->assertEquals(0, $listResp->json('data.total_amount'));
        $this->assertEmpty($listResp->json('data.expenses'));

        // 4. Verifikasi HPP batch sekarang menjadi 0 (kedua expense telah di-void)
        $hppAfter = $this->getJson("/api/baglogs/{$batch->id}/hpp")->json('data');
        $this->assertEquals(0, $hppAfter['biaya_operasional']);
    }

    /**
     * AUD-08, AUD-16 & Probe P08:
     * - Endpoint /api/harvests dan /api/baglogs/hpp-summary tetap bounded dalam query budget (O(1) queries).
     */
    public function test_aud08_harvests_and_hpp_endpoints_stay_within_query_budget(): void
    {
        Sanctum::actingAs($this->admin);

        // Buat 5 batch dan 15 panen
        $batches = [];
        for ($i = 1; $i <= 5; $i++) {
            $batches[] = BaglogBatch::factory()->create([
                'user_id' => $this->admin->id,
                'quantity' => 50,
                'price_per_baglog' => 5000,
                'entry_date' => now()->subDays($i * 5)->toDateString(),
            ]);
        }

        foreach ($batches as $b) {
            for ($h = 1; $h <= 3; $h++) {
                Harvest::create([
                    'user_id' => $this->admin->id,
                    'baglog_batch_id' => $b->id,
                    'harvest_date' => now()->toDateString(),
                    'weight_kg' => 2.0,
                    'flush_number' => $h,
                    'quality_grade' => 'A',
                ]);
            }
        }

        // Hitung query pada GET /api/harvests (15 baris)
        \DB::enableQueryLog();
        \DB::flushQueryLog();
        $this->getJson('/api/harvests')->assertStatus(200);
        $harvestQueries = count(\DB::getQueryLog());
        // Seharusnya <= 5 queries (bukan 15 * 3 = 45 queries)
        $this->assertLessThanOrEqual(5, $harvestQueries, "Jumlah query /api/harvests ({$harvestQueries}) melebihi budget O(1)");

        // Hitung query pada GET /api/baglogs/hpp-summary (5 batch)
        \DB::flushQueryLog();
        $this->getJson('/api/baglogs/hpp-summary')->assertStatus(200);
        $hppQueries = count(\DB::getQueryLog());
        // Seharusnya <= 10 queries (bukan 5 * 8 = 40+ queries)
        $this->assertLessThanOrEqual(10, $hppQueries, "Jumlah query /api/baglogs/hpp-summary ({$hppQueries}) melebihi budget O(1)");
        \DB::disableQueryLog();
    }

    /**
     * AUD-15 & Probe P07, P37:
     * - Endpoint /api/dashboard/stats menampilkan assigned_quantity dan unassigned_quantity yang akurat pada latest_batches.
     * - Membedakan active_on_rack dari unassigned_quantity.
     */
    public function test_p07_dashboard_latest_batches_shows_assigned_quantity(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
            'entry_date' => now()->toDateString(),
            'status' => 'active',
        ]);

        // Alokasikan 30 baglog ke 3 slot (A-01-01, A-01-02, A-01-03)
        foreach (['A-01-01', 'A-01-02', 'A-01-03'] as $slot) {
            BatchSlotAssignment::create([
                'baglog_batch_id' => $batch->id,
                'slot_code' => $slot,
                'initial_quantity' => 10,
                'initial_mycelium_stage' => 'LEVEL_2',
                'current_status' => 'INCUBATION',
                'assigned_at' => now()->toDateString(),
            ]);
        }

        $res = $this->getJson('/api/dashboard/stats')->assertStatus(200);
        $data = $res->json('data');

        // Probe P07: latest_batches HARUS memiliki assigned_quantity = 30 dan unassigned_quantity = 70
        $latestBatch = collect($data['latest_batches'])->firstWhere('id', $batch->id);
        $this->assertNotNull($latestBatch);
        $this->assertEquals(30, $latestBatch['assigned_quantity']);
        $this->assertEquals(70, $latestBatch['unassigned_quantity']);
        $this->assertEquals(3, $latestBatch['assigned_slots_count']);

        // Probe P37: active_on_rack = 30 dan unassigned_quantity = 70 pada root summary
        $this->assertEquals(100, $data['active_baglogs']);
        $this->assertEquals(30, $data['active_on_rack']);
        $this->assertEquals(70, $data['unassigned_quantity']);
    }

    /**
     * AUD-11 & Probe P22:
     * - Alokasi overhead tidak mendistorsi batch masa lalu secara retroaktif saat batch baru masuk.
     */
    public function test_p22_overhead_allocation_is_not_diluted_retroactively(): void
    {
        Sanctum::actingAs($this->admin);

        // Batch 1 dibeli 60 hari lalu
        $b1 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
            'price_per_baglog' => 5000,
            'entry_date' => now()->subDays(60)->toDateString(),
        ]);

        // Biaya overhead bersama (listrik umum kumbung) 50 hari lalu
        OperationalExpense::create([
            'expense_date' => now()->subDays(50)->toDateString(),
            'category' => 'LISTRIK',
            'amount' => 1000000,
        ]);

        $shareBefore = $this->getJson("/api/baglogs/{$b1->id}/hpp")->json('data.biaya_operasional');
        $this->assertEquals(1000000, $shareBefore);

        // Batch 2 dibeli hari ini (50 hari SETELAH biaya listrik terjadi)
        $b2 = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 3000,
            'price_per_baglog' => 5000,
            'entry_date' => now()->toDateString(),
        ]);

        // AUD-11 Fix: Biaya b1 TETAP 1.000.000 (tidak terdilusi menjadi 500.000)
        $shareAfter = $this->getJson("/api/baglogs/{$b1->id}/hpp")->json('data.biaya_operasional');
        $this->assertEquals(1000000, $shareAfter);

        // Batch 2 yang baru masuk TIDAK menanggung biaya masa lalu
        $b2Share = $this->getJson("/api/baglogs/{$b2->id}/hpp")->json('data.biaya_operasional');
        $this->assertEquals(0, $b2Share);
    }

    /**
     * AUD-13 & Probe P24:
     * - Rekonsiliasi omzet ringkasan HPP terhadap penjualan tanpa batch.
     */
    public function test_p24_hpp_summary_reconciles_unattributed_sales(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 20,
            'price_per_baglog' => 5000,
            'entry_date' => now()->toDateString(),
        ]);

        // Penjualan tanpa batch (misal penjualan gabungan di toko fisik)
        Sale::create([
            'user_id' => $this->admin->id,
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 4.0,
            'price_per_kg' => 25000,
            'total_revenue' => 100000,
            'buyer_name' => 'Toko Tanpa Batch',
        ]);

        // Penjualan terikat batch
        Sale::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 2.0,
            'price_per_kg' => 25000,
            'total_revenue' => 50000,
            'buyer_name' => 'Toko Batch Terikat',
        ]);

        $summary = $this->getJson('/api/baglogs/hpp-summary')->json('data');

        $this->assertEquals(50000, $summary['total_sales_revenue']);
        $this->assertEquals(100000, $summary['unattributed_sales_revenue']);
        $this->assertEquals(150000, $summary['farm_total_sales_revenue']);
    }

    /**
     * Helper asersi regex negatif
     */
    private function assertDoesNotMatch(string $actual, string $pattern, string $message = ''): void
    {
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $actual, 'Harus berformat YYYY-MM-DD');
        $this->assertEquals(0, preg_match($pattern, $actual), $message);
    }
}
