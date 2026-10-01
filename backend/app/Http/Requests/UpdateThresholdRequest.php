<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateThresholdRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Hanya admin yang bisa update (dicek dari middleware RoleCheck juga)
        return $this->user() && $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'temp_min' => 'required|numeric|between:0,50',
            'temp_max' => 'required|numeric|between:0,50|gte:temp_min',
            'humidity_min' => 'required|numeric|between:0,100',
            'humidity_max' => 'required|numeric|between:0,100|gte:humidity_min',
            'phase_mode' => 'nullable|string|in:incubation,primordia,fruiting,custom',
        ];
    }

    public function messages(): array
    {
        return [
            'temp_max.gte' => 'Batas atas suhu harus lebih besar atau sama dengan batas bawah.',
            'humidity_max.gte' => 'Batas atas kelembaban harus lebih besar atau sama dengan batas bawah.',
        ];
    }

    /**
     * Validasi lanjutan: selisih rentang kelembaban minimal 4% agar histeresis aktuator bekerja (F-15a).
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($v) {
            $data = $this->all();
            if (isset($data['humidity_min'], $data['humidity_max']) && is_numeric($data['humidity_min']) && is_numeric($data['humidity_max'])) {
                if (((float) $data['humidity_max'] - (float) $data['humidity_min']) < 4.0) {
                    $v->errors()->add('humidity_max', 'Selisih rentang kelembaban minimal 4% agar histeresis aktuator bekerja.');
                }
            }
        });
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
