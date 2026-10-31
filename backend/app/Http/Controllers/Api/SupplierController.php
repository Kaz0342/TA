<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSupplierRequest;
use App\Models\Supplier;
use App\Services\SupplierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function __construct(
        private readonly SupplierService $supplierService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $onlyActive = filter_var($request->query('active_only', false), FILTER_VALIDATE_BOOLEAN);
        $suppliers = $this->supplierService->getAllSuppliers($onlyActive);

        return response()->json([
            'success' => true,
            'data' => $suppliers,
            'message' => 'Daftar pemasok berhasil diambil',
        ]);
    }

    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $supplier = $this->supplierService->createSupplier($request->validated());

        return response()->json([
            'success' => true,
            'data' => $supplier,
            'message' => 'Pemasok berhasil didaftarkan',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $supplier = $this->supplierService->getSupplierById($id);

        if (! $supplier) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Pemasok tidak ditemukan',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $supplier,
            'message' => 'Detail pemasok berhasil diambil',
        ]);
    }

    public function update(StoreSupplierRequest $request, int $id): JsonResponse
    {
        $supplier = Supplier::find($id);

        if (! $supplier) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Pemasok tidak ditemukan',
            ], 404);
        }

        $updated = $this->supplierService->updateSupplier($supplier, $request->validated());

        return response()->json([
            'success' => true,
            'data' => $updated,
            'message' => 'Data pemasok berhasil diperbarui',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $supplier = Supplier::find($id);

        if (! $supplier) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Pemasok tidak ditemukan',
            ], 404);
        }

        $this->supplierService->deleteSupplier($supplier);

        return response()->json([
            'success' => true,
            'data' => null,
            'message' => 'Pemasok berhasil dinonaktifkan/dihapus',
        ]);
    }

    /**
     * Endpoint Supplier Performance Scorecard.
     */
    public function scorecard(int $id): JsonResponse
    {
        $supplier = Supplier::find($id);

        if (! $supplier) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Pemasok tidak ditemukan',
            ], 404);
        }

        $scorecard = $this->supplierService->getSupplierScorecard($supplier);

        return response()->json([
            'success' => true,
            'data' => $scorecard,
            'message' => 'Scorecard kinerja pemasok berhasil dihitung',
        ]);
    }

    /**
     * Endpoint Komparasi Seluruh Pemasok.
     */
    public function comparison(): JsonResponse
    {
        $comparison = $this->supplierService->getComparison();

        return response()->json([
            'success' => true,
            'data' => $comparison,
            'message' => 'Komparasi kinerja seluruh pemasok berhasil diambil',
        ]);
    }
}

