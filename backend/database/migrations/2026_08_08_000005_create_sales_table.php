<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration untuk tabel sales.
 *
 * Mencatat transaksi penjualan jamur ke tengkulak/pembeli.
 * Total revenue dihitung di backend (Service layer), BUKAN di frontend.
 * Sesuai ECC Rule: "Business logic belongs in the Backend/API, not Frontend."
 *
 * Semua kolom uang/berat pakai DECIMAL, bukan FLOAT:
 * - quantity_kg:    DECIMAL(8,2)  → max 999,999.99 Kg
 * - price_per_kg:   DECIMAL(10,2) → max 99,999,999.99 IDR/Kg
 * - total_revenue:  DECIMAL(12,2) → max 9,999,999,999.99 IDR
 *
 * @see PRD FR-3.2 (Input Penjualan)
 * @see PRD FR-3.3 (Report Sederhana — Panen vs Terjual)
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();

            // FK ke users — admin yang mencatat penjualan
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('Admin yang mencatat transaksi penjualan');

            // Tanggal penjualan
            $table->date('sale_date')
                ->comment('Tanggal transaksi penjualan');

            // Jumlah terjual — DECIMAL(8,2)
            $table->decimal('quantity_kg', 8, 2)
                ->comment('Jumlah jamur terjual dalam Kilogram');

            // Harga per Kg — DECIMAL(10,2) untuk mata uang IDR
            $table->decimal('price_per_kg', 10, 2)
                ->comment('Harga per Kg dalam Rupiah (IDR)');

            // Total pendapatan — DECIMAL(12,2)
            // Dihitung di backend: quantity_kg × price_per_kg
            $table->decimal('total_revenue', 12, 2)
                ->comment('Total pendapatan = quantity_kg × price_per_kg (IDR)');

            // Nama pembeli/tengkulak
            $table->string('buyer_name', 100)
                ->comment('Nama tengkulak/pembeli');

            // Catatan opsional
            $table->text('notes')
                ->nullable()
                ->comment('Catatan tambahan tentang transaksi');

            $table->timestamps();

            // === INDEXES ===
            // Index sale_date untuk report mingguan (FR-3.3)
            $table->index('sale_date');

            // Composite: user + sale_date — filter transaksi per admin per tanggal
            $table->index(['user_id', 'sale_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
