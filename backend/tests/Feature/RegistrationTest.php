<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Notifications\VerifyEmail;
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
            ->assertJsonPath('user.email', 'alex@example.com');

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
}
