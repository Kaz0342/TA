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
        Schema::table('sprinkler_logs', function (Blueprint $table) {
            $table->string('actuator', 50)->default('misting')->after('device_id')->comment('Jenis aktuator: misting, fan');
            $table->string('stop_reason', 255)->nullable()->after('trigger_reason')->comment('Kondisi akhir / alasan mati: target tercapai, safety timeout');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sprinkler_logs', function (Blueprint $table) {
            $table->dropColumn(['actuator', 'stop_reason']);
        });
    }
};
