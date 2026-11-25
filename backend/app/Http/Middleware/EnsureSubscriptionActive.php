<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSubscriptionActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if (in_array(strtoupper($request->method()), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        Organization::expireDueSubscriptions();
        $organization = $request->user()?->organizations()->first();

        if ($organization && ! in_array($organization->subscription_status, ['active', 'free_trial'], true)) {
            return response()->json([
                'message' => 'Your subscription has expired. Renew your plan to modify or create workspace data.',
                'code' => 'subscription_expired',
            ], 402);
        }

        return $next($request);
    }
}
