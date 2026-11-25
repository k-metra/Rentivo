<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_link_requests_are_neutral_and_link_to_the_frontend(): void
    {
        Notification::fake();
        config(['app.frontend_url' => 'https://rentivo.example/']);

        $user = User::factory()->create([
            'email' => 'owner@example.com',
            'email_verified_at' => now(),
        ]);
        $expectedMessage = 'If an account exists for that email, a password reset link has been sent.';

        $this->postJson('/api/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', $expectedMessage);

        $token = null;
        $resetUrl = null;
        Notification::assertSentTo(
            $user,
            ResetPasswordNotification::class,
            function (ResetPasswordNotification $notification) use ($user, &$token, &$resetUrl): bool {
                $token = $notification->token;
                $resetUrl = $notification->toMail($user)->actionUrl;

                return true;
            },
        );

        $this->assertSame(
            'https://rentivo.example/reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->email,
            ]),
            $resetUrl,
        );

        $this->postJson('/api/forgot-password', ['email' => 'unknown@example.com'])
            ->assertOk()
            ->assertJsonPath('message', $expectedMessage);
    }

    public function test_a_valid_reset_changes_the_password_and_revokes_existing_api_tokens(): void
    {
        Notification::fake();
        $user = User::factory()->create([
            'email' => 'reset@example.com',
            'password' => 'old-password',
            'email_verified_at' => now(),
        ]);
        $user->createToken('existing-session');

        $this->postJson('/api/forgot-password', ['email' => $user->email])
            ->assertOk();

        $token = null;
        Notification::assertSentTo(
            $user,
            ResetPasswordNotification::class,
            function (ResetPasswordNotification $notification) use (&$token): bool {
                $token = $notification->token;

                return true;
            },
        );
        $this->assertNotNull($token);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-secure-password',
            'password_confirmation' => 'new-secure-password',
        ])->assertOk()
            ->assertJsonPath('message', 'Your password has been reset. You can now sign in.');

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'new-secure-password',
        ])->assertOk();
        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'old-password',
        ])->assertUnprocessable();
    }

    public function test_invalid_reset_tokens_are_rejected_without_changing_the_password(): void
    {
        $user = User::factory()->create([
            'email' => 'invalid-reset@example.com',
            'password' => 'old-password',
        ]);

        $this->postJson('/api/reset-password', [
            'token' => 'invalid-token',
            'email' => $user->email,
            'password' => 'new-secure-password',
            'password_confirmation' => 'new-secure-password',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'This password reset link is invalid or has expired.');

        $this->assertTrue(password_verify('old-password', $user->fresh()->password));
        $this->assertSame(0, PersonalAccessToken::query()->count());
    }
}
