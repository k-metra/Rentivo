<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingRequestStatusNotification extends Notification
{
    public function __construct(
        private readonly string $organizationName,
        private readonly string $customerName,
        private readonly string $requestReference,
        private readonly string $event,
        private readonly ?string $bookingReference = null,
        private readonly ?string $declineReason = null,
        private readonly ?string $portalUrl = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->greeting("Hello {$this->customerName}");

        if ($this->event === 'received') {
            $mail
                ->subject('Your rental request was received')
                ->line("{$this->organizationName} received your online booking request.")
                ->line("Request reference: {$this->requestReference}")
                ->line('This request is not a confirmed booking. No payment has been collected.');
        } elseif ($this->event === 'approved') {
            $mail
                ->subject('Your rental request was approved')
                ->line("{$this->organizationName} approved your online booking request.")
                ->line("Booking reference: {$this->bookingReference}")
                ->line('Payment has not been collected. Please contact the rental team to arrange payment.');
        } else {
            $mail
                ->subject('Update on your rental request')
                ->line("{$this->organizationName} could not approve your online booking request.")
                ->line("Request reference: {$this->requestReference}");
            if ($this->declineReason) {
                $mail->line("Reason: {$this->declineReason}");
            }
        }

        if ($this->portalUrl) {
            $mail
                ->line('You can securely view your booking history and request status online.')
                ->action('Open My Bookings', $this->portalUrl);
        }

        return $mail;
    }
}
