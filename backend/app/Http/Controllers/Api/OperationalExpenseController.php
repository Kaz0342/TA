<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperationalExpense;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Controller untuk mengelola pencatatan biaya operasional nyata (listrik, misting, plastik, dll).
 */
class OperationalExpenseController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/operational-expenses
     * List seluruh biaya operasional dengan filter kategori & batch.
     */
    public function index(Request $request): JsonResponse
    {
        $query = OperationalExpense::with('baglogBatch');

        if ($request->filled('baglog_batch_id')) {
            $query->where('baglog_batch_id', $request->query('baglog_batch_id'));
        }

        if ($request->filled('category')) {
            $query->where('category', strtoupper($request->query('category')));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('expense_date', [$request->query('start_date'), $request->query('end_date')]);
        }

        $expenses = $query->orderByDesc('expense_date')->orderByDesc('id')->get();

        $totalAmount = (float) $expenses->sum('amount');

        return $this->success([
            'total_amount' => $totalAmount,
            'expenses' => $expenses,
        ], 'Data pengeluaran operasional berhasil dimuat');
    }

    /**
     * POST /api/operational-expenses
     * Catat pengeluaran operasional baru (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'baglog_batch_id' => 'nullable|exists:baglog_batches,id',
            'expense_date' => 'required|date',
            'category' => 'required|in:LISTRIK,AIR,NUTRISI,LABOR,PACKAGING,LAINNYA',
            'amount' => 'required|numeric|min:100',
            'notes' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $expense = OperationalExpense::create($validator->validated());

        return $this->created($expense, 'Pengeluaran operasional berhasil dicatat');
    }

    /**
     * DELETE /api/operational-expenses/{id}
     * Hapus pencatatan pengeluaran operasional.
     */
    public function destroy(int $id): JsonResponse
    {
        $expense = OperationalExpense::find($id);

        if (! $expense) {
            return $this->notFound('Data pengeluaran operasional tidak ditemukan');
        }

        $expense->delete();

        return $this->success(null, 'Pengeluaran operasional berhasil dihapus');
    }
}
