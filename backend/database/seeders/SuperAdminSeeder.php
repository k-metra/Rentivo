<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('RENTIVO_SUPERADMIN_EMAIL');
        $password = env('RENTIVO_SUPERADMIN_PASSWORD');
        $name = env('RENTIVO_SUPERADMIN_NAME', 'Rentivo Superadmin');

        if (! $email || ! $password) {
            $this->command->warn('Set RENTIVO_SUPERADMIN_EMAIL and RENTIVO_SUPERADMIN_PASSWORD before seeding.');
            return;
        }

        $user = User::where('email', $email)->first();
        if (! $user) {
            $user = new User();
            $user->email = $email;
        }
        $user->name = $name;
        $user->password = Hash::make($password);
        $user->role = 'superadmin';
        $user->is_superadmin = true;
        $user->email_verified_at = now();
        $user->save();
    }
}
