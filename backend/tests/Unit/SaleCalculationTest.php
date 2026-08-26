<?php

namespace Tests\Unit;

use App\Models\Sale;
use Tests\TestCase;

/**
 * SaleCalculationTest — Unit test untuk logika kalkulasi model Sale.
 *
 * Menguji bahwa method calculateRevenue() menghasilkan total yang benar
 * menggunakan bcmul (arbitrary precision) bukan float multiplication.
 *
 * @see App\Models\Sale::calculateRevenue()
 */
class SaleCalculationTest extends TestCase
{
    // ════════════════════════════════════════════════════════════
    // Revenue Calculation (bcmul precision)
    // ════════════════════════════════════════════════════════════

    /**
     * 10 Kg × Rp15.000 = Rp150.000,00
     */
    public function test_calculates_revenue_correctly_for_whole_numbers(): void
    {
        $sale = new Sale([
            'quantity_kg' => '10.00',
            'price_per_kg' => '15000.00',
        ]);

        $revenue = $sale->calculateRevenue();

        $this->assertEquals('150000.00', $revenue);
    }

    /**
     * 5.5 Kg × Rp12.500 = Rp68.750,00
     */
    public function test_calculates_revenue_correctly_for_decimal_quantity(): void
    {
        $sale = new Sale([
            'quantity_kg' => '5.50',
            'price_per_kg' => '12500.00',
        ]);

        $revenue = $sale->calculateRevenue();

        $this->assertEquals('68750.00', $revenue);
    }

    /**
     * 0.5 Kg × Rp20.000 = Rp10.000,00 (penjualan kecil).
     */
    public function test_calculates_revenue_for_small_quantity(): void
    {
        $sale = new Sale([
            'quantity_kg' => '0.50',
            'price_per_kg' => '20000.00',
        ]);

        $revenue = $sale->calculateRevenue();

        $this->assertEquals('10000.00', $revenue);
    }

    /**
     * 100 Kg × Rp18.000 = Rp1.800.000,00 (penjualan besar).
     */
    public function test_calculates_revenue_for_large_quantity(): void
    {
        $sale = new Sale([
            'quantity_kg' => '100.00',
            'price_per_kg' => '18000.00',
        ]);

        $revenue = $sale->calculateRevenue();

        $this->assertEquals('1800000.00', $revenue);
    }

    /**
     * Presisi DECIMAL: 3.33 Kg × Rp15.000 = Rp49.950,00
     * Pastikan bcmul menghasilkan 2 desimal tanpa floating point error.
     */
    public function test_calculates_revenue_with_decimal_precision(): void
    {
        $sale = new Sale([
            'quantity_kg' => '3.33',
            'price_per_kg' => '15000.00',
        ]);

        $revenue = $sale->calculateRevenue();

        // bcmul('3.33', '15000.00', 2) = '49950.00'
        $this->assertEquals('49950.00', $revenue);
    }

    /**
     * Return type HARUS string (sesuai bcmul behavior).
     * Ini penting karena frontend menerima string, bukan float.
     */
    public function test_revenue_returns_string_type(): void
    {
        $sale = new Sale([
            'quantity_kg' => '10.00',
            'price_per_kg' => '15000.00',
        ]);

        $revenue = $sale->calculateRevenue();

        $this->assertIsString($revenue);
    }

    // ════════════════════════════════════════════════════════════
    // Role Constants (Anti Magic String)
    // ════════════════════════════════════════════════════════════

    /**
     * Model Sale HARUS punya field yang benar di $fillable.
     */
    public function test_fillable_contains_required_fields(): void
    {
        $sale = new Sale;
        $fillable = $sale->getFillable();

        $this->assertContains('sale_date', $fillable);
        $this->assertContains('quantity_kg', $fillable);
        $this->assertContains('price_per_kg', $fillable);
        $this->assertContains('total_revenue', $fillable);
        $this->assertContains('buyer_name', $fillable);
    }
}
