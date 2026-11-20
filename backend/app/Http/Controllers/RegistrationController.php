<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class RegistrationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', Password::min(8)],
        ]);

        $result = DB::transaction(function () use ($validated): array {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => 'owner',
            ]);

            $baseSlug = Str::slug($validated['company_name']) ?: 'organization';
            $slug = $baseSlug;
            $suffix = 1;

            while (Organization::where('slug', $slug)->exists()) {
                $slug = $baseSlug.'-'.$suffix;
                $suffix++;
            }

            $organization = Organization::create([
                'name' => $validated['company_name'],
                'slug' => $slug,
            ]);

            $organization->users()->attach($user->id, ['role' => 'owner']);

            return [$user, $organization];
        });

        [$user, $organization] = $result;
        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Registration successful. Please verify your email address.',
            'user' => $user,
            'organization' => $organization,
        ], 201);
    }
}
