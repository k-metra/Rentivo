<?php

namespace App\Services;

use App\Models\BookingRequest;
use App\Notifications\BookingRequestStatusNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class BookingRequestNotifier
{
    public function send(
        BookingRequest $bookingRequest,
        string $event,
        ?string $bookingReference = null,
    ): bool {
        try {
            $organization = $bookingRequest->organization;
            $portalUrl = $organization?->online_booking_slug
                ? rtrim((string) config('app.frontend_url'), '/').'/booking/'.$organization->online_booking_slug.'/my-bookings'
                : null;
            Notification::route('mail', $bookingRequest->customer_email)
                ->notify(new BookingRequestStatusNotification(
                    $organization?->name ?? 'The rental company',
                    $bookingRequest->customer_name,
                    $bookingRequest->reference,
                    $event,
                    $bookingReference,
                    $bookingRequest->decline_reason,
                    $portalUrl,
                ));

            return true;
        } catch (TransportExceptionInterface $exception) {
            Log::error('Booking request status email could not be sent.', [
                'request_reference' => $bookingRequest->reference,
                'event' => $event,
                'exception' => $exception->getMessage(),
            ]);

            return false;
        }
    }
}
