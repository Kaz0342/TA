<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Model ThresholdSetting — batas aman suhu & kelembaban.
 *
 * Admin mengatur batas ini via Settings page (FR-4.2).
 * SensorDataService akan cek setiap data IoT masuk:
 * jika melewati batas → trigger alert di Dashboard (FR-1.3).
 *
 * Hanya satu threshold yang boleh aktif (is_active = true).
 * Default values:
 * - Suhu: 20°C - 30°C (optimal jamur tiram)
 * - Kelembaban: 70% - 90%
 *
 * @see PRD FR-4.2 (Threshold Settings)
 *
 * @property int $id
 * @property int $user_id
 * @property string $temp_min
 * @property string $temp_max
 * @property string $humidity_min
 * @property string $humidity_max
 * @property bool $is_active
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class ThresholdSetting extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'temp_min',
        'temp_max',
        'humidity_min',
        'humidity_max',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'temp_min' => 'decimal:2',
            'temp_max' => 'decimal:2',
            'humidity_min' => 'decimal:2',
            'humidity_max' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────

    /**
     * Threshold dimiliki oleh seorang admin.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Scopes ─────────────────────────────────────────────────

    /**
     * Scope: ambil threshold yang sedang aktif.
     *
     * @param  Builder  $query
     * @return Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // ─── Helper Methods ─────────────────────────────────────────

    /**
     * Cek apakah data sensor melanggar threshold ini.
     * Return array berisi jenis pelanggaran (kosong jika aman).
     *
     * @return list<array{type: string, message: string, severity: string}>
     */
    public function checkViolations(SensorData $sensorData): array
    {
        $violations = [];

        if ($sensorData->isTemperatureAbove((float) $this->temp_max)) {
            $violations[] = [
                'type' => 'temp_high',
                'message' => "Suhu Kritis! {$sensorData->temperature}°C melebihi batas {$this->temp_max}°C",
                'severity' => 'danger',
            ];
        }

        if ($sensorData->isTemperatureBelow((float) $this->temp_min)) {
            $violations[] = [
                'type' => 'temp_low',
                'message' => "Suhu Rendah! {$sensorData->temperature}°C di bawah batas {$this->temp_min}°C",
                'severity' => 'warning',
            ];
        }

        if ($sensorData->isHumidityAbove((float) $this->humidity_max)) {
            $violations[] = [
                'type' => 'humidity_high',
                'message' => "Kelembaban Tinggi! {$sensorData->humidity}% melebihi batas {$this->humidity_max}%",
                'severity' => 'warning',
            ];
        }

        if ($sensorData->isHumidityBelow((float) $this->humidity_min)) {
            $violations[] = [
                'type' => 'humidity_low',
                'message' => "Kelembaban Rendah! {$sensorData->humidity}% di bawah batas {$this->humidity_min}%",
                'severity' => 'danger',
            ];
        }

        return $violations;
    }
}
