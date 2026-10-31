<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration penambahan customer_id ke tabel sales.
 *
 * Menghubungkan transaksi penjualan ke entitas master pembeli untuk
 * analisis segmentasi dan mendukung penelusuran hulu-hilir (traceability).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->foreignId('customer_id')
                ->nullable()
                ->after('baglog_batch_id')
                ->constrained('customers')
                ->nullOnDelete()
                ->comment('Relasi ke master pelanggan terdaftar');

            $table->index('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropIndex(['customer_id']);
            $table->dropColumn('customer_id');
        });
    }
};

