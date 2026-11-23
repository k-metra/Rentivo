<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_an_owner_can_add_a_user_with_a_custom_role(): void
    {
        $organization = Organization::create([
            'name' => 'Team Rentals',
            'slug' => 'team-rentals',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);
        $role = \App\Models\OrganizationRole::create([
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
