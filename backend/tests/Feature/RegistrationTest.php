<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Notifications\VerifyEmail;
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
