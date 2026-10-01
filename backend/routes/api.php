<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BaglogBatchController;
use App\Http\Controllers\Api\BaglogCullController;
use App\Http\Controllers\Api\BatchSlotAssignmentController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeviceControlController;
use App\Http\Controllers\Api\HarvestController;
use App\Http\Controllers\Api\OperationalExpenseController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SensorDataController;
use App\Http\Controllers\Api\SlotController;
use App\Http\Controllers\Api\SprinklerLogController;
use App\Http\Controllers\Api\ThresholdSettingController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public Routes — Dilindungi rate limiter untuk mencegah Brute Force & DoS
Route::middleware('throttle:15,1')->post('/login', [AuthController::class, 'login']);

// NO AUTH — Device Endpoint (ESP32)
// @see ECC rules/php/security.md → Rate limit semua endpoint publik
Route::middleware('throttle:20,1')->group(function () {
    Route::post('/sensor-data', [SensorDataController::class, 'store']);
    Route::post('/sprinkler-logs', [SprinklerLogController::class, 'store']);
});

// NO AUTH — Threshold & Command Read-Only untuk IoT Device & Dashboard
// ESP32 butuh baca threshold dan status jeda panen tanpa token
Route::get('/thresholds/active', [ThresholdSettingController::class, 'index']);
Route::get('/device/command', [DeviceControlController::class, 'status']);

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

    // Actuator Logs History
    Route::get('/sprinkler-logs', [SprinklerLogController::class, 'index']);

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
    Route::get('/sales/buyer-ranking', [SaleController::class, 'buyerRanking']);
    Route::get('/sales/price-trend', [SaleController::class, 'priceTrend']);

    // Grid Spasial Kumbung 3D & Heatmap
    Route::get('/slots', [SlotController::class, 'index']);
    Route::get('/slots/heatmap', [SlotController::class, 'heatmap']);
    Route::get('/slots/{code}', [SlotController::class, 'show']);

    // Ledger Mutasi Afkir Baglog (Culls)
    Route::get('/baglog-culls', [BaglogCullController::class, 'index']);
    Route::post('/baglog-culls', [BaglogCullController::class, 'store']); // worker & admin bisa input

    // HPP & Margin Kontribusi
    Route::get('/baglogs/hpp-summary', [BaglogBatchController::class, 'hppSummary']);
    Route::get('/baglogs/{id}/hpp', [BaglogBatchController::class, 'hpp']);

    // Biaya Operasional (Read)
    Route::get('/operational-expenses', [OperationalExpenseController::class, 'index']);

    // Device Interruption Control (Failsafe Timer Mode Panen)
    Route::post('/device/pause', [DeviceControlController::class, 'pause']);
    Route::post('/device/resume', [DeviceControlController::class, 'resume']);

    // HANYA ADMIN
    Route::middleware('role:admin')->group(function () {
        // Registrasi Akun Pekerja / User Baru (Admin Only)
        Route::post('/register', [AuthController::class, 'register']);

        // Threshold (Admin — bisa baca DAN update)
        Route::get('/thresholds', [ThresholdSettingController::class, 'index']);
        Route::put('/thresholds', [ThresholdSettingController::class, 'update']);

        // Admin only baglog actions
        Route::post('/baglogs', [BaglogBatchController::class, 'store']);

        // Alokasi Batch ke Slot Rak (WMS)
        Route::post('/batch-slot-assignments', [BatchSlotAssignmentController::class, 'store']);
        Route::patch('/batch-slot-assignments/{id}/status', [BatchSlotAssignmentController::class, 'updateStatus']);
        Route::delete('/batch-slot-assignments/{id}', [BatchSlotAssignmentController::class, 'destroy']);

        // Operasional Expenses (Admin create & delete)
        Route::post('/operational-expenses', [OperationalExpenseController::class, 'store']);
        Route::delete('/operational-expenses/{id}', [OperationalExpenseController::class, 'destroy']);

        // Admin only sales actions (POST only — no duplikat dengan GET di atas)
        Route::post('/sales', [SaleController::class, 'store']);
    });
});

// ============================================================
// UTILITY ENDPOINTS — HANYA AKTIF DI LOCAL DEVELOPMENT
// Di production (Vercel), endpoint ini otomatis tidak terdaftar.
// @see Audit Keamanan C2: Hardcoded secret di source code
// ============================================================
if (app()->environment('local')) {

    // Endpoint Utility untuk Upgrade User jadi Role Admin
    Route::get('/make-admin', function () {
        $secret = request()->query('secret');
        if ($secret !== env('UTILITY_SECRET', 'ta-shroom-migrate-2026')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        $email = request()->query('email', 'admin@smartshroom.com');
        $user = \App\Models\User::where('email', $email)->first();
        if ($user) {
            // Jika user belum admin dan kuota admin (1) sudah terisi oleh user lain
            if ($user->role !== \App\Models\User::ROLE_ADMIN && ! \App\Models\User::canRegisterAdmin()) {
                return response()->json([
                    'error' => 'Batas kuota admin telah tercapai (maksimal 1 admin).'
                ], 422);
            }

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
        if ($secret !== env('UTILITY_SECRET', 'ta-shroom-migrate-2026')) {
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
            ], 500);
        }
    });
} // end if(local)
