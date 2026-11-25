<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingRequest;
use App\Models\Customer;
use App\Models\CustomerPortalAccessLink;
use App\Models\CustomerPortalSession;
use App\Models\Organization;
use App\Notifications\CustomerPortalAccessLinkNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class CustomerPortalController extends Controller
{
    private function organization(string $slug): Organization
    {
        return Organization::query()
            ->where('online_booking_slug', $slug)
            ->firstOrFail();
    }

    public function sendAccessLink(Request $request, string $slug): JsonResponse
    {
        $organization = $this->organization($slug);
        $request->merge(['email' => trim((string) $request->input('email', ''))]);
        $validated = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
        ]);
        $email = strtolower(trim($validated['email']));

        $hasBookings = Customer::query()
            ->where('organization_id', $organization->id)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->exists();
        $hasRequests = BookingRequest::query()
            ->where('organization_id', $organization->id)
            ->whereRaw('LOWER(customer_email) = ?', [$email])
            ->exists();

        if ($hasBookings || $hasRequests) {
            $plainToken = Str::random(64);
            $expiresAt = now()->addMinutes(15);

            DB::transaction(function () use ($organization, $email, $plainToken, $expiresAt): void {
                CustomerPortalAccessLink::query()
                    ->where('organization_id', $organization->id)
                    ->where('email', $email)
                    ->whereNull('used_at')
                    ->update(['used_at' => now()]);

                CustomerPortalAccessLink::create([
                    'organization_id' => $organization->id,
                    'email' => $email,
                    'token_hash' => hash('sha256', $plainToken),
                    'expires_at' => $expiresAt,
                ]);
            });

            $accessUrl = rtrim((string) config('app.frontend_url'), '/')
                .'/booking/'.rawurlencode((string) $organization->online_booking_slug)
                .'/my-bookings#token='.rawurlencode($plainToken);

            try {
                Notification::route('mail', $email)
                    ->notify(new CustomerPortalAccessLinkNotification($organization->name, $accessUrl));
            } catch (TransportExceptionInterface $exception) {
                Log::error('Customer portal sign-in link could not be sent.', [
                    'organization_id' => $organization->id,
                    'email_hash' => hash('sha256', $email),
                    'exception' => $exception->getMessage(),
                ]);
            }
        }

        return response()->json([
            'message' => 'If we find bookings for that email, we will send a secure sign-in link.',
        ]);
    }

    public function exchangeAccessLink(Request $request, string $slug): JsonResponse
    {
        $organization = $this->organization($slug);
        $validated = $request->validate([
            'token' => ['required', 'string', 'size:64'],
        ]);
        $plainToken = $validated['token'];
        $sessionToken = Str::random(80);
        $sessionExpiresAt = now()->addDays(30);

        DB::transaction(function () use ($organization, $plainToken, $sessionToken, $sessionExpiresAt): void {
            $accessLink = CustomerPortalAccessLink::query()
                ->where('organization_id', $organization->id)
                ->where('token_hash', hash('sha256', $plainToken))
                ->whereNull('used_at')
                ->where('expires_at', '>', now())
                ->lockForUpdate()
                ->first();

            abort_if(! $accessLink, 422, 'This sign-in link is invalid or expired. Request a new one.');

            $accessLink->update(['used_at' => now()]);
            CustomerPortalSession::create([
                'organization_id' => $organization->id,
                'email' => $accessLink->email,
                'token_hash' => hash('sha256', $sessionToken),
                'expires_at' => $sessionExpiresAt,
            ]);
        });

        return response()->json([
            'token' => $sessionToken,
            'expires_at' => $sessionExpiresAt->toIso8601String(),
        ]);
    }

    public function bookings(Request $request, string $slug): JsonResponse
    {
        $organization = $this->organization($slug);
        $session = $this->resolveSession($request, $organization);
        $customerIds = Customer::query()
            ->where('organization_id', $organization->id)
            ->whereRaw('LOWER(email) = ?', [$session->email])
            ->select('id');

        $bookings = Booking::query()
            ->where('organization_id', $organization->id)
            ->whereIn('customer_id', $customerIds)
            ->with('vehicle:id,brand,model')
            ->orderByDesc('pickup_at')
            ->get()
            ->map(fn (Booking $booking): array => [
                'reference' => $booking->reference,
                'vehicle' => $booking->vehicle
                    ? trim($booking->vehicle->brand.' '.$booking->vehicle->model)
                    : 'Vehicle unavailable',
                'pickup_at' => $booking->pickup_at?->toIso8601String(),
                'return_at' => $booking->return_at?->toIso8601String(),
                'status' => $booking->status,
                'payment_status' => $booking->payment_status,
                'total_amount' => $booking->total_amount,
            ])
            ->values();

        $requests = BookingRequest::query()
            ->where('organization_id', $organization->id)
            ->whereRaw('LOWER(customer_email) = ?', [$session->email])
            ->whereNull('booking_id')
            ->whereIn('status', ['pending', 'declined'])
            ->with('vehicle:id,brand,model')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (BookingRequest $bookingRequest): array => [
                'reference' => $bookingRequest->reference,
                'vehicle' => $bookingRequest->vehicle
                    ? trim($bookingRequest->vehicle->brand.' '.$bookingRequest->vehicle->model)
                    : 'Vehicle unavailable',
                'pickup_at' => $bookingRequest->pickup_at?->toIso8601String(),
                'return_at' => $bookingRequest->return_at?->toIso8601String(),
                'status' => $bookingRequest->status,
                'decline_reason' => $bookingRequest->decline_reason,
            ])
            ->values();

        return response()->json([
            'organization_name' => $organization->name,
            'currency' => $organization->currency ?: 'PHP',
            'bookings' => $bookings,
            'requests' => $requests,
        ]);
    }

    public function destroySession(Request $request, string $slug): JsonResponse
    {
        $organization = $this->organization($slug);
        $session = $this->resolveSession($request, $organization);
        $session->delete();

        return response()->json(['message' => 'You have been signed out.']);
    }

    private function resolveSession(Request $request, Organization $organization): CustomerPortalSession
    {
        $plainToken = $request->bearerToken();
        abort_unless(is_string($plainToken) && strlen($plainToken) === 80, 401, 'Your customer portal session has expired. Request a new sign-in link.');

        $session = CustomerPortalSession::query()
            ->where('organization_id', $organization->id)
            ->where('token_hash', hash('sha256', $plainToken))
            ->where('expires_at', '>', now())
            ->first();
        abort_unless($session, 401, 'Your customer portal session has expired. Request a new sign-in link.');

        $session->update(['last_used_at' => now()]);

        return $session;
    }
}
