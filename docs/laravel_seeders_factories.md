# Panduan Seeder & Factory (Smart Shroom SCM)

Dokumen ini menjelaskan implementasi **DatabaseSeeder**, **SlotSeeder**, dan **Model Factories** pada backend Laravel 12. Seeder ini secara otomatis membangkitkan data simulasi realistis untuk budidaya Jamur Kuping (*Auricularia auricula-judae*), mencakup master denah spasial rak 3D, siklus hidup batch media tanam, mutasi afkir, panen multi-flush, transaksi penjualan, pembukuan beban operasional, dan data telemetri IoT.

---

## 1. Menjalankan Seeder

Cukup jalankan perintah Artisan berikut di root direktori backend:
```bash
php artisan migrate:fresh --seed
```

Data yang otomatis digenerate:
- **Master Denah 3D (`SlotSeeder`):** 300 koordinat slot kamar rak (`A-01-01` s.d. `C-10-10`), total kapasitas 3.000 baglog.
- **Pengguna:** 1 Admin (`admin@smartshroom.test`) + 1 Worker (`worker@smartshroom.test`).
- **Ambang Batas (Threshold):** 1 profil optimal Jamur Kuping fase *Fruiting* ($24^\circ\text{C} - 32^\circ\text{C}$ dan $85\% - 95\%$).
- **Batch Baglog:** 5 batch media tanam dengan atribut modal awal per baglog (`price_per_baglog` Rp 2.800) dan variasi status (`active`, `completed`, `contaminated`, `disposed`).
- **Alokasi Slot WMS:** Penempatan batch ke slot-slot kamar di Rak A dan B dengan initial capacity 10 baglog per slot.
- **Jurnal Mutasi Afkir (`baglog_culls`):** Rekaman pengurangan baglog akibat *Trichoderma* dan busuk basah.
- **Hasil Panen:** 28 rekaman panen harian terhubung ke koordinat slot kamar dan nomor siklus flush (1 s.d. 3).
- **Transaksi Penjualan:** 14 transaksi penjualan harian ke berbagai mitra pasar dengan kalkulasi omzet via `bcmul()`.
- **Beban Operasional (`operational_expenses`):** Biaya listrik PLN, air misting, tenaga kerja, dan sanitasi.
- **Telemetri Sensor:** 288 data poin (24 jam terakhir $\times$ interval 5 menit) dengan kurva termal diurnal (siang hangat, malam sejuk).
- **Log Aktuator:** 12 log aktivitas otomatis pompa misting, exhaust fan, dan event sistem jeda panen.

---

## 2. Kode Seeder Spasial (`database/seeders/SlotSeeder.php`)

```php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SlotSeeder extends Seeder
{
    public function run(): void
    {
        $rows = ['A', 'B', 'C'];
        $slots = [];
        $now = now();

        foreach ($rows as $row) {
            for ($bay = 1; $bay <= 10; $bay++) {
                for ($tier = 1; $tier <= 10; $tier++) {
                    $slotCode = sprintf('%s-%02d-%02d', $row, $bay, $tier);

                    $slots[] = [
                        'slot_code' => $slotCode,
                        'row_code' => $row,
                        'bay_number' => $bay,
                        'tier_number' => $tier,
                        'max_capacity' => 10,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        }

        // Bulk upsert per 100 record agar ringan di SQLite
        foreach (array_chunk($slots, 100) as $chunk) {
            DB::table('slots')->upsert(
                $chunk,
                ['slot_code'],
                ['row_code', 'bay_number', 'tier_number', 'max_capacity', 'is_active', 'updated_at']
            );
        }

        $this->command->info('✅ 300 koordinat slot rak (A-01-01 s/d C-10-10) berhasil di-seed.');
    }
}
```

---

## 3. Kode Seeder Utama (`database/seeders/DatabaseSeeder.php`)

```php
namespace Database\Seeders;

use App\Models\BaglogBatch;
use App\Models\Harvest;
use App\Models\Sale;
use App\Models\SensorData;
use App\Models\SprinklerLog;
use App\Models\ThresholdSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 0. SLOTS (Master Grid Kumbung 3D)
        $this->call(SlotSeeder::class);

        // 1. USERS
        $admin = User::factory()->admin()->create([
            'name' => 'Administrator',
            'email' => 'admin@smartshroom.test',
            'password' => bcrypt('password123'),
        ]);

        $worker = User::factory()->create([
            'name' => 'Pekerja Satu',
            'email' => 'worker@smartshroom.test',
            'password' => bcrypt('password123'),
        ]);

        // 2. THRESHOLD SETTING (Fruiting Phase Optimal)
        ThresholdSetting::factory()->create([
            'user_id' => $admin->id,
            'temp_min' => 24.00,
            'temp_max' => 32.00,
            'humidity_min' => 85.00,
            'humidity_max' => 95.00,
            'phase_mode' => 'fruiting',
            'is_active' => true,
        ]);

        // 3. BATCH BAGLOG DENGAN MODAL AWAL HPP
        $batchAktif1 = BaglogBatch::create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260801-001',
            'entry_date' => Carbon::now()->subDays(55),
            'quantity' => 1000,
            'price_per_baglog' => 2800.00,
            'supplier' => 'CV Jamur Lestari',
            'status' => 'active',
        ]);

        // 4. DATA PANEN HARIAN DENGAN FLUSH & SLOT
        for ($i = 14; $i >= 0; $i--) {
            Harvest::create([
                'user_id' => $worker->id,
                'baglog_batch_id' => $batchAktif1->id,
                'slot_code' => 'B-05-03',
                'flush_number' => ($i > 7) ? 1 : 2,
                'harvest_date' => Carbon::now()->subDays($i)->toDateString(),
                'weight_kg' => number_format(rand(60, 120) / 10, 2, '.', ''),
                'notes' => 'Panen daun tebal grade A',
            ]);
        }

        // 5. TRANSAKSI PENJUALAN
        for ($i = 14; $i >= 0; $i--) {
            $qty = rand(50, 100) / 10;
            $price = 25000;
            Sale::create([
                'user_id' => $admin->id,
                'baglog_batch_id' => $batchAktif1->id,
                'sale_date' => Carbon::now()->subDays($i)->toDateString(),
                'quantity_kg' => number_format($qty, 2, '.', ''),
                'price_per_kg' => number_format($price, 2, '.', ''),
                'total_revenue' => bcmul((string)$qty, (string)$price, 2),
                'buyer_name' => 'Pak Joko (Pasar Induk)',
            ]);
        }

        // 6. TELEMETRI SENSOR HISTORIS (288 Poin = 24 Jam x 5 Menit)
        $totalPoints = 288;
        $intervalMinutes = 5;

        for ($i = $totalPoints; $i >= 0; $i--) {
            $timestamp = Carbon::now()->subMinutes($i * $intervalMinutes);
            $hour = $timestamp->hour;

            if ($hour >= 11 && $hour <= 15) {
                $temp = 29.5 + (sin($i) * 1.5);
                $hum = 86.0 + (cos($i) * 3.0);
            } else {
                $temp = 25.0 + (sin($i) * 1.0);
                $hum = 92.0 + (cos($i) * 2.0);
            }

            SensorData::create([
                'device_id' => 'ESP32-KUMBUNG-01',
                'temperature' => round($temp, 2),
                'humidity' => round($hum, 2),
                'co2_level' => round(450 + rand(0, 50), 2),
                'light_intensity' => ($hour >= 6 && $hour <= 18) ? round(150 + rand(0, 100), 2) : 10.0,
                'recorded_at' => $timestamp,
                'created_at' => $timestamp,
            ]);
        }
    }
}
```
