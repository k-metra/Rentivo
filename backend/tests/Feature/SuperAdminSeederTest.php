<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SuperAdminSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_seeds_the_superadmin_from_configuration(): void
    {
        config([
            'rentivo.superadmin.name' => 'Rentivo Admin',
            'rentivo.superadmin.email' => 'admin@example.com',
            'rentivo.superadmin.password' => 'test-superadmin-password',
        ]);

        $this->seed(SuperAdminSeeder::class);

        $user = User::where('email', 'admin@example.com')->firstOrFail();

        $this->assertSame('Rentivo Admin', $user->name);
        $this->assertSame('superadmin', $user->role);
        $this->assertTrue($user->is_superadmin);
        $this->assertTrue(Hash::check('test-superadmin-password', $user->password));
        $this->assertNotNull($user->email_verified_at);
    }
}
