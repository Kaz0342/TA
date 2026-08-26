<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration untuk tabel baglog_batches.
 *
 * Baglog = media tanam jamur tiram (serbuk kayu + dedak yang dibungkus plastik).
 * Tabel ini mencatat keluar-masuk batch baglog dari supplier.
 *
 * Umur baglog dihitung otomatis dari entry_date di Model (accessor),
 * bukan disimpan di DB — menghindari data stale.
 *
 * Status lifecycle: active → contaminated → disposed
 * - active: masih produktif, bisa panen
 * - contaminated: terkontaminasi jamur parasit/bakteri
 * - disposed: sudah dibuang/afkir
 *
 * @see PRD FR-2.1 (Input Batch Baglog)
 * @see PRD FR-2.2 (Status Baglog)
 * @see PRD FR-2.3 (Log Aktivitas)
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('baglog_batches', function (Blueprint $table) {
            $table->id();

            // FK ke users — admin/worker yang menginput batch
            $table->foreignId('user_id')
                ->constrained('users')
                ->onDelete('cascade')
                ->comment('User yang mencatat batch ini');

            // Kode batch unik — format: BL-YYYYMMDD-XXX
            $table->string('batch_code', 30)
                ->unique()
                ->comment('Kode unik batch, contoh: BL-20260808-001');

            // Tanggal masuk baglog — basis perhitungan umur
            $table->date('entry_date')
                ->comment('Tanggal kedatangan baglog dari supplier');

            // Jumlah baglog dalam batch
            $table->unsignedInteger('quantity')
                ->comment('Jumlah baglog dalam batch ini');

            // Nama supplier
            $table->string('supplier', 100)
                ->comment('Nama supplier/pemasok baglog');

            // Status lifecycle baglog
            $table->enum('status', ['active', 'contaminated', 'disposed'])
                ->default('active')
                ->comment('Status: active=produktif, contaminated=rusak, disposed=dibuang');

            // Catatan opsional
            $table->text('notes')
                ->nullable()
                ->comment('Catatan tambahan tentang batch ini');

            $table->timestamps();

            // === INDEXES ===
            // Index entry_date untuk query umur dan filter range tanggal
            $table->index('entry_date');

            // Index status untuk filter cepat "tampilkan semua yang aktif"
            $table->index('status');

            // Composite: user + status — "tampilkan semua baglog aktif milik admin X"
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('baglog_batches');
    }
};
