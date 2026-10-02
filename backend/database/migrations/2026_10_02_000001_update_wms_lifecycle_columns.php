<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Modifikasi status batch agar mendukung 'completed'
        Schema::table('baglog_batches', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->comment('active, contaminated, disposed, completed')->change();
        });

        // 2. Modifikasi reason afkir agar mendukung 'HABIS_PRODUKSI'
        Schema::table('baglog_culls', function (Blueprint $table) {
            $table->string('reason', 30)->comment('TRICHODERMA, BUSUK_BASAH, HAMA, KERING, LAINNYA, HABIS_PRODUKSI')->change();
        });

        // 3. Tambahkan completed_at & completed_reason pada batch_slot_assignments
        Schema::table('batch_slot_assignments', function (Blueprint $table) {
            $table->date('completed_at')->nullable()->after('assigned_at')->comment('Tanggal slot selesai siklus');
            $table->string('completed_reason', 30)->nullable()->after('completed_at')->comment('EXHAUSTED, CONTAMINATED, DISPOSED, MANUAL');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batch_slot_assignments', function (Blueprint $table) {
            $table->dropColumn(['completed_at', 'completed_reason']);
        });

        Schema::table('baglog_culls', function (Blueprint $table) {
            $table->string('reason', 50)->change();
        });

        Schema::table('baglog_batches', function (Blueprint $table) {
            $table->string('status', 50)->change();
        });
    }
};
