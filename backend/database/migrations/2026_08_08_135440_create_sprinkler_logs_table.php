<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sprinkler_logs', function (Blueprint $table) {
            $table->id();
            $table->string('device_id', 50)->comment('ID device pengirim log');
            $table->timestamp('started_at')->comment('Waktu penyemprotan dimulai');
            $table->unsignedInteger('duration_seconds')->comment('Durasi nyala pompa (detik)');
            $table->string('trigger_reason')->comment('Alasan nyala, misal: Suhu 32C > Max 30C');
            $table->timestamps();

            $table->index('started_at');
            $table->index('device_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sprinkler_logs');
    }
};
