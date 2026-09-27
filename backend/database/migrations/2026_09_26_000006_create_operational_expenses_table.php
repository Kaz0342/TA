<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration tabel operational_expenses untuk pencatatan biaya operasional
 * (listrik, misting, alkohol, plastik, dll).
 *
 * Mendukung atribusi per batch (jika biaya spesifik batch) maupun
 * NULL (jika biaya shared/overhead kumbung).
 * Menggunakan DECIMAL(12, 2) untuk uang.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('operational_expenses', function (Blueprint $table) {
            $table->id();

            // FK ke batch baglog (nullable jika biaya shared/overhead umum)
            $table->foreignId('baglog_batch_id')
                ->nullable()
                ->constrained('baglog_batches')
                ->onDelete('set null')
                ->comment('Batch terkait (opsional/nullable untuk biaya shared)');

            // Tanggal pengeluaran
            $table->date('expense_date')
                ->comment('Tanggal pengeluaran operasional');

            // Kategori pengeluaran operasional
            $table->enum('category', [
                'LISTRIK',     // Token listrik kumbung / pompa / exhaust
                'MISTING',     // Pemeliharaan nozzle / filter air
                'ALKOHOL',     // Alkohol 70% / sterilisasi ruang & alat
                'PLASTIK',     // Plastik packing jamur panen
                'LAINNYA',     // Pengeluaran operasional tak terduga lainnya
            ])->comment('Kategori pengeluaran');

            // Nominal pengeluaran dalam Rupiah
            $table->decimal('amount', 12, 2)
                ->comment('Nominal pengeluaran dalam Rupiah (IDR)');

            // Catatan rincian biaya
            $table->text('notes')
                ->nullable()
                ->comment('Keterangan nota / detail belanja');

            $table->timestamps();

            // Indexes
            $table->index(['baglog_batch_id', 'expense_date']);
            $table->index('expense_date');
            $table->index('category');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('operational_expenses');
    }
};
