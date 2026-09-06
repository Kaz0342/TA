<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BaglogBatchController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HarvestController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SensorDataController;
use App\Http\Controllers\Api\SprinklerLogController;
use App\Http\Controllers\Api\ThresholdSettingController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public Routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// NO AUTH — Device Endpoint (ESP32)
// @see ECC rules/php/security.md → Rate limit semua endpoint publik
Route::middleware('throttle:20,1')->group(function () {
    Route::post('/sensor-data', [SensorDataController::class, 'store']);
    Route::post('/sprinkler-logs', [SprinklerLogController::class, 'store']);
});

// NO AUTH — Threshold Read-Only untuk IoT Device
// ESP32 butuh baca threshold tanpa punya akun user
// @see Audit BE-C2: endpoint ini HARUS publik agar ESP32 bisa baca threshold terbaru
Route::get('/thresholds/active', [ThresholdSettingController::class, 'index']);

// Protected Routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth User
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Sensor Data Analytics (FR-1.1, FR-1.2)
    // Bisa diakses oleh admin & worker
    Route::get('/sensor-data/latest', [SensorDataController::class, 'latest']);
    Route::get('/sensor-data/chart', [SensorDataController::class, 'chart']);

    // Dashboard Quick Stats (FR-1.3)
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Baglog Management (FR-2.x)
    Route::get('/baglogs', [BaglogBatchController::class, 'index']);
    Route::patch('/baglogs/{id}/status', [BaglogBatchController::class, 'updateStatus']);

    // Harvests (FR-3.x)
    Route::get('/harvests', [HarvestController::class, 'index']);
    Route::post('/harvests', [HarvestController::class, 'store']); // worker bisa input
    Route::get('/harvests/today-total', [HarvestController::class, 'todayTotal']);
    Route::get('/harvests/chart', [HarvestController::class, 'chart']);

    // Sales (FR-3.x)
    Route::get('/sales', [SaleController::class, 'index']);
    Route::get('/sales/weekly-report', [SaleController::class, 'weeklyReport']);

    // HANYA ADMIN
    Route::middleware('role:admin')->group(function () {
        // Threshold (Admin — bisa baca DAN update)
        Route::get('/thresholds', [ThresholdSettingController::class, 'index']);
        Route::put('/thresholds', [ThresholdSettingController::class, 'update']);

        // Admin only baglog actions
        Route::post('/baglogs', [BaglogBatchController::class, 'store']);

        // Admin only sales actions (POST only — no duplikat dengan GET di atas)
        Route::post('/sales', [SaleController::class, 'store']);
    });
});

// Endpoint Utility untuk Upgrade User jadi Role Admin
Route::get('/make-admin', function () {
    $secret = request()->query('secret');
    if ($secret !== 'ta-shroom-migrate-2026') {
        return response()->json(['error' => 'Unauthorized'], 403);
    }
    $email = request()->query('email', 'admin@smartshroom.com');
    $user = \App\Models\User::where('email', $email)->first();
    if ($user) {
        $user->update(['role' => 'admin']);
        return response()->json([
            'status' => 'success',
            'message' => "User {$email} berhasil di-upgrade jadi role ADMIN!",
            'user' => $user,
        ]);
    }
    return response()->json(['error' => 'User not found'], 404);
});

// Endpoint Utility untuk Seeder Data Awal di Supabase
Route::get('/seed-db', function () {
    $secret = request()->query('secret');
    if ($secret !== 'ta-shroom-migrate-2026') {
        return response()->json(['error' => 'Unauthorized'], 403);
    }

    try {
        // 1. Admin
        $admin = \App\Models\User::firstOrCreate(
            ['email' => 'admin@smartshroom.test'],
            [
                'name' => 'Administrator',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role' => \App\Models\User::ROLE_ADMIN,
            ]
        );

        // 2. Worker
        $worker = \App\Models\User::firstOrCreate(
            ['email' => 'worker@smartshroom.test'],
            [
                'name' => 'Pekerja Kebun',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role' => \App\Models\User::ROLE_WORKER,
            ]
        );

        // 3. Active Threshold
        $threshold = \App\Models\ThresholdSetting::firstOrCreate(
            ['is_active' => true],
            [
                'user_id' => $admin->id,
                'temp_min' => 20.00,
                'temp_max' => 30.00,
                'humidity_min' => 70.00,
                'humidity_max' => 90.00,
                'is_active' => true,
            ]
        );

        // 4. Batch Baglog dummy aktif
        $batch = \App\Models\BaglogBatch::firstOrCreate(
            ['batch_code' => 'BL-20260901-001'],
            [
                'user_id' => $admin->id,
                'entry_date' => now()->subDays(10)->toDateString(),
                'quantity' => 500,
                'supplier' => 'UD Jamur Makmur',
                'status' => \App\Models\BaglogBatch::STATUS_ACTIVE,
                'notes' => 'Batch utama kumbung A',
            ]
        );

        // 5. Sensor Data awal
        $sensor = \App\Models\SensorData::create([
            'temperature' => 26.5,
            'humidity' => 82.0,
            'co2_level' => 450.0,
            'light_intensity' => 120.0,
            'device_id' => 'ESP32-KUMBUNG-01',
            'recorded_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Database Supabase berhasil di-seed!',
            'admin' => $admin->email,
            'worker' => $worker->email,
            'threshold' => $threshold,
            'batch' => $batch->batch_code,
            'sensor' => $sensor,
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'status' => 'error',
            'message' => $e->getMessage(),
            'line' => $e->getLine(),
        ], 500);
    }
});

// Endpoint Darurat/Utility untuk Migrasi Database Supabase di Cloud
Route::get('/migrate-db', function () {
    $secret = request()->query('secret');
    if ($secret !== 'ta-shroom-migrate-2026') {
        return response()->json([
            'status' => 'error',
            'message' => 'Unauthorized. Secret key salah atau tidak disertakan.'
        ], 403);
    }

    try {
        Artisan::call('migrate', ['--force' => true]);
        $output = Artisan::output();

        return response()->json([
            'status' => 'success',
            'message' => 'Migrasi Supabase berhasil dijalankan!',
            'output' => $output,
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'status' => 'error',
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ], 500);
    }
});
