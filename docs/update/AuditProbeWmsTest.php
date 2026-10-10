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
 * PROBE OBSERVASIONAL untuk audit WMS & SCM (basis commit 3b17f60).
 *
 * Tidak men-assert "benar/salah": hanya merekam perilaku nyata kode ke JSON agar bisa dikutip pada laporan audit.
 * Semua probe selalu "lulus"; yang penting adalah isi berkas keluaran:
 *   backend/storage/app/audit_probe_results.json
 *
 * Cara pakai (salin berkas ini ke backend/tests/Feature/):
 *   php artisan test --filter=AuditProbeWmsTest
 * Prasyarat: ekstensi PHP bcmath (php8.3-bcmath).
 * Berkas ini bukan bagian dari suite produk; hapus setelah selesai dipakai.
 */
class AuditProbeWmsTest extends TestCase
{
    use RefreshDatabase;


    private static array $R = [];

    private static function out(): string
    {
        // tests/Feature -> backend (dua tingkat ke atas); tidak memakai helper Laravel karena dipanggil dari tearDownAfterClass
        return dirname(__DIR__, 2).'/storage/app/audit_probe_results.json';
    }

    private User $admin;
    private User $worker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SlotSeeder::class);
        $this->admin = User::factory()->admin()->create();
        $this->worker = User::factory()->create(['role' => User::ROLE_WORKER]);
    }

    public static function tearDownAfterClass(): void
    {
        @mkdir(dirname(self::out()), 0777, true);
        $existing = is_file(self::out()) ? (json_decode(file_get_contents(self::out()), true) ?: []) : [];
        file_put_contents(self::out(), json_encode(array_merge($existing, self::$R), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        parent::tearDownAfterClass();
    }

    // ───────────── helpers ─────────────

    private function probe(string $id, callable $fn): void
    {
        try {
            self::$R[$id] = $fn();
        } catch (\Throwable $e) {
            self::$R[$id] = ['EXCEPTION' => get_class($e).': '.substr($e->getMessage(), 0, 300)];
        }
        $this->assertTrue(true);
    }

    private function batch(array $o = []): BaglogBatch
    {
        return BaglogBatch::factory()->create(array_merge(['user_id' => $this->admin->id, 'quantity' => 10], $o));
    }

    private function assign(BaglogBatch $b, string $slot, int $qty = 10, string $status = 'INCUBATION', ?string $date = null): BatchSlotAssignment
    {
        return BatchSlotAssignment::create([
            'baglog_batch_id' => $b->id,
            'slot_code' => $slot,
            'initial_quantity' => $qty,
            'initial_mycelium_stage' => 'LEVEL_2',
            'current_status' => $status,
            'assigned_at' => $date ?? now()->toDateString(),
        ]);
    }

    private function as(User $u): void
    {
        Sanctum::actingAs($u);
    }

    private function queries(callable $fn): array
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $res = $fn();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return [$n, $res];
    }

    // ───────────── probes ─────────────

    public function test_p01_worker_can_dispose_batch(): void
    {
        $this->probe('P01_worker_dispose_batch', function () {
            $b = $this->batch(['quantity' => 20]);
            $a1 = $this->assign($b, 'A-01-01');
            $a2 = $this->assign($b, 'A-01-02');
            $this->as($this->worker);
            $r = $this->patchJson("/api/baglogs/{$b->id}/status", ['status' => 'disposed']);
            $b->refresh();

            return [
                'http' => $r->status(),
                'batch_status' => $b->status,
                'assignments' => BatchSlotAssignment::pluck('current_status', 'slot_code')->all(),
                'culls' => BaglogCull::select('slot_code', 'quantity', 'reason')->get()->toArray(),
            ];
        });
    }

    public function test_p02_worker_void_access(): void
    {
        $this->probe('P02_worker_void_access', function () {
            $b = $this->batch();
            $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $h = Harvest::create(['user_id' => $this->admin->id, 'baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01', 'harvest_date' => now()->toDateString(), 'weight_kg' => 3, 'flush_number' => 1, 'quality_grade' => 'A']);
            $c = BaglogCull::create(['baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01', 'cull_date' => now()->toDateString(), 'quantity' => 2, 'reason' => 'HAMA']);
            $s = \App\Models\Sale::create(['user_id' => $this->admin->id, 'sale_date' => now()->toDateString(), 'quantity_kg' => 1, 'price_per_kg' => 25000, 'total_revenue' => 25000, 'buyer_name' => 'X']);
            $this->as($this->worker);
            $out = [];
            $out['worker_void_harvest'] = $this->postJson("/api/harvests/{$h->id}/void", ['reason' => 'worker coba void'])->status();
            $out['worker_void_cull'] = $this->postJson("/api/baglog-culls/{$c->id}/void", ['reason' => 'worker coba void'])->status();
            $out['worker_void_sale'] = $this->postJson("/api/sales/{$s->id}/void", ['reason' => 'worker coba void'])->status();
            $out['worker_get_hpp_summary'] = $this->getJson('/api/baglogs/hpp-summary')->status();
            $out['worker_get_sales_list'] = $this->getJson('/api/sales')->status();
            $out['worker_get_expenses'] = $this->getJson('/api/operational-expenses')->status();
            $out['worker_post_baglogs'] = $this->postJson('/api/baglogs', ['entry_date' => now()->toDateString(), 'quantity' => 10, 'supplier' => 'x'])->status();
            $out['worker_post_assignment'] = $this->postJson('/api/batch-slot-assignments', [])->status();
            $out['worker_post_rack'] = $this->postJson('/api/racks', [])->status();

            return $out;
        });
    }

    public function test_p03_cull_exhaustion_vs_complete_batch_lifecycle(): void
    {
        $this->probe('P03_batch_lifecycle_paths', function () {
            $this->as($this->admin);
            // Jalur 1: habis lewat afkir
            $b1 = $this->batch(['quantity' => 10]);
            $a1 = $this->assign($b1, 'A-01-01', 10, 'FRUITING');
            $r1 = $this->postJson('/api/baglog-culls', ['baglog_batch_id' => $b1->id, 'slot_code' => 'A-01-01', 'cull_date' => now()->toDateString(), 'quantity' => 10, 'reason' => 'TRICHODERMA']);
            $a1->refresh();
            $b1->refresh();
            // Jalur 2: habis lewat tombol tutup siklus
            $b2 = $this->batch(['quantity' => 10]);
            $a2 = $this->assign($b2, 'A-01-02', 10, 'FRUITING');
            $r2 = $this->postJson("/api/batch-slot-assignments/{$a2->id}/complete", ['reason' => 'EXHAUSTED']);
            $a2->refresh();
            $b2->refresh();

            return [
                'path_cull_exhaustion' => ['http' => $r1->status(), 'assignment' => $a1->current_status, 'completed_reason' => $a1->completed_reason, 'batch_status' => $b1->status],
                'path_complete_button' => ['http' => $r2->status(), 'assignment' => $a2->current_status, 'completed_reason' => $a2->completed_reason, 'batch_status' => $b2->status],
            ];
        });
    }

    public function test_p04_void_after_complete_inconsistent_batch(): void
    {
        $this->probe('P04_void_reopen_inconsistency', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10]);
            $a = $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $this->postJson("/api/batch-slot-assignments/{$a->id}/complete", ['reason' => 'EXHAUSTED']);
            $cull = BaglogCull::where('baglog_batch_id', $b->id)->first();
            $b->refresh();
            $out = ['after_complete' => ['batch' => $b->status, 'assignment' => $a->fresh()->current_status, 'cull_reason' => $cull->reason, 'cull_qty' => $cull->quantity]];
            $rv = $this->postJson("/api/baglog-culls/{$cull->id}/void", ['reason' => 'salah tutup siklus']);
            $a->refresh();
            $b->refresh();
            $out['after_void'] = ['http' => $rv->status(), 'batch' => $b->status, 'assignment' => $a->current_status, 'completed_at' => $a->completed_at, 'capacity' => $a->kapasitasAktif()];
            $out['harvest_batch_only'] = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 1.5, 'baglog_batch_id' => $b->id])->status();
            $out['harvest_with_slot'] = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 1.5, 'baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01'])->status();
            $stats = $this->getJson('/api/dashboard/stats')->json('data');
            $out['dashboard_active_baglogs'] = $stats['active_baglogs'];

            return $out;
        });
    }

    public function test_p05_manual_close_void_cull(): void
    {
        $this->probe('P05_manual_close_void', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10]);
            $a = $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $this->postJson("/api/batch-slot-assignments/{$a->id}/complete", ['reason' => 'MANUAL']);
            $cull = BaglogCull::where('baglog_batch_id', $b->id)->first();
            $out = ['cull_reason_for_MANUAL' => $cull->reason];
            $this->postJson("/api/baglog-culls/{$cull->id}/void", ['reason' => 'salah tutup manual']);
            $a->refresh();
            $out['after_void'] = ['assignment' => $a->current_status, 'capacity' => $a->kapasitasAktif()];
            // cek apakah slot bisa dipakai batch lain padahal kapasitas aktif > 0
            $b2 = $this->batch(['quantity' => 10]);
            $r = $this->postJson('/api/batch-slot-assignments', ['baglog_batch_id' => $b2->id, 'assigned_at' => now()->toDateString(), 'slots' => [['slot_code' => 'A-01-01', 'initial_quantity' => 10, 'initial_mycelium_stage' => 'LEVEL_1']]]);
            $out['reassign_same_slot_http'] = $r->status();
            $out['dua_assignment_pada_slot'] = BatchSlotAssignment::where('slot_code', 'A-01-01')->count();

            return $out;
        });
    }

    public function test_p06_mortality_includes_habis_produksi(): void
    {
        $this->probe('P06_mortality_rate', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10, 'price_per_baglog' => 5000]);
            $a = $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $this->postJson('/api/baglog-culls', ['baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01', 'cull_date' => now()->toDateString(), 'quantity' => 2, 'reason' => 'TRICHODERMA']);
            $before = $this->getJson("/api/baglogs/{$b->id}/hpp")->json('data');
            $this->postJson("/api/batch-slot-assignments/{$a->id}/complete", ['reason' => 'EXHAUSTED']);
            $after = $this->getJson("/api/baglogs/{$b->id}/hpp")->json('data');

            return [
                'before_close' => ['mortality_rate_percent' => $before['mortality_rate_percent'], 'culled' => $before['culled_quantity'], 'active_capacity' => $before['active_capacity']],
                'after_close_all_baglog_healthy_until_end' => ['mortality_rate_percent' => $after['mortality_rate_percent'], 'culled' => $after['culled_quantity'], 'active_capacity' => $after['active_capacity'], 'is_completed' => $after['is_completed']],
                'culls_by_reason' => BaglogCull::select('reason', DB::raw('SUM(quantity) q'))->groupBy('reason')->pluck('q', 'reason')->all(),
            ];
        });
    }

    public function test_p07_dashboard_latest_batches_payload(): void
    {
        $this->probe('P07_dashboard_latest_batches', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 100]);
            foreach (['A-01-01', 'A-01-02', 'A-01-03'] as $s) {
                $this->assign($b, $s, 10);
            }
            [$n, $stats] = $this->queries(fn () => $this->getJson('/api/dashboard/stats')->json('data'));

            return [
                'queries_dashboard' => $n,
                'latest_batches_first' => $stats['latest_batches'][0] ?? null,
                'expected_assigned_quantity' => 30,
                'stats_keys' => array_keys($stats),
            ];
        });
    }

    public function test_p08_query_counts_endpoints(): void
    {
        $this->probe('P08_query_counts', function () {
            $this->as($this->admin);
            $out = [];
            $batches = [];
            for ($i = 0; $i < 10; $i++) {
                $batches[] = $this->batch(['quantity' => 100, 'entry_date' => now()->subDays($i)->toDateString(), 'batch_code' => 'BL-PROBE-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT)]);
            }
            $slotIdx = 0;
            foreach ($batches as $b) {
                for ($k = 0; $k < 5; $k++) {
                    $slotIdx++;
                    $code = sprintf('B-%02d-%02d', intdiv($slotIdx - 1, 10) + 1, (($slotIdx - 1) % 10) + 1);
                    $this->assign($b, $code, 10, 'FRUITING');
                }
            }
            foreach ($batches as $b) {
                for ($h = 0; $h < 2; $h++) {
                    Harvest::create(['user_id' => $this->admin->id, 'baglog_batch_id' => $b->id, 'harvest_date' => now()->toDateString(), 'weight_kg' => 2.5, 'flush_number' => $h + 1, 'quality_grade' => 'A']);
                }
                BaglogCull::create(['baglog_batch_id' => $b->id, 'slot_code' => 'B-01-01', 'cull_date' => now()->toDateString(), 'quantity' => 1, 'reason' => 'HAMA']);
                \App\Models\Sale::create(['user_id' => $this->admin->id, 'baglog_batch_id' => $b->id, 'sale_date' => now()->toDateString(), 'quantity_kg' => 1, 'price_per_kg' => 25000, 'total_revenue' => 25000, 'buyer_name' => 'T']);
            }
            // 10 batch, 20 harvest, 10 cull, 10 sale, 50 assignment
            foreach (['/api/harvests' => '20 harvest', '/api/baglogs' => '10 batch', '/api/baglogs/hpp-summary' => '10 batch', '/api/slots' => '300 slot / 50 terisi', '/api/baglog-culls' => '10 cull', '/api/sales' => '10 sale', '/api/dashboard/stats' => '-', '/api/slots/heatmap' => '-', '/api/racks' => '3 rak'] as $url => $note) {
                [$n, $r] = $this->queries(fn () => $this->getJson($url)->status());
                $out[$url] = ['queries' => $n, 'http' => $r, 'data' => $note];
            }
            // skala 2x harvest untuk melihat pola
            for ($i = 0; $i < 20; $i++) {
                Harvest::create(['user_id' => $this->admin->id, 'baglog_batch_id' => $batches[$i % 10]->id, 'harvest_date' => now()->subDay()->toDateString(), 'weight_kg' => 1, 'flush_number' => 3, 'quality_grade' => 'A']);
            }
            [$n2] = $this->queries(fn () => $this->getJson('/api/harvests')->status());
            $out['/api/harvests (40 harvest)'] = ['queries' => $n2];
            [$n3] = $this->queries(fn () => $this->getJson("/api/baglogs/{$batches[0]->id}/hpp")->status());
            $out['/api/baglogs/{id}/hpp (1 batch)'] = ['queries' => $n3];

            return $out;
        });
    }

    public function test_p09_sale_without_stock(): void
    {
        $this->probe('P09_sale_no_stock', function () {
            $this->as($this->admin);
            $r = $this->postJson('/api/sales', ['sale_date' => now()->toDateString(), 'quantity_kg' => 500, 'price_per_kg' => 25000, 'buyer_name' => 'Tengkulak X']);
            $r2 = $this->postJson('/api/sales', ['sale_date' => now()->addDays(30)->toDateString(), 'quantity_kg' => 1, 'price_per_kg' => 25000, 'buyer_name' => 'Tengkulak Masa Depan']);
            $rep = $this->getJson('/api/sales/weekly-report')->json('data');

            return [
                'total_harvest_in_db_kg' => (float) Harvest::sum('weight_kg'),
                'sale_500kg_http' => $r->status(),
                'sale_future_date_http' => $r2->status(),
                'weekly_report' => ['harvest' => $rep['total_harvest_kg'], 'sales_kg' => $rep['total_sales_kg'], 'unsold_kg' => $rep['unsold_kg']],
            ];
        });
    }

    public function test_p10_reject_grade_counted(): void
    {
        $this->probe('P10_reject_counted_as_stock', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10, 'price_per_baglog' => 5000]);
            $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 5, 'baglog_batch_id' => $b->id, 'quality_grade' => 'A']);
            $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 5, 'baglog_batch_id' => $b->id, 'quality_grade' => 'REJECT']);
            $stats = $this->getJson('/api/dashboard/stats')->json('data');
            $hpp = $this->getJson("/api/baglogs/{$b->id}/hpp")->json('data');
            $week = $this->getJson('/api/sales/weekly-report')->json('data');

            return ['dashboard_today_harvest_kg' => $stats['today_harvest_kg'], 'hpp_total_panen_kg' => $hpp['total_panen_kg'], 'weekly_total_harvest_kg' => $week['total_harvest_kg'], 'note' => '5 kg grade A + 5 kg REJECT'];
        });
    }

    public function test_p11_flush_semantics(): void
    {
        $this->probe('P11_flush_semantics', function () {
            $this->as($this->admin);
            $out = [];
            // Mode slot
            $b = $this->batch(['quantity' => 10]);
            $this->assign($b, 'A-01-01', 10, 'INCUBATION');
            $seq = [];
            for ($i = 1; $i <= 8; $i++) {
                $r = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 0.5, 'baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01']);
                $seq[] = ['n' => $i, 'http' => $r->status(), 'flush' => $r->json('data.flush_number'), 'msg' => $r->status() >= 400 ? ($r->json('errors.flush_number.0') ?? $r->json('message')) : null];
            }
            $out['slot_mode_8_posts_same_day'] = $seq;
            $out['slot_mode_assignment_status_after'] = BatchSlotAssignment::first()->current_status;
            // Mode batch saja (alur nyata pemilik)
            $b2 = $this->batch(['quantity' => 100, 'batch_code' => 'BL-PROBE-B2']);
            $this->assign($b2, 'A-02-01', 10, 'INCUBATION');
            $seq2 = [];
            for ($i = 1; $i <= 10; $i++) {
                $r = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 0.5, 'baglog_batch_id' => $b2->id]);
                $seq2[] = ['n' => $i, 'http' => $r->status(), 'flush' => $r->json('data.flush_number')];
            }
            $out['batch_mode_10_posts'] = $seq2;
            $out['batch_mode_assignment_status_after'] = BatchSlotAssignment::where('slot_code', 'A-02-01')->value('current_status');
            $r11 = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 0.5, 'baglog_batch_id' => $b2->id, 'flush_number' => 10]);
            $r12 = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 0.5, 'baglog_batch_id' => $b2->id, 'flush_number' => 11]);
            $out['batch_mode_explicit_flush_10_http'] = $r11->status();
            $out['batch_mode_explicit_flush_11_http'] = $r12->status();
            // sanity berat
            $b3 = $this->batch(['quantity' => 10, 'batch_code' => 'BL-PROBE-B3']);
            $this->assign($b3, 'A-03-01', 10, 'FRUITING');
            $big = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 999, 'baglog_batch_id' => $b3->id, 'slot_code' => 'A-03-01']);
            $out['weight_999kg_for_10_baglog_slot_http'] = $big->status();
            // double submit
            $d1 = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 2, 'baglog_batch_id' => $b3->id]);
            $d2 = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 2, 'baglog_batch_id' => $b3->id]);
            $out['double_submit'] = [$d1->status(), $d1->json('data.flush_number'), $d2->status(), $d2->json('data.flush_number')];

            return $out;
        });
    }

    public function test_p12_p13_date_and_orphan(): void
    {
        $this->probe('P12_P13_invariants', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10, 'entry_date' => now()->toDateString()]);
            $r = $this->postJson('/api/harvests', ['harvest_date' => now()->subDays(10)->toDateString(), 'weight_kg' => 1, 'baglog_batch_id' => $b->id]);
            $orphan = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 1]);
            $fut = $this->postJson('/api/baglogs', ['entry_date' => now()->addDays(5)->toDateString(), 'quantity' => 100, 'supplier' => 'S']);
            $big = $this->postJson('/api/baglogs', ['entry_date' => now()->toDateString(), 'quantity' => 5000, 'supplier' => 'S']);

            return [
                'harvest_10_days_before_batch_entry_http' => $r->status(),
                'orphan_harvest' => ['http' => $orphan->status(), 'batch_id' => $orphan->json('data.baglog_batch_id'), 'flush' => $orphan->json('data.flush_number')],
                'future_entry_date_batch' => ['http' => $fut->status(), 'age_days' => $fut->json('data.age_days')],
                'batch_quantity_5000_vs_capacity_3000_http' => $big->status(),
            ];
        });
    }

    public function test_p14_rack_cap_and_partial(): void
    {
        $this->probe('P14_rack_capacity', function () {
            $this->as($this->admin);
            $before = $this->getJson('/api/dashboard/stats')->json('data.total_kumbung_capacity');
            $r1 = $this->postJson('/api/racks', []);
            $r2 = $this->postJson('/api/racks', []);
            $after = $this->getJson('/api/dashboard/stats')->json('data');

            return [
                'capacity_before' => $before,
                'add_rack_1' => [$r1->status(), $r1->json('data.row')],
                'add_rack_2' => [$r2->status(), $r2->json('data.row')],
                'capacity_after_two_extra_racks' => $after['total_kumbung_capacity'],
                'slots_count_after' => $after['total_slots_count'],
            ];
        });
    }

    public function test_p15_rack_partial_insert(): void
    {
        $this->probe('P15_rack_partial_insert', function () {
            $this->as($this->admin);
            // simulasikan kegagalan di tengah insert: 1 slot "korup" dengan kode rak D tapi row Z
            DB::table('slots')->insert(['slot_code' => 'D-06-01', 'row' => 'Z', 'bay' => 6, 'tier' => 1, 'max_capacity' => 10, 'created_at' => now(), 'updated_at' => now()]);
            $r = $this->postJson('/api/racks', ['row' => 'D']);

            return ['http' => $r->status(), 'slots_row_D_left_behind' => Slot::where('row', 'D')->count(), 'racks_api' => collect($this->getJson('/api/racks')->json('data'))->firstWhere('row', 'D')];
        });
    }

    public function test_p16_voided_audit_lost_by_rack_delete(): void
    {
        $this->probe('P16_rack_delete_cascades_voided_ledger', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10]);
            $a = $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $h = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 2, 'baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01']);
            $hid = $h->json('data.id');
            $c = $this->postJson('/api/baglog-culls', ['baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01', 'cull_date' => now()->toDateString(), 'quantity' => 3, 'reason' => 'HAMA']);
            $cid = $c->json('data.cull.id');
            $this->postJson("/api/harvests/{$hid}/void", ['reason' => 'salah input berat']);
            $this->postJson("/api/baglog-culls/{$cid}/void", ['reason' => 'salah input afkir']);
            $del = $this->deleteJson("/api/batch-slot-assignments/{$a->id}");
            $before = ['culls_all' => BaglogCull::withVoided()->count(), 'harvests_all' => Harvest::withVoided()->count()];
            $delRack = $this->deleteJson('/api/racks/A');
            $after = ['culls_all' => BaglogCull::withVoided()->count(), 'harvests_all' => Harvest::withVoided()->count(), 'voided_harvest_slot_code' => Harvest::withVoided()->find($hid)?->slot_code, 'voided_harvest_void_reason' => Harvest::withVoided()->find($hid)?->void_reason];

            return ['delete_assignment_http' => $del->status(), 'before_rack_delete' => $before, 'delete_rack_http' => $delRack->status(), 'delete_rack_msg' => $delRack->json('message'), 'after_rack_delete' => $after];
        });
    }

    public function test_p17_racks_fake_fallback(): void
    {
        $this->probe('P17_fake_fallback', function () {
            $this->as($this->admin);
            Slot::query()->delete();
            $racks = $this->getJson('/api/racks')->json('data');
            $slots = $this->getJson('/api/slots')->json('data');
            $stats = $this->getJson('/api/dashboard/stats')->json('data');

            return ['racks_api' => $racks, 'slots_api_count' => count($slots), 'dashboard_capacity' => $stats['total_kumbung_capacity'], 'dashboard_slots' => $stats['total_slots_count']];
        });
    }

    public function test_p18_batch_status_free_jump(): void
    {
        $this->probe('P18_batch_status_transitions', function () {
            $this->as($this->admin);
            $out = [];
            $b = $this->batch(['quantity' => 20, 'notes' => 'catatan awal supplier']);
            $this->assign($b, 'A-01-01', 10);
            $r = $this->patchJson("/api/baglogs/{$b->id}/status", ['status' => 'completed', 'notes' => 'ditutup']);
            $out['completed_with_active_slot'] = ['http' => $r->status(), 'batch' => $b->fresh()->status, 'slot' => BatchSlotAssignment::first()->current_status, 'notes_after' => $b->fresh()->notes];
            $this->patchJson("/api/baglogs/{$b->id}/status", ['status' => 'disposed']);
            $out['after_disposed'] = ['batch' => $b->fresh()->status, 'slot' => BatchSlotAssignment::first()->current_status];
            $r2 = $this->patchJson("/api/baglogs/{$b->id}/status", ['status' => 'active']);
            $out['disposed_to_active'] = ['http' => $r2->status(), 'batch' => $b->fresh()->status, 'slot' => BatchSlotAssignment::first()->current_status];
            $r3 = $this->postJson('/api/batch-slot-assignments', ['baglog_batch_id' => $b->id, 'assigned_at' => now()->toDateString(), 'slots' => [['slot_code' => 'A-01-02', 'initial_quantity' => 10, 'initial_mycelium_stage' => 'LEVEL_1']]]);
            $out['assign_after_resurrect_http'] = $r3->status();

            return $out;
        });
    }

    public function test_p19_partial_placement_autocomplete(): void
    {
        $this->probe('P19_partial_placement', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 100]);
            $a = $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $this->postJson("/api/batch-slot-assignments/{$a->id}/complete", ['reason' => 'EXHAUSTED']);
            $b->refresh();
            $r = $this->postJson('/api/batch-slot-assignments', ['baglog_batch_id' => $b->id, 'assigned_at' => now()->toDateString(), 'slots' => [['slot_code' => 'A-01-02', 'initial_quantity' => 10, 'initial_mycelium_stage' => 'LEVEL_1']]]);

            return ['batch_status_after_first_slot_closed' => $b->status, 'unassigned_quantity' => $b->unassigned_quantity, 'place_more_http' => $r->status(), 'place_more_msg' => $r->json('message')];
        });
    }

    public function test_p20_completed_before_assigned(): void
    {
        $this->probe('P20_completed_date_invariant', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10, 'entry_date' => now()->subDays(20)->toDateString()]);
            $a = $this->assign($b, 'A-01-01', 10, 'FRUITING', now()->subDays(5)->toDateString());
            $r = $this->postJson("/api/batch-slot-assignments/{$a->id}/complete", ['reason' => 'MANUAL', 'date' => now()->subDays(15)->toDateString()]);
            $a->refresh();

            return ['http' => $r->status(), 'assigned_at' => $a->assigned_at->toDateString(), 'completed_at' => $a->completed_at?->toDateString(), 'cull_date' => BaglogCull::first()?->cull_date?->toDateString()];
        });
    }

    public function test_p21_expenses(): void
    {
        $this->probe('P21_expenses', function () {
            $this->as($this->admin);
            $out = [];
            foreach (['MISTING', 'PLASTIK', 'ALKOHOL', 'AIR', 'LABOR'] as $cat) {
                $out["category_{$cat}"] = $this->postJson('/api/operational-expenses', ['expense_date' => now()->toDateString(), 'category' => $cat, 'amount' => 100000])->status();
            }
            $out['future_date'] = $this->postJson('/api/operational-expenses', ['expense_date' => now()->addDays(60)->toDateString(), 'category' => 'LISTRIK', 'amount' => 100000])->status();
            $b = $this->batch(['quantity' => 100, 'price_per_baglog' => 5000]);
            $before = $this->getJson("/api/baglogs/{$b->id}/hpp")->json('data.biaya_operasional');
            $id = \App\Models\OperationalExpense::first()->id;
            $del = $this->deleteJson("/api/operational-expenses/{$id}")->status();
            $after = $this->getJson("/api/baglogs/{$b->id}/hpp")->json('data.biaya_operasional');
            $out['delete_expense'] = ['http' => $del, 'biaya_ops_before' => $before, 'biaya_ops_after' => $after, 'trail_rows_left' => \App\Models\OperationalExpense::where('id', $id)->count()];

            return $out;
        });
    }

    public function test_p22_overhead_prorata_retroactive(): void
    {
        $this->probe('P22_overhead_prorata', function () {
            $this->as($this->admin);
            $b1 = $this->batch(['quantity' => 100, 'price_per_baglog' => 5000, 'entry_date' => now()->subDays(60)->toDateString(), 'batch_code' => 'BL-OLD-001']);
            $this->postJson('/api/operational-expenses', ['expense_date' => now()->subDays(50)->toDateString(), 'category' => 'LISTRIK', 'amount' => 1000000]);
            $one = $this->getJson("/api/baglogs/{$b1->id}/hpp")->json('data.biaya_operasional');
            $b2 = $this->batch(['quantity' => 3000, 'price_per_baglog' => 5000, 'entry_date' => now()->toDateString(), 'batch_code' => 'BL-NEW-001']);
            $two = $this->getJson("/api/baglogs/{$b1->id}/hpp")->json('data.biaya_operasional');
            $newShare = $this->getJson("/api/baglogs/{$b2->id}/hpp")->json('data.biaya_operasional');

            return ['overhead_total' => 1000000, 'batch_old_share_when_only_batch' => $one, 'batch_old_share_after_big_batch_added_later' => $two, 'batch_new_share_(3000 baglog, entry after expense)' => $newShare];
        });
    }

    public function test_p24_hpp_summary_unattributed_sales(): void
    {
        $this->probe('P24_hpp_unattributed_sales', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10, 'price_per_baglog' => 5000]);
            $this->postJson('/api/sales', ['sale_date' => now()->toDateString(), 'quantity_kg' => 10, 'price_per_kg' => 25000, 'buyer_name' => 'A']);
            $this->postJson('/api/sales', ['sale_date' => now()->toDateString(), 'quantity_kg' => 4, 'price_per_kg' => 25000, 'buyer_name' => 'B', 'baglog_batch_id' => $b->id]);
            $sum = $this->getJson('/api/baglogs/hpp-summary')->json('data');
            $stats = $this->getJson('/api/dashboard/stats')->json('data');
            $hppOne = $this->getJson("/api/baglogs/{$b->id}/hpp")->json('data');

            return ['dashboard_monthly_revenue' => $stats['monthly_revenue_idr'], 'hpp_summary_total_sales_revenue' => $sum['total_sales_revenue'], 'hpp_summary_total_margin' => $sum['total_margin_kontribusi'], 'batch_price_fallback_bep_input' => $hppOne['avg_selling_price_per_kg']];
        });
    }

    public function test_p25_date_serialization(): void
    {
        $this->probe('P25_date_serialization', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 10]);
            $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 1, 'baglog_batch_id' => $b->id]);
            $list = $this->getJson('/api/harvests')->json('data');
            $baglogs = $this->getJson('/api/baglogs')->json('data');

            return ['app_today' => now()->toDateString(), 'app_timezone' => config('app.timezone'), 'harvest_date_in_json' => $list[0]['harvest_date'], 'batch_entry_date_in_json' => $baglogs[0]['entry_date'], 'harvest_row_batch_has_appends' => array_keys($list[0]['baglog_batch'] ?? [])];
        });
    }

    public function test_p28_badge_per_batch_harvest(): void
    {
        $this->probe('P28_badge_flush_per_batch', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 30]);
            foreach (['A-01-01', 'A-01-02', 'A-01-03'] as $s) {
                $this->assign($b, $s, 10, 'FRUITING', now()->subDays(60)->toDateString());
            }
            for ($i = 0; $i < 6; $i++) {
                $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 3, 'baglog_batch_id' => $b->id]);
            }
            $slots = collect($this->getJson('/api/slots?row=A')->json('data'))->where('is_occupied', true)->values();
            $heat = $this->getJson('/api/slots/heatmap')->json('data');

            return [
                'batch_level_harvests_flush_values' => Harvest::orderBy('id')->pluck('flush_number')->all(),
                'slot_badges' => $slots->map(fn ($s) => ['slot' => $s['slot_code'], 'label' => $s['assignment']['badge']['label'], 'flush' => $s['assignment']['badge']['flush'], 'needs_po_alert' => $s['assignment']['badge']['needs_po_alert'] ?? null, 'last_flush' => $s['assignment']['last_flush']])->all(),
                'heatmap_max_kg' => $heat['max_kg_in_slot'],
            ];
        });
    }

    public function test_p37_active_baglogs_includes_unplaced(): void
    {
        $this->probe('P37_active_baglogs_unplaced', function () {
            $this->as($this->admin);
            $this->batch(['quantity' => 100]);
            $stats = $this->getJson('/api/dashboard/stats')->json('data');

            return ['active_baglogs_with_zero_slots_assigned' => $stats['active_baglogs']];
        });
    }

    public function test_p38_duplicate_assignment_same_batch_same_slot(): void
    {
        $this->probe('P38_same_batch_same_slot_twice', function () {
            $this->as($this->admin);
            $b = $this->batch(['quantity' => 30]);
            $a1 = $this->assign($b, 'A-01-01', 10, 'FRUITING');
            $this->assign($b, 'A-01-02', 10, 'FRUITING');
            $this->postJson('/api/baglog-culls', ['baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01', 'cull_date' => now()->toDateString(), 'quantity' => 4, 'reason' => 'HAMA']);
            $this->postJson("/api/batch-slot-assignments/{$a1->id}/complete", ['reason' => 'EXHAUSTED']);
            $b->refresh();
            $out = ['batch_status_after_first_close' => $b->status];
            $r = $this->postJson('/api/batch-slot-assignments', ['baglog_batch_id' => $b->id, 'assigned_at' => now()->toDateString(), 'slots' => [['slot_code' => 'A-01-01', 'initial_quantity' => 10, 'initial_mycelium_stage' => 'LEVEL_1']]]);
            $a2 = BatchSlotAssignment::where('slot_code', 'A-01-01')->orderByDesc('id')->first();
            $out['reassign_http'] = $r->status();
            $out['new_assignment_initial_quantity'] = $a2->initial_quantity;
            $out['new_assignment_capacity_reported'] = $a2->kapasitasAktif();
            $h = $this->postJson('/api/harvests', ['harvest_date' => now()->toDateString(), 'weight_kg' => 1, 'baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01']);
            $out['harvest_on_new_assignment_http'] = $h->status();
            $out['harvest_msg'] = $h->json('errors.slot_code.0');
            $c = $this->postJson('/api/baglog-culls', ['baglog_batch_id' => $b->id, 'slot_code' => 'A-01-01', 'cull_date' => now()->toDateString(), 'quantity' => 1, 'reason' => 'HAMA']);
            $out['cull_on_new_assignment_http'] = $c->status();
            $out['cull_msg'] = $c->json('message');

            return $out;
        });
    }
}
