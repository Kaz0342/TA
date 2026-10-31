<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration penambahan supplier_id dan audit kedatangan baglog_batches.
 *
 * Menambahkan relasi FK ke tabel suppliers dengan tetap menjaga kolom string
 * 'supplier' lama agar kompatibel ke belakang (zero breaking change).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('baglog_batches', function (Blueprint $table) {
            $table->foreignId('supplier_id')
                ->nullable()
                ->after('user_id')
                ->constrained('suppliers')
                ->nullOnDelete()
                ->comment('Relasi ke master pemasok terverifikasi');

            $table->unsignedInteger('rejected_at_arrival')
                ->default(0)
                ->after('quantity')
                ->comment('Jumlah baglog rusak/kontaminasi saat pertama kali bongkar muat');

            $table->string('po_number', 50)
                ->nullable()
                ->after('batch_code')
                ->comment('Nomor Purchase Order restock terkait');

            $table->index('supplier_id');
            $table->index('po_number');
        });
    }

    public function down(): void
    {
        Schema::table('baglog_batches', function (Blueprint $table) {
            $table->dropForeign(['supplier_id']);
            $table->dropIndex(['supplier_id']);
            $table->dropIndex(['po_number']);
            $table->dropColumn(['supplier_id', 'rejected_at_arrival', 'po_number']);
        });
    }
};

