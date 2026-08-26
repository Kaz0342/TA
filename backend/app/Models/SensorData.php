<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Model SensorData — data pengukuran IoT dari ESP32.
 *
 * Data sensor bersifat IMMUTABLE (tidak boleh diubah setelah masuk DB).
 * Sesuai ECC Core Principle: "Immutability — prefer explicit state
 * transitions over mutation."
 *
 * Temperature & humidity di-cast ke 'decimal:2' agar presisi terjaga.
 * JANGAN pakai float — floating point arithmetic bisa bikin data sensor
 * lu meleset 0.0001°C dan itu ampas buat analitik AI Phase 2.
 *
 * @see PRD FR-4.1 (API Endpoint IoT)
 * @see PRD FR-1.1 (Real-time Climate Cards)
 * @see PRD FR-1.2 (Climate Chart)
 *
 * @property int $id
 * @property string $temperature — Suhu dalam °C (DECIMAL 5,2)
 * @property string $humidity — Kelembaban dalam % (DECIMAL 5,2)
 * @property string $device_id — ID unik device ESP32
 * @property Carbon $recorded_at — Waktu pengukuran sensor
 * @property Carbon $created_at — Waktu data masuk DB
 */
class SensorData extends Model
{
    use HasFactory;

    /**
     * Nama tabel — override karena default-nya 'sensor_datas' (grammatically wrong).
     */
    protected $table = 'sensor_data';

    /**
     * Kolom yang boleh di-mass assign.
     *
     * Sesuai ECC Rule (rules/php/security.md):
     * "Scope ORM mass-assignment carefully and whitelist writable fields."
     *
     * @var list<string>
     */
    protected $fillable = [
        'temperature',
        'humidity',
        'co2_level',
        'light_intensity',
        'device_id',
        'recorded_at',
    ];

    /**
     * Data sensor IMMUTABLE — tidak ada updated_at.
     * Hanya created_at yang dipakai.
     */
    public const UPDATED_AT = null;

    /**
     * Cast attributes ke tipe yang tepat.
     *
     * DECIMAL bukan FLOAT — ini krusial buat akurasi data sensor.
     * recorded_at di-cast ke datetime agar bisa dimanipulasi Carbon.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'temperature' => 'decimal:2',
            'humidity' => 'decimal:2',
            'co2_level' => 'decimal:2',
            'light_intensity' => 'decimal:2',
            'recorded_at' => 'datetime',
        ];
    }

    // ─── Scopes ─────────────────────────────────────────────────

    /**
     * Scope: ambil data dari X jam terakhir.
     * Dipakai oleh FR-1.2 (Climate Chart 24 jam).
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeLastHours($query, int $hours = 24)
    {
        return $query->where('recorded_at', '>=', now()->subHours($hours));
    }

    /**
     * Scope: filter by device ID.
     * Berguna kalau nanti ada multi-kumbung (Phase 2+).
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeForDevice($query, string $deviceId)
    {
        return $query->where('device_id', $deviceId);
    }

    /**
     * Scope: order by recorded_at descending (terbaru dulu).
     * Default ordering untuk ambil data terbaru.
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeLatestReading($query)
    {
        return $query->orderByDesc('recorded_at');
    }

    // ─── Helper Methods ─────────────────────────────────────────

    /**
     * Cek apakah suhu di atas batas yang diberikan.
     * Dipakai oleh ThresholdService untuk trigger alert (FR-4.2).
     */
    public function isTemperatureAbove(float $max): bool
    {
        return (float) $this->temperature > $max;
    }

    /**
     * Cek apakah suhu di bawah batas yang diberikan.
     */
    public function isTemperatureBelow(float $min): bool
    {
        return (float) $this->temperature < $min;
    }

    /**
     * Cek apakah kelembaban di atas batas yang diberikan.
     */
    public function isHumidityAbove(float $max): bool
    {
        return (float) $this->humidity > $max;
    }

    /**
     * Cek apakah kelembaban di bawah batas yang diberikan.
     */
    public function isHumidityBelow(float $min): bool
    {
        return (float) $this->humidity < $min;
    }
}
