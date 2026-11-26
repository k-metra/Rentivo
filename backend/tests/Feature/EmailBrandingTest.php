<?php

namespace Tests\Feature;

use Illuminate\Mail\Markdown;
use Tests\TestCase;

class EmailBrandingTest extends TestCase
{
    public function test_notification_emails_use_rentivo_branding_in_html_and_text(): void
    {
        $data = [
            'greeting' => 'Hello, Alex',
            'introLines' => ['Please verify your email address.'],
            'outroLines' => [],
            'actionText' => 'Verify email address',
            'actionUrl' => 'https://rentivo.test/verify',
            'displayableActionUrl' => 'https://rentivo.test/verify',
            'level' => 'default',
            'salutation' => null,
        ];
        $markdown = app(Markdown::class);

        $html = $markdown->render('notifications::email', $data)->toHtml();
        $text = $markdown->renderText('notifications::email', $data);

        $this->assertStringContainsString('<title>Rentivo</title>', $html);
        $this->assertStringContainsString('Rentivo', $html);
        $this->assertStringContainsString('The Rentivo team', $html);
        $this->assertStringContainsString('#5b21b6', $html);
        $this->assertStringContainsString('Contact Rentivo support', $html);
        $this->assertStringContainsString('https://rentivo.test/verify', $html);
        $this->assertStringNotContainsString('laravel.com/img/notification', $html);
        $this->assertStringNotContainsString('Laravel', $html);
        $this->assertStringContainsString('Rentivo', $text);
        $this->assertStringContainsString('Vehicle rentals, made simple.', $text);
        $this->assertStringContainsString('The Rentivo team', $text);
        $this->assertStringContainsString('Contact Rentivo support', $text);
        $this->assertStringContainsString('https://rentivo.test/verify', $text);
        $this->assertStringNotContainsString('Laravel', $text);
    }
}
