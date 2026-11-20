<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RegistrationController;

Route::post('/register', [RegistrationController::class, 'store']);

Route::post('/email/verification-notification', function (Request $request) {
    $validated = $request->validate([
        'email' => ['required', 'email', 'exists:users,email'],
    ]);
    $user = \App\Models\User::where('email', $validated['email'])->firstOrFail();

    if ($user->hasVerifiedEmail()) {
        return response()->json([
            'message' => 'Email address already verified.',
        ]);
    }

    $user->sendEmailVerificationNotification();

    return response()->json([
        'message' => 'Verification email sent.',
    ]);
})->middleware('throttle:6,1');

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
