<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Hanya Admin yang bisa catat penjualan
        return $this->user() && $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'sale_date' => 'required|date|before_or_equal:today',
            'baglog_batch_id' => 'nullable|exists:baglog_batches,id',
            'customer_id' => 'required_without:buyer_name|nullable|exists:customers,id',
            'quantity_kg' => 'required|numeric|min:0.01',
            'price_per_kg' => 'required|numeric|min:1000',
            'buyer_name' => 'required_without:customer_id|nullable|string|max:100',
            'notes' => 'nullable|string',
            'force' => 'nullable|boolean',
            'force_reason' => 'required_if:force,true|nullable|string|min:10',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'data' => null,
            'message' => 'Validation failed',
            'errors' => $validator->errors(),
        ], 422));
    }
}
