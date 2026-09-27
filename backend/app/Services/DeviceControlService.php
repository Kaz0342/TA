<?php

namespace App\Services;

use App\Models\SprinklerLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Service untuk mengelola kontrol aktuator mode jeda panen (PAUSE/RESUME)
 * berbasis timer non-blocking untuk mencegah human error lupa menyalakan misting/fan.
 */
class DeviceControlService
{
    public const CACHE_KEY = 'device_command:kumbung_01';

    /**
     * Dapatkan status perintah perangkat terkini.
     */
    public function getCurrentCommand(): array
    {
        $data = Cache::get(self::CACHE_KEY);

        if (! $data) {
            return [
                'command' => 'AUTO',
                'is_paused' => false,
                'duration_seconds' => 0,
                'remaining_seconds' => 0,
                'paused_until' => null,
                'reason' => null,
            ];
        }

        $pausedUntil = Carbon::parse($data['paused_until']);
        $now = now();

        if ($now->greaterThanOrEqualTo($pausedUntil)) {
            // Waktu jeda habis, otomatis kembali ke AUTO
            Cache::forget(self::CACHE_KEY);

            return [
                'command' => 'AUTO',
                'is_paused' => false,
                'duration_seconds' => 0,
                'remaining_seconds' => 0,
                'paused_until' => null,
                'reason' => null,
            ];
        }

        $remainingSeconds = max(0, (int) $now->diffInSeconds($pausedUntil, false));

        return [
            'command' => 'PAUSE',
            'is_paused' => true,
            'duration_seconds' => (int) $data['duration_seconds'],
            'remaining_seconds' => $remainingSeconds,
            'paused_until' => $pausedUntil->toIso8601String(),
            'reason' => $data['reason'] ?? 'Mode Panen (Pintu Kumbung Terbuka)',
        ];
    }

    /**
     * Aktifkan mode jeda (PAUSE) dengan preset durasi.
     * Misting & Exhaust Fan wajib OFF selama mode ini.
     */
    public function pause(int $durationSeconds, string $reason = 'Mode Panen'): array
    {
        $pausedUntil = now()->addSeconds($durationSeconds);

        $payload = [
            'command' => 'PAUSE',
            'duration_seconds' => $durationSeconds,
            'paused_until' => $pausedUntil->toIso8601String(),
            'reason' => $reason,
        ];

        Cache::put(self::CACHE_KEY, $payload, $pausedUntil);

        // Catat ke log bahwa mode jeda panen diaktifkan
        SprinklerLog::create([
            'device_id' => 'ESP32-KUMBUNG-01',
            'actuator' => 'system',
            'started_at' => now(),
            'duration_seconds' => $durationSeconds,
            'trigger_reason' => "Manual Pause ({$durationSeconds}s): {$reason}",
            'stop_reason' => 'Mode Panen Aktif (Misting & Fan OFF)',
        ]);

        return $this->getCurrentCommand();
    }

    /**
     * Hentikan jeda sebelum waktunya & langsung kembali ke AUTO.
     */
    public function resume(string $reason = 'Diakhiri Manual oleh User'): array
    {
        $current = Cache::get(self::CACHE_KEY);
        Cache::forget(self::CACHE_KEY);

        if ($current) {
            SprinklerLog::create([
                'device_id' => 'ESP32-KUMBUNG-01',
                'actuator' => 'system',
                'started_at' => now(),
                'duration_seconds' => 0,
                'trigger_reason' => "Resume: {$reason}",
                'stop_reason' => 'Kembali ke mode AUTO & instant sensor read',
            ]);
        }

        return $this->getCurrentCommand();
    }
}
