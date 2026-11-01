<?php

namespace Database\Seeders;

use App\Models\BaglogBatch;
use App\Models\BaglogCull;
use App\Models\BatchSlotAssignment;
use App\Models\Customer;
use App\Models\Harvest;
use App\Models\OperationalExpense;
use App\Models\Sale;
use App\Models\SensorData;
use App\Models\Slot;
use App\Models\SprinklerLog;
use App\Models\Supplier;
use App\Models\ThresholdSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Main Database Seeder — Comprehensive Production-Grade Dataset
 * untuk Evaluasi, Pengujian, dan Demo Sidang Smart Shroom SCM.
 *
 * Mencakup seluruh skenario fisis & bisnis nyata:
 * 1. Multi-role Auth: Admin + Worker (Format .test dan .com)
 * 2. WMS 3D Racks: 300 Slot (Kapasitas 3.000 Baglog) dengan status Sehat, Kritis, Panen, dan Kosong
 * 3. Siklus Hidup Baglog: 6 Batch (Inkubasi, Puncak Panen, Akhir Siklus, Kontaminasi, Selesai, dan Inbound Buffer)
 * 4. Audit Garansi & Afkir: Pencatatan culls per slot (Trichoderma, Busuk Basah, Hama, Kering, Habis Produksi)
 * 5. SCM Supplier Scorecard: 4 Vendor dengan kontras Grade A (Prioritas), Grade B (Cadangan), dan Grade C (Peringatan)
 * 6. Keuangan & HPP: Pengeluaran operasional nyata (Listrik, Air, Labor, Packaging, Nutrisi)
 * 7. Traceability Hulu-Hilir: Penjualan ke 4 segmen pelanggan melacak batch baglog & supplier asal
 * 8. IoT Sensor & Aktuator: 288 data time-series + 5 log kendali aktuator (Misting, Fan cooling, Purge malam, Homogenisasi)
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // Nonaktifkan foreign keys sementara untuk pembersihan aman
        DB::statement('PRAGMA foreign_keys = OFF;');
        BatchSlotAssignment::truncate();
        BaglogCull::truncate();
        Harvest::truncate();
        Sale::truncate();
        OperationalExpense::truncate();
        BaglogBatch::truncate();
        Supplier::truncate();
        Customer::truncate();
        SensorData::truncate();
        SprinklerLog::truncate();
        ThresholdSetting::truncate();
        User::truncate();
        DB::statement('PRAGMA foreign_keys = ON;');

        // ─── 0. MASTER SLOTS (Grid 3D Kumbung) ───────────────────
        $this->call(SlotSeeder::class);

        // ─── 1. USERS & OTORISASI MULTI-ROLE ─────────────────────
        // Administrator (Pemilik Kumbung)
        $adminTest = User::create([
            'name' => 'Administrator',
            'email' => 'admin@smartshroom.test',
            'password' => bcrypt('password123'),
            'role' => 'admin',
        ]);

        $adminCom = User::create([
            'name' => 'Administrator',
            'email' => 'admin@smartshroom.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
        ]);

        // Worker (Pekerja Lapangan & Operator Timbangan)
        $workerTest = User::create([
            'name' => 'Pekerja Satu',
            'email' => 'worker@smartshroom.test',
            'password' => bcrypt('password123'),
            'role' => 'worker',
        ]);

        $workerCom = User::create([
            'name' => 'Pekerja Satu',
            'email' => 'worker@smartshroom.com',
            'password' => bcrypt('password123'),
            'role' => 'worker',
        ]);

        $admin = $adminCom;
        $worker = $workerCom;

        // Pastikan token login yang aktif di browser diarahkan ke akun admin
        DB::table('personal_access_tokens')->update(['tokenable_id' => $adminCom->id]);
        $this->command->info('✅ Users seeded: Admin & Worker (.test + .com)');

        // ─── 2. THRESHOLD SETTING (Optimal Jamur Kuping) ──────────
        ThresholdSetting::create([
            'user_id' => $admin->id,
            'temp_min' => 24.00,
            'temp_max' => 32.00,
            'humidity_min' => 80.00,
            'humidity_max' => 95.00,
            'phase_mode' => 'FRUITING',
            'is_active' => true,
        ]);
        $this->command->info('✅ Threshold settings seeded: Optimal 24-32°C & 80-95% RH');

        // ─── 3. SCM MASTER SUPPLIERS (Hulu Rantai Pasok) ──────────
        // Supplier Grade A (Kualitas Unggul, Sterilisasi Bersih, Pengiriman Cepat)
        $supplierSejahtera = Supplier::create([
            'name' => 'UD Baglog Sejahtera',
            'contact_person' => 'Pak Budi',
            'phone' => '081234567890',
            'address' => 'Jl. Raya Cisarua No. 12, Bogor',
            'lead_time_days' => 3,
            'is_active' => true,
        ]);

        // Supplier Grade B (Standar Operasional, Kualitas Cukup Baik)
        $supplierMakmur = Supplier::create([
            'name' => 'CV Jamur Makmur',
            'contact_person' => 'Bu Sinta',
            'phone' => '081298765432',
            'address' => 'Jl. Pertanian No. 45, Lembang',
            'lead_time_days' => 5,
            'is_active' => true,
        ]);

        // Supplier Grade B+ (Alternatif Lokal Sukabumi)
        $supplierHaji = Supplier::create([
            'name' => 'Pak Haji Baglog',
            'contact_person' => 'Haji Ahmad',
            'phone' => '081311223344',
            'address' => 'Kp. Babakan No. 8, Sukabumi',
            'lead_time_days' => 4,
            'is_active' => true,
        ]);

        // Supplier Grade C (Rapor Merah: Sering Rusak, Sterilisasi Buruk, Pengiriman Lambat)
        $supplierMaju = Supplier::create([
            'name' => 'Toko Tani Maju',
            'contact_person' => 'Pak Eko',
            'phone' => '081555667788',
            'address' => 'Jl. Agrobisnis No. 3, Cianjur',
            'lead_time_days' => 10,
            'is_active' => true,
        ]);
        $this->command->info('✅ Master Suppliers seeded: 4 vendor dengan variasi grade kinerja A, B, C');

        // ─── 4. BAGLOG BATCHES (Siklus Hidup Lengkap) ─────────────
        // Batch 1: Aktif, Produktif Puncak (Flush 3) — Dari Supplier A
        $batch1 = BaglogBatch::create([
            'user_id' => $admin->id,
            'supplier_id' => $supplierSejahtera->id,
            'batch_code' => 'BL-20260710-001',
            'po_number' => 'PO-202607-001',
            'entry_date' => '2026-07-10',
            'quantity' => 200,
            'rejected_at_arrival' => 1,
            'price_per_baglog' => '3200.00',
            'supplier' => 'UD Baglog Sejahtera',
            'status' => BaglogBatch::STATUS_ACTIVE,
            'notes' => 'Batch Rak A, miselium putih tebal, pinhead sangat rapat.',
        ]);

        // Batch 2: Aktif, Fruiting Awal (Flush 1) — Dari Supplier B
        $batch2 = BaglogBatch::create([
            'user_id' => $admin->id,
            'supplier_id' => $supplierMakmur->id,
            'batch_code' => 'BL-20260725-001',
            'po_number' => 'PO-202607-002',
            'entry_date' => '2026-07-25',
            'quantity' => 150,
            'rejected_at_arrival' => 4,
            'price_per_baglog' => '3000.00',
            'supplier' => 'CV Jamur Makmur',
            'status' => BaglogBatch::STATUS_ACTIVE,
            'notes' => 'Batch Rak B depan, mulai sobek tutup kapas untuk panen perdana.',
        ]);

        // Batch 3: Aktif, Inkubasi Vegetatif (Belum Panen) — Dari Supplier 3
        $batch3 = BaglogBatch::create([
            'user_id' => $admin->id,
            'supplier_id' => $supplierHaji->id,
            'batch_code' => 'BL-20260810-001',
            'po_number' => 'PO-202608-001',
            'entry_date' => '2026-08-10',
            'quantity' => 300,
            'rejected_at_arrival' => 5,
            'price_per_baglog' => '2900.00',
            'supplier' => 'Pak Haji Baglog',
            'status' => BaglogBatch::STATUS_ACTIVE,
            'notes' => 'Batch besar Rak B belakang, miselium merambat 75% (Tahap Level 2).',
        ]);

        // Batch 4: Terkontaminasi Parah — Dari Supplier C (Kualitas Buruk)
        $batch4 = BaglogBatch::create([
            'user_id' => $admin->id,
            'supplier_id' => $supplierMaju->id,
            'batch_code' => 'BL-20260615-001',
            'po_number' => 'PO-202606-003',
            'entry_date' => '2026-06-15',
            'quantity' => 100,
            'rejected_at_arrival' => 10,
            'price_per_baglog' => '2700.00',
            'supplier' => 'Toko Tani Maju',
            'status' => BaglogBatch::STATUS_CONTAMINATED,
            'notes' => 'Tercemar jamur hijau trichoderma & busuk basah sejak pengiriman.',
        ]);

        // Batch 5: Selesai Siklus (Completed / Siap Kompos) — Dari Supplier A
        $batch5 = BaglogBatch::create([
            'user_id' => $admin->id,
            'supplier_id' => $supplierSejahtera->id,
            'batch_code' => 'BL-20260501-001',
            'po_number' => 'PO-202605-001',
            'entry_date' => '2026-05-01',
            'quantity' => 120,
            'rejected_at_arrival' => 0,
            'price_per_baglog' => '3100.00',
            'supplier' => 'UD Baglog Sejahtera',
            'status' => BaglogBatch::STATUS_COMPLETED,
            'notes' => 'Siklus panen tuntas 7 flush, media tanam aus, siap dipindahkan ke lahan kompos.',
        ]);

        // Batch 6: Baru Tiba Hari Ini (Antrean Inbound Buffer / Belum Masuk Rak)
        $batch6 = BaglogBatch::create([
            'user_id' => $admin->id,
            'supplier_id' => $supplierSejahtera->id,
            'batch_code' => 'BL-20260825-001',
            'po_number' => 'PO-202608-002',
            'entry_date' => $now->toDateString(),
            'quantity' => 150,
            'rejected_at_arrival' => 1,
            'price_per_baglog' => '3200.00',
            'supplier' => 'UD Baglog Sejahtera',
            'status' => BaglogBatch::STATUS_ACTIVE,
            'notes' => 'Baru tiba di area karantina inbound, siap dialokasikan ke slot rak.',
        ]);

        $this->command->info('✅ Baglog Batches seeded: 6 batch mewakili seluruh siklus hidup');

        // ─── 5. WMS BATCH SLOT ASSIGNMENTS (Pemetaan Spasial 3D) ───
        $assignments = [];

        // Alokasi Batch 1 ke Rak A: Bay 01 & 02, Tier 01 s/d 10 (20 slot × 10 = 200 baglog)
        for ($bay = 1; $bay <= 2; $bay++) {
            for ($tier = 1; $tier <= 10; $tier++) {
                $assignments[] = [
                    'baglog_batch_id' => $batch1->id,
                    'slot_code' => sprintf('A-%02d-%02d', $bay, $tier),
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_3,
                    'current_status' => BatchSlotAssignment::STATUS_FRUITING,
                    'assigned_at' => '2026-07-11',
                    'completed_at' => null,
                    'completed_reason' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // Alokasi Batch 2 ke Rak B: Bay 01 (10 slot) + Bay 02 Tier 01 s/d 05 (5 slot) = 15 slot (150 baglog)
        for ($tier = 1; $tier <= 10; $tier++) {
            $assignments[] = [
                'baglog_batch_id' => $batch2->id,
                'slot_code' => sprintf('B-01-%02d', $tier),
                'initial_quantity' => 10,
                'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_3,
                'current_status' => BatchSlotAssignment::STATUS_FRUITING,
                'assigned_at' => '2026-07-26',
                'completed_at' => null,
                'completed_reason' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        for ($tier = 1; $tier <= 5; $tier++) {
            $assignments[] = [
                'baglog_batch_id' => $batch2->id,
                'slot_code' => sprintf('B-02-%02d', $tier),
                'initial_quantity' => 10,
                'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_3,
                'current_status' => BatchSlotAssignment::STATUS_FRUITING,
                'assigned_at' => '2026-07-26',
                'completed_at' => null,
                'completed_reason' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Alokasi Batch 3 ke Rak B: Bay 03 s/d 05, Tier 01 s/d 10 (30 slot × 10 = 300 baglog)
        for ($bay = 3; $bay <= 5; $bay++) {
            for ($tier = 1; $tier <= 10; $tier++) {
                $assignments[] = [
                    'baglog_batch_id' => $batch3->id,
                    'slot_code' => sprintf('B-%02d-%02d', $bay, $tier),
                    'initial_quantity' => 10,
                    'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_2,
                    'current_status' => BatchSlotAssignment::STATUS_INCUBATION,
                    'assigned_at' => '2026-08-11',
                    'completed_at' => null,
                    'completed_reason' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // Alokasi Batch 4 (Terkontaminasi) ke Rak C: Bay 01, Tier 01 s/d 10 (10 slot × 10 = 100 baglog)
        for ($tier = 1; $tier <= 10; $tier++) {
            $assignments[] = [
                'baglog_batch_id' => $batch4->id,
                'slot_code' => sprintf('C-01-%02d', $tier),
                'initial_quantity' => 10,
                'initial_mycelium_stage' => BatchSlotAssignment::MYCELIUM_LEVEL_3,
                'current_status' => BatchSlotAssignment::STATUS_FRUITING,
                'assigned_at' => '2026-06-16',
                'completed_at' => null,
                'completed_reason' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Total alokasi aktif: 20 + 15 + 30 + 10 = 75 slot (750 baglog).
        // Sisa 225 slot (Rak A Bay 3-10, Rak B Bay 6-10, Rak C Bay 2-10) KOSONG untuk demo kapasitas bebas.
        BatchSlotAssignment::insert($assignments);
        $this->command->info('✅ Batch Slot Assignments seeded: 75 slot terisi, 225 slot bebas siap tampung');

        // ─── 6. AUDIT GARANSI & BAGLOG CULLS (Data Afkir Riil) ────
        $culls = [
            [
                'baglog_batch_id' => $batch4->id,
                'slot_code' => 'C-01-03',
                'cull_date' => '2026-07-02',
                'quantity' => 4,
                'reason' => BaglogCull::REASON_TRICHODERMA,
                'notes' => 'Miselium hijau kebiruan pekat di leher baglog, segera diisolasi.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch4->id,
                'slot_code' => 'C-01-05',
                'cull_date' => '2026-07-05',
                'quantity' => 3,
                'reason' => BaglogCull::REASON_BUSUK_BASAH,
                'notes' => 'Kantung lembek berlendir akibat kelembaban jenuh setempat.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch4->id,
                'slot_code' => 'C-01-08',
                'cull_date' => '2026-07-10',
                'quantity' => 3,
                'reason' => BaglogCull::REASON_HAMA,
                'notes' => 'Tercemar larva lalat jamur (sciarid fly), dibakar.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch1->id,
                'slot_code' => 'A-01-02',
                'cull_date' => '2026-07-20',
                'quantity' => 1,
                'reason' => BaglogCull::REASON_KERING,
                'notes' => 'Baglog mengering di dekat bukaan sirkulasi udara.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch2->id,
                'slot_code' => 'B-02-01',
                'cull_date' => '2026-08-05',
                'quantity' => 2,
                'reason' => BaglogCull::REASON_TRICHODERMA,
                'notes' => 'Spora kontaminasi sporadis, langsung diafkir.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch5->id,
                'slot_code' => 'A-01-01',
                'cull_date' => '2026-07-30',
                'quantity' => 10,
                'reason' => BaglogCull::REASON_HABIS_PRODUKSI,
                'notes' => 'Tuntas 7 flush panen, nutrisi serbuk kayu telah habis.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        BaglogCull::insert($culls);
        $this->command->info('✅ Baglog Culls seeded: 6 catatan afkir dengan berbagai alasan patologi jamur');

        // ─── 7. HARVESTS (Catatan Panen Terhubung Slot & Batch) ────
        $harvestSlotsBatch1 = ['A-01-01', 'A-01-03', 'A-01-05', 'A-02-02', 'A-02-08'];
        $harvestSlotsBatch2 = ['B-01-02', 'B-01-04', 'B-01-07', 'B-02-02', 'B-02-04'];
        $harvestGrades = ['GRADE_A', 'GRADE_A', 'GRADE_A', 'GRADE_B', 'GRADE_B', 'REJECT'];

        $harvestRecords = [];

        // 1. Panen Hari Ini (Bulan Berjalan)
        $harvestRecords[] = [
            'user_id' => $worker->id,
            'baglog_batch_id' => $batch1->id,
            'slot_code' => 'A-01-01',
            'harvest_date' => $now->toDateString(),
            'weight_kg' => '9.50',
            'flush_number' => 3,
            'quality_grade' => 'GRADE_A',
            'notes' => 'Panen pagi A-01-01 - GRADE_A',
            'created_at' => $now->copy()->setTime(7, 30),
            'updated_at' => $now->copy()->setTime(7, 30),
        ];
        $harvestRecords[] = [
            'user_id' => $admin->id,
            'baglog_batch_id' => $batch2->id,
            'slot_code' => 'B-01-02',
            'harvest_date' => $now->toDateString(),
            'weight_kg' => '6.80',
            'flush_number' => 1,
            'quality_grade' => 'GRADE_B',
            'notes' => 'Panen sore B-01-02 - GRADE_B',
            'created_at' => $now->copy()->setTime(16, 15),
            'updated_at' => $now->copy()->setTime(16, 15),
        ];

        // 2. Panen 14 Hari Sebelumnya
        for ($day = 14; $day >= 1; $day--) {
            $hDate = $now->copy()->subDays($day)->toDateString();

            // Panen Pagi (Batch 1, Rak A)
            $slotA = $harvestSlotsBatch1[$day % count($harvestSlotsBatch1)];
            $gradeA = $harvestGrades[$day % count($harvestGrades)];
            $harvestRecords[] = [
                'user_id' => $worker->id,
                'baglog_batch_id' => $batch1->id,
                'slot_code' => $slotA,
                'harvest_date' => $hDate,
                'weight_kg' => round(mt_rand(400, 950) / 100, 2), // 4.00 - 9.50 Kg
                'flush_number' => ($day > 7) ? 2 : 3,
                'quality_grade' => $gradeA,
                'notes' => "Panen pagi {$slotA} - {$gradeA}",
                'created_at' => $now->copy()->subDays($day)->setTime(7, 30),
                'updated_at' => $now->copy()->subDays($day)->setTime(7, 30),
            ];

            // Panen Sore (Batch 2, Rak B)
            $slotB = $harvestSlotsBatch2[$day % count($harvestSlotsBatch2)];
            $gradeB = $harvestGrades[($day + 2) % count($harvestGrades)];
            $harvestRecords[] = [
                'user_id' => $day % 3 === 0 ? $admin->id : $worker->id,
                'baglog_batch_id' => $batch2->id,
                'slot_code' => $slotB,
                'harvest_date' => $hDate,
                'weight_kg' => round(mt_rand(250, 700) / 100, 2), // 2.50 - 7.00 Kg
                'flush_number' => 1,
                'quality_grade' => $gradeB,
                'notes' => "Panen sore {$slotB} - {$gradeB}",
                'created_at' => $now->copy()->subDays($day)->setTime(16, 15),
                'updated_at' => $now->copy()->subDays($day)->setTime(16, 15),
            ];
        }

        Harvest::insert($harvestRecords);
        $this->command->info('✅ Harvests seeded: 30 panen harian terpetakan ke slot & flush (termasuk hari ini)');

        // ─── 8. OPERATIONAL EXPENSES (HPP & Biaya Produksi Nyata) ──
        $expenses = [
            [
                'baglog_batch_id' => $batch1->id,
                'expense_date' => $now->copy()->subDays(12)->toDateString(),
                'category' => OperationalExpense::CATEGORY_LISTRIK,
                'amount' => '480000.00',
                'notes' => 'Listrik PLN bulanan kumbung: pompa misting, exhaust fan, & penerangan.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch1->id,
                'expense_date' => $now->copy()->subDays(10)->toDateString(),
                'category' => OperationalExpense::CATEGORY_AIR,
                'amount' => '125000.00',
                'notes' => 'Penggantian filter cartridge mikron & pemeliharaan tandon air misting.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch1->id,
                'expense_date' => $now->copy()->subDays(7)->toDateString(),
                'category' => OperationalExpense::CATEGORY_LABOR,
                'amount' => '700000.00',
                'notes' => 'Upah tenaga kerja petik, sortir, dan pembersihan rak jamur (2 minggu).',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch2->id,
                'expense_date' => $now->copy()->subDays(5)->toDateString(),
                'category' => OperationalExpense::CATEGORY_PACKAGING,
                'amount' => '165000.00',
                'notes' => 'Plastik kemasan PP tebal 0.05 mm & keranjang ventilasi.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => $batch3->id,
                'expense_date' => $now->copy()->subDays(3)->toDateString(),
                'category' => OperationalExpense::CATEGORY_NUTRISI,
                'amount' => '95000.00',
                'notes' => 'Kapur dolomit & cairan nutrisi hayati untuk semprotan vegetatif.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'baglog_batch_id' => null,
                'expense_date' => $now->copy()->subDays(1)->toDateString(),
                'category' => OperationalExpense::CATEGORY_ALKOHOL,
                'amount' => '60000.00',
                'notes' => 'Alkohol 70% 5 Liter untuk sterilisasi pisau panen dan tangan pekerja.',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        OperationalExpense::insert($expenses);
        $this->command->info('✅ Operational Expenses seeded: 6 pos biaya riil pembentuk HPP akurat');

        // ─── 9. SCM HILIR: CUSTOMERS & PENJUALAN KETERTELUSURAN ────
        $custPasar = Customer::create([
            'name' => 'Pak Joko (Pasar Induk)',
            'category' => Customer::CATEGORY_PASAR_INDUK,
            'phone' => '081122334455',
            'address' => 'Pasar Induk Kramat Jati Kios B-12',
            'is_active' => true,
        ]);

        $custResto = Customer::create([
            'name' => 'Bu Sari (Resto Jamur)',
            'category' => Customer::CATEGORY_RESTO,
            'phone' => '081233445566',
            'address' => 'Jl. Boulevard Raya Blok Q No. 5',
            'is_active' => true,
        ]);

        $custTengkulak = Customer::create([
            'name' => 'Mas Adi (Tengkulak)',
            'category' => Customer::CATEGORY_TENGKULAK,
            'phone' => '081344556677',
            'address' => 'Desa Sukamaju RT 02/05',
            'is_active' => true,
        ]);

        $custToko = Customer::create([
            'name' => 'Ibu Dewi (Toko Sayur)',
            'category' => Customer::CATEGORY_ECERAN,
            'phone' => '081455667788',
            'address' => 'Perumahan Griya Indah No. 18',
            'is_active' => true,
        ]);

        $customersList = [$custPasar, $custResto, $custTengkulak, $custToko];
        $salesBatches = [$batch1, $batch2];

        $salesRecords = [];

        // 1. Transaksi Penjualan Hari Ini (Bulan Berjalan - 4 Segmen Pasar)
        $todaySales = [
            [
                'cust' => $custResto,
                'batch' => $batch1,
                'qty' => '12.50',
                'price' => 35000,
                'time' => 9,
            ],
            [
                'cust' => $custPasar,
                'batch' => $batch1,
                'qty' => '20.00',
                'price' => 24000,
                'time' => 11,
            ],
            [
                'cust' => $custToko,
                'batch' => $batch2,
                'qty' => '10.00',
                'price' => 28000,
                'time' => 14,
            ],
            [
                'cust' => $custTengkulak,
                'batch' => $batch2,
                'qty' => '18.50',
                'price' => 20000,
                'time' => 16,
            ],
        ];

        foreach ($todaySales as $ts) {
            $rev = bcmul((string) $ts['qty'], (string) $ts['price'], 2);
            $salesRecords[] = [
                'user_id' => $admin->id,
                'customer_id' => $ts['cust']->id,
                'baglog_batch_id' => $ts['batch']->id,
                'sale_date' => $now->toDateString(),
                'quantity_kg' => $ts['qty'],
                'price_per_kg' => (string) $ts['price'],
                'total_revenue' => $rev,
                'buyer_name' => $ts['cust']->name,
                'notes' => "Pengiriman hari ini ke {$ts['cust']->name} (Batch: {$ts['batch']->batch_code})",
                'created_at' => $now->copy()->setTime($ts['time'], 0),
                'updated_at' => $now->copy()->setTime($ts['time'], 0),
            ];
        }

        // 2. Transaksi 14 Hari Sebelumnya
        for ($day = 14; $day >= 1; $day--) {
            $sDate = $now->copy()->subDays($day)->toDateString();
            $targetCust = $customersList[$day % count($customersList)];
            $sourceBatch = $salesBatches[$day % count($salesBatches)];

            // Penentuan harga per kg berdasarkan segmen pasar
            $pricePerKg = match ($targetCust->category) {
                Customer::CATEGORY_RESTO => 35000,
                Customer::CATEGORY_ECERAN => 28000,
                Customer::CATEGORY_PASAR_INDUK => 24000,
                default => 20000, // TENGKULAK
            };

            $qtyKg = round(mt_rand(500, 2200) / 100, 2); // 5.00 - 22.00 Kg
            $totalRev = bcmul((string) $qtyKg, (string) $pricePerKg, 2);

            $salesRecords[] = [
                'user_id' => $admin->id,
                'customer_id' => $targetCust->id,
                'baglog_batch_id' => $sourceBatch->id,
                'sale_date' => $sDate,
                'quantity_kg' => $qtyKg,
                'price_per_kg' => (string) $pricePerKg,
                'total_revenue' => $totalRev,
                'buyer_name' => $targetCust->name,
                'notes' => "Pengiriman ke {$targetCust->name} (Batch: {$sourceBatch->batch_code})",
                'created_at' => $now->copy()->subDays($day)->setTime(18, 0),
                'updated_at' => $now->copy()->subDays($day)->setTime(18, 0),
            ];
        }

        Sale::insert($salesRecords);
        $this->command->info('✅ Customers & Sales seeded: 18 transaksi penjualan (termasuk 4 hari ini)');

        // ─── 10. IOT SENSOR DATA (288 Titik, 24 Jam Fluktuasi) ─────
        $sensorReadings = [];
        for ($i = 287; $i >= 0; $i--) {
            $recAt = $now->copy()->subMinutes($i * 5);
            $hour = (int) $recAt->format('H');
            $isDaytime = $hour >= 6 && $hour < 18;

            if ($isDaytime) {
                $baseTemp = 28.5;
                $tempVariance = 2.5;
                $baseHum = 86.0;
            } else {
                $baseTemp = 25.2;
                $tempVariance = 1.8;
                $baseHum = 91.5;
            }

            $temp = round($baseTemp + (mt_rand(-100, 100) / 100) * $tempVariance, 2);
            $hum = round($baseHum + (mt_rand(-100, 100) / 100) * 5.0, 2);

            $temp = max(18.0, min(38.0, $temp));
            $hum = max(65.0, min(99.0, $hum));

            $sensorReadings[] = [
                'temperature' => $temp,
                'humidity' => $hum,
                'co2_level' => round(mt_rand(440, 520), 2),
                'light_intensity' => $isDaytime ? round(mt_rand(120, 480), 2) : 0,
                'device_id' => 'ESP32-KUMBUNG-01',
                'recorded_at' => $recAt,
                'created_at' => $recAt,
            ];
        }

        // Injeksi skenario ekstrim untuk memvalidasi indikator status di frontend:
        // 1. Puncak panas siang hari
        $sensorReadings[140]['temperature'] = 34.20;
        $sensorReadings[140]['humidity'] = 74.00;
        // 2. Kelembaban rendah siang
        $sensorReadings[170]['temperature'] = 31.80;
        $sensorReadings[170]['humidity'] = 71.50;
        // 3. Kelembaban jenuh malam
        $sensorReadings[250]['temperature'] = 23.80;
        $sensorReadings[250]['humidity'] = 97.60;

        foreach (array_chunk($sensorReadings, 50) as $chunk) {
            SensorData::insert($chunk);
        }
        $this->command->info('✅ Sensor Data seeded: 288 data poin 24 jam dengan event cuaca ekstrim');

        // ─── 11. IOT ACTUATOR LOGS (Misting & Fan Kritis) ─────────
        $actuatorLogs = [
            [
                'device_id' => 'ESP32-KUMBUNG-01',
                'actuator' => 'misting',
                'started_at' => $now->copy()->subMinutes(15),
                'duration_seconds' => 45,
                'trigger_reason' => 'Kelembaban Rendah (76.5% < 80%)',
                'stop_reason' => 'Target tercapai (RH:88.2% T:27.1°C)',
                'created_at' => $now->copy()->subMinutes(15),
                'updated_at' => $now->copy()->subMinutes(15),
            ],
            [
                'device_id' => 'ESP32-KUMBUNG-01',
                'actuator' => 'fan',
                'started_at' => $now->copy()->subHours(2)->subMinutes(10),
                'duration_seconds' => 120,
                'trigger_reason' => 'Suhu Kritis Siang (34.2°C > 32°C)',
                'stop_reason' => 'Suhu normal (30.1°C <= 32°C)',
                'created_at' => $now->copy()->subHours(2)->subMinutes(10),
                'updated_at' => $now->copy()->subHours(2)->subMinutes(10),
            ],
            [
                'device_id' => 'ESP32-KUMBUNG-01',
                'actuator' => 'fan',
                'started_at' => $now->copy()->subHours(5)->subMinutes(25),
                'duration_seconds' => 30,
                'trigger_reason' => 'Disparitas Vertikal Ekstrem (Selisih 13.5% > 12.0%)',
                'stop_reason' => 'Sirkulasi homogen tuntas',
                'created_at' => $now->copy()->subHours(5)->subMinutes(25),
                'updated_at' => $now->copy()->subHours(5)->subMinutes(25),
            ],
            [
                'device_id' => 'ESP32-KUMBUNG-01',
                'actuator' => 'fan',
                'started_at' => $now->copy()->subHours(10)->subMinutes(40),
                'duration_seconds' => 300,
                'trigger_reason' => 'Over-humidity malam (RH 97.6% > 96.0%)',
                'stop_reason' => 'Flush CO2 & embun jenuh selesai (RH: 90.8%)',
                'created_at' => $now->copy()->subHours(10)->subMinutes(40),
                'updated_at' => $now->copy()->subHours(10)->subMinutes(40),
            ],
            [
                'device_id' => 'ESP32-KUMBUNG-01',
                'actuator' => 'misting',
                'started_at' => $now->copy()->subHours(14),
                'duration_seconds' => 90,
                'trigger_reason' => 'Kelembaban Kritis (71.5% < 80%)',
                'stop_reason' => 'Safety timeout darurat 90 detik',
                'created_at' => $now->copy()->subHours(14),
                'updated_at' => $now->copy()->subHours(14),
            ],
        ];

        SprinklerLog::insert($actuatorLogs);
        $this->command->info('✅ Actuator Logs seeded: 5 log kendali aktuator');

        $this->command->newLine();
        $this->command->info('🍄 Smart Shroom SCM database seeded successfully!');
        $this->command->info('   Admin:  admin@smartshroom.com  / password123');
        $this->command->info('   Worker: worker@smartshroom.com / password123');
    }
}
