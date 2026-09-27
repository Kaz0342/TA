<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration master data koordinat rak kumbung 3D (Row-Bay-Tier).
 *
 * Format kode baku: [Row]-[Bay]-[Tier], contoh: 'A-01-01' s/d 'C-10-10'
 * - Row: A, B, C (Lorong/Rak)
 * - Bay: 01 s/d 10 (Seksi horizontal)
 * - Tier: 01 s/d 10 (Tingkat vertikal)
 * Kapasitas default: 10 baglog per slot.
 *
 * Koordinat bersifat fisik statis & immutable.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('slots', function (Blueprint $table) {
            $table->string('slot_code', 10)->primary()->comment('Kode koordinat Kartesius 3D: Row-Bay-Tier');
            $table->char('row', 1)->comment('Lorong/Rak: A, B, C');
            $table->unsignedTinyInteger('bay')->comment('Seksi horizontal: 1-10');
            $table->unsignedTinyInteger('tier')->comment('Tingkat vertikal: 1-10');
            $table->unsignedTinyInteger('max_capacity')->default(10)->comment('Kapasitas maksimal baglog per slot');
            $table->timestamps();

            // Index pencarian spasial & visualisasi heatmap per lorong
            $table->index('row');
            $table->index(['row', 'bay']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('slots');
    }
};
