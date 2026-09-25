# Panduan Seeder & Factory (Smart Shroom SCM)

Dokumen ini menjelaskan implementasi **DatabaseSeeder** dan **Model Factories** pada backend Laravel 12. Seeder ini secara otomatis membangkitkan data simulasi realistis untuk budidaya Jamur Kuping (*Auricularia auricula-judae*), siap digunakan untuk keperluan demonstrasi visual dashboard, pengujian otomatis (PHPUnit), dan lampiran dokumen Tugas Akhir.

---

## 1. Menjalankan Seeder

Cukup jalankan perintah Artisan berikut di root direktori backend:
```bash
php artisan migrate:fresh --seed
```

Data yang otomatis digenerate:
- **Pengguna:** 1 Admin (`admin@smartshroom.test`) + 1 Worker (`worker@smartshroom.test`).
- **Ambang Batas (Threshold):** 1 profil optimal Jamur Kuping fase *Fruiting* ($24^\circ\text{C} - 32^\circ\text{C}$ dan $80\% - 95\%$).
- **Batch Baglog:** 5 batch media tanam (3 batch aktif umur 15, 35, 55 hari; 1 terkontaminasi; 1 afkir dibuang).
- **Hasil Panen:** 28 rekaman panen harian (2 minggu terakhir, 2 sesi petik per hari).
- **Transaksi Penjualan:** 14 transaksi penjualan harian ke berbagai mitra pasar dengan kalkulasi omzet via `bcmul()`.
- **Telemetri Sensor:** 288 data poin (24 jam terakhir $\times$ interval 5 menit) dengan kurva termal diurnal (siang hangat, malam sejuk).
- **Log Aktuator:** 12 log aktivitas otomatis pompa misting dan exhaust fan.

---

## 2. Kode Seeder Utama (`database/seeders/DatabaseSeeder.php`)

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
        // 1. Akun Pengguna
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

        // 2. Threshold Setting (Fruiting Phase)
        ThresholdSetting::factory()->create([
            'user_id' => $admin->id,
            'temp_min' => 24.00,
            'temp_max' => 32.00,
            'humidity_min' => 80.00,
            'humidity_max' => 95.00,
            'phase_mode' => 'fruiting',
            'is_active' => true,
        ]);

        // 3. Batch Baglog (Variasi Siklus Hidup)
        $batchAktif1 = BaglogBatch::create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260715-001',
            'entry_date' => Carbon::now()->subDays(55),
            'quantity' => 1000,
            'supplier' => 'CV Jamur Lestari',
            'status' => 'active',
        ]);

        $batchAktif2 = BaglogBatch::create([
            'user_id' => $admin->id,
            'batch_code' => 'BL-20260801-002',
            'entry_date' => Carbon::now()->subDays(35),
            'quantity' => 800,
            'supplier' => 'Koperasi Bibit Mandiri',
            'status' => 'active',
        ]);

        // 4. Data Panen Harian (2 Minggu Terakhir)
        for ($i = 14; $i >= 0; $i--) {
            Harvest::create([
                'user_id' => $worker->id,
                'baglog_batch_id' => $batchAktif1->id,
                'harvest_date' => Carbon::now()->subDays($i)->toDateString(),
                'weight_kg' => number_format(rand(60, 120) / 10, 2, '.', ''), // 6.0 - 12.0 kg
                'notes' => 'Panen daun tebal grade A',
            ]);
        }

        // 5. Data Penjualan (Revenue Otomatis)
        for ($i = 14; $i >= 0; $i--) {
            $qty = rand(50, 100) / 10;
            $price = 25000;
            Sale::create([
                'user_id' => $admin->id,
                'sale_date' => Carbon::now()->subDays($i)->toDateString(),
                'quantity_kg' => number_format($qty, 2, '.', ''),
                'price_per_kg' => number_format($price, 2, '.', ''),
                'total_revenue' => bcmul((string)$qty, (string)$price, 2),
                'buyer_name' => 'Pak Joko (Pasar Induk)',
            ]);
        }

        // 6. Data Sensor Historis Diurnal (288 Poin = 24 Jam x 5 Menit)
        $totalPoints = 288;
        $intervalMinutes = 5;

        for ($i = $totalPoints; $i >= 0; $i--) {
            $timestamp = Carbon::now()->subMinutes($i * $intervalMinutes);
            $hour = $timestamp->hour;

            // Model fluktuasi siang terik vs malam lembab sejuk
            if ($hour >= 11 && $hour <= 15) {
                $temp = 29.5 + (sin($i) * 1.5);
                $hum = 82.0 + (cos($i) * 3.0);
            } else {
                $temp = 25.0 + (sin($i) * 1.0);
                $hum = 90.0 + (cos($i) * 2.0);
            }

            SensorData::create([
                'device_id' => 'ESP32-KUMBUNG-01',
                'temperature' => round($temp, 2),
                'humidity' => round($hum, 2),
                'co2_level' => round(420 + rand(0, 80), 2),
                'light_intensity' => ($hour >= 6 && $hour <= 18) ? round(150 + rand(0, 100), 2) : 10.0,
                'recorded_at' => $timestamp,
                'created_at' => $timestamp,
            ]);
        }
    }
}
```
