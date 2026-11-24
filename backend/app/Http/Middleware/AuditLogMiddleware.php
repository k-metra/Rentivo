<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditLogMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! in_array(strtoupper($request->method()), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return $response;
        }

        $user = $request->user();
        if (! $user) {
            return $response;
        }

        $organization = $user->organizations()->first();
        if (! $organization) {
            return $response;
        }

        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            return $response;
        }

        $path = trim($request->path(), '/');
        $segments = explode('/', $path);
        $moduleSegment = $segments[2] ?? 'Dashboard';
        $moduleMap = [
            'summary' => 'Dashboard',
            'settings' => 'Settings',
            'vehicles' => 'Vehicles',
            'bookings' => 'Bookings',
            'payments' => 'Payments',
            'customers' => 'Customers',
            'users' => 'Users',
            'roles' => 'Roles',
            'partners' => 'Partners',
            'funds' => 'Funds',
            'fund-transfers' => 'Funds',
            'fund-transactions' => 'Funds',
            'expenses' => 'Expenses',
            'booking-sources' => 'Booking Sources',
            'contract' => 'Contracts',
        ];
        $module = $moduleMap[$moduleSegment] ?? ucfirst(str_replace('-', ' ', $moduleSegment ?: 'dashboard'));

        $method = strtoupper($request->method());
        $actionMap = [
            'POST' => 'Created',
            'PUT' => 'Updated',
            'PATCH' => 'Updated',
            'DELETE' => 'Deleted',
        ];
        $action = $actionMap[$method];
        if (str_contains($path, '/complete')) $action = 'Completed';
        if (str_contains($path, '/undo')) $action = 'Reversed';
        if (str_contains($path, '/status')) $action = 'Changed status';
        if (str_contains($path, '/contract')) $action = 'Generated contract';
        if (str_contains($path, '/logout')) $action = 'Signed out';

        $routeParameters = $request->route()?->parameters() ?? [];
        $targetType = null;
        $targetId = null;
        foreach (['booking', 'vehicle', 'customer', 'payment', 'partner', 'user', 'fund', 'expense', 'role'] as $parameter) {
            if (isset($routeParameters[$parameter])) {
                $value = $routeParameters[$parameter];
                $targetType = ucfirst($parameter);
                $targetId = is_object($value) && isset($value->id) ? (string) $value->id : (string) $value;
                break;
            }
        }

        $metadata = $this->safeMetadata($request->except([
            'password',
            'password_confirmation',
            'token',
            'pin',
            'signature_data',
            'staff_signature_data',
            'renter_signature_data',
            'post_signature_data',
        ]));

        \Illuminate\Support\Facades\DB::transaction(function () use ($organization, $user, $module, $action, $request, $response, $targetType, $targetId, $metadata, $path) {
            $previous = AuditLog::where('organization_id', $organization->id)->latest('id')->lockForUpdate()->first();
            $previousHash = $previous?->entry_hash ?? str_repeat('0', 64);
            $createdAt = now();
            $payload = implode('|', [
                (string) $organization->id,
                (string) $user->id,
                $module,
                $action,
                strtoupper($request->method()),
                $request->ip() ?: '0.0.0.0',
                json_encode($metadata, JSON_UNESCAPED_SLASHES),
                (string) $response->getStatusCode(),
                $createdAt->toIso8601String(),
                $previousHash,
                (string) ($targetType ?? ''),
                (string) ($targetId ?? ''),
                substr((string) $request->userAgent(), 0, 1000),
                (string) ($request->route()?->getName() ?? ''),
            ]);
            $entryHash = hash_hmac('sha256', $payload, (string) config('app.key'));

            AuditLog::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_email' => $user->email,
                'module' => $module,
                'action' => $action,
                'route_name' => $request->route()?->getName(),
                'http_method' => strtoupper($request->method()),
                'ip_address' => $request->ip() ?: '0.0.0.0',
                'user_agent' => substr((string) $request->userAgent(), 0, 1000),
                'target_type' => $targetType,
                'target_id' => $targetId,
                'metadata' => $metadata ?: null,
                'response_status' => $response->getStatusCode(),
                'previous_hash' => $previousHash,
                'entry_hash' => $entryHash,
                'created_at' => $createdAt,
            ]);
        });

        return $response;
    }

    private function safeMetadata(array $metadata): array
    {
        $filtered = [];
        foreach ($metadata as $key => $value) {
            if (is_array($value) && count($value) > 20) {
                $filtered[$key] = '[array truncated]';
            } elseif (is_string($value) && strlen($value) > 2000) {
                $filtered[$key] = substr($value, 0, 2000).'...';
            } elseif (is_object($value)) {
                $filtered[$key] = '[object omitted]';
            } else {
                $filtered[$key] = $value;
            }
        }
        return $filtered;
    }
}
