<?php

namespace App\Http\Requests;

use App\Models\Customer;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isAdmin();
    }

    public function rules(): array
    {
        $customerId = $this->route('id');

        return [
            'name' => 'required|string|max:100|unique:customers,name,'.($customerId ?? 'NULL').',id',
            'category' => 'nullable|in:'.implode(',', [
                Customer::CATEGORY_TENGKULAK,
                Customer::CATEGORY_RESTO,
                Customer::CATEGORY_PASAR_INDUK,
                Customer::CATEGORY_ECERAN,
            ]),
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'data' => null,
            'message' => 'Validasi pelanggan gagal',
            'errors' => $validator->errors(),
        ], 422));
    }
}

