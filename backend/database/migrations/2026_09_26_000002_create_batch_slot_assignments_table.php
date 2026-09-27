<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration tabel pivot alokasi batch baglog ke koordinat slot rak.
 *
 * Entitas fisik (Slot) terpisah dari entitas tamu (Batch).
 * Mengakomodasi initial_quantity (audit #6) dan tracking fase inkubasi/fruiting.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('batch_slot_assignments', function (Blueprint $table) {
            $table->id();

            // FK ke batch baglog
            $table->foreignId('baglog_batch_id')
                ->constrained('baglog_batches')
                ->onDelete('cascade')
                ->comment('Batch baglog yang menempati slot ini');

            // FK ke koordinat slot rak
            $table->string('slot_code', 10)
                ->comment('Kode koordinat slot, contoh: B-05-03');
            $table->foreign('slot_code')
                ->references('slot_code')
                ->on('slots')
                ->onDelete('cascade');

            // Jumlah awal baglog saat masuk slot (fleksibel jika tidak pas 10)
            $table->unsignedTinyInteger('initial_quantity')
                ->default(10)
                ->comment('Jumlah baglog awal di slot ini saat barang masuk');

            // Kondisi miselium awal saat barang turun pikap
            $table->enum('initial_mycelium_stage', ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'])
                ->comment('Fase miselium awal: LEVEL_1 (<50%), LEVEL_2 (50-80%), LEVEL_3 (>80%)');

            // Status pertumbuhan di slot ini (metadata analitik)
            $table->enum('current_status', ['INCUBATION', 'FRUITING', 'COMPLETED'])
                ->default('INCUBATION')
                ->comment('Status fase pertumbuhan di level slot');

            // Tanggal penempatan di slot
            $table->date('assigned_at')
                ->comment('Tanggal baglog mulai ditaruh di slot rak');

            $table->timestamps();

            // Indexes
            $table->index(['baglog_batch_id', 'slot_code']);
            $table->index('current_status');
            $table->index('assigned_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batch_slot_assignments');
    }
};
