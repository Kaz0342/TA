<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreHarvestRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Admin & Worker bisa catat panen
        return true;
    }

    public function rules(): array
    {
        return [
            'harvest_date' => 'required|date',
            'weight_kg' => 'required|numeric|min:0.1',
            'baglog_batch_id' => 'nullable|exists:baglog_batches,id',
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
