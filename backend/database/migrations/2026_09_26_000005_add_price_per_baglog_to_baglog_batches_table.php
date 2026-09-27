<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration penambahan harga modal beli per baglog pada tabel baglog_batches.
 *
 * Diperlukan untuk perhitungan HPP & Margin Kontribusi:
 * Modal Baglog Awal = quantity * price_per_baglog.
 * Menggunakan DECIMAL(10, 2) untuk integritas data finansial.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('baglog_batches', function (Blueprint $table) {
            $table->decimal('price_per_baglog', 10, 2)
                ->default(0.00)
                ->after('supplier')
                ->comment('Harga modal beli per baglog (IDR) untuk kalkulasi HPP');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('baglog_batches', function (Blueprint $table) {
            $table->dropColumn('price_per_baglog');
        });
    }
};
