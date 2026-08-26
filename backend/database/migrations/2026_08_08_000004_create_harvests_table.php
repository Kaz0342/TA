<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration untuk tabel harvests.
 *
 * Mencatat hasil panen harian jamur tiram.
 * Setiap record panen dikaitkan dengan batch baglog tertentu
 * sehingga bisa dianalisis produktivitas per batch.
 *
 * weight_kg pakai DECIMAL(8,2) — max 999999.99 Kg
 * (lebih dari cukup, kecuali King punya kumbung seluas stadion).
 *
 * Data ini juga fondasi untuk AI Analytics Phase 2:
 * model Regresi/Random Forest akan tarik data historis panen
 * untuk prediksi hasil panen esok hari.
 *
 * @see PRD FR-3.1 (Input Hasil Panen)
 * @see PRD Section 7 (Phase 2 — AI Analytics)
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('harvests', function (Blueprint $table) {
            $table->id();

            // FK ke users — pekerja yang menginput data panen
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('Pekerja/admin yang mencatat panen');

            // FK ke baglog_batches — panen dari batch mana
            // Nullable karena kadang pekerja nggak tahu batch-nya (edge case)
            $table->foreignId('baglog_batch_id')
                ->nullable()
                ->constrained('baglog_batches')
                ->onDelete('set null')
                ->comment('Batch baglog sumber panen (opsional)');

            // Tanggal panen
            $table->date('harvest_date')
                ->comment('Tanggal panen dilakukan');

            // Berat panen — DECIMAL bukan FLOAT
            // precision 8, scale 2 → max 999,999.99 Kg
            $table->decimal('weight_kg', 8, 2)
                ->comment('Berat total panen dalam Kilogram');

            // Catatan opsional
            $table->text('notes')
                ->nullable()
                ->comment('Catatan tambahan, misal: kondisi jamur, dll');

            $table->timestamps();

            // === INDEXES ===
            // Index harvest_date untuk query "total panen hari ini" (FR-1.3)
            // dan report mingguan (FR-3.3)
            $table->index('harvest_date');

            // Composite: user + harvest_date — "panen siapa di tanggal X"
            $table->index(['user_id', 'harvest_date']);

            // Composite: baglog + harvest_date — produktivitas per batch
            $table->index(['baglog_batch_id', 'harvest_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('harvests');
    }
};
