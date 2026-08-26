<?php

namespace Tests\Unit;

use App\Models\BaglogBatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BaglogBatchLogicTest — Unit test untuk logika bisnis model BaglogBatch.
 *
 * Menguji:
 * 1. Accessor age_days (perhitungan umur baglog).
 * 2. Status helper methods (isActive, isContaminated, isDisposed).
 * 3. Batch code generator (format BL-YYYYMMDD-XXX).
 * 4. Total harvest calculation.
 *
 * @see App\Models\BaglogBatch
 */
class BaglogBatchLogicTest extends TestCase
{
    use RefreshDatabase;

    // ════════════════════════════════════════════════════════════
    // SKENARIO 1: Accessor age_days (Perhitungan Umur)
    // ════════════════════════════════════════════════════════════

    /**
     * Batch yang ditanam hari ini HARUS berumur 0 hari.
     */
    public function test_age_days_is_zero_for_today(): void
    {
        $batch = BaglogBatch::factory()->create([
            'entry_date' => now()->toDateString(),
        ]);

        $this->assertEquals(0, $batch->age_days);
    }

    /**
     * Batch yang ditanam 30 hari lalu HARUS berumur 30 hari.
     */
    public function test_age_days_calculates_correctly_for_30_days(): void
    {
        $batch = BaglogBatch::factory()->daysOld(30)->create();

        $this->assertEquals(30, $batch->age_days);
    }

    /**
     * Batch yang ditanam 90 hari lalu HARUS berumur 90 hari.
     */
    public function test_age_days_calculates_correctly_for_90_days(): void
    {
        $batch = BaglogBatch::factory()->daysOld(90)->create();

        $this->assertEquals(90, $batch->age_days);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 2: Status Helper Methods
    // ════════════════════════════════════════════════════════════

    /**
     * Batch dengan status 'active' HARUS return true pada isActive().
     */
    public function test_is_active_returns_true_for_active_batch(): void
    {
        $batch = BaglogBatch::factory()->create();

        $this->assertTrue($batch->isActive());
        $this->assertFalse($batch->isContaminated());
        $this->assertFalse($batch->isDisposed());
    }

    /**
     * Batch dengan status 'contaminated' HARUS return true pada isContaminated().
     */
    public function test_is_contaminated_returns_true_for_contaminated_batch(): void
    {
        $batch = BaglogBatch::factory()->contaminated()->create();

        $this->assertFalse($batch->isActive());
        $this->assertTrue($batch->isContaminated());
        $this->assertFalse($batch->isDisposed());
    }

    /**
     * Batch dengan status 'disposed' HARUS return true pada isDisposed().
     */
    public function test_is_disposed_returns_true_for_disposed_batch(): void
    {
        $batch = BaglogBatch::factory()->disposed()->create();

        $this->assertFalse($batch->isActive());
        $this->assertFalse($batch->isContaminated());
        $this->assertTrue($batch->isDisposed());
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 3: Batch Code Generator
    // ════════════════════════════════════════════════════════════

    /**
     * Batch code pertama hari ini HARUS berformat BL-YYYYMMDD-001.
     */
    public function test_generates_first_batch_code_of_the_day(): void
    {
        $code = BaglogBatch::generateBatchCode();

        $expected = 'BL-'.now()->format('Ymd').'-001';
        $this->assertEquals($expected, $code);
    }

    /**
     * Batch code kedua HARUS increment ke -002.
     */
    public function test_generates_sequential_batch_code(): void
    {
        // Buat batch pertama
        BaglogBatch::factory()->create([
            'batch_code' => 'BL-'.now()->format('Ymd').'-001',
        ]);

        $code = BaglogBatch::generateBatchCode();

        $expected = 'BL-'.now()->format('Ymd').'-002';
        $this->assertEquals($expected, $code);
    }

    /**
     * Batch code HARUS reset ke -001 pada hari baru.
     */
    public function test_batch_code_resets_on_new_day(): void
    {
        // Buat batch kemarin
        $yesterday = now()->subDay()->format('Ymd');
        BaglogBatch::factory()->create([
            'batch_code' => "BL-{$yesterday}-005",
        ]);

        // Batch hari ini harus mulai dari 001
        $code = BaglogBatch::generateBatchCode();

        $expected = 'BL-'.now()->format('Ymd').'-001';
        $this->assertEquals($expected, $code);
    }

    // ════════════════════════════════════════════════════════════
    // SKENARIO 4: Status Constants (Anti Magic String)
    // ════════════════════════════════════════════════════════════

    /**
     * Constants HARUS sesuai dengan nilai enum di database.
     */
    public function test_status_constants_match_expected_values(): void
    {
        $this->assertEquals('active', BaglogBatch::STATUS_ACTIVE);
        $this->assertEquals('contaminated', BaglogBatch::STATUS_CONTAMINATED);
        $this->assertEquals('disposed', BaglogBatch::STATUS_DISPOSED);
    }
}
