<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BaglogBatchController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HarvestController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SensorDataController;
use App\Http\Controllers\Api\SprinklerLogController;
use App\Http\Controllers\Api\ThresholdSettingController;
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
