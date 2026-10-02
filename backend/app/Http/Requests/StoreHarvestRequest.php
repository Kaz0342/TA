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

    protected function prepareForValidation(): void
    {
        if ($this->has('slot_code') && is_string($this->slot_code)) {
            $this->merge([
                'slot_code' => strtoupper($this->slot_code),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'harvest_date' => 'required|date|before_or_equal:today',
            'weight_kg' => 'required|numeric|min:0.01',
            'baglog_batch_id' => 'nullable|exists:baglog_batches,id',
            'slot_code' => 'nullable|string|exists:slots,slot_code',
            'flush_number' => 'nullable|integer|min:1|max:10',
            'quality_grade' => 'nullable|in:A,B,REJECT',
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
