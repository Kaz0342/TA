# Panduan Seeder & Factory (Smart Shroom SCM)

Dokumen ini berisi kode **DatabaseSeeder** dan **Factory** untuk nge-*generate* data dummy realistis (Jamur Kuping). Berguna banget buat pengujian grafik di *dashboard* dan bisa dilampirin langsung di laporan TA lu.

---

## 1. DatabaseSeeder (`database/seeders/DatabaseSeeder.php`)

Ini adalah file utama yang bakal manggil dan nge-*generate* semua data yang lu minta: Akun, Baglog, Panen, dan Log Sensor Historis. Tinggal jalanin `php artisan db:seed`.

```php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\BaglogBatch;
use App\Models\Harvest;
use App\Models\SensorData;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        // 1. Buat Akun Admin & Worker
        $admin = User::create([
            'name' => 'King Admin',
            'email' => 'admin@jamurking.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);

        $worker = User::create([
            'name' => 'Pekerja Kumbung',
            'email' => 'worker@jamurking.com',
            'password' => bcrypt('password'),
            'role' => 'worker',
        ]);

        // 2. Buat 3 Batch Baglog (Umur 15, 30, dan 50 hari)
        $batch50 = BaglogBatch::create([
            'batch_code' => 'BATCH-KUPING-001',
            'entry_date' => Carbon::now()->subDays(50),
            'quantity' => 1000,
            'supplier' => 'Petani Lokal Lembang',
            'is_active' => true,
        ]);

        $batch30 = BaglogBatch::create([
            'batch_code' => 'BATCH-KUPING-002',
            'entry_date' => Carbon::now()->subDays(30),
            'quantity' => 800,
            'supplier' => 'Koperasi Jamur Tiram',
            'is_active' => true,
        ]);

        $batch15 = BaglogBatch::create([
            'batch_code' => 'BATCH-KUPING-003',
            'entry_date' => Carbon::now()->subDays(15),
            'quantity' => 1200,
            'supplier' => 'Agro Jamur Jaya',
            'is_active' => true,
        ]);

        // 3. Buat Data Panen 2 Minggu Terakhir (Khusus Batch 1 & 2 yang udah cukup umur)
        for ($i = 14; $i >= 0; $i--) {
            // Panen dari Batch umur 50 hari (Lagi produktif)
            Harvest::create([
                'baglog_batch_id' => $batch50->id,
                'user_id' => $worker->id,
                'harvest_date' => Carbon::now()->subDays($i),
                'total_kg' => rand(20, 55) / 10, // Hasil realistis: 2.0 kg - 5.5 kg per hari
                'quality' => 'A',
            ]);

            // Panen dari Batch umur 30 hari (Baru mulai tumbuh awal)
            Harvest::create([
                'baglog_batch_id' => $batch30->id,
                'user_id' => $worker->id,
                'harvest_date' => Carbon::now()->subDays($i),
                'total_kg' => rand(10, 30) / 10, // Hasil tipis: 1.0 kg - 3.0 kg per hari
                'quality' => 'A',
            ]);
        }

        // 4. Buat 100 Log Sensor Data Historis (Untuk ngetes Grafik Suhu/RH 24 Jam)
        // Data di-generate mundur dari 24 jam yang lalu sampai waktu sekarang
        $totalLogs = 100;
        $minutesInterval = (24 * 60) / $totalLogs; // Sekitar 1 data per 14 menit

        for ($i = $totalLogs; $i >= 0; $i--) {
            $timestamp = Carbon::now()->subMinutes($i * $minutesInterval);
            
            // Bikin fluktuasi Suhu & RH realistis (Siang panas, Malam adem)
            $hour = $timestamp->hour;
            if ($hour >= 10 && $hour <= 15) {
                $temp = rand(280, 305) / 10; // Siang bolong: 28.0°C - 30.5°C
                $hum = rand(750, 850) / 10;  // Siang bolong: 75.0% - 85.0% (Lebih kering)
            } else {
                $temp = rand(250, 275) / 10; // Pagi/Malam: 25.0°C - 27.5°C
                $hum = rand(880, 950) / 10;  // Pagi/Malam: 88.0% - 95.0% (Lembab)
            }

            SensorData::create([
                'device_id' => 'ESP32-KUMBUNG-01',
                'temperature' => $temp,
                'humidity' => $hum,
                'co2_level' => rand(400, 550), // CO2 normal udara
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);
        }
    }
}
```

---

## 2. Factory (`database/factories/SensorDataFactory.php`)

Kalau di masa depan lu mau *generate* ribuan data secara random banget (di luar seeder manual di atas), lu bisa pake `Factory` bawaan Laravel kayak gini:

```php
namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class SensorDataFactory extends Factory
{
    public function definition()
    {
        return [
            'device_id' => 'ESP32-KUMBUNG-01',
            'temperature' => $this->faker->randomFloat(2, 25, 30),
            'humidity' => $this->faker->randomFloat(2, 80, 95),
            'co2_level' => $this->faker->randomFloat(2, 400, 600),
            'created_at' => $this->faker->dateTimeBetween('-1 week', 'now'),
        ];
    }
}
```
