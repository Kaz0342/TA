<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration master data pemasok baglog (Suppliers).
 *
 * Mengubah pencatatan supplier dari free-text string menjadi
 * entitas terkelola untuk mendukung Supplier Performance Scorecard
 * dan Purchase Order (PO) Restock Planning.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique()->comment('Nama badan usaha/pemasok bibit baglog');
            $table->string('contact_person', 100)->nullable()->comment('Nama penanggung jawab/sales');
            $table->string('phone', 30)->nullable()->comment('Nomor kontak/WhatsApp');
            $table->text('address')->nullable()->comment('Alamat workshop/lokasi pembuatan baglog');
            $table->unsignedSmallInteger('lead_time_days')->default(7)->comment('Estimasi hari tunggu kedatangan bibit dari tanggal PO');
            $table->boolean('is_active')->default(true)->comment('Status kemitraan aktif');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};

