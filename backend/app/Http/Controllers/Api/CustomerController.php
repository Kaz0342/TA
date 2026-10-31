<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCustomerRequest;
use App\Models\Customer;
use App\Services\TraceabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(
        private readonly TraceabilityService $traceabilityService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Customer::query()->withCount('sales');

        if ($request->has('category')) {
            $query->byCategory($request->query('category'));
        }

        if (filter_var($request->query('active_only', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->active();
        }

        $customers = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $customers,
            'message' => 'Daftar pelanggan berhasil diambil',
        ]);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = Customer::create($request->validated());

        return response()->json([
            'success' => true,
            'data' => $customer,
            'message' => 'Pelanggan berhasil ditambahkan',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $customer = Customer::with('sales')->find($id);

        if (! $customer) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Pelanggan tidak ditemukan',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $customer,
            'message' => 'Detail pelanggan berhasil diambil',
        ]);
    }

    public function update(StoreCustomerRequest $request, int $id): JsonResponse
    {
        $customer = Customer::find($id);

        if (! $customer) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Pelanggan tidak ditemukan',
            ], 404);
        }

        $customer->update($request->validated());

        return response()->json([
            'success' => true,
            'data' => $customer,
            'message' => 'Data pelanggan berhasil diperbarui',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $customer = Customer::find($id);

        if (! $customer) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Pelanggan tidak ditemukan',
            ], 404);
        }

        if ($customer->sales()->exists()) {
            $customer->update(['is_active' => false]);
        } else {
            $customer->delete();
        }

        return response()->json([
            'success' => true,
            'data' => null,
            'message' => 'Pelanggan berhasil dinonaktifkan/dihapus',
        ]);
    }

    /**
     * Endpoint analitik segmentasi pelanggan.
     */
    public function analytics(): JsonResponse
    {
        $analytics = $this->traceabilityService->getCustomerAnalytics();

        return response()->json([
            'success' => true,
            'data' => $analytics,
            'message' => 'Analisis segmentasi pelanggan berhasil dihitung',
        ]);
    }
}

