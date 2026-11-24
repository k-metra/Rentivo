<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\OrganizationRole;
use App\Models\User;

class RolePermissionService
{
    public function permissionsFor(User $user, Organization $organization): array
    {
        $membership = $organization->users()
            ->whereKey($user->id)
            ->first()
            ?->pivot;

        if ($membership?->role === 'owner'
            || ($membership?->role_id && OrganizationRole::where('organization_id', $organization->id)
                ->whereKey($membership->role_id)
                ->where('is_owner', true)
                ->exists())) {
            return ['*'];
        }

        if (! $membership?->role_id) {
            return [];
        }

        $role = OrganizationRole::where('organization_id', $organization->id)
            ->whereKey($membership->role_id)
            ->where('is_active', true)
            ->first();

        return $role ? array_values(array_unique($role->permissions ?? [])) : [];
    }

    public function can(User $user, Organization $organization, string $permission): bool
    {
        $permissions = $this->permissionsFor($user, $organization);
        return in_array('*', $permissions, true) || in_array($permission, $permissions, true);
    }

    public function abortUnless(User $user, Organization $organization, string $permission): void
    {
        abort_unless($this->can($user, $organization, $permission), 403, 'You do not have permission to perform this action.');
    }
}
