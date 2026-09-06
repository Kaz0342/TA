<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Endpoint Darurat/Utility untuk Migrasi & Seeder Database Supabase di Cloud
Route::get('/migrate-db', function () {
    $secret = request()->query('secret');
    if ($secret !== 'ta-shroom-migrate-2026') {
        return response()->json([
            'status' => 'error',
            'message' => 'Unauthorized. Secret key salah atau tidak disertakan.'
        ], 403);
    }

    try {
        Artisan::call('migrate:fresh', ['--force' => true, '--seed' => true]);
        $output = Artisan::output();

        return response()->json([
            'status' => 'success',
            'message' => 'Migrasi fresh dan seeder Supabase berhasil dijalankan!',
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
