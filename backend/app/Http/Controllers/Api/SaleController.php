<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSaleRequest;
use App\Services\SaleService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly SaleService $service
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['start_date', 'end_date']);
        $sales = $this->service->getAllSales($filters);

        return $this->success($sales, 'Sales data retrieved');
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        $sale = $this->service->createSale($request->validated(), $request->user()->id);

        return $this->created($sale, 'Transaksi penjualan berhasil disimpan');
    }

    public function weeklyReport(): JsonResponse
    {
        $report = $this->service->getWeeklyReport();

        return $this->success($report, 'Weekly sales report retrieved');
    }
}
