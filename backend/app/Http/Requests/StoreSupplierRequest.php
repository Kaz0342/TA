<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isAdmin();
    }

    public function rules(): array
    {
        $supplierId = $this->route('id');

        return [
            'name' => 'required|string|max:100|unique:suppliers,name,'.($supplierId ?? 'NULL').',id',
            'contact_person' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'lead_time_days' => 'nullable|integer|min:1|max:90',
            'is_active' => 'nullable|boolean',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'data' => null,
            'message' => 'Validasi pemasok gagal',
            'errors' => $validator->errors(),
        ], 422));
    }
}

