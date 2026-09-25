<?php

use App\Models\SensorData;
use Carbon\Carbon;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('sensor:sync-now', function () {
    $now = Carbon::now();
    $latest = SensorData::latestReading()->first();

    $lastTime = $latest ? Carbon::parse($latest->recorded_at) : $now->copy()->subHours(24);
    $diffMinutes = $lastTime->diffInMinutes($now, false);

    if ($diffMinutes <= 0) {
        $this->info("Sensor data already up to date ({$lastTime->format('H:i:s')})!");
        return;
    }

    $records = [];
    $currentTime = $lastTime->copy()->addMinutes(5);

    while ($currentTime <= $now) {
        $hour = (int) $currentTime->format('H');
        $isDaytime = $hour >= 6 && $hour < 18;
        $baseTemp = $isDaytime ? 28.2 : 25.2;
        $temp = round($baseTemp + (mt_rand(-60, 60) / 100) * 1.5, 1);
        $hum = round(83.2 + (mt_rand(-60, 60) / 100) * 2.5, 1);

        $records[] = [
            'temperature' => $temp,
            'humidity' => $hum,
            'co2_level' => 450,
            'light_intensity' => $isDaytime ? rand(100, 300) : 0,
            'device_id' => 'ESP32-KUMBUNG-01',
            'recorded_at' => $currentTime->copy(),
            'created_at' => $currentTime->copy(),
        ];
        $currentTime->addMinutes(5);
    }

    if (!empty($records)) {
        foreach (array_chunk($records, 50) as $chunk) {
            SensorData::insert($chunk);
        }
        $this->info("✅ Berhasil generate " . count($records) . " data sensor baru sampai {$now->format('H:i:s')}");
    } else {
        $this->info("Sensor data sudah update.");
    }
})->purpose('Generate missing sensor readings up to current time');

Artisan::command('db:checkpoint {name? : Custom label untuk checkpoint}', function () {
    $dbPath = database_path('database.sqlite');
    if (!file_exists($dbPath)) {
        $this->error("Database file tidak ditemukan di {$dbPath}!");
        return 1;
    }

    $backupDir = database_path('backups');
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }

    $label = $this->argument('name') ? preg_replace('/[^a-zA-Z0-9_-]/', '_', $this->argument('name')) : 'snapshot';
    $filename = 'checkpoint_' . date('Ymd_His') . "_{$label}.sqlite";
    $targetPath = $backupDir . DIRECTORY_SEPARATOR . $filename;

    copy($dbPath, $targetPath);

    $sizeKb = round(filesize($targetPath) / 1024, 1);
    $this->info("✅ Checkpoint database berhasil disimpan!");
    $this->line("   📁 File : {$filename}");
    $this->line("   📦 Size : {$sizeKb} KB");
    $this->line("   📍 Path : {$targetPath}");
    return 0;
})->purpose('Simpan checkpoint/snapshot SQLite database 1-click');

Artisan::command('db:checkpoints', function () {
    $backupDir = database_path('backups');
    if (!is_dir($backupDir)) {
        $this->comment('Belum ada checkpoint database.');
        return 0;
    }

    $files = glob($backupDir . DIRECTORY_SEPARATOR . '*.sqlite');
    if (empty($files)) {
        $this->comment('Belum ada checkpoint database.');
        return 0;
    }

    $this->info('📋 Daftar Checkpoint Database:');
    $headers = ['Nama File', 'Ukuran', 'Tanggal Dibuat'];
    $rows = [];

    foreach ($files as $file) {
        $rows[] = [
            basename($file),
            round(filesize($file) / 1024, 1) . ' KB',
            date('Y-m-d H:i:s', filemtime($file)),
        ];
    }

    $this->table($headers, $rows);
    return 0;
})->purpose('Tampilkan daftar seluruh checkpoint database');

Artisan::command('db:restore {file? : Nama file checkpoint yang ingin di-restore}', function () {
    $backupDir = database_path('backups');
    $files = glob($backupDir . DIRECTORY_SEPARATOR . '*.sqlite');

    if (empty($files)) {
        $this->error('Tidak ada file checkpoint yang tersedia di database/backups!');
        return 1;
    }

    // Sort by modified time descending (terbaru dulu)
    usort($files, fn($a, $b) => filemtime($b) - filemtime($a));

    $targetFile = $this->argument('file');
    if (!$targetFile) {
        // Ambil yang paling baru secara otomatis
        $targetPath = $files[0];
        $this->comment("Menggunakan checkpoint terbaru: " . basename($targetPath));
    } else {
        $targetPath = $backupDir . DIRECTORY_SEPARATOR . basename($targetFile);
        if (!file_exists($targetPath)) {
            $this->error("File checkpoint {$targetFile} tidak ditemukan!");
            return 1;
        }
    }

    $dbPath = database_path('database.sqlite');
    copy($targetPath, $dbPath);

    $this->info("✅ Database berhasil di-restore dari checkpoint: " . basename($targetPath));
    return 0;
})->purpose('Restore database SQLite dari checkpoint');


