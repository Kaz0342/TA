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
        Schema::table('threshold_settings', function (Blueprint $table) {
            $table->string('phase_mode', 30)
                ->default('fruiting')
                ->after('humidity_max')
                ->comment('Fase pertumbuhan jamur kuping: incubation, primordia, fruiting, custom');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('threshold_settings', function (Blueprint $table) {
            $table->dropColumn('phase_mode');
        });
    }
};
