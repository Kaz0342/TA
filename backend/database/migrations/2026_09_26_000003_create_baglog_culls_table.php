<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration tabel ledger kematian / afkir baglog (baglog_culls).
 *
 * Kapasitas aktif slot tidak diedit manual, melainkan dihitung dinamis:
 * Kapasitas Aktif = initial_quantity - SUM(culls.quantity).
 * Digunakan untuk audit garansi supplier dan analisis titik sebar kontaminasi.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('baglog_culls', function (Blueprint $table) {
            $table->id();

            // FK ke batch baglog
            $table->foreignId('baglog_batch_id')
                ->constrained('baglog_batches')
                ->onDelete('cascade')
                ->comment('Batch baglog yang diafkir');

            // FK ke koordinat slot rak
            $table->string('slot_code', 10)
                ->comment('Koordinat slot tempat baglog rusak ditemukan');
            $table->foreign('slot_code')
                ->references('slot_code')
                ->on('slots')
                ->onDelete('cascade');

            // Tanggal pencatatan afkir
            $table->date('cull_date')
                ->comment('Tanggal baglog diafkir/dibuang');

            // Jumlah baglog yang dibuang
            $table->unsignedTinyInteger('quantity')
                ->comment('Jumlah baglog yang diafkir');

            // Alasan kerusakan/kematian
            $table->enum('reason', [
                'TRICHODERMA',   // Jamur hijau parasit
                'BUSUK_BASAH',   // Terlalu lembap / infeksi bakteri
                'HAMA',          // Tikus, kecoa, serangga
                'KERING',        // Dehidrasi media tanam
                'LAINNYA',       // Alasan lainnya
            ])->comment('Penyebab baglog diafkir');

            // Catatan tambahan (audit garansi supplier)
            $table->text('notes')
                ->nullable()
                ->comment('Keterangan pendukung untuk audit / klaim garansi supplier');

            $table->timestamps();

            // Indexes
            $table->index(['baglog_batch_id', 'slot_code']);
            $table->index('cull_date');
            $table->index('reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('baglog_culls');
    }
};
