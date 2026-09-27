<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeder untuk menginisialisasi 300 slot rak kumbung 3D (Row-Bay-Tier).
 *
 * Konfigurasi:
 * - Row: A, B, C (3 Rak)
 * - Bay: 1 s/d 10 (10 Kolom horizontal per rak)
 * - Tier: 1 s/d 10 (10 Tingkat vertikal per rak)
 * Total: 3 × 10 × 10 = 300 slot.
 * Kapasitas per slot: 10 baglog -> Total kapasitas kumbung: 3.000 baglog.
 *
 * Menggunakan upsert agar idempotent (bisa dijalankan berulang kali tanpa error).
 */
class SlotSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $rows = ['A', 'B', 'C'];
        $slots = [];
        $now = now();

        foreach ($rows as $row) {
            for ($bay = 1; $bay <= 10; $bay++) {
                for ($tier = 1; $tier <= 10; $tier++) {
                    $slotCode = sprintf('%s-%02d-%02d', $row, $bay, $tier);

                    $slots[] = [
                        'slot_code' => $slotCode,
                        'row' => $row,
                        'bay' => $bay,
                        'tier' => $tier,
                        'max_capacity' => 10,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        }

        // Bulk upsert per 100 record agar ringan di SQLite
        foreach (array_chunk($slots, 100) as $chunk) {
            DB::table('slots')->upsert(
                $chunk,
                ['slot_code'],
                ['row', 'bay', 'tier', 'max_capacity', 'updated_at']
            );
        }

        $this->command->info('✅ 300 koordinat slot rak (A-01-01 s/d C-10-10) berhasil di-seed.');
    }
}
