<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingRequest;
use App\Models\Customer;
use App\Models\CustomerPortalAccessLink;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Notifications\CustomerPortalAccessLinkNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CustomerPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_redeem_a_single_use_link_and_only_see_bookings_for_that_company(): void
    {
        Notification::fake();

        $organization = $this->createOrganization('portal-rentals');
        $otherOrganization = $this->createOrganization('other-rentals');
        $vehicle = $this->createVehicle($organization, 'PORTAL-1');
        $otherVehicle = $this->createVehicle($otherOrganization, 'PORTAL-2');
        $customer = Customer::create([
            'organization_id' => $organization->id,
            'name' => 'Portal Customer',
            'email' => 'customer@example.com',
        ]);
        $otherCustomer = Customer::create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Portal Customer',
            'email' => 'customer@example.com',
        ]);
        $booking = $this->createBooking($organization, $customer, $vehicle, 'PORTAL-BOOK-1');
        $this->createBooking($otherOrganization, $otherCustomer, $otherVehicle, 'PORTAL-BOOK-2');
        BookingRequest::create([
            'organization_id' => $organization->id,
            'vehicle_id' => $vehicle->id,
            'reference' => 'PORTAL-REQUEST-1',
            'customer_name' => 'Portal Customer',
            'customer_email' => 'customer@example.com',
            'customer_phone' => '+639000000000',
            'pickup_at' => now()->addDays(5),
            'return_at' => now()->addDays(7),
            'delivery_method' => 'renter_pickup_renter_return',
            'quoted_rental_amount' => 2500,
            'status' => 'pending',
        ]);

        $genericMessage = 'If we find bookings for that email, we will send a secure sign-in link.';
        $this->postJson('/api/booking-form/portal-rentals/customer-access-links', [
            'email' => ' Customer@Example.com ',
        ])->assertOk()->assertJsonPath('message', $genericMessage);

        $accessUrl = null;
        Notification::assertSentOnDemand(
            CustomerPortalAccessLinkNotification::class,
            function (CustomerPortalAccessLinkNotification $notification) use (&$accessUrl): bool {
                $accessUrl = $notification->accessUrl;

                return true;
            },
        );
        $this->assertIsString($accessUrl);
        parse_str((string) parse_url($accessUrl, PHP_URL_FRAGMENT), $fragment);
        $linkToken = $fragment['token'] ?? '';
        $this->assertNotSame('', $linkToken);

        $sessionToken = $this->postJson('/api/booking-form/portal-rentals/customer-sessions', [
            'token' => $linkToken,
        ])->assertOk()->json('token');
        $this->assertIsString($sessionToken);
        $this->assertNotNull(CustomerPortalAccessLink::query()
            ->where('organization_id', $organization->id)
            ->where('email', 'customer@example.com')
            ->value('used_at'));

        $this->postJson('/api/booking-form/portal-rentals/customer-sessions', [
            'token' => $linkToken,
        ])->assertUnprocessable();

        $this->getJson('/api/booking-form/portal-rentals/customer-bookings', [
            'Authorization' => 'Bearer '.$sessionToken,
        ])
            ->assertOk()
            ->assertJsonPath('organization_name', $organization->name)
            ->assertJsonCount(1, 'bookings')
            ->assertJsonPath('bookings.0.reference', $booking->reference)
            ->assertJsonMissingPath('bookings.0.customer_email')
            ->assertJsonCount(1, 'requests')
            ->assertJsonPath('requests.0.reference', 'PORTAL-REQUEST-1');

        $this->deleteJson('/api/booking-form/portal-rentals/customer-sessions', [], [
            'Authorization' => 'Bearer '.$sessionToken,
        ])->assertOk();
        $this->getJson('/api/booking-form/portal-rentals/customer-bookings', [
            'Authorization' => 'Bearer '.$sessionToken,
        ])->assertUnauthorized();
    }

    public function test_unknown_email_gets_the_same_generic_response_without_sending_a_link(): void
    {
        Notification::fake();
        $this->createOrganization('portal-rentals');

        $this->postJson('/api/booking-form/portal-rentals/customer-access-links', [
            'email' => 'unknown@example.com',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'If we find bookings for that email, we will send a secure sign-in link.');

        Notification::assertNothingSent();
        $this->assertDatabaseCount('customer_portal_access_links', 0);
    }

    private function createOrganization(string $slug): Organization
    {
        return Organization::create([
            'name' => str($slug)->replace('-', ' ')->title()->toString(),
            'slug' => $slug,
            'online_booking_slug' => $slug,
            'currency' => 'PHP',
        ]);
    }

    private function createVehicle(Organization $organization, string $plate): Vehicle
    {
        return Vehicle::create([
            'organization_id' => $organization->id,
            'brand' => 'Toyota',
            'model' => 'Vios',
            'year' => 2025,
            'plate_number' => $plate,
            'daily_rate' => 1200,
            'status' => 'available',
        ]);
    }

    private function createBooking(
        Organization $organization,
        Customer $customer,
        Vehicle $vehicle,
        string $reference,
    ): Booking {
        return Booking::create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'reference' => $reference,
            'pickup_at' => now()->addDays(2),
            'return_at' => now()->addDays(4),
            'rental_amount' => 2400,
            'additional_charges' => 0,
            'total_amount' => 2400,
            'status' => 'upcoming',
            'payment_status' => 'unpaid',
        ]);
    }
}
