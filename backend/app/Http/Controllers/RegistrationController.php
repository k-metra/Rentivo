<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Support\Facades\Hash;

class RegistrationController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'message' => 'The email or password is incorrect.',
            ], 422);
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before signing in.',
                'email_verification_required' => true,
            ], 403);
        }

        $organization = $user->organizations()->first();
        $token = $user->createToken('rentivo-session')->plainTextToken;

        return response()->json([
            'message' => 'Signed in successfully.',
            'token' => $token,
            'user' => $user,
            'organization' => $organization,
            'onboarding_completed' => $organization?->onboarding_completed_at !== null,
        ]);
    }
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
        $token = $user->createToken('rentivo-session')->plainTextToken;

        return response()->json([
            'message' => 'Registration successful. Please verify your email address.',
            'user' => $user,
            'organization' => $organization,
            'token' => $token,
        ], 201);
    }

    public function onboarding(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'province' => ['required', 'string', 'max:255'],
            'country' => ['required', 'string', 'in:Philippines'],
            'social_pages' => ['nullable', 'json'],
            'timezone' => ['required', 'string', 'max:100'],
            'currency' => ['required', 'string', 'size:3'],
            'rental_unit' => ['required', 'in:hour,day,week,month'],
            'tax_name' => ['nullable', 'string', 'max:100'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Please sign in before continuing with onboarding.',
            ], 401);
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email before continuing with onboarding.',
            ], 403);
        }

        $organization = $user->organizations()->firstOrFail();
        $logoPath = $organization->logo_path;

        if ($request->hasFile('logo')) {
            $logoPath = $request->file('logo')->store('logos', 'public');
        }

        $organization->update([
            'name' => $validated['company_name'],
            'logo_path' => $logoPath,
            'phone' => $validated['phone'] ?? null,
            'website' => $validated['website'] ?? null,
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'province' => $validated['province'],
            'country' => 'Philippines',
            'social_pages' => json_decode($validated['social_pages'] ?? '[]', true),
            'timezone' => $validated['timezone'],
            'currency' => strtoupper($validated['currency']),
            'rental_unit' => $validated['rental_unit'],
            'tax_name' => $validated['tax_name'] ?? null,
            'tax_rate' => $validated['tax_rate'] ?? null,
            'onboarding_completed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Onboarding completed.',
            'organization' => $organization->fresh(),
        ]);
    }
}
