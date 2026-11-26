<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationRole;
use App\Models\User;
use App\Services\RolePermissionService;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_email_verification_redirects_to_the_dashboard_host(): void
    {
        config(['app.dashboard_url' => 'https://app.rentivo.example']);
        $user = User::factory()->unverified()->create();
        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(30),
            ['id' => $user->id, 'hash' => sha1($user->getEmailForVerification())],
        );

        $this->get($verificationUrl)
            ->assertRedirect('https://app.rentivo.example/?verified=1');

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_a_user_can_start_a_free_trial(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/register', [
            'company_name' => 'Acme Rentals',
            'name' => 'Alex Rivera',
            'email' => 'alex@example.com',
            'password' => 'password123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('organization.name', 'Acme Rentals')
            ->assertJsonPath('organization.online_booking_enabled', true)
            ->assertJsonPath('user.email', 'alex@example.com')
            ->assertJsonStructure(['token']);

        $this->assertDatabaseHas('users', [
            'name' => 'Alex Rivera',
            'email' => 'alex@example.com',
            'role' => 'owner',
        ]);

        Notification::assertSentTo(
            User::where('email', 'alex@example.com')->firstOrFail(),
            VerifyEmail::class,
        );

        $organization = Organization::where('slug', 'acme-rentals')->firstOrFail();
        $user = User::where('email', 'alex@example.com')->firstOrFail();

        $this->assertTrue($organization->users()->whereKey($user->id)->exists());
    }

    public function test_onboarding_logo_is_saved_to_the_organization(): void
    {
        Storage::fake('public');

        $organization = Organization::create([
            'name' => 'Logo Rentals',
            'slug' => 'logo-rentals',
        ]);
        $user = User::factory()->create([
            'email' => 'logo@example.com',
            'email_verified_at' => now(),
        ]);
        $organization->users()->attach($user->id, ['role' => 'owner']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/onboarding', [
            'company_name' => 'Logo Rentals',
            'phone' => '+63 900 000 0000',
            'address' => '123 Main Street',
            'city' => 'Makati',
            'province' => 'Metro Manila',
            'country' => 'Philippines',
            'timezone' => 'Asia/Manila',
            'currency' => 'PHP',
            'rental_unit' => 'day',
            'logo' => UploadedFile::fake()->createWithContent(
                'company-logo.png',
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
            ),
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('organization.name', 'Logo Rentals')
            ->assertJsonStructure(['organization' => ['logo_path', 'logo_url']]);

        $logoPath = $response->json('organization.logo_path');
        $this->assertNotNull($logoPath);
        Storage::disk('public')->assertExists($logoPath);
        $this->assertSame($logoPath, $organization->fresh()->logo_path);
    }

    public function test_company_currency_can_be_changed_in_settings(): void
    {
        $organization = Organization::create([
            'name' => 'Currency Rentals',
            'slug' => 'currency-rentals',
            'currency' => 'USD',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/settings', [
            'name' => $organization->name,
            'currency' => 'PHP',
        ])
            ->assertOk()
            ->assertJsonPath('currency', 'PHP');

        $this->postJson('/api/dashboard/settings', [
            'name' => $organization->name,
            'currency' => 'ABC',
        ])->assertStatus(422)->assertJsonValidationErrors(['currency']);

        $this->assertSame('PHP', $organization->fresh()->currency);
    }

    public function test_expired_subscriptions_can_read_but_cannot_modify_workspace_data(): void
    {
        $organization = Organization::create([
            'name' => 'Expired Rentals',
            'slug' => 'expired-rentals',
            'subscription_status' => 'expired',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        Sanctum::actingAs($owner);

        $this->getJson('/api/dashboard/summary')->assertOk();
        $this->getJson('/api/dashboard/settings')->assertOk();
        $this->getJson('/api/dashboard/vehicles')->assertOk();
        $this->getJson('/api/dashboard/bookings')->assertOk();

        foreach ([
            ['POST', '/api/dashboard/settings'],
            ['POST', '/api/dashboard/bookings'],
            ['PUT', '/api/dashboard/partners/999'],
            ['PATCH', '/api/dashboard/users/999'],
            ['DELETE', '/api/dashboard/users/999'],
        ] as [$method, $uri]) {
            $this->json($method, $uri, ['name' => 'Updated Expired Rentals'])
                ->assertStatus(402)
                ->assertJsonPath('code', 'subscription_expired');
        }

        $this->assertSame('Expired Rentals', $organization->fresh()->name);
    }

    public function test_due_subscription_is_expired_before_a_workspace_write(): void
    {
        $organization = Organization::create([
            'name' => 'Due Trial Rentals',
            'slug' => 'due-trial-rentals',
            'subscription_status' => 'free_trial',
            'trial_ends_at' => now()->subMinute(),
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/settings', [
            'name' => 'Updated Due Trial Rentals',
        ])->assertStatus(402)
            ->assertJsonPath('code', 'subscription_expired');

        $this->assertSame('expired', $organization->fresh()->subscription_status);
        $this->assertSame('Due Trial Rentals', $organization->fresh()->name);
    }

    public function test_active_and_free_trial_subscriptions_can_still_modify_workspace_data(): void
    {
        foreach (['active', 'free_trial'] as $status) {
            $organization = Organization::create([
                'name' => "{$status} Rentals",
                'slug' => "{$status}-rentals",
                'subscription_status' => $status,
                'subscription_ends_at' => $status === 'active' ? now()->addMonth() : null,
                'trial_ends_at' => $status === 'free_trial' ? now()->addDays(20) : null,
            ]);
            $owner = User::factory()->create(['email_verified_at' => now()]);
            $organization->users()->attach($owner->id, ['role' => 'owner']);
            Sanctum::actingAs($owner);

            $this->postJson('/api/dashboard/settings', [
                'name' => "Updated {$status} Rentals",
            ])->assertOk();

            $this->assertSame("Updated {$status} Rentals", $organization->fresh()->name);
        }
    }

    public function test_superadmin_can_renew_an_expired_subscription_and_workspace_writes_resume(): void
    {
        $organization = Organization::create([
            'name' => 'Renewed Rentals',
            'slug' => 'renewed-rentals',
            'plan' => 'Business',
            'subscription_status' => 'expired',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        $superadmin = User::factory()->create([
            'email_verified_at' => now(),
            'is_superadmin' => true,
        ]);
        $startsAt = now()->startOfMinute();
        $endsAt = $startsAt->copy()->addDays(30);
        Sanctum::actingAs($superadmin);

        $this->postJson("/api/superadmin/organizations/{$organization->id}/subscription-history", [
            'plan' => 'Business',
            'billing_cycle' => 'monthly',
            'duration_days' => 30,
            'starts_at' => $startsAt->toDateTimeString(),
            'ends_at' => $endsAt->toDateTimeString(),
            'price' => 1000,
            'processing_fee' => 25,
            'discount' => 50,
            'status' => 'paid',
        ])->assertCreated()
            ->assertJsonPath('status', 'paid');

        $this->assertSame('active', $organization->fresh()->subscription_status);
        $this->assertDatabaseHas('subscription_history', [
            'organization_id' => $organization->id,
            'created_by' => $superadmin->id,
            'status' => 'paid',
        ]);

        Sanctum::actingAs($owner);
        $this->postJson('/api/dashboard/settings', [
            'name' => 'Renewed Workspace',
        ])->assertOk();

        $this->assertSame('Renewed Workspace', $organization->fresh()->name);
    }

    public function test_an_owner_can_add_a_user_with_a_custom_role(): void
    {
        $organization = Organization::create([
            'name' => 'Team Rentals',
            'slug' => 'team-rentals',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        $role = OrganizationRole::create([
            'organization_id' => $organization->id,
            'name' => 'Operations',
            'description' => 'Operations access',
            'permissions' => ['Bookings View'],
            'is_owner' => false,
            'is_active' => true,
        ]);
        Sanctum::actingAs($owner);

        $response = $this->postJson('/api/dashboard/users', [
            'name' => 'Jamie Staff',
            'email' => 'jamie@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role_id' => $role->id,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('name', 'Jamie Staff')
            ->assertJsonPath('role', 'Operations')
            ->assertJsonPath('role_id', $role->id);

        $this->assertDatabaseHas('organization_memberships', [
            'organization_id' => $organization->id,
            'role' => 'Operations',
            'role_id' => $role->id,
        ]);
        $this->assertNotNull(User::where('email', 'jamie@example.com')->firstOrFail()->email_verified_at);

        $this->deleteJson('/api/dashboard/users/'.$response->json('id'))
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->assertDatabaseMissing('organization_memberships', [
            'organization_id' => $organization->id,
            'user_id' => $response->json('id'),
        ]);
    }

    public function test_custom_role_permissions_are_resolved_from_a_membership_role_id(): void
    {
        $organization = Organization::create([
            'name' => 'Permission Rentals',
            'slug' => 'permission-rentals',
        ]);
        $staff = User::factory()->create(['email_verified_at' => now()]);
        $role = OrganizationRole::create([
            'organization_id' => $organization->id,
            'name' => 'Staff',
            'permissions' => ['Bookings View'],
            'is_owner' => false,
            'is_active' => true,
        ]);
        $organization->users()->attach($staff->id, [
            'role' => $role->name,
            'role_id' => $role->id,
        ]);

        $this->assertSame(
            ['Bookings View'],
            app(RolePermissionService::class)->permissionsFor($staff, $organization),
        );
    }

    public function test_business_plan_limits_an_organization_to_ten_users_during_trial(): void
    {
        $organization = Organization::create([
            'name' => 'Business Rentals',
            'slug' => 'business-rentals',
            'plan' => 'Business',
            'subscription_status' => 'free_trial',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        $role = OrganizationRole::create([
            'organization_id' => $organization->id,
            'name' => 'Staff',
            'permissions' => [],
            'is_owner' => false,
            'is_active' => true,
        ]);
        User::factory()->count(9)->create()->each(
            fn (User $user) => $organization->users()->attach($user->id, [
                'role' => $role->name,
                'role_id' => $role->id,
            ]),
        );
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/users', [
            'name' => 'Eleventh User',
            'email' => 'eleventh@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role_id' => $role->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Your Business plan allows up to 10 users.');
    }

    public function test_solo_plan_cannot_enable_growth_features(): void
    {
        $organization = Organization::create([
            'name' => 'Solo Rentals',
            'slug' => 'solo-rentals',
            'plan' => 'Solo',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/settings', [
            'name' => 'Solo Rentals',
            'electronic_signature_enabled' => true,
            'online_booking_enabled' => true,
        ])
            ->assertOk()
            ->assertJsonPath('electronic_signature_enabled', false)
            ->assertJsonPath('online_booking_enabled', false);

        $this->getJson('/api/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('limits.users', 1)
            ->assertJsonPath('limits.vehicles', 3)
            ->assertJsonPath('entitlements.advanced_reports', false)
            ->assertJsonPath('entitlements.electronic_signatures', false)
            ->assertJsonPath('entitlements.online_booking', false);
    }

    public function test_a_verified_user_can_complete_onboarding(): void
    {
        $organization = Organization::create([
            'name' => 'Acme Rentals',
            'slug' => 'acme-rentals',
        ]);
        $user = User::factory()->create([
            'email' => 'verified@example.com',
            'email_verified_at' => now(),
        ]);
        $organization->users()->attach($user->id, ['role' => 'owner']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/onboarding', [
            'email' => 'verified@example.com',
            'company_name' => 'Acme Rentals Updated',
            'phone' => '+1 555 0100',
            'website' => 'https://acmerentals.example',
            'address' => '123 Main Street',
            'city' => 'Seattle',
            'province' => 'Metro Manila',
            'country' => 'Philippines',
            'social_pages' => '[{"platform":"Facebook","url":"https://facebook.com/acme-rentals"}]',
            'timezone' => 'America/Los_Angeles',
            'currency' => 'USD',
            'rental_unit' => 'day',
            'tax_name' => 'Sales Tax',
            'tax_rate' => 8.25,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('organization.name', 'Acme Rentals Updated')
            ->assertJsonPath('organization.currency', 'USD');

        $this->assertDatabaseHas('organizations', [
            'id' => $organization->id,
            'name' => 'Acme Rentals Updated',
            'timezone' => 'America/Los_Angeles',
            'rental_unit' => 'day',
        ]);
        $this->assertNotNull($organization->fresh()->onboarding_completed_at);
    }

    public function test_an_unverified_user_can_request_another_verification_email(): void
    {
        Notification::fake();

        $user = User::factory()->unverified()->create([
            'email' => 'unverified@example.com',
        ]);

        $response = $this->postJson('/api/email/verification-notification', [
            'email' => 'unverified@example.com',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Verification email sent.');

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_due_trials_and_paid_subscriptions_are_expired(): void
    {
        $trial = Organization::create([
            'name' => 'Expired Trial',
            'slug' => 'expired-trial',
            'subscription_status' => 'free_trial',
            'trial_ends_at' => now()->subMinute(),
        ]);
        $paid = Organization::create([
            'name' => 'Expired Subscription',
            'slug' => 'expired-subscription',
            'subscription_status' => 'active',
            'subscription_ends_at' => now()->subMinute(),
        ]);

        Organization::expireDueSubscriptions();

        $this->assertSame('expired', $trial->fresh()->subscription_status);
        $this->assertSame('expired', $paid->fresh()->subscription_status);
    }

    public function test_a_user_can_sign_in_and_is_told_when_onboarding_is_incomplete(): void
    {
        $organization = Organization::create([
            'name' => 'Acme Rentals',
            'slug' => 'acme-rentals',
        ]);
        $user = User::factory()->create([
            'email' => 'signin@example.com',
            'password' => 'password123',
            'email_verified_at' => now(),
        ]);
        $organization->users()->attach($user->id, ['role' => 'owner']);

        $response = $this->postJson('/api/login', [
            'email' => 'signin@example.com',
            'password' => 'password123',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('onboarding_completed', false)
            ->assertJsonStructure(['token', 'user', 'organization']);
    }
}
