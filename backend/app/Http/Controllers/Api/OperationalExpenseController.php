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
            'expense_date' => 'required|date|before_or_equal:today',
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
     * POST /api/operational-expenses/{id}/void
     * Batalkan pencatatan pengeluaran operasional dengan alasan (W-09 / AUD-07).
     */
    public function void(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|min:5|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 422);
        }

        $expense = OperationalExpense::withVoided()->find($id);

        if (! $expense) {
            return $this->notFound('Data pengeluaran operasional tidak ditemukan');
        }

        if ($expense->isVoided()) {
            return $this->error('Data pengeluaran operasional sudah dibatalkan (voided) sebelumnya', 422);
        }

        $expense->void($request->user()->id, $request->input('reason'));

        return $this->success($expense, 'Pengeluaran operasional berhasil di-void (dibatalkan)');
    }

    /**
     * DELETE /api/operational-expenses/{id}
     * Batalkan pencatatan pengeluaran operasional (soft-void untuk menjaga audit trail W-09 / AUD-07).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $expense = OperationalExpense::withVoided()->find($id);

        if (! $expense) {
            return $this->notFound('Data pengeluaran operasional tidak ditemukan');
        }

        if ($expense->isVoided()) {
            return $this->error('Data pengeluaran operasional sudah dibatalkan (voided) sebelumnya', 422);
        }

        $reason = $request->input('reason') ?: 'Dihapus oleh admin';
        $expense->void($request->user()->id, $reason);

        return $this->success($expense, 'Pengeluaran operasional berhasil dibatalkan (void)');
    }
}
