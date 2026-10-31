<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Models\Customer;
use App\Models\Harvest;
use App\Models\Sale;
use App\Models\Slot;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Feature Test Suite untuk Modul Supply Chain Management (SCM) & WMS.
 *
 * Menguji:
 * 1. RBAC Shield: Perlindungan hak akses role:admin untuk seluruh endpoint SCM.
 * 2. Master Supplier & Supplier Performance Scorecard.
 * 3. Proyeksi Kapasitas Kumbung & Restock / PO Advisor (Hard Cap 3.000).
 * 4. Master Customer & Analitik Segmentasi Pasar (Tengkulak vs Resto).
 * 5. End-to-End Traceability (Supplier -> Batch -> Slot -> Panen -> Penjualan).
 * 6. Query Budget: Memastikan operasi analitik bebas N+1 query.
 */
class ScmSupplyChainTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $worker;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create([
            'email' => 'admin_scm@smartshroom.test',
        ]);

        $this->worker = User::factory()->create([
            'email' => 'worker_scm@smartshroom.test',
            'role' => 'worker',
        ]);
    }

    /**
     * Uji 1: Seluruh rute SCM wajib ditolak untuk role worker atau unauthenticated (401/403).
     */
    public function test_scm_endpoints_are_protected_by_rbac_admin(): void
    {
        $supplier = Supplier::create([
            'name' => 'Supplier RBAC Test',
            'lead_time_days' => 5,
        ]);

        $customer = Customer::create([
            'name' => 'Customer RBAC Test',
            'category' => Customer::CATEGORY_RESTO,
        ]);

        $protectedUrls = [
            ['GET', '/api/suppliers'],
            ['POST', '/api/suppliers'],
            ['GET', '/api/suppliers/comparison'],
            ['GET', "/api/suppliers/{$supplier->id}/scorecard"],
            ['GET', '/api/scm/capacity-snapshot'],
            ['GET', '/api/scm/capacity-forecast'],
            ['GET', '/api/scm/restock-recommendations'],
            ['GET', '/api/customers'],
            ['POST', '/api/customers'],
            ['GET', '/api/customers/analytics'],
            ['GET', '/api/scm/traceability/batch/BL-TEST-001'],
        ];

        foreach ($protectedUrls as [$method, $url]) {
            // Unauthenticated -> 401 or 403 (Forbidden by FormRequest authorize before unauthenticated handling)
            $resGuest = $this->json($method, $url);
            $this->assertContains($resGuest->status(), [401, 403, 404, 405], "Failed guest check on {$method} {$url}");

            // Worker -> 403 Forbidden
            $resWorker = $this->actingAs($this->worker)->json($method, $url);
            $this->assertEquals(403, $resWorker->status(), "Failed worker check on {$method} {$url}");
        }
    }

    /**
     * Uji 2: Master Supplier CRUD & Supplier Performance Scorecard.
     */
    public function test_supplier_crud_and_scorecard_calculation(): void
    {
        // 1. Create Supplier via API
        $createRes = $this->actingAs($this->admin)->postJson('/api/suppliers', [
            'name' => 'CV Bibit Unggul Lestari',
            'contact_person' => 'Bambang',
            'phone' => '081234567890',
            'lead_time_days' => 6,
        ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('data.name', 'CV Bibit Unggul Lestari')
            ->assertJsonPath('data.lead_time_days', 6);

        $supplierId = $createRes->json('data.id');

        // 2. Buat batch yang terhubung ke supplier ini
        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'supplier_id' => $supplierId,
            'batch_code' => 'BL-20261030-001',
            'entry_date' => Carbon::now()->subDays(25)->toDateString(),
            'quantity' => 200,
            'rejected_at_arrival' => 10, // 10 reject saat bongkar muat
            'price_per_baglog' => 3200.00,
        ]);

        // Cek backward-compatible supplier string
        $this->assertEquals('CV Bibit Unggul Lestari', $batch->supplier);

        // Buat slot dan afkir dini (hari ke-10, bukan habis produksi)
        Slot::create(['slot_code' => 'A-01-01', 'row' => 'A', 'bay' => 1, 'tier' => 1, 'max_capacity' => 10]);
        BaglogCull::create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'A-01-01',
            'cull_date' => Carbon::parse($batch->entry_date)->addDays(10)->toDateString(),
            'quantity' => 6,
            'reason' => 'KONTAMINASI_HIJAU',
        ]);

        // Tambah panen Grade A
        Harvest::factory()->create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'harvest_date' => Carbon::now()->toDateString(),
            'weight_kg' => 70.00,
            'quality_grade' => 'GRADE_A',
        ]);

        // 3. Scorecard API
        $scoreRes = $this->actingAs($this->admin)->getJson("/api/suppliers/{$supplierId}/scorecard");
        $scoreRes->assertOk();

        $data = $scoreRes->json('data');
        $this->assertEquals(200, $data['total_baglogs_received']);
        $this->assertEquals(10, $data['total_rejected_at_arrival']);

        // Arrival Defect Rate: 10 / (200 + 10) * 100 = 4.76%
        $this->assertEquals(4.76, $data['arrival_defect_rate_percent']);

        // Early Mortality: 6 / 200 * 100 = 3.00%
        $this->assertEquals(3.00, $data['early_mortality_rate_percent']);

        // Yield: 70 kg / 200 baglog = 0.35 kg/baglog
        $this->assertEquals(0.35, $data['avg_yield_kg_per_baglog']);

        // Comparison API
        $compRes = $this->actingAs($this->admin)->getJson('/api/suppliers/comparison');
        $compRes->assertOk()
            ->assertJsonPath('success', true);
        $this->assertGreaterThanOrEqual(1, count($compRes->json('data.suppliers')));
    }

    /**
     * Uji 3: Perencanaan Kapasitas Kumbung & Restock Advisor (Patuhi limit fisik 3.000).
     */
    public function test_capacity_forecast_and_restock_recommendations(): void
    {
        // Setup slot rak A
        $slot1 = Slot::create(['slot_code' => 'A-01-01', 'row' => 'A', 'bay' => 1, 'tier' => 1, 'max_capacity' => 10]);
        $slot2 = Slot::create(['slot_code' => 'A-01-02', 'row' => 'A', 'bay' => 1, 'tier' => 2, 'max_capacity' => 10]);

        $supplier = Supplier::create([
            'name' => 'Supplier Rekomendasi Utama',
            'lead_time_days' => 5,
            'is_active' => true,
        ]);

        $oldBatch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'supplier_id' => $supplier->id,
            'batch_code' => 'BL-OLD-001',
            'entry_date' => Carbon::now()->subDays(115)->toDateString(),
            'quantity' => 100,
        ]);

        // Assignment yang mendekati flush 6
        $assign = BatchSlotAssignment::create([
            'baglog_batch_id' => $oldBatch->id,
            'slot_code' => 'A-01-02',
            'assigned_at' => Carbon::now()->subDays(60)->toDateString(),
            'initial_quantity' => 10,
            'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_3,
            'current_status' => 'FRUITING',
        ]);

        Harvest::factory()->create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $oldBatch->id,
            'slot_code' => 'A-01-02',
            'harvest_date' => Carbon::now()->toDateString(),
            'weight_kg' => 2.5,
            'flush_number' => 6,
        ]);

        // Test capacity snapshot
        $snapRes = $this->actingAs($this->admin)->getJson('/api/scm/capacity-snapshot');
        $snapRes->assertOk()
            ->assertJsonPath('data.max_farm_capacity', 3000);

        // Test forecast
        $forecastRes = $this->actingAs($this->admin)->getJson('/api/scm/capacity-forecast');
        $forecastRes->assertOk();
        $this->assertArrayHasKey('forecast_windows', $forecastRes->json('data'));

        // Test restock recommendation
        $recomRes = $this->actingAs($this->admin)->getJson('/api/scm/restock-recommendations');
        $recomRes->assertOk();

        $recomData = $recomRes->json('data');
        $this->assertTrue($recomData['action_required']);
        $this->assertLessThanOrEqual(3000, $recomData['recommended_quantity']);
        $this->assertEquals('Supplier Rekomendasi Utama', $recomData['recommended_supplier']['name']);
        $this->assertNotNull($recomData['recommended_order_date']);
    }

    /**
     * Uji 4: Master Pelanggan & Analisis Segmentasi Pasar Penjualan.
     */
    public function test_customer_crud_and_segmentation_analytics(): void
    {
        // 1. Buat Customer via API
        $custRes = $this->actingAs($this->admin)->postJson('/api/customers', [
            'name' => 'Resto Jamur Enak',
            'category' => Customer::CATEGORY_RESTO,
            'phone' => '081999888777',
            'address' => 'Pusat Kuliner No. 7',
        ]);

        $custRes->assertStatus(201)
            ->assertJsonPath('data.category', 'RESTO');
        $customerId = $custRes->json('data.id');

        // 2. Buat panen untuk stok jual
        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
        ]);

        Harvest::factory()->create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'harvest_date' => Carbon::now()->toDateString(),
            'weight_kg' => 50.00,
            'quality_grade' => 'GRADE_A',
        ]);

        // 3. Catat Penjualan ke Customer ini via API
        $saleRes = $this->actingAs($this->admin)->postJson('/api/sales', [
            'sale_date' => Carbon::now()->toDateString(),
            'customer_id' => $customerId,
            'baglog_batch_id' => $batch->id,
            'quantity_kg' => 20.00,
            'price_per_kg' => 30000,
        ]);

        $saleRes->assertStatus(201);
        $this->assertEquals('Resto Jamur Enak', $saleRes->json('data.buyer_name'));

        // 4. Test Customer Analytics
        $analyticsRes = $this->actingAs($this->admin)->getJson('/api/customers/analytics');
        $analyticsRes->assertOk();

        $segments = $analyticsRes->json('data.segments');
        $this->assertEquals(20.0, $segments['RESTO']['total_kg']);
        $this->assertEquals(600000.0, $segments['RESTO']['total_revenue']);
        $this->assertEquals(30000.0, $segments['RESTO']['avg_price_per_kg']);
    }

    /**
     * Uji 5: End-to-End Traceability (Supplier -> Batch -> Slot -> Panen -> Penjualan).
     */
    public function test_end_to_end_traceability_lifecycle(): void
    {
        // 1. Pemasok
        $supplier = Supplier::create([
            'name' => 'PT Agro Bibit Nusantara',
            'contact_person' => 'Ir. Hendra',
            'phone' => '08111222333',
            'lead_time_days' => 5,
        ]);

        // 2. Batch Bibit Masuk
        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'supplier_id' => $supplier->id,
            'batch_code' => 'BL-TRACE-2026',
            'po_number' => 'PO-TRACE-01',
            'entry_date' => Carbon::now()->subDays(30)->toDateString(),
            'quantity' => 100,
            'rejected_at_arrival' => 2,
            'price_per_baglog' => 3000,
        ]);

        // 3. Alokasi Spasial ke Slot Rak
        $slot = Slot::create([
            'slot_code' => 'B-02-05',
            'row' => 'B',
            'bay' => 2,
            'tier' => 5,
            'max_capacity' => 10,
        ]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'B-02-05',
            'assigned_at' => Carbon::now()->subDays(25)->toDateString(),
            'initial_quantity' => 10,
            'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_3,
            'current_status' => 'FRUITING',
        ]);

        // 4. Panen
        Harvest::factory()->create([
            'user_id' => $this->admin->id,
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'B-02-05',
            'harvest_date' => Carbon::now()->subDays(5)->toDateString(),
            'weight_kg' => 15.00,
            'quality_grade' => 'GRADE_A',
            'flush_number' => 1,
        ]);

        // 5. Pembeli & Penjualan
        $customer = Customer::create([
            'name' => 'Hotel Grand Shroom',
            'category' => Customer::CATEGORY_RESTO,
            'phone' => '021-998877',
        ]);

        $sale = Sale::create([
            'user_id' => $this->admin->id,
            'customer_id' => $customer->id,
            'baglog_batch_id' => $batch->id,
            'sale_date' => Carbon::now()->subDays(2)->toDateString(),
            'quantity_kg' => 10.00,
            'price_per_kg' => 35000,
            'total_revenue' => 350000,
            'buyer_name' => 'Hotel Grand Shroom',
        ]);

        // 6. Uji Endpoint Batch Traceability
        $batchTraceRes = $this->actingAs($this->admin)->getJson('/api/scm/traceability/batch/BL-TRACE-2026');
        $batchTraceRes->assertOk();

        $bData = $batchTraceRes->json('data');
        $this->assertEquals('PT Agro Bibit Nusantara', $bData['upstream']['supplier_name']);
        $this->assertEquals(2, $bData['upstream']['rejected_at_arrival']);
        $this->assertEquals(['B'], $bData['midstream']['racks_utilized']);
        $this->assertEquals(15.0, $bData['production']['sellable_harvest_kg']);
        $this->assertEquals(10.0, $bData['downstream']['total_sold_kg']);
        $this->assertTrue($bData['traceability_chain_status']['end_to_end_complete']);

        // 7. Uji Endpoint Sale Traceability
        $saleTraceRes = $this->actingAs($this->admin)->getJson("/api/scm/traceability/sale/{$sale->id}");
        $saleTraceRes->assertOk();

        $sData = $saleTraceRes->json('data');
        $this->assertEquals('Hotel Grand Shroom', $sData['buyer']['buyer_name']);
        $this->assertEquals('BL-TRACE-2026', $sData['origin']['batch_code']);
        $this->assertEquals('PT Agro Bibit Nusantara', $sData['origin']['supplier_name']);
        $this->assertContains('B-02-05', $sData['origin']['slots_grown']);
    }

    /**
     * Uji 6: Query Budget Verification (Mencegah N+1 query loop pada kalkulasi SCM).
     */
    public function test_scm_endpoints_execute_within_query_budget(): void
    {
        // Seed sejumlah batch dan supplier
        for ($i = 1; $i <= 3; $i++) {
            $supp = Supplier::create([
                'name' => "Supplier Query {$i}",
                'lead_time_days' => 5 + $i,
            ]);

            $b = BaglogBatch::factory()->create([
                'user_id' => $this->admin->id,
                'supplier_id' => $supp->id,
                'batch_code' => "BL-QUERY-{$i}",
                'quantity' => 100,
            ]);

            Harvest::factory()->create([
                'user_id' => $this->admin->id,
                'baglog_batch_id' => $b->id,
                'weight_kg' => 10.0,
                'harvest_date' => Carbon::now()->toDateString(),
            ]);
        }

        // Hitung query pada supplier comparison
        DB::enableQueryLog();
        $this->actingAs($this->admin)->getJson('/api/suppliers/comparison')->assertOk();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Query tidak boleh meledak melebihi 15 query
        $this->assertLessThanOrEqual(15, count($queries), 'Query comparison supplier melebihi budget.');
    }
}
