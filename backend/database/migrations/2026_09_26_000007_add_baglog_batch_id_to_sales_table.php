<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration penambahan foreign key baglog_batch_id ke tabel sales.
 *
 * Mengaitkan transaksi penjualan ke batch spesifik (opsional/nullable)
 * untuk mendukung kalkulasi Omzet per Batch pada modul HPP & Margin Kontribusi.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->foreignId('baglog_batch_id')
                ->nullable()
                ->after('user_id')
                ->constrained('baglog_batches')
                ->onDelete('set null')
                ->comment('Batch sumber penjualan (opsional untuk HPP)');

            $table->index(['baglog_batch_id', 'sale_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['baglog_batch_id']);
            $table->dropIndex(['baglog_batch_id', 'sale_date']);
            $table->dropColumn('baglog_batch_id');
        });
    }
};
