<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerPortalAccessLinkNotification extends Notification
{
    public function __construct(
        private readonly string $organizationName,
        public readonly string $accessUrl,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Sign in to {$this->organizationName} bookings")
            ->line("Use this secure link to view your bookings with {$this->organizationName}.")
            ->action('View my bookings', $this->accessUrl)
            ->line('This link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.');
    }
}
