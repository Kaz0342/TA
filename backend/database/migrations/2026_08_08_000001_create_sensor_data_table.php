<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration untuk tabel sensor_data.
 *
 * Tabel ini menyimpan payload data IoT dari ESP32 (suhu & kelembaban)
 * yang dikirim setiap 5 menit ke endpoint POST /api/sensor-data.
 *
 * Kolom temperature & humidity pakai DECIMAL (bukan FLOAT)
 * sesuai ECC Rule: "Use Decimal for money/measurement, NEVER Float."
 *
 * Index pada recorded_at untuk performa query chart 24 jam (FR-1.2)
 * dan lookup data terbaru (FR-1.1).
 *
 * Index pada device_id untuk rate limiting per device.
 *
 * @see PRD FR-4.1 (API Endpoint IoT)
 * @see PRD FR-1.1 (Real-time Climate Cards)
 * @see PRD FR-1.2 (Climate Chart 24 jam)
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sensor_data', function (Blueprint $table) {
            $table->id();

            // Data pengukuran sensor — DECIMAL bukan FLOAT
            // precision 5, scale 2 → max 999.99 (cukup untuk suhu & kelembaban)
            $table->decimal('temperature', 5, 2)
                ->comment('Suhu dalam derajat Celsius dari sensor DHT22/BME280');
            $table->decimal('humidity', 5, 2)
                ->comment('Kelembaban relatif dalam persen (%) dari sensor');

            $table->decimal('co2_level', 6, 2)->nullable()
                ->comment('Kadar CO2 dalam ppm');

            $table->decimal('light_intensity', 7, 2)->nullable()
                ->comment('Intensitas cahaya dalam satuan Lux');

            // Identitas device pengirim (ESP32)
            $table->string('device_id', 50)
                ->comment('ID unik device IoT, contoh: ESP32-KUMBUNG-01');

            // Timestamp saat data direkam oleh sensor (bukan saat masuk DB)
            $table->timestamp('recorded_at')
                ->comment('Waktu pengukuran di sensor, format ISO8601');

            // created_at saja (tanpa updated_at) karena data sensor immutable
            // Sesuai ECC Principle: Immutability — sensor data tidak boleh diubah
            $table->timestamp('created_at')->useCurrent();

            // === INDEXES ===
            // Index recorded_at untuk query chart 24 jam terakhir (FR-1.2)
            // dan mengambil data sensor terbaru (FR-1.1)
            $table->index('recorded_at');

            // Index device_id untuk rate limiting per device
            // dan filter data per kumbung di masa depan
            $table->index('device_id');

            // Composite index untuk query yang sering dilakukan:
            // "Ambil data dari device X dalam 24 jam terakhir"
            $table->index(['device_id', 'recorded_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sensor_data');
    }
};
