<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware RoleCheck — memastikan user punya role yang sesuai.
 *
 * Dipakai di route group:
 *   ->middleware('role:admin')     → hanya admin
 *   ->middleware('role:worker')    → hanya worker
 *   ->middleware('role:admin,worker') → keduanya boleh
 *
 * @see PRD Section 2 (Target Users — role-based access)
 */
class RoleCheck
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     * @param  string  ...$roles  — role yang diizinkan (bisa multiple, dipisah koma)
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Unauthorized',
            ], 401);
        }

        if (! in_array($user->role, $roles, true)) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Forbidden — akses hanya untuk: '.implode(', ', $roles),
            ], 403);
        }

        return $next($request);
    }
}
