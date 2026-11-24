<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\SuperAdminController;

Route::post('/register', [RegistrationController::class, 'store']);
Route::post('/login', [RegistrationController::class, 'login']);
Route::get('/booking-form/{slug}', [DashboardController::class, 'publicBookingForm']);
Route::get('/contracts/{token}', [DashboardController::class, 'viewPublicBookingContract']);
Route::post('/contracts/{token}/verify', [DashboardController::class, 'verifyPublicBookingContract'])->middleware('throttle:10,1');
Route::post('/contracts/{token}/sign', [DashboardController::class, 'signPublicBookingContract'])->middleware('throttle:10,1');
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

Route::patch('/user/profile', function (Illuminate\Http\Request $request) {
    $user = $request->user();
    $validated = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$user->id],
        'password' => ['nullable', 'string', 'min:8', 'confirmed'],
    ]);
    $emailChanged = strtolower($validated['email']) !== strtolower($user->email);
    $user->name = $validated['name'];
    $user->email = $validated['email'];
    if (! empty($validated['password'])) $user->password = $validated['password'];
    if ($emailChanged) $user->email_verified_at = null;
    $user->save();
    if ($emailChanged) $user->sendEmailVerificationNotification();
    return response()->json($user);
})->middleware('auth:sanctum');

Route::post('/logout', function (Request $request) {
    $request->user()->currentAccessToken()?->delete();
    return response()->json(['message' => 'Signed out successfully.']);
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->prefix('superadmin')->group(function () {
    Route::get('/organizations', [SuperAdminController::class, 'index']);
    Route::get('/organizations/{organization}', [SuperAdminController::class, 'showOrganization']);
    Route::patch('/organizations/{organization}', [SuperAdminController::class, 'updateOrganization']);
    Route::delete('/organizations/{organization}', [SuperAdminController::class, 'destroyOrganization']);
    Route::post('/organizations/{organization}/subscription-history', [SuperAdminController::class, 'storeSubscriptionHistory']);
    Route::patch('/organizations/{organization}/subscription-history/{history}', [SuperAdminController::class, 'updateSubscriptionHistory']);
    Route::delete('/organizations/{organization}/subscription-history/{history}', [SuperAdminController::class, 'destroySubscriptionHistory']);
});

Route::middleware('auth:sanctum')->prefix('dashboard')->group(function () {
    Route::get('/summary', [DashboardController::class, 'summary']);
    Route::get('/audit-logs', [DashboardController::class, 'auditLogs']);
    Route::get('/settings', [DashboardController::class, 'settings']);
    Route::post('/settings', [DashboardController::class, 'updateSettings']);
    Route::get('/contract-templates', [DashboardController::class, 'contractTemplates']);
    Route::post('/contract-templates', [DashboardController::class, 'saveContractTemplate']);
    Route::delete('/contract-templates/{template}', [DashboardController::class, 'deleteContractTemplate']);
    Route::get('/vehicles', [DashboardController::class, 'vehicles']);
    Route::get('/customers', [DashboardController::class, 'customers']);
    Route::get('/customers/{customer}', [DashboardController::class, 'showCustomer']);
    Route::get('/bookings', [DashboardController::class, 'bookings']);
    Route::get('/payments', [DashboardController::class, 'payments']);
    Route::get('/users', [DashboardController::class, 'users']);
    Route::post('/users', [DashboardController::class, 'storeUser']);
    Route::patch('/users/{user}', [DashboardController::class, 'updateUser']);
    Route::delete('/users/{user}', [DashboardController::class, 'destroyUser']);
    Route::patch('/users/{user}/role', [DashboardController::class, 'updateUserRole']);
    Route::get('/partners', [DashboardController::class, 'partners']);
    Route::post('/partners', [DashboardController::class, 'storePartner']);
    Route::put('/partners/{partner}', [DashboardController::class, 'updatePartner']);
    Route::delete('/partners/{partner}', [DashboardController::class, 'deletePartner']);
    Route::get('/booking-sources', [DashboardController::class, 'bookingSources']);
    Route::get('/booking-sources/stats', [DashboardController::class, 'bookingSourceStats']);
    Route::post('/booking-sources', [DashboardController::class, 'storeBookingSource']);
    Route::post('/bookings', [DashboardController::class, 'storeBooking']);
    Route::put('/bookings/{booking}', [DashboardController::class, 'updateBooking']);
    Route::patch('/bookings/{booking}/status', [DashboardController::class, 'updateBookingStatus']);
    Route::get('/bookings/{booking}', [DashboardController::class, 'showBooking']);
    Route::get('/bookings/{booking}/contract', [DashboardController::class, 'showBookingContract']);
    Route::post('/bookings/{booking}/contract', [DashboardController::class, 'generateBookingContract']);
    Route::post('/bookings/{booking}/contract/staff-sign', [DashboardController::class, 'signBookingContractAsStaff']);
    Route::post('/bookings/{booking}/contract/revoke', [DashboardController::class, 'revokeBookingContract']);
    Route::post('/bookings/{booking}/extensions', [DashboardController::class, 'storeBookingExtension']);
    Route::post('/bookings/{booking}/extensions/undo', [DashboardController::class, 'undoBookingExtension']);
    Route::post('/bookings/{booking}/payments', [DashboardController::class, 'storeBookingPayment']);
    Route::get('/bookings/{booking}/inspection', [DashboardController::class, 'showBookingInspection']);
    Route::post('/bookings/{booking}/inspection', [DashboardController::class, 'saveBookingInspection']);
    Route::post('/bookings/{booking}/inspection/complete', [DashboardController::class, 'completeBookingInspection']);
    Route::get('/bookings/{booking}/post-inspection', [DashboardController::class, 'showBookingPostInspection']);
    Route::post('/bookings/{booking}/post-inspection', [DashboardController::class, 'saveBookingPostInspection']);
    Route::post('/bookings/{booking}/post-inspection/complete', [DashboardController::class, 'completeBookingPostInspection']);
    Route::delete('/payments/{payment}', [DashboardController::class, 'deleteBookingPayment']);
    Route::post('/vehicles', [DashboardController::class, 'storeVehicle']);
    Route::get('/vehicles/{vehicle}', [DashboardController::class, 'showVehicle']);
    Route::put('/vehicles/{vehicle}', [DashboardController::class, 'updateVehicle']);
    Route::post('/vehicles/{vehicle}', [DashboardController::class, 'updateVehicle']);
    Route::post('/customers', [DashboardController::class, 'storeCustomer']);
    Route::put('/customers/{customer}', [DashboardController::class, 'updateCustomer']);
    Route::patch('/customers/{customer}/archive', [DashboardController::class, 'archiveCustomer']);
    Route::delete('/customers/{customer}', [DashboardController::class, 'deleteCustomer']);
    Route::get('/funds', [\App\Http\Controllers\FundController::class, 'index']);
    Route::post('/funds', [\App\Http\Controllers\FundController::class, 'store']);
    Route::post('/funds/{fund}', [\App\Http\Controllers\FundController::class, 'update']);
    Route::delete('/funds/{fund}', [\App\Http\Controllers\FundController::class, 'destroy']);
    Route::post('/fund-transfers', [\App\Http\Controllers\FundController::class, 'transfer']);
    Route::post('/funds/{fund}/transactions', [\App\Http\Controllers\FundController::class, 'storeTransaction']);
    Route::patch('/fund-transactions/{transaction}', [\App\Http\Controllers\FundController::class, 'updateTransaction']);
    Route::delete('/fund-transactions/{transaction}', [\App\Http\Controllers\FundController::class, 'destroyTransaction']);
    Route::get('/expenses', [\App\Http\Controllers\ExpenseController::class, 'index']);
    Route::post('/expenses', [\App\Http\Controllers\ExpenseController::class, 'store']);
    Route::post('/expenses/{expense}', [\App\Http\Controllers\ExpenseController::class, 'update']);
    Route::patch('/expenses/{expense}', [\App\Http\Controllers\ExpenseController::class, 'update']);
    Route::delete('/expenses/{expense}', [\App\Http\Controllers\ExpenseController::class, 'destroy']);
    Route::get('/roles', [\App\Http\Controllers\RoleController::class, 'index']);
    Route::post('/roles', [\App\Http\Controllers\RoleController::class, 'store']);
    Route::patch('/roles/{role}', [\App\Http\Controllers\RoleController::class, 'update']);
    Route::delete('/roles/{role}', [\App\Http\Controllers\RoleController::class, 'destroy']);
});
