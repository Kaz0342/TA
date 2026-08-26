<?php

namespace App\Repositories;

use App\Models\Sale;
use App\Repositories\Contracts\SaleRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class SaleRepository implements SaleRepositoryInterface
{
    public function getAll(array $filters = []): Collection
    {
        $query = Sale::query();

        if (isset($filters['start_date']) && isset($filters['end_date'])) {
            $query->betweenDates($filters['start_date'], $filters['end_date']);
        }

        return $query->orderByDesc('sale_date')->orderByDesc('id')->get();
    }

    public function store(array $data): Sale
    {
        // total_revenue dihitung via Model logic saat creating (atau di service)
        // Kita letakkan logikanya di model atau service.
        // Di sini kita langsung create karena total_revenue disiapkan oleh Service.
        return Sale::create($data);
    }

    public function getWeeklySales(): Collection
    {
        return Sale::thisWeek()->get();
    }
}
