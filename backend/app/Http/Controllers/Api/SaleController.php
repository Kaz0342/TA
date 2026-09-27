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

    public function weeklyReport(Request $request): JsonResponse
    {
        $offset = (int) $request->query('offset', 0);
        $report = $this->service->getWeeklyReport($offset);

        return $this->success($report, 'Weekly sales report retrieved');
    }

    /**
     * GET /api/sales/buyer-ranking
     * Top 4 tengkulak / pembeli dengan transaksi terbanyak (PRD 4.B Quick Button).
     */
    public function buyerRanking(): JsonResponse
    {
        $rankings = \App\Models\Sale::select('buyer_name', \Illuminate\Support\Facades\DB::raw('COUNT(id) as freq'))
            ->whereNotNull('buyer_name')
            ->where('buyer_name', '!=', '')
            ->groupBy('buyer_name')
            ->orderByDesc('freq')
            ->limit(4)
            ->get();

        return $this->success($rankings, 'Ranking pembeli/tengkulak berhasil dimuat');
    }

    /**
     * GET /api/sales/price-trend
     * 5 harga per Kg terakhir yang pernah digunakan (PRD 4.B Preset Harga Dinamis).
     */
    public function priceTrend(): JsonResponse
    {
        $prices = \App\Models\Sale::select('price_per_kg')
            ->distinct()
            ->orderByDesc('id')
            ->limit(5)
            ->pluck('price_per_kg')
            ->map(fn ($p) => (float) $p)
            ->values();

        // Fallback default jika data penjualan belum banyak
        if ($prices->isEmpty()) {
            $prices = collect([20000, 22000, 25000, 28000, 30000]);
        }

        return $this->success($prices, 'Preset tren harga jual berhasil dimuat');
    }
}
