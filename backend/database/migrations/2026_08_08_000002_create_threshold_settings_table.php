<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration untuk tabel threshold_settings.
 *
 * Menyimpan batas atas/bawah suhu & kelembaban yang aman.
 * Jika data sensor (FR-4.1) melewati batas ini,
 * sistem akan trigger notifikasi "Suhu Kritis!" di Dashboard (FR-1.3).
 *
 * Satu user (admin) bisa punya beberapa konfigurasi threshold,
 * tapi hanya satu yang aktif (is_active = true) pada satu waktu.
 *
 * @see PRD FR-4.2 (Threshold Settings)
 * @see PRD FR-1.3 (Quick Stats — Peringatan Sistem)
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('threshold_settings', function (Blueprint $table) {
            $table->id();

            // FK ke users — admin yang mengatur threshold
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('Admin yang mengatur threshold ini');

            // Batas suhu — DECIMAL(5,2) sesuai ECC Rule
            $table->decimal('temp_min', 5, 2)
                ->default(20.00)
                ->comment('Batas bawah suhu aman dalam °C');
            $table->decimal('temp_max', 5, 2)
                ->default(30.00)
                ->comment('Batas atas suhu aman dalam °C');

            // Batas kelembaban — DECIMAL(5,2)
            $table->decimal('humidity_min', 5, 2)
                ->default(70.00)
                ->comment('Batas bawah kelembaban aman dalam %');
            $table->decimal('humidity_max', 5, 2)
                ->default(90.00)
                ->comment('Batas atas kelembaban aman dalam %');

            // Flag aktif — hanya 1 threshold yang aktif pada satu waktu
            $table->boolean('is_active')
                ->default(true)
                ->comment('Hanya satu threshold yang boleh aktif');

            $table->timestamps();

            // Index user_id untuk lookup cepat threshold per admin
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('threshold_settings');
    }
};
