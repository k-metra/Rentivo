<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('rentivo.superadmin.email');
        $password = config('rentivo.superadmin.password');
        $name = config('rentivo.superadmin.name', 'Rentivo Superadmin');

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
