<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingRequest;
use App\Models\BookingRequestDocument;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Services\BookingAvailability;
use App\Services\BookingRequestNotifier;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingRequestController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    private function requirePermission(Request $request, string $permission): void
    {
        $organization = $this->organization($request);
        app(RolePermissionService::class)->abortUnless($request->user(), $organization, $permission);
    }

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Bookings View');
        $organization = $this->organization($request);
        $requests = BookingRequest::query()
            ->where('organization_id', $organization->id)
            ->with([
                'vehicle:id,name,brand,model,year,image_path',
                'documents:id,booking_request_id,category,original_name,mime_type,size,expires_at',
                'booking:id,reference,status',
            ])
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (BookingRequest $bookingRequest): array => $this->serialize($bookingRequest));

        return response()->json(['requests' => $requests]);
    }

    public function approve(Request $request, BookingRequest $bookingRequest): JsonResponse
    {
        $this->requirePermission($request, 'Bookings Create');
        $organization = $this->organization($request);
        abort_if($bookingRequest->organization_id !== $organization->id, 404);
        if ($bookingRequest->reservation_fee_amount) {
            $this->requirePermission($request, 'Bookings Payments');
        }
        $validated = $request->validate([
            'reservation_fee_confirmed' => ['nullable', 'boolean'],
        ]);
        $reservationFeeConfirmed = (bool) ($validated['reservation_fee_confirmed'] ?? false);

        $booking = DB::transaction(function () use ($request, $bookingRequest, $organization, $reservationFeeConfirmed): Booking {
            $bookingRequest = BookingRequest::query()
                ->where('organization_id', $organization->id)
                ->lockForUpdate()
                ->findOrFail($bookingRequest->id);
            abort_unless($bookingRequest->status === 'pending', 422, 'This request has already been reviewed.');
            abort_unless($bookingRequest->vehicle_id, 422, 'The requested vehicle is no longer available.');
            abort_unless(
                ! $bookingRequest->reservation_fee_amount || $reservationFeeConfirmed,
                422,
                'Confirm that the reservation-fee proof has been verified before approving this request.',
            );
            abort_unless(
                ! $bookingRequest->reservation_fee_amount || $bookingRequest->documents()
                    ->where('category', 'reservation_payment_proof')
                    ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                    ->exists(),
                422,
                'The reservation-fee proof is missing or expired.',
            );

            $vehicle = Vehicle::query()
                ->where('organization_id', $organization->id)
                ->lockForUpdate()
                ->findOrFail($bookingRequest->vehicle_id);
            app(BookingAvailability::class)->assertAvailable(
                $vehicle,
                $bookingRequest->pickup_at,
                $bookingRequest->return_at,
            );

            $customer = Customer::query()
                ->where('organization_id', $organization->id)
                ->whereRaw('LOWER(email) = ?', [strtolower($bookingRequest->customer_email)])
                ->first();
            if (! $customer) {
                $customer = Customer::create([
                    'organization_id' => $organization->id,
                    'name' => $bookingRequest->customer_name,
                    'email' => $bookingRequest->customer_email,
                    'phone' => $bookingRequest->customer_phone,
                    'address' => $bookingRequest->customer_address,
                    'social_profile_url' => $bookingRequest->customer_facebook_profile,
                    'referral_source' => $bookingRequest->referral_source,
                ]);
            } else {
                $customer->update([
                    'name' => $bookingRequest->customer_name,
                    'phone' => $bookingRequest->customer_phone,
                    'address' => $bookingRequest->customer_address,
                    'social_profile_url' => $bookingRequest->customer_facebook_profile,
                    'referral_source' => $bookingRequest->referral_source,
                ]);
            }

            $reservationFeeAmount = (float) ($bookingRequest->reservation_fee_amount ?? 0);
            $additionalCharges = $reservationFeeAmount > 0 && ! $bookingRequest->reservation_fee_deductible
                ? $reservationFeeAmount
                : 0;
            $totalAmount = (float) $bookingRequest->quoted_rental_amount + $additionalCharges;
            $paymentStatus = $reservationFeeAmount <= 0
                ? 'unpaid'
                : ($reservationFeeAmount >= $totalAmount ? 'paid' : 'partial');
            $remarks = trim(implode("\n", array_filter([
                $bookingRequest->remarks,
                "Online booking request {$bookingRequest->reference}",
                'Delivery method: '.$bookingRequest->delivery_method,
                $bookingRequest->professional_driver_requested ? 'Professional driver requested.' : null,
                $reservationFeeAmount > 0
                    ? 'Reservation fee verified and recorded: ₱'.number_format($reservationFeeAmount, 2, '.', ',')
                    : null,
            ])));
            $booking = Booking::create([
                'organization_id' => $organization->id,
                'created_by' => $request->user()->id,
                'reference' => 'RV-'.now()->format('Ymd').'-'.strtoupper(Str::random(6)),
                'customer_id' => $customer->id,
                'vehicle_id' => $vehicle->id,
                'pickup_at' => $bookingRequest->pickup_at,
                'return_at' => $bookingRequest->return_at,
                'rental_amount' => $bookingRequest->quoted_rental_amount,
                'additional_charges' => $additionalCharges,
                'total_amount' => $totalAmount,
                'destination_city' => $bookingRequest->destination_city,
                'destination_province' => $bookingRequest->destination_province,
                'remarks' => $remarks,
                'status' => now()->gte($bookingRequest->pickup_at) ? 'pre_inspection' : 'upcoming',
                'payment_status' => $paymentStatus,
                'delivery_method' => $bookingRequest->delivery_method,
                'professional_driver_requested' => $bookingRequest->professional_driver_requested,
            ]);

            if ($reservationFeeAmount > 0) {
                $booking->payments()->create([
                    'organization_id' => $organization->id,
                    'created_by' => $request->user()->id,
                    'amount' => $reservationFeeAmount,
                    'method' => 'online',
                    'status' => 'paid',
                    'paid_at' => now(),
                    'notes' => "Reservation fee verified from proof for request {$bookingRequest->reference}.",
                ]);
            }

            $bookingRequest->update([
                'status' => 'approved',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'booking_id' => $booking->id,
            ]);

            return $booking;
        });

        $bookingRequest = $bookingRequest->fresh();
        $notificationSent = app(BookingRequestNotifier::class)->send(
            $bookingRequest,
            'approved',
            $booking->reference,
        );

        return response()->json([
            'message' => $notificationSent
                ? 'Booking request approved.'
                : 'Booking request approved, but the customer email could not be sent.',
            'notification_sent' => $notificationSent,
            'booking' => $booking->load(['customer:id,name,email,phone', 'vehicle:id,brand,model']),
        ]);
    }

    public function decline(Request $request, BookingRequest $bookingRequest): JsonResponse
    {
        $this->requirePermission($request, 'Bookings Update');
        $organization = $this->organization($request);
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $bookingRequest = DB::transaction(function () use ($request, $bookingRequest, $organization, $validated): BookingRequest {
            $bookingRequest = BookingRequest::query()
                ->where('organization_id', $organization->id)
                ->lockForUpdate()
                ->findOrFail($bookingRequest->id);
            abort_unless($bookingRequest->status === 'pending', 422, 'This request has already been reviewed.');
            $bookingRequest->update([
                'status' => 'declined',
                'decline_reason' => $validated['reason'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            return $bookingRequest;
        });

        $notificationSent = app(BookingRequestNotifier::class)->send($bookingRequest, 'declined');

        return response()->json([
            'message' => $notificationSent
                ? 'Booking request declined.'
                : 'Booking request declined, but the customer email could not be sent.',
            'notification_sent' => $notificationSent,
            'booking_request' => $this->serialize($bookingRequest->load('documents')),
        ]);
    }

    public function downloadDocument(
        Request $request,
        BookingRequest $bookingRequest,
        BookingRequestDocument $document,
    ): StreamedResponse {
        $this->requirePermission($request, 'Bookings View');
        $organization = $this->organization($request);
        abort_if($bookingRequest->organization_id !== $organization->id, 404);
        abort_if($document->booking_request_id !== $bookingRequest->id, 404);
        abort_if($document->expires_at && $document->expires_at->isPast(), 410, 'This customer document has expired.');
        abort_unless(Storage::disk('local')->exists($document->file_path), 404);

        return Storage::disk('local')->download($document->file_path, $document->original_name, [
            'Content-Type' => $document->mime_type,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function serialize(BookingRequest $bookingRequest): array
    {
        return [
            'id' => $bookingRequest->id,
            'reference' => $bookingRequest->reference,
            'status' => $bookingRequest->status,
            'customer_name' => $bookingRequest->customer_name,
            'customer_email' => $bookingRequest->customer_email,
            'customer_phone' => $bookingRequest->customer_phone,
            'customer_address' => $bookingRequest->customer_address,
            'customer_facebook_profile' => $bookingRequest->customer_facebook_profile,
            'referral_source' => $bookingRequest->referral_source,
            'pickup_at' => $bookingRequest->pickup_at,
            'return_at' => $bookingRequest->return_at,
            'destination_city' => $bookingRequest->destination_city,
            'destination_province' => $bookingRequest->destination_province,
            'delivery_method' => $bookingRequest->delivery_method,
            'professional_driver_requested' => $bookingRequest->professional_driver_requested,
            'remarks' => $bookingRequest->remarks,
            'quoted_rental_amount' => $bookingRequest->quoted_rental_amount,
            'quoted_rental_breakdown' => $bookingRequest->quoted_rental_breakdown,
            'reservation_fee_amount' => $bookingRequest->reservation_fee_amount,
            'reservation_fee_deductible' => $bookingRequest->reservation_fee_deductible,
            'privacy_acknowledged_at' => $bookingRequest->privacy_acknowledged_at,
            'decline_reason' => $bookingRequest->decline_reason,
            'created_at' => $bookingRequest->created_at,
            'booking' => $bookingRequest->booking,
            'vehicle' => $bookingRequest->vehicle ? [
                'id' => $bookingRequest->vehicle->id,
                'name' => $bookingRequest->vehicle->name,
                'brand' => $bookingRequest->vehicle->brand,
                'model' => $bookingRequest->vehicle->model,
                'year' => $bookingRequest->vehicle->year,
                'image_url' => $bookingRequest->vehicle->image_url,
            ] : null,
            'documents' => $bookingRequest->documents
                ->filter(fn (BookingRequestDocument $document): bool => ! $document->expires_at || $document->expires_at->isFuture())
                ->map(fn (BookingRequestDocument $document): array => [
                    'id' => $document->id,
                    'category' => $document->category,
                    'original_name' => $document->original_name,
                    'mime_type' => $document->mime_type,
                    'size' => $document->size,
                    'download_url' => "/api/dashboard/booking-requests/{$bookingRequest->id}/documents/{$document->id}",
                ])
                ->values(),
        ];
    }
}
