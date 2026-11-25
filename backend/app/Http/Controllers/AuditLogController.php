<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Organization;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        app(RolePermissionService::class)->abortUnless($request->user(), $organization, 'Audit Logs View');
        $query = AuditLog::query()
            ->where('organization_id', $organization->id)
            ->with('user:id,name,email');

        if ($request->filled('module')) {
            $query->where('module', $request->string('module')->toString());
        }
        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($builder) use ($search) {
                $builder->where('action', 'like', "%{$search}%")
                    ->orWhere('module', 'like', "%{$search}%")
                    ->orWhere('user_name', 'like', "%{$search}%")
                    ->orWhere('user_email', 'like', "%{$search}%")
                    ->orWhere('target_type', 'like', "%{$search}%")
                    ->orWhere('target_id', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%");
            });
        }

        $logs = $query->latest('id')->paginate(
            min(100, max(10, (int) $request->integer('per_page', 25))),
        );

        $integrity = 'verified';
        $previousHash = str_repeat('0', 64);
        foreach (AuditLog::where('organization_id', $organization->id)->oldest('id')->get([
            'organization_id',
            'user_id',
            'module',
            'action',
            'route_name',
            'http_method',
            'ip_address',
            'user_agent',
            'target_type',
            'target_id',
            'metadata',
            'response_status',
            'created_at',
            'previous_hash',
            'entry_hash',
        ]) as $log) {
            if ($log->previous_hash !== $previousHash) {
                $integrity = 'tampered';
                break;
            }
            $payload = implode('|', [
                (string) $log->organization_id,
                (string) $log->user_id,
                (string) $log->module,
                (string) $log->action,
                (string) $log->http_method,
                (string) $log->ip_address,
                json_encode($log->metadata, JSON_UNESCAPED_SLASHES),
                (string) $log->response_status,
                $log->created_at->toIso8601String(),
                (string) $log->previous_hash,
                (string) ($log->target_type ?? ''),
                (string) ($log->target_id ?? ''),
                (string) ($log->user_agent ?? ''),
                (string) ($log->route_name ?? ''),
            ]);
            if (! hash_equals(hash_hmac('sha256', $payload, (string) config('app.key')), $log->entry_hash)) {
                $integrity = 'tampered';
                break;
            }
            $previousHash = $log->entry_hash;
        }

        return response()->json([
            'logs' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
            'integrity' => $integrity,
        ]);
    }
}
