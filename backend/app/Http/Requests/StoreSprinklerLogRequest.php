<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreSprinklerLogRequest extends FormRequest
{
    /**
     * Endpoint IoT tidak memerlukan auth user.
     * Validasi device dilakukan via rate limiting per device_id.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Aturan validasi untuk log sprinkler.
     * Termasuk BE-W3 fix: duration_seconds max 600 (10 menit)
     * Termasuk DB-W1 fix: device_id
     */
    public function rules(): array
    {
        return [
            'device_id' => ['required', 'string', 'max:50'],
            'started_at' => ['nullable', 'date'],
            'duration_seconds' => ['required', 'integer', 'min:1', 'max:600'],
            'trigger_reason' => ['required', 'string', 'max:255'],
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
