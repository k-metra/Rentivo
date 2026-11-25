<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationRole;
use App\Models\User;
use App\Services\PlanLimits;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class OrganizationUserController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    private function requirePermission(Request $request, string $permission): void
    {
        $organization = $this->organization($request);
        app(RolePermissionService::class)->abortUnless($request->user(), $organization, $permission);
    }

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Users View');
        $organization = $this->organization($request);

        return response()->json($organization->users()
            ->get()
            ->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->pivot->role,
                'role_id' => $user->pivot->role_id,
                'created_at' => $user->created_at,
            ])
            ->values());
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Users Create');
        $organization = $this->organization($request);
        $userLimit = app(PlanLimits::class)->userLimit($organization->plan);
        abort_if(
            $userLimit !== null && $organization->users()->count() >= $userLimit,
            422,
            "Your {$organization->plan} plan allows up to {$userLimit} users.",
        );
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
            'role_id' => ['required', 'integer'],
        ]);

        $role = OrganizationRole::where('organization_id', $organization->id)
            ->whereKey($validated['role_id'])
            ->where('is_active', true)
            ->first();
        abort_unless($role, 422, 'The selected role is invalid.');

        $user = User::where('email', $validated['email'])->first();
        if ($user) {
            abort_if(
                $organization->users()->whereKey($user->id)->exists(),
                422,
                'This email already belongs to a user in this organization.',
            );
        } else {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => $role->name,
                'email_verified_at' => now(),
            ]);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        if ($user->name !== $validated['name']) {
            $user->update(['name' => $validated['name']]);
        }
        $user->role = $role->name;
        $user->save();

        $organization->users()->syncWithoutDetaching([
            $user->id => [
                'role' => $role->name,
                'role_id' => $role->id,
            ],
        ]);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role->name,
            'role_id' => $role->id,
        ], 201);
    }

    public function update(Request $request, int $userId): JsonResponse
    {
        $this->requirePermission($request, 'Users Update');
        $organization = $this->organization($request);
        $membership = DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->first();
        abort_unless($membership, 404);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => ['nullable', 'string', 'confirmed', Password::min(8)],
            'role_id' => ['nullable', 'integer'],
        ]);

        $user = User::findOrFail($userId);
        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
        ];
        if (! empty($validated['password'])) {
            $data['password'] = $validated['password'];
        }
        $user->update($data);

        if ($membership->role !== 'owner' && ! empty($validated['role_id'])) {
            $role = OrganizationRole::where('organization_id', $organization->id)
                ->whereKey($validated['role_id'])
                ->where('is_active', true)
                ->first();
            abort_unless($role, 422, 'The selected role is invalid.');
            DB::table('organization_memberships')
                ->where('organization_id', $organization->id)
                ->where('user_id', $userId)
                ->update([
                    'role' => $role->name,
                    'role_id' => $role->id,
                    'updated_at' => now(),
                ]);
            $user->update(['role' => $role->name]);
            $resolvedRole = $role->name;
        } else {
            $resolvedRole = $membership->role;
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $resolvedRole,
            'role_id' => $membership->role !== 'owner' && ! empty($validated['role_id'])
                ? (int) $validated['role_id']
                : $membership->role_id,
        ]);
    }

    public function destroy(Request $request, int $userId): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($request->user()->id === $userId, 422, 'You cannot remove your own account.');

        $membership = DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->first();
        abort_unless($membership, 404);
        abort_if($membership->role === 'owner', 422, 'The Owner account cannot be deleted.');

        DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->delete();

        return response()->json([
            'deleted' => true,
            'id' => $userId,
        ]);
    }

    public function updateRole(Request $request, int $userId): JsonResponse
    {
        $this->requirePermission($request, 'Users Update');
        $organization = $this->organization($request);
        $validated = $request->validate([
            'role_id' => ['required', 'integer'],
        ]);

        $membership = DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->first();
        abort_unless($membership, 404);
        abort_if($membership->role === 'owner', 422, 'The Owner role is untamperable.');

        $role = OrganizationRole::where('organization_id', $organization->id)
            ->whereKey($validated['role_id'])
            ->where('is_active', true)
            ->first();
        abort_unless($role, 422, 'The selected role is invalid.');

        DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->update([
                'role' => $role->name,
                'role_id' => $role->id,
                'updated_at' => now(),
            ]);

        return response()->json([
            'id' => $userId,
            'role' => $role->name,
            'role_id' => $role->id,
        ]);
    }
}
