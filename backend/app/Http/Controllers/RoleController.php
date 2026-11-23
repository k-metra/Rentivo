<?php

namespace App\Http\Controllers;

use App\Models\OrganizationRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    private function organization(Request $request)
    {
        return $request->user()->organizations()->firstOrFail();
    }

    private function canManageRoles(Request $request): bool
    {
        $organization = $this->organization($request);
        $membership = $organization->users()->whereKey($request->user()->id)->first()?->pivot;
        if ($membership?->role === 'owner') {
            return true;
        }
        $role = OrganizationRole::find($membership?->role_id);
        return $role ? in_array('Roles Create', $role->permissions ?? [], true)
            || in_array('Roles Update', $role->permissions ?? [], true)
            || in_array('Roles Delete', $role->permissions ?? [], true)
            : false;
    }

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $roles = OrganizationRole::where('organization_id', $organization->id)
            ->withCount('memberships')
            ->orderBy('is_owner', 'desc')
            ->orderBy('name')
            ->get();
        return response()->json([
            'roles' => $roles,
            'owner' => [
                'name' => 'Owner',
                'description' => 'Untamperable organization owner with all permissions.',
                'is_owner' => true,
                'is_active' => true,
                'memberships_count' => $organization->users()->wherePivot('role', 'owner')->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($this->canManageRoles($request), 403, 'You do not have permission to create roles.');
        $organization = $this->organization($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string'],
        ]);
        abort_if(strcasecmp($data['name'], 'Owner') === 0, 422, 'Owner is a reserved role.');
        abort_if(OrganizationRole::where('organization_id', $organization->id)->whereRaw('LOWER(name) = ?', [strtolower($data['name'])])->exists(), 422, 'A role with this name already exists.');

        $role = OrganizationRole::create([
            ...$data,
            'organization_id' => $organization->id,
            'is_owner' => false,
            'is_active' => true,
        ]);
        return response()->json($role->loadCount('memberships'), 201);
    }

    public function update(Request $request, OrganizationRole $role): JsonResponse
    {
        abort_unless($this->canManageRoles($request), 403, 'You do not have permission to update roles.');
        $organization = $this->organization($request);
        abort_if($role->organization_id !== $organization->id, 404);
        abort_if($role->is_owner || strcasecmp($role->name, 'Owner') === 0, 422, 'The Owner role is untamperable.');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        abort_if(strcasecmp($data['name'], 'Owner') === 0, 422, 'Owner is a reserved role.');
        abort_if(OrganizationRole::where('organization_id', $organization->id)->whereKeyNot($role->id)->whereRaw('LOWER(name) = ?', [strtolower($data['name'])])->exists(), 422, 'A role with this name already exists.');
        $role->update($data);
        return response()->json($role->fresh()->loadCount('memberships'));
    }

    public function destroy(Request $request, OrganizationRole $role): JsonResponse
    {
        abort_unless($this->canManageRoles($request), 403, 'You do not have permission to delete roles.');
        $organization = $this->organization($request);
        abort_if($role->organization_id !== $organization->id, 404);
        abort_if($role->is_owner || strcasecmp($role->name, 'Owner') === 0, 422, 'The Owner role cannot be deleted.');
        abort_if($role->memberships()->exists(), 422, 'Reassign or remove users from this role before deleting it.');
        $role->delete();
        return response()->json(['deleted' => true]);
    }
}
