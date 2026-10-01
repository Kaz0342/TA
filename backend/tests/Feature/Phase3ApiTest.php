<?php

namespace Tests\Feature;

use App\Models\BaglogBatch;
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

class Phase3ApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $worker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SlotSeeder::class);

        $this->admin = User::factory()->admin()->create();
        $this->worker = User::factory()->create();
    }

    /**
     * Test GET /api/slots & GET /api/slots/{code} & heatmap
     */
    public function test_slots_endpoints(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Get all slots
        $response = $this->getJson('/api/slots?row=A');
        $response->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertCount(100, $response->json('data')); // 10 bay x 10 tier = 100 slots in Row A

        // 2. Get specific slot detail
        $slotDetail = $this->getJson('/api/slots/A-01-01');
        $slotDetail->assertStatus(200)
            ->assertJsonPath('data.slot_code', 'A-01-01')
            ->assertJsonPath('data.is_occupied', false);

        // 3. Heatmap
        $heatmap = $this->getJson('/api/slots/heatmap');
        $heatmap->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test POST /api/batch-slot-assignments (Bulk assignment)
     */
    public function test_batch_slot_assignment_flow(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
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
                [
                    'slot_code' => 'A-01-02',
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => 'LEVEL_3',
                ],
            ],
        ];

        $response = $this->postJson('/api/batch-slot-assignments', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('data.total_assigned', 2);

        // Cek bahwa slot A-01-01 sekarang berstatus occupied
        $this->assertTrue(Slot::find('A-01-01')->isOccupied());

        // Coba assign ke slot yang sama -> harus ditolak (422)
        $dupResponse = $this->postJson('/api/batch-slot-assignments', $payload);
        $dupResponse->assertStatus(422);
    }

    /**
     * Test POST & GET /api/baglog-culls (Ledger afkir & validasi kapasitas)
     */
    public function test_baglog_cull_flow(): void
    {
        Sanctum::actingAs($this->worker);

        $batch = BaglogBatch::factory()->create(['user_id' => $this->admin->id]);

        BatchSlotAssignment::create([
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'B-02-01',
            'initial_quantity' => 10,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => 'INCUBATION',
            'assigned_at' => now()->toDateString(),
        ]);

        // Coba buang 15 baglog (padahal isi cuma 10) -> Harus ditolak (422)
        $invalidCull = $this->postJson('/api/baglog-culls', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'B-02-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 15,
            'reason' => 'TRICHODERMA',
        ]);
        $invalidCull->assertStatus(422);

        // Buang 3 baglog (valid)
        $validCull = $this->postJson('/api/baglog-culls', [
            'baglog_batch_id' => $batch->id,
            'slot_code' => 'B-02-01',
            'cull_date' => now()->toDateString(),
            'quantity' => 3,
            'reason' => 'TRICHODERMA',
            'notes' => 'Ada spora hijau',
        ]);
        $validCull->assertStatus(201)
            ->assertJsonPath('data.slot_active_capacity_remaining', 7);

        // Cek ledger index
        $indexResponse = $this->getJson("/api/baglog-culls?slot_code=B-02-01");
        $indexResponse->assertStatus(200);
        $this->assertCount(1, $indexResponse->json('data'));
    }

    /**
     * Test HPP & Margin Kontribusi endpoint
     */
    public function test_hpp_endpoints(): void
    {
        Sanctum::actingAs($this->admin);

        $batch = BaglogBatch::factory()->create([
            'user_id' => $this->admin->id,
            'quantity' => 100,
            'price_per_baglog' => 3000.00,
        ]);

        $response = $this->getJson("/api/baglogs/{$batch->id}/hpp");
        $response->assertStatus(200)
            ->assertJsonPath('data.modal_baglog_awal', 300000)
            ->assertJsonPath('data.margin_kontribusi', -300000); // Belum ada omzet

        $summary = $this->getJson('/api/baglogs/hpp-summary');
        $summary->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test Quick Buttons: buyer-ranking & price-trend
     */
    public function test_sales_helpers_endpoints(): void
    {
        Sanctum::actingAs($this->admin);

        // Buat beberapa record penjualan
        Sale::create([
            'user_id' => $this->admin->id,
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 10.00,
            'price_per_kg' => 25000.00,
            'total_revenue' => 250000.00,
            'buyer_name' => 'Pak Joko',
        ]);

        Sale::create([
            'user_id' => $this->admin->id,
            'sale_date' => now()->toDateString(),
            'quantity_kg' => 15.00,
            'price_per_kg' => 28000.00,
            'total_revenue' => 420000.00,
            'buyer_name' => 'Pak Joko',
        ]);

        $ranking = $this->getJson('/api/sales/buyer-ranking');
        $ranking->assertStatus(200)
            ->assertJsonPath('data.0.buyer_name', 'Pak Joko')
            ->assertJsonPath('data.0.freq', 2);

        $priceTrend = $this->getJson('/api/sales/price-trend');
        $priceTrend->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test Operational Expenses CRUD
     */
    public function test_operational_expenses_endpoints(): void
    {
        Sanctum::actingAs($this->admin);

        $postRes = $this->postJson('/api/operational-expenses', [
            'expense_date' => now()->toDateString(),
            'category' => 'LISTRIK',
            'amount' => 150000.00,
            'notes' => 'Token listrik kumbung',
        ]);
        $postRes->assertStatus(201);
        $expenseId = $postRes->json('data.id');

        $getRes = $this->getJson('/api/operational-expenses');
        $getRes->assertStatus(200)
            ->assertJsonPath('data.total_amount', 150000);

        $delRes = $this->deleteJson("/api/operational-expenses/{$expenseId}");
        $delRes->assertStatus(200);
    }

    /**
     * Test GET /api/sensor-data/chart & agregasi data sensor (F-06).
     */
    public function test_sensor_data_chart_endpoint_and_aggregation(): void
    {
        Sanctum::actingAs($this->worker);

        // Buat 105 data sensor berkala dalam rentang 12 jam terakhir
        $baseTime = now()->subHours(12);
        for ($i = 0; $i < 105; $i++) {
            \App\Models\SensorData::factory()->create([
                'temperature' => 26.5 + ($i % 5) * 0.2,
                'humidity' => 88.0 + ($i % 4) * 0.5,
                'recorded_at' => (clone $baseTime)->addMinutes($i * 6),
            ]);
        }

        $res = $this->getJson('/api/sensor-data/chart?hours=12');
        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotEmpty($res->json('data'));
        $firstItem = $res->json('data')[0];
        $this->assertArrayHasKey('temperature', $firstItem);
        $this->assertArrayHasKey('humidity', $firstItem);
        $this->assertArrayHasKey('recorded_at', $firstItem);
        $this->assertArrayHasKey('time_label', $firstItem);
    }

    /**
     * Test GET /api/sensor-data/chart dengan filter device_id (F-16).
     */
    public function test_sensor_data_chart_filter_by_device_id(): void
    {
        Sanctum::actingAs($this->worker);

        $baseTime = now()->subHours(5);

        // Buat 10 data untuk ESP32-KUMBUNG-01
        for ($i = 0; $i < 10; $i++) {
            \App\Models\SensorData::factory()->create([
                'device_id' => 'ESP32-KUMBUNG-01',
                'temperature' => 25.0,
                'humidity' => 85.0,
                'recorded_at' => (clone $baseTime)->addMinutes($i * 10),
            ]);
        }

        // Buat 10 data untuk SIM-KUMBUNG-01
        for ($i = 0; $i < 10; $i++) {
            \App\Models\SensorData::factory()->create([
                'device_id' => 'SIM-KUMBUNG-01',
                'temperature' => 29.0,
                'humidity' => 70.0,
                'recorded_at' => (clone $baseTime)->addMinutes($i * 10),
            ]);
        }

        // Request chart khusus SIM-KUMBUNG-01
        $res = $this->getJson('/api/sensor-data/chart?hours=6&device_id=SIM-KUMBUNG-01');
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.device_id', 'SIM-KUMBUNG-01')
            ->assertJsonPath('meta.total_readings', 10);

        $data = $res->json('data');
        $this->assertCount(10, $data);
        foreach ($data as $item) {
            $this->assertEquals(29.0, $item['temperature']);
        }
    }
}

