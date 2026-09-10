<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// ============================================================
// UTILITY ENDPOINTS — HANYA AKTIF DI LOCAL DEVELOPMENT
// @see Audit Keamanan C2
// ============================================================
if (app()->environment('local')) {

    // Endpoint Utility untuk Seeder Database Supabase di Cloud
    Route::get('/seed-db', function () {
        $secret = request()->query('secret');
        if ($secret !== env('UTILITY_SECRET', 'ta-shroom-migrate-2026')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized. Secret key salah atau tidak disertakan.'
            ], 403);
        }

        try {
            Artisan::call('db:seed', ['--force' => true]);
            $output = Artisan::output();

            return response()->json([
                'status' => 'success',
                'message' => 'Seeder Supabase berhasil dijalankan!',
                'output' => $output,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    });

} // end if(local)

// Endpoint Darurat/Utility untuk Migrasi & Seeder Database Supabase di Cloud (dilindungi secret key)
Route::get('/migrate-db', function () {
    $secret = request()->query('secret');
    if ($secret !== env('UTILITY_SECRET', 'ta-shroom-migrate-2026')) {
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
