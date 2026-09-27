<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration penambahan koordinat slot, nomor flush (siklus panen),
 * dan quality grade pada tabel harvests.
 *
 * Kolom bersifat nullable / ber-default agar data panen existing tetap utuh.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('harvests', function (Blueprint $table) {
            // Koordinat slot sumber panen (opsional/nullable untuk backward compatibility)
            $table->string('slot_code', 10)
                ->nullable()
                ->after('baglog_batch_id')
                ->comment('Koordinat slot rak sumber panen');

            $table->foreign('slot_code')
                ->references('slot_code')
                ->on('slots')
                ->onDelete('set null');

            // Siklus panen ke-berapa (Flush 1 s/d 7)
            $table->unsignedTinyInteger('flush_number')
                ->default(1)
                ->after('weight_kg')
                ->comment('Siklus panen ke-berapa (Flush 1-7)');

            // Kualitas jamur saat panen
            $table->enum('quality_grade', ['A', 'B', 'REJECT'])
                ->default('A')
                ->after('flush_number')
                ->comment('Grade kualitas jamur: A (premium), B (standar), REJECT (rusak/cacat)');

            // Index performa query heatmap & analitik flush
            $table->index(['slot_code', 'flush_number']);
            $table->index('flush_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('harvests', function (Blueprint $table) {
            $table->dropForeign(['slot_code']);
            $table->dropIndex(['slot_code', 'flush_number']);
            $table->dropIndex(['flush_number']);
            $table->dropColumn(['slot_code', 'flush_number', 'quality_grade']);
        });
    }
};
