<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrganizationDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_an_organization_removes_exclusive_member_accounts_but_keeps_shared_and_superadmin_accounts(): void
    {
        $organization = Organization::create([
            'name' => 'Organization to delete',
            'slug' => 'organization-to-delete',
        ]);
        $otherOrganization = Organization::create([
            'name' => 'Other organization',
            'slug' => 'other-organization',
        ]);

        $exclusiveUser = User::factory()->create();
        $sharedUser = User::factory()->create();
        $superadmin = User::factory()->create(['is_superadmin' => true]);
        $organization->users()->attach([
            $exclusiveUser->id => ['role' => 'owner'],
            $sharedUser->id => ['role' => 'staff'],
            $superadmin->id => ['role' => 'staff'],
        ]);
        $otherOrganization->users()->attach([
            $sharedUser->id => ['role' => 'owner'],
        ]);

        $actor = User::factory()->create(['is_superadmin' => true]);
        Sanctum::actingAs($actor);

        $this->getJson("/api/superadmin/organizations/{$organization->id}")
            ->assertOk()
            ->assertJsonPath('accounts_to_delete_count', 1);

        $this->deleteJson("/api/superadmin/organizations/{$organization->id}")
            ->assertOk()
            ->assertJsonPath('deleted_user_accounts', 1);

        $this->assertDatabaseMissing('users', ['id' => $exclusiveUser->id]);
        $this->assertDatabaseHas('users', ['id' => $sharedUser->id]);
        $this->assertDatabaseHas('users', ['id' => $superadmin->id]);
        $this->assertDatabaseMissing('organization_memberships', [
            'organization_id' => $organization->id,
            'user_id' => $sharedUser->id,
        ]);
        $this->assertDatabaseHas('organization_memberships', [
            'organization_id' => $otherOrganization->id,
            'user_id' => $sharedUser->id,
        ]);
        $this->assertDatabaseMissing('organizations', ['id' => $organization->id]);
    }
}
