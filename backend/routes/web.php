<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/email/verify/{id}/{hash}', function (string $id, string $hash) {
    $user = User::findOrFail($id);

    abort_unless(
        hash_equals((string) $hash, sha1($user->getEmailForVerification())),
        403,
    );

    if (! $user->hasVerifiedEmail()) {
        $user->markEmailAsVerified();
    }

    return redirect(env('FRONTEND_URL', 'http://localhost:5173').'/?verified=1');
})->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
