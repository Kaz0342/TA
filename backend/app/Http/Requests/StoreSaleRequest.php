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
            'sale_date' => 'required|date',
            'quantity_kg' => 'required|numeric|min:0.1',
            'price_per_kg' => 'required|numeric|min:1000',
            'buyer_name' => 'required|string|max:100',
            'notes' => 'nullable|string',
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
