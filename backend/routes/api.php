<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\BookingPaymentController;
use App\Http\Controllers\BookingInspectionController;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\OrganizationUserController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BookingContractController;
use App\Http\Controllers\BookingRequestController;
use App\Http\Controllers\OrganizationSettingsController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\PartnerController;
use App\Http\Controllers\BookingSourceController;
use App\Http\Controllers\PublicBookingController;
use App\Http\Controllers\CustomerPortalController;
use App\Http\Controllers\SuperAdminController;

Route::post('/register', [RegistrationController::class, 'store']);
Route::post('/login', [RegistrationController::class, 'login']);
Route::post('/forgot-password', [PasswordResetController::class, 'sendLink'])->middleware('throttle:6,1');
Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:6,1');
Route::get('/booking-form/{slug}', [PublicBookingController::class, 'form']);
Route::get('/booking-form/{slug}/availability', [PublicBookingController::class, 'availability'])->middleware('throttle:30,1');
Route::get('/booking-form/{slug}/vehicles/{vehicleId}', [PublicBookingController::class, 'vehicleProfile'])->middleware('throttle:30,1');
Route::get('/booking-form/{slug}/vehicles/{vehicleId}/calendar', [PublicBookingController::class, 'vehicleCalendar'])->middleware('throttle:30,1');
Route::get('/booking-form/{slug}/estimate', [PublicBookingController::class, 'estimate'])->middleware('throttle:30,1');
Route::post('/booking-form/{slug}/requests', [PublicBookingController::class, 'submit'])->middleware('throttle:5,1');
Route::post('/booking-form/{slug}/customer-access-links', [CustomerPortalController::class, 'sendAccessLink'])->middleware('throttle:5,1');
Route::post('/booking-form/{slug}/customer-sessions', [CustomerPortalController::class, 'exchangeAccessLink'])->middleware('throttle:10,1');
Route::get('/booking-form/{slug}/customer-bookings', [CustomerPortalController::class, 'bookings'])->middleware('throttle:60,1');
Route::delete('/booking-form/{slug}/customer-sessions', [CustomerPortalController::class, 'destroySession'])->middleware('throttle:10,1');
Route::get('/contracts/{token}', [BookingContractController::class, 'viewPublic']);
Route::post('/contracts/{token}/verify', [BookingContractController::class, 'verifyPublic'])->middleware('throttle:10,1');
Route::post('/contracts/{token}/sign', [BookingContractController::class, 'signPublic'])->middleware('throttle:10,1');
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

Route::middleware(['auth:sanctum', 'subscription.active'])->prefix('dashboard')->group(function () {
    Route::get('/summary', [DashboardController::class, 'summary']);
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
    Route::get('/settings', [OrganizationSettingsController::class, 'show']);
    Route::post('/settings', [OrganizationSettingsController::class, 'update']);
    Route::get('/contract-templates', [BookingContractController::class, 'templates']);
    Route::post('/contract-templates', [BookingContractController::class, 'saveTemplate']);
    Route::delete('/contract-templates/{template}', [BookingContractController::class, 'deleteTemplate']);
    Route::get('/vehicles', [VehicleController::class, 'index']);
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customers/{customer}', [CustomerController::class, 'show']);
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::get('/payments', [BookingPaymentController::class, 'index']);
    Route::get('/users', [OrganizationUserController::class, 'index']);
    Route::post('/users', [OrganizationUserController::class, 'store']);
    Route::patch('/users/{user}', [OrganizationUserController::class, 'update']);
    Route::delete('/users/{user}', [OrganizationUserController::class, 'destroy']);
    Route::patch('/users/{user}/role', [OrganizationUserController::class, 'updateRole']);
    Route::get('/partners', [PartnerController::class, 'index']);
    Route::post('/partners', [PartnerController::class, 'store']);
    Route::put('/partners/{partner}', [PartnerController::class, 'update']);
    Route::delete('/partners/{partner}', [PartnerController::class, 'destroy']);
    Route::get('/booking-sources', [BookingSourceController::class, 'index']);
    Route::get('/booking-sources/stats', [BookingSourceController::class, 'stats']);
    Route::post('/booking-sources', [BookingSourceController::class, 'store']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::put('/bookings/{booking}', [BookingController::class, 'update']);
    Route::patch('/bookings/{booking}/status', [BookingController::class, 'updateStatus']);
    Route::get('/bookings/{booking}', [BookingController::class, 'show']);
    Route::get('/bookings/{booking}/contract', [BookingContractController::class, 'show']);
    Route::post('/bookings/{booking}/contract', [BookingContractController::class, 'generate']);
    Route::post('/bookings/{booking}/contract/staff-sign', [BookingContractController::class, 'signAsStaff']);
    Route::post('/bookings/{booking}/contract/revoke', [BookingContractController::class, 'revoke']);
    Route::get('/booking-requests', [BookingRequestController::class, 'index']);
    Route::post('/booking-requests/{bookingRequest}/approve', [BookingRequestController::class, 'approve']);
    Route::post('/booking-requests/{bookingRequest}/decline', [BookingRequestController::class, 'decline']);
    Route::get('/booking-requests/{bookingRequest}/documents/{document}', [BookingRequestController::class, 'downloadDocument']);
    Route::post('/bookings/{booking}/extensions', [BookingController::class, 'storeExtension']);
    Route::post('/bookings/{booking}/extensions/undo', [BookingController::class, 'undoExtension']);
    Route::post('/bookings/{booking}/payments', [BookingPaymentController::class, 'store']);
    Route::get('/bookings/{booking}/inspection', [BookingInspectionController::class, 'showPreInspection']);
    Route::post('/bookings/{booking}/inspection', [BookingInspectionController::class, 'savePreInspection']);
    Route::post('/bookings/{booking}/inspection/complete', [BookingInspectionController::class, 'completePreInspection']);
    Route::get('/bookings/{booking}/post-inspection', [BookingInspectionController::class, 'showPostInspection']);
    Route::post('/bookings/{booking}/post-inspection', [BookingInspectionController::class, 'savePostInspection']);
    Route::post('/bookings/{booking}/post-inspection/complete', [BookingInspectionController::class, 'completePostInspection']);
    Route::delete('/payments/{payment}', [BookingPaymentController::class, 'destroy']);
    Route::post('/vehicles', [VehicleController::class, 'store']);
    Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show']);
    Route::put('/vehicles/{vehicle}', [VehicleController::class, 'update']);
    Route::post('/vehicles/{vehicle}', [VehicleController::class, 'update']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::put('/customers/{customer}', [CustomerController::class, 'update']);
    Route::patch('/customers/{customer}/archive', [CustomerController::class, 'archive']);
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
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
