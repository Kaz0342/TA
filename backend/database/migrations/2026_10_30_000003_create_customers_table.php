<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration master data pelanggan / pembeli (Customers).
 *
 * Mengelompokkan pembeli berdasarkan segmen pasar (Tengkulak, Restoran, Pasar Induk, Eceran)
 * guna mendukung analisis penyerapan volume panen dan harga rata-rata komoditas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique()->comment('Nama pelanggan/badan usaha pembeli');
            $table->enum('category', ['TENGKULAK', 'RESTO', 'PASAR_INDUK', 'ECERAN'])
                ->default('TENGKULAK')
                ->comment('Segmen pasar pembeli');
            $table->string('phone', 30)->nullable()->comment('Kontak telepon/WhatsApp pembeli');
            $table->text('address')->nullable()->comment('Alamat pengiriman/lokasi pembeli');
            $table->boolean('is_active')->default(true)->comment('Status pelanggan aktif');
            $table->timestamps();

            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};

