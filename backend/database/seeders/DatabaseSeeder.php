<?php

namespace Database\Seeders;

use App\Models\BaglogBatch;
use App\Models\Harvest;
use App\Models\Sale;
use App\Models\SensorData;
use App\Models\ThresholdSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Main Database Seeder — generate dummy data realistis
 * untuk development & testing Smart Shroom SCM.
 *
 * Data yang di-generate:
 * - 1 Admin (pemilik kumbung) + 1 Worker (buruh tani)
 * - 288 sensor readings (24 jam × interval 5 menit)
 * - 5 batch baglog (3 aktif, 1 kontaminasi, 1 disposed)
 * - ~28 record panen (2 minggu, 2 panen/hari)
 * - ~14 record penjualan (2 minggu, 1/hari)
 * - 1 threshold setting (default optimal jamur tiram)
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // ─── 1. USERS ───────────────────────────────────────────
        // Admin: pemilik kumbung (King, the farmer boss)
        $admin = User::factory()->admin()->create([
            'name' => 'King Admin',
            'email' => 'admin@smartshroom.test',
            'password' => bcrypt('password123'),
        ]);

        // Worker: buruh tani yang input data panen
        $worker = User::factory()->create([
            'name' => 'Pekerja Satu',
            'email' => 'worker@smartshroom.test',
            'password' => bcrypt('password123'),
        ]);

        $this->command->info('✅ Users seeded: 1 admin + 1 worker');

        // ─── 2. THRESHOLD SETTINGS ──────────────────────────────
        // Default threshold optimal untuk jamur tiram
        ThresholdSetting::factory()->create([
            'user_id' => $admin->id,
            'temp_min' => 20.00,
            'temp_max' => 30.00,
            'humidity_min' => 70.00,
            'humidity_max' => 90.00,
            'is_active' => true,
        ]);

        $this->command->info('✅ Threshold settings seeded');

        // ─── 3. SENSOR DATA (24 jam, interval 5 menit) ─────────
        // Simulasi data dari ESP32 selama 24 jam terakhir
        // 24 jam × 12 data/jam = 288 readings
        $now = Carbon::now();
        $sensorReadings = [];

        for ($i = 287; $i >= 0; $i--) {
            $recordedAt = $now->copy()->subMinutes($i * 5);

            // Simulasi suhu yang berfluktuasi secara natural
            // Siang lebih panas (25-32°C), malam lebih dingin (20-26°C)
            $hour = (int) $recordedAt->format('H');
            $isDaytime = $hour >= 6 && $hour < 18;

            if ($isDaytime) {
                $baseTemp = 27.0;
                $tempVariance = 4.0;
            } else {
                $baseTemp = 23.0;
                $tempVariance = 3.0;
            }

            // Tambah random noise agar data terlihat natural
            $temperature = round($baseTemp + (mt_rand(-100, 100) / 100) * $tempVariance, 2);
            $humidity = round(80.0 + (mt_rand(-100, 100) / 100) * 10, 2);

            // Clamp values ke range yang masuk akal
            $temperature = max(15.0, min(40.0, $temperature));
            $humidity = max(50.0, min(99.0, $humidity));

            $sensorReadings[] = [
                'temperature' => $temperature,
                'humidity' => $humidity,
                'co2_level' => 450.00,
                'light_intensity' => $isDaytime ? round(mt_rand(100, 500), 2) : 0,
                'device_id' => 'ESP32-KUMBUNG-01',
                'recorded_at' => $recordedAt,
                'created_at' => $recordedAt,
            ];
        }

        // Tambahkan beberapa data extreme untuk test alert
        // Suhu tinggi (simulasi siang yang terik)
        $sensorReadings[100]['temperature'] = 33.50;
        $sensorReadings[101]['temperature'] = 34.20;
        // Kelembaban rendah
        $sensorReadings[150]['humidity'] = 62.00;

        // Bulk insert biar cepat
        foreach (array_chunk($sensorReadings, 50) as $chunk) {
            SensorData::insert($chunk);
        }

        $this->command->info('✅ Sensor data seeded: 288 readings (24 jam)');

        // ─── 4. BAGLOG BATCHES ──────────────────────────────────
        // 3 batch aktif (berbeda umur)
        $batch1 = BaglogBatch::factory()->create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260710-001',
            'entry_date' => '2026-07-10',
            'quantity' => 200,
            'supplier' => 'UD Baglog Sejahtera',
            'status' => BaglogBatch::STATUS_ACTIVE,
            'notes' => 'Batch pertama bulan Juli, kualitas bagus',
        ]);

        $batch2 = BaglogBatch::factory()->create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260720-001',
            'entry_date' => '2026-07-20',
            'quantity' => 150,
            'supplier' => 'CV Jamur Makmur',
            'status' => BaglogBatch::STATUS_ACTIVE,
        ]);

        $batch3 = BaglogBatch::factory()->create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260801-001',
            'entry_date' => '2026-08-01',
            'quantity' => 300,
            'supplier' => 'Pak Haji Baglog',
            'status' => BaglogBatch::STATUS_ACTIVE,
            'notes' => 'Batch besar, supplier baru',
        ]);

        // 1 batch terkontaminasi
        BaglogBatch::factory()->contaminated()->create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260625-001',
            'entry_date' => '2026-06-25',
            'quantity' => 100,
            'supplier' => 'Toko Tani Maju',
        ]);

        // 1 batch sudah dibuang
        BaglogBatch::factory()->disposed()->create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260601-001',
            'entry_date' => '2026-06-01',
            'quantity' => 80,
            'supplier' => 'UD Baglog Sejahtera',
        ]);

        $this->command->info('✅ Baglog batches seeded: 5 (3 active, 1 contaminated, 1 disposed)');

        // ─── 5. HARVESTS (2 minggu data) ────────────────────────
        $activeBatches = [$batch1, $batch2, $batch3];

        for ($day = 13; $day >= 0; $day--) {
            $harvestDate = $now->copy()->subDays($day)->toDateString();

            // 2 kali panen per hari (pagi + sore), dari batch berbeda
            foreach (array_slice($activeBatches, 0, 2) as $batch) {
                Harvest::factory()->create([
                    'user_id' => $day % 2 === 0 ? $worker->id : $admin->id,
                    'baglog_batch_id' => $batch->id,
                    'harvest_date' => $harvestDate,
                    'weight_kg' => round(mt_rand(200, 1200) / 100, 2), // 2.00 - 12.00 Kg
                ]);
            }
        }

        $this->command->info('✅ Harvests seeded: 28 records (2 minggu)');

        // ─── 6. SALES (2 minggu data) ───────────────────────────
        $buyers = [
            'Pak Joko (Pasar Induk)',
            'Bu Sari (Resto Jamur)',
            'Mas Adi (Tengkulak)',
            'Ibu Dewi (Toko Sayur)',
        ];
        $prices = [20000, 22000, 25000, 28000, 30000];

        for ($day = 13; $day >= 0; $day--) {
            $saleDate = $now->copy()->subDays($day)->toDateString();
            $qty = round(mt_rand(300, 2000) / 100, 2); // 3.00 - 20.00 Kg
            $price = $prices[array_rand($prices)];
            $revenue = bcmul((string) $qty, (string) $price, 2);

            Sale::factory()->create([
                'user_id' => $admin->id,
                'sale_date' => $saleDate,
                'quantity_kg' => $qty,
                'price_per_kg' => $price,
                'total_revenue' => $revenue,
                'buyer_name' => $buyers[array_rand($buyers)],
            ]);
        }

        $this->command->info('✅ Sales seeded: 14 records (2 minggu)');
        $this->command->newLine();
        $this->command->info('🍄 Smart Shroom SCM database seeded successfully!');
        $this->command->info('   Login admin: admin@smartshroom.test / password123');
        $this->command->info('   Login worker: worker@smartshroom.test / password123');
    }
}
