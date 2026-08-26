<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

/**
 * Trait ApiResponse — konsistensi format response API.
 *
 * Semua API endpoint WAJIB return format ini:
 * {
 *   "success": true|false,
 *   "data": {} | [],
 *   "message": "...",
 *   "meta": { "pagination": {} } // opsional
 * }
 *
 * Sesuai ECC Architecture Pattern: "Consistent envelope with
 * success indicator, data payload, error message, and pagination metadata."
 *
 * @see AGENTS.md → Architecture Patterns → API Response Format
 */
trait ApiResponse
{
    /**
     * Response sukses (200/201).
     */
    protected function success(
        mixed $data = null,
        string $message = 'Success',
        int $code = 200,
        array $meta = []
    ): JsonResponse {
        $response = [
            'success' => true,
            'data' => $data,
            'message' => $message,
        ];

        if (! empty($meta)) {
            $response['meta'] = $meta;
        }

        return response()->json($response, $code);
    }

    /**
     * Response sukses dengan data created (201).
     */
    protected function created(mixed $data = null, string $message = 'Created successfully'): JsonResponse
    {
        return $this->success($data, $message, 201);
    }

    /**
     * Response error (4xx/5xx).
     * Sesuai ECC Rule: "Error messages don't leak sensitive data."
     */
    protected function error(
        string $message = 'Something went wrong',
        int $code = 400,
        mixed $errors = null
    ): JsonResponse {
        $response = [
            'success' => false,
            'data' => null,
            'message' => $message,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $code);
    }

    /**
     * Response unauthorized (401).
     */
    protected function unauthorized(string $message = 'Unauthorized'): JsonResponse
    {
        return $this->error($message, 401);
    }

    /**
     * Response forbidden (403).
     */
    protected function forbidden(string $message = 'Forbidden'): JsonResponse
    {
        return $this->error($message, 403);
    }

    /**
     * Response not found (404).
     */
    protected function notFound(string $message = 'Resource not found'): JsonResponse
    {
        return $this->error($message, 404);
    }

    /**
     * Response validation error (422).
     */
    protected function validationError(mixed $errors, string $message = 'Validation failed'): JsonResponse
    {
        return $this->error($message, 422, $errors);
    }
}
