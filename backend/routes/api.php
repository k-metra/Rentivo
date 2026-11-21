<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\DashboardController;

Route::post('/register', [RegistrationController::class, 'store']);
Route::post('/login', [RegistrationController::class, 'login']);
Route::post('/onboarding', [RegistrationController::class, 'onboarding'])
    ->middleware(['auth:sanctum', 'throttle:10,1']);

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

Route::post('/logout', function (Request $request) {
    $request->user()->currentAccessToken()?->delete();
    return response()->json(['message' => 'Signed out successfully.']);
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->prefix('dashboard')->group(function () {
    Route::get('/summary', [DashboardController::class, 'summary']);
    Route::get('/vehicles', [DashboardController::class, 'vehicles']);
    Route::get('/customers', [DashboardController::class, 'customers']);
    Route::get('/bookings', [DashboardController::class, 'bookings']);
    Route::get('/payments', [DashboardController::class, 'payments']);
    Route::get('/users', [DashboardController::class, 'users']);
    Route::post('/bookings', [DashboardController::class, 'storeBooking']);
    Route::post('/vehicles', [DashboardController::class, 'storeVehicle']);
    Route::post('/customers', [DashboardController::class, 'storeCustomer']);
});
