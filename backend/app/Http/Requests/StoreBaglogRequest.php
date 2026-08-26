<?php

namespace App\Http\Requests;

use App\Models\BaglogBatch;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreBaglogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'entry_date' => 'required|date',
            'quantity' => 'required|integer|min:1',
            'supplier' => 'required|string|max:100',
            'status' => 'nullable|in:'.implode(',', [BaglogBatch::STATUS_ACTIVE, BaglogBatch::STATUS_CONTAMINATED, BaglogBatch::STATUS_DISPOSED]),
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
