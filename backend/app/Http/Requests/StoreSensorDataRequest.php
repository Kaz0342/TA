<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * FormRequest untuk menyimpan data sensor IoT.
 *
 * Validasi input di boundary (FormRequest), BUKAN di controller/service.
 * Sesuai ECC Rule: "Validate request input at the framework boundary."
 *
 * Endpoint ini TIDAK pakai auth user (dipakai oleh ESP32),
 * jadi authorize() return true.
 *
 * @see PRD FR-4.1 (POST /api/sensor-data)
 * @see ECC rules/php/security.md → Input and Output
 */
class StoreSensorDataRequest extends FormRequest
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
     * Aturan validasi untuk payload sensor.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'temperature' => ['required', 'numeric', 'between:-50,100'],
            'humidity' => ['required', 'numeric', 'between:0,100'],
            'co2_level' => [
                'nullable',
                'numeric',
                'min:0',
                'max:5000', // max 5000 ppm
            ],
            'light_intensity' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100000', // direct sunlight is ~100k lux
            ],
            'device_id' => ['required', 'string', 'max:50'],
            'recorded_at' => ['nullable', 'date'],
        ];
    }

    /**
     * Pesan error custom — dalam bahasa Indonesia.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'temperature.required' => 'Data suhu wajib diisi',
            'temperature.numeric' => 'Data suhu harus berupa angka',
            'temperature.between' => 'Suhu harus antara -50°C sampai 100°C',
            'humidity.required' => 'Data kelembaban wajib diisi',
            'humidity.numeric' => 'Data kelembaban harus berupa angka',
            'humidity.between' => 'Kelembaban harus antara 0% sampai 100%',
            'device_id.required' => 'ID device wajib diisi',
            'device_id.max' => 'ID device maksimal 50 karakter',
            'recorded_at.required' => 'Timestamp pengukuran wajib diisi',
            'recorded_at.date' => 'Format timestamp tidak valid',
        ];
    }

    /**
     * Override response saat validasi gagal — return JSON sesuai envelope.
     * Bukan redirect (karena ini API, bukan web).
     */
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
