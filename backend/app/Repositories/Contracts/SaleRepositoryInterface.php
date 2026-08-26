<?php

namespace App\Repositories\Contracts;

use App\Models\Sale;
use Illuminate\Database\Eloquent\Collection;

interface SaleRepositoryInterface
{
    public function getAll(array $filters = []): Collection;

    public function store(array $data): Sale;

    public function getWeeklySales(): Collection;
}
