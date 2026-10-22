<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/favicon.ico', function () {
    return file_exists(public_path('favicon.ico'))
        ? response()->file(public_path('favicon.ico'))
        : response('', 404);
});

Route::get('/favicon.png', function () {
    return file_exists(public_path('favicon.png'))
        ? response()->file(public_path('favicon.png'), ['Content-Type' => 'image/png'])
        : response('', 404);
});

Route::get('/favicon.svg', function () {
    return file_exists(public_path('favicon.svg'))
        ? response()->file(public_path('favicon.svg'), ['Content-Type' => 'image/svg+xml'])
        : response('', 404);
});

// ============================================================
// UTILITY ENDPOINTS — HANYA AKTIF DI LOCAL DEVELOPMENT
// @see Audit Keamanan C2
// ============================================================
if (app()->environment('local')) {

    // Endpoint Utility untuk Seeder Database Supabase di Cloud (Local Only)
    Route::match(['GET', 'POST'], '/seed-db', function () {
        $secret = (string) (request()->header('X-Utility-Secret') ?: request()->input('secret', request()->query('secret', '')));
        $validSecret = (string) config('app.utility_secret');

        if (empty($validSecret) || ! hash_equals($validSecret, $secret)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthorized. Secret key tidak valid atau tidak dikonfigurasi di environment.'
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

