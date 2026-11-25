<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PartnerController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        if (! Schema::hasTable('partners')) {
            return response()->json([]);
        }

        return response()->json(DB::table('partners')
            ->where('organization_id', $organization->id)
            ->orderBy('name')
            ->get());
    }

    public function store(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
        ]);
        $id = DB::table('partners')->insertGetId([
            'organization_id' => $organization->id,
            ...$validated,
            'type' => $validated['type'] ?? 'agency',
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(DB::table('partners')->where('id', $id)->first(), 201);
    }

    public function update(Request $request, int $partner): JsonResponse
    {
        $organization = $this->organization($request);
        $existing = DB::table('partners')
            ->where('id', $partner)
            ->where('organization_id', $organization->id)
            ->first();
        abort_unless($existing, 404);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
        ]);
        DB::table('partners')->where('id', $partner)->update([
            ...$validated,
            'type' => $validated['type'] ?? $existing->type,
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'updated_at' => now(),
        ]);

        return response()->json(DB::table('partners')->where('id', $partner)->first());
    }

    public function destroy(Request $request, int $partner): JsonResponse
    {
        $organization = $this->organization($request);
        $deleted = DB::table('partners')
            ->where('id', $partner)
            ->where('organization_id', $organization->id)
            ->delete();
        abort_unless($deleted, 404);

        return response()->json(['deleted' => true]);
    }
}
