<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingExtension;
use App\Models\BookingRequest;
use App\Models\BookingRequestDocument;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationRole;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleImage;
use App\Models\VehicleRentalRate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OnlineBookingTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_form_only_returns_safe_data_for_an_eligible_enabled_organization(): void
    {
        [$organization, $owner] = $this->createWorkspace('Public Form');
        $organization->update([
            'address' => '123 Example Road',
            'primary_color' => '#123456',
            'online_booking_requirements' => ['primary_id'],
            'delivery_methods' => ['renter_pickup_renter_return'],
            'professional_driver_enabled' => true,
        ]);
        $vehicle = $this->createVehicle($organization, 'PUBLIC-1');
        $vehicle->update([
            'image_path' => 'vehicles/internal-icon.png',
            'marketing_image_path' => 'vehicles/marketing-photo.png',
        ]);
        Config::set('app.frontend_url', 'https://rentivo.example');
        Sanctum::actingAs($owner);

        $this->getJson('/api/dashboard/settings')
            ->assertOk()
            ->assertJsonPath('online_booking_eligible', true)
            ->assertJsonPath('online_booking_full_website_eligible', true)
            ->assertJsonPath('online_booking_url', 'https://rentivo.example/booking/public-form');

        $this->getJson('/api/booking-form/public-form')
            ->assertOk()
            ->assertJsonPath('website_tier', 'full')
            ->assertJsonPath('organization.name', 'Public Form')
            ->assertJsonPath('organization.address', '123 Example Road')
            ->assertJsonPath('organization.primary_color', '#123456')
            ->assertJsonPath('fleet.0.brand', 'Toyota')
            ->assertJsonPath('fleet.0.image_url', $vehicle->image_url)
            ->assertJsonPath('fleet.0.marketing_image_url', $vehicle->marketing_image_url)
            ->assertJsonMissingPath('fleet.0.plate_number')
            ->assertJsonPath('requirements.0', 'primary_id')
            ->assertJsonPath('delivery_methods.0', 'renter_pickup_renter_return')
            ->assertJsonPath('professional_driver_enabled', true)
            ->assertJsonMissingPath('organization.plan')
            ->assertJsonMissingPath('organization.subscription_status');

        $organization->update(['online_booking_enabled' => false]);
        $this->getJson('/api/booking-form/public-form')->assertNotFound();

        $organization->update([
            'online_booking_enabled' => true,
            'plan' => 'Solo',
        ]);
        $this->getJson('/api/booking-form/public-form')->assertNotFound();
    }

    public function test_growth_plan_receives_basic_booking_website_and_cannot_customize_full_website(): void
    {
        [$organization, $owner] = $this->createWorkspace('Growth Booking');
        $organization->update(['plan' => 'Growth']);
        Sanctum::actingAs($owner);

        $this->getJson('/api/dashboard/settings')
            ->assertOk()
            ->assertJsonPath('online_booking_eligible', true)
            ->assertJsonPath('online_booking_full_website_eligible', false);

        $this->getJson('/api/booking-form/growth-booking')
            ->assertOk()
            ->assertJsonPath('website_tier', 'basic')
            ->assertJsonPath('fleet', []);

        $this->postJson('/api/dashboard/settings', [
            'name' => $organization->name,
            'online_booking_enabled' => true,
        ])
            ->assertOk()
            ->assertJsonPath('online_booking_enabled', true);

        $this->postJson('/api/dashboard/settings', [
            'name' => $organization->name,
            'online_booking_enabled' => true,
            'online_booking_hero_title' => 'A custom full-site headline',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Full website customization is available on Professional plans and above.');
    }

    public function test_professional_plan_can_customize_public_website_hero_and_banner(): void
    {
        Storage::fake('public');
        [$organization, $owner] = $this->createWorkspace('Full Website');
        Sanctum::actingAs($owner);

        $banner = UploadedFile::fake()->createWithContent(
            'fleet-banner.png',
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
        );
        $this->post('/api/dashboard/settings', [
            'name' => $organization->name,
            'online_booking_enabled' => true,
            'online_booking_hero_title' => 'Road trips made easy',
            'online_booking_hero_subtitle' => 'Choose a vehicle for your next trip.',
            'online_booking_banner' => $banner,
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('online_booking_hero_title', 'Road trips made easy')
            ->assertJsonPath('online_booking_hero_subtitle', 'Choose a vehicle for your next trip.')
            ->assertJsonPath('online_booking_full_website_eligible', true);

        $organization->refresh();
        Storage::disk('public')->assertExists($organization->online_booking_banner_path);

        $this->getJson('/api/booking-form/full-website')
            ->assertOk()
            ->assertJsonPath('website_tier', 'full')
            ->assertJsonPath('organization.hero_title', 'Road trips made easy')
            ->assertJsonPath('organization.hero_subtitle', 'Choose a vehicle for your next trip.')
            ->assertJsonPath(
                'organization.banner_url',
                'http://localhost:8000/storage/'.$organization->online_booking_banner_path,
            );
    }

    public function test_online_booking_settings_publish_fixed_reservation_fee_instructions_and_qr(): void
    {
        Storage::fake('public');
        [$organization, $owner] = $this->createWorkspace('Reservation Settings');
        Sanctum::actingAs($owner);

        $this->post('/api/dashboard/settings', [
            'name' => $organization->name,
            'online_booking_enabled' => true,
            'online_booking_reservation_fee_amount' => 500,
            'online_booking_reservation_fee_deductible' => '0',
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Add payment instructions or a QR code before setting a reservation fee.');

        $qrCode = UploadedFile::fake()->createWithContent(
            'payment-qr.png',
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
        );
        $this->post('/api/dashboard/settings', [
            'name' => $organization->name,
            'online_booking_enabled' => true,
            'online_booking_reservation_fee_amount' => 500,
            'online_booking_reservation_fee_deductible' => '0',
            'online_booking_reservation_payment_instructions' => 'Send the fee to the displayed payment channel.',
            'online_booking_reservation_qr' => $qrCode,
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('online_booking_reservation_fee_amount', '500.00')
            ->assertJsonPath('online_booking_reservation_fee_deductible', false)
            ->assertJsonPath('online_booking_reservation_payment_instructions', 'Send the fee to the displayed payment channel.');

        $organization->refresh();
        Storage::disk('public')->assertExists($organization->online_booking_reservation_qr_path);
        $this->getJson('/api/booking-form/'.$organization->online_booking_slug)
            ->assertOk()
            ->assertJsonPath('reservation_fee.amount', 500)
            ->assertJsonPath('reservation_fee.deductible', false)
            ->assertJsonPath('reservation_fee.instructions', 'Send the fee to the displayed payment channel.')
            ->assertJsonPath(
                'reservation_fee.qr_url',
                'http://localhost:8000/storage/'.$organization->online_booking_reservation_qr_path,
            );
    }

    public function test_public_availability_excludes_maintenance_and_effective_booking_overlaps(): void
    {
        [$organization, $owner] = $this->createWorkspace('Availability');
        $freeVehicle = $this->createVehicle($organization, 'FREE-1');
        $occupiedVehicle = $this->createVehicle($organization, 'OCC-1');
        $extendedVehicle = $this->createVehicle($organization, 'EXT-1');
        $this->createVehicle($organization, 'SHOP-1', 'maintenance');
        $pickupAt = now()->addDays(5)->startOfHour();
        $returnAt = $pickupAt->copy()->addDay();

        $this->createBooking($organization, $owner, $occupiedVehicle, $pickupAt->copy()->subHours(2), $returnAt->copy()->addHours(2));
        $extendedBooking = $this->createBooking(
            $organization,
            $owner,
            $extendedVehicle,
            $pickupAt->copy()->subDays(2),
            $pickupAt->copy()->subDay(),
        );
        BookingExtension::create([
            'booking_id' => $extendedBooking->id,
            'created_by' => $owner->id,
            'previous_return_at' => $extendedBooking->return_at,
            'new_return_at' => $pickupAt->copy()->addHours(2),
            'fee' => 100,
            'pricing_mode' => 'hourly',
        ]);

        $response = $this->getJson('/api/booking-form/availability/availability?pickup_at='
            .urlencode($pickupAt->toDateTimeString()).'&return_at='.urlencode($returnAt->toDateTimeString()))
            ->assertOk()
            ->assertJsonCount(1, 'vehicles')
            ->assertJsonPath('vehicles.0.id', $freeVehicle->id);

        $this->assertArrayNotHasKey('plate_number', $response->json('vehicles.0'));
    }

    public function test_public_vehicle_profile_exposes_gallery_and_only_booked_date_ranges(): void
    {
        [$organization, $owner] = $this->createWorkspace('Vehicle Profile');
        $vehicle = $this->createVehicle($organization, 'PROFILE-1');
        $vehicle->update([
            'image_path' => 'vehicles/internal-icon.png',
            'marketing_image_path' => 'vehicles/marketing-photo.png',
        ]);
        VehicleImage::create([
            'vehicle_id' => $vehicle->id,
            'category' => 'interior',
            'image_path' => 'vehicles/gallery/interior.png',
            'sort_order' => 0,
        ]);
        VehicleImage::create([
            'vehicle_id' => $vehicle->id,
            'category' => 'interior_front',
            'image_path' => 'vehicles/gallery/interior-front.png',
            'sort_order' => 1,
        ]);
        $pickupAt = now()->addDays(8)->startOfHour();
        $returnAt = $pickupAt->copy()->addDay();
        $this->createBooking($organization, $owner, $vehicle, $pickupAt, $returnAt);

        $this->getJson("/api/booking-form/{$organization->online_booking_slug}/vehicles/{$vehicle->id}")
            ->assertOk()
            ->assertJsonPath('vehicle.id', $vehicle->id)
            ->assertJsonPath('vehicle.image_url', $vehicle->image_url)
            ->assertJsonPath('vehicle.marketing_image_url', $vehicle->marketing_image_url)
            ->assertJsonPath('vehicle.images.0.category', 'interior')
            ->assertJsonPath('vehicle.images.1.category', 'interior_front')
            ->assertJsonMissingPath('vehicle.plate_number');

        $this->getJson("/api/booking-form/{$organization->online_booking_slug}/vehicles/{$vehicle->id}/calendar")
            ->assertOk()
            ->assertJsonPath('booked_ranges.0.start', $pickupAt->toIso8601String())
            ->assertJsonPath('booked_ranges.0.end', $returnAt->toIso8601String())
            ->assertJsonMissingPath('booked_ranges.0.booking_id');
    }

    public function test_public_estimate_returns_a_rate_and_outside_area_breakdown(): void
    {
        [$organization] = $this->createWorkspace('Price Estimate');
        $vehicle = $this->createVehicle($organization, 'PRICE-1');
        $vehicle->update(['security_deposit' => 2000]);
        VehicleRentalRate::create([
            'vehicle_id' => $vehicle->id,
            'duration_hours' => 24,
            'location_scope' => 'all',
            'amount' => 1500,
            'amount_type' => 'fixed',
            'outside_amount' => 200,
            'coverage_type' => 'province',
            'coverage_locations' => ['Metro Manila'],
        ]);
        $pickupAt = now()->addDays(6)->startOfHour();
        $returnAt = $pickupAt->copy()->addDay();

        $this->getJson('/api/booking-form/'.$organization->online_booking_slug.'/estimate?'.http_build_query([
            'vehicle_id' => $vehicle->id,
            'pickup_at' => $pickupAt->toDateTimeString(),
            'return_at' => $returnAt->toDateTimeString(),
            'destination_province' => 'Cavite',
        ]))
            ->assertOk()
            ->assertJsonPath('estimate.rental_amount', 1700)
            ->assertJsonPath('estimate.daily_rate', 1500)
            ->assertJsonPath('estimate.security_deposit', 2000)
            ->assertJsonPath('estimate.breakdown.0.label', '24-hour rental rate')
            ->assertJsonPath('estimate.breakdown.1.label', 'Outside-area charge')
            ->assertJsonPath('estimate.breakdown.1.amount', 200);
    }

    public function test_reservation_fee_proof_is_private_and_staff_confirmation_records_online_payment(): void
    {
        Notification::fake();
        Storage::fake('local');
        [$organization, $owner] = $this->createWorkspace('Reservation Fee');
        $organization->update([
            'online_booking_reservation_fee_amount' => 500,
            'online_booking_reservation_fee_deductible' => false,
            'online_booking_reservation_payment_instructions' => 'Send the fee to the listed account.',
        ]);
        $vehicle = $this->createVehicle($organization, 'FEE-1');
        $payload = $this->publicRequestPayload($vehicle);
        $payload['reservation_payment_proof'] = UploadedFile::fake()->create('payment-proof.pdf', 30, 'application/pdf');

        $submitted = $this->post('/api/booking-form/'.$organization->online_booking_slug.'/requests', $payload, ['Accept' => 'application/json'])
            ->assertCreated();
        $bookingRequest = BookingRequest::query()->where('reference', $submitted->json('reference'))->firstOrFail();
        $proof = $bookingRequest->documents()->where('category', 'reservation_payment_proof')->firstOrFail();
        Storage::disk('local')->assertExists($proof->file_path);
        $this->assertSame('500.00', $bookingRequest->reservation_fee_amount);
        $this->assertFalse($bookingRequest->reservation_fee_deductible);

        Sanctum::actingAs($owner);
        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Confirm that the reservation-fee proof has been verified before approving this request.');

        $approved = $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve", [
            'reservation_fee_confirmed' => true,
        ])->assertOk()
            ->assertJsonPath('booking.payment_status', 'partial')
            ->assertJsonPath('booking.total_amount', number_format((float) $bookingRequest->quoted_rental_amount + 500, 2, '.', ''));

        $booking = Booking::query()->findOrFail($approved->json('booking.id'));
        $this->assertDatabaseHas('payments', [
            'booking_id' => $booking->id,
            'amount' => 500,
            'method' => 'online',
            'status' => 'paid',
        ]);
        $this->assertDatabaseHas('customers', [
            'id' => $booking->customer_id,
            'address' => '12 Rental Street, Makati',
            'social_profile_url' => 'https://facebook.com/customer',
            'referral_source' => 'Facebook',
        ]);
    }

    public function test_public_request_requires_privacy_acknowledgment_and_fee_proof(): void
    {
        [$organization] = $this->createWorkspace('Privacy Required');
        $vehicle = $this->createVehicle($organization, 'CONSENT-1');
        $payload = $this->publicRequestPayload($vehicle);
        unset($payload['privacy_acknowledged']);

        $this->post('/api/booking-form/'.$organization->online_booking_slug.'/requests', $payload, ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['privacy_acknowledged']);

        $organization->update([
            'online_booking_reservation_fee_amount' => 300,
            'online_booking_reservation_payment_instructions' => 'Use the provided payment account.',
        ]);
        $payload = $this->publicRequestPayload($vehicle);
        $this->post('/api/booking-form/'.$organization->online_booking_slug.'/requests', $payload, ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reservation_payment_proof']);
    }

    public function test_public_request_rejects_combined_attachments_above_upload_limit(): void
    {
        [$organization] = $this->createWorkspace('Large Request Attachments');
        $vehicle = $this->createVehicle($organization, 'LARGE-1');
        $payload = $this->publicRequestPayload($vehicle);
        $payload['documents'] = [
            'primary_id' => UploadedFile::fake()->create('primary-id.pdf', 1800, 'application/pdf'),
            'secondary_id' => UploadedFile::fake()->create('secondary-id.pdf', 1800, 'application/pdf'),
            'proof_of_billing' => UploadedFile::fake()->create('proof-of-billing.pdf', 1800, 'application/pdf'),
            'ltms_screenshots' => UploadedFile::fake()->create('ltms.pdf', 1800, 'application/pdf'),
        ];

        $this->post('/api/booking-form/'.$organization->online_booking_slug.'/requests', $payload, ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['documents']);
    }

    public function test_reservation_fee_approval_requires_payment_permission(): void
    {
        Notification::fake();
        Storage::fake('local');
        [$organization] = $this->createWorkspace('Fee Permissions');
        $organization->update([
            'online_booking_reservation_fee_amount' => 250,
            'online_booking_reservation_payment_instructions' => 'Use the listed payment channel.',
        ]);
        $vehicle = $this->createVehicle($organization, 'FEE-PERM-1');
        $payload = $this->publicRequestPayload($vehicle);
        $payload['reservation_payment_proof'] = UploadedFile::fake()->create('payment-proof.pdf', 20, 'application/pdf');
        $submitted = $this->post('/api/booking-form/'.$organization->online_booking_slug.'/requests', $payload, ['Accept' => 'application/json'])
            ->assertCreated();
        $bookingRequest = BookingRequest::query()->where('reference', $submitted->json('reference'))->firstOrFail();

        $role = OrganizationRole::create([
            'organization_id' => $organization->id,
            'name' => 'Booking Creator',
            'permissions' => ['Bookings Create'],
            'is_owner' => false,
            'is_active' => true,
        ]);
        $staff = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($staff->id, ['role' => 'staff', 'role_id' => $role->id]);
        Sanctum::actingAs($staff);

        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve", [
            'reservation_fee_confirmed' => true,
        ])->assertForbidden();

        $this->assertSame('pending', $bookingRequest->fresh()->status);
        $this->assertDatabaseCount('bookings', 0);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_public_submission_requires_configured_documents_and_stores_them_privately(): void
    {
        Notification::fake();
        Storage::fake('local');
        Storage::fake('public');
        [$organization] = $this->createWorkspace('Document Request');
        $organization->update([
            'online_booking_requirements' => ['primary_id'],
            'delivery_methods' => ['renter_pickup_renter_return'],
        ]);
        $vehicle = $this->createVehicle($organization, 'DOC-1');
        $payload = $this->publicRequestPayload($vehicle);

        $this->post('/api/booking-form/document-request/requests', $payload, ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['documents.primary_id']);
        $this->assertDatabaseCount('booking_requests', 0);

        $payload['documents'] = [
            'primary_id' => UploadedFile::fake()->create('primary-id.pdf', 30, 'application/pdf'),
        ];
        $response = $this->post('/api/booking-form/document-request/requests', $payload, ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonStructure(['reference', 'message'])
            ->assertJsonPath('message', 'Your request has been received. The rental is not confirmed until the company approves it.');

        $bookingRequest = BookingRequest::query()->where('reference', $response->json('reference'))->firstOrFail();
        $document = BookingRequestDocument::query()->where('booking_request_id', $bookingRequest->id)->firstOrFail();
        Storage::disk('local')->assertExists($document->file_path);
        Storage::disk('public')->assertMissing($document->file_path);
        $this->assertSame('pending', $bookingRequest->status);
        $this->assertSame('Pending Request', $bookingRequest->customer_name);
        $this->assertDatabaseCount('bookings', 0);
        Notification::assertSentOnDemand(\App\Notifications\BookingRequestStatusNotification::class);
    }

    public function test_approval_creates_a_booking_and_private_documents_are_staff_only(): void
    {
        Notification::fake();
        Storage::fake('local');
        [$organization, $owner] = $this->createWorkspace('Approve Request');
        $organization->update([
            'online_booking_requirements' => ['primary_id'],
            'delivery_methods' => ['owner_delivery_renter_return'],
            'professional_driver_enabled' => true,
        ]);
        $vehicle = $this->createVehicle($organization, 'APP-1');
        $payload = array_merge($this->publicRequestPayload($vehicle), [
            'delivery_method' => 'owner_delivery_renter_return',
            'professional_driver' => '1',
            'destination_province' => 'Metro Manila',
            'destination_city' => 'Makati',
            'documents' => [
                'primary_id' => UploadedFile::fake()->create('customer-id.pdf', 40, 'application/pdf'),
            ],
        ]);
        $submitted = $this->post('/api/booking-form/approve-request/requests', $payload, ['Accept' => 'application/json'])
            ->assertCreated();
        $bookingRequest = BookingRequest::query()->where('reference', $submitted->json('reference'))->firstOrFail();
        $document = $bookingRequest->documents()->firstOrFail();

        Sanctum::actingAs($owner);
        $this->getJson('/api/dashboard/booking-requests')
            ->assertOk()
            ->assertJsonPath('requests.0.customer_email', 'customer@example.com')
            ->assertJsonPath('requests.0.documents.0.category', 'primary_id')
            ->assertJsonMissingPath('requests.0.documents.0.file_path');

        $this->get("/api/dashboard/booking-requests/{$bookingRequest->id}/documents/{$document->id}", [
            'Accept' => 'application/pdf',
        ])->assertOk();

        $approval = $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Booking request approved.')
            ->assertJsonPath('booking.customer.email', 'customer@example.com')
            ->assertJsonPath('booking.vehicle.id', $vehicle->id)
            ->assertJsonPath('booking.delivery_method', 'owner_delivery_renter_return')
            ->assertJsonPath('booking.professional_driver_requested', true)
            ->assertJsonPath('booking.payment_status', 'unpaid')
            ->assertJsonPath('booking.status', 'upcoming');

        $bookingRequest->refresh();
        $this->assertSame('approved', $bookingRequest->status);
        $this->assertSame($approval->json('booking.id'), $bookingRequest->booking_id);
        $this->assertDatabaseCount('customers', 1);
        $this->assertDatabaseCount('bookings', 1);
        $this->assertDatabaseHas('bookings', [
            'id' => $bookingRequest->booking_id,
            'rental_amount' => $bookingRequest->quoted_rental_amount,
            'destination_city' => 'Makati',
            'destination_province' => 'Metro Manila',
        ]);
        Notification::assertSentOnDemand(\App\Notifications\BookingRequestStatusNotification::class);

        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This request has already been reviewed.');
    }

    public function test_approval_rechecks_availability_and_leaves_conflicting_request_pending(): void
    {
        [$organization, $owner] = $this->createWorkspace('Stale Availability');
        $vehicle = $this->createVehicle($organization, 'STALE-1');
        $payload = $this->publicRequestPayload($vehicle);
        $submitted = $this->post('/api/booking-form/stale-availability/requests', $payload, ['Accept' => 'application/json'])
            ->assertCreated();
        $bookingRequest = BookingRequest::query()->where('reference', $submitted->json('reference'))->firstOrFail();

        $this->createBooking($organization, $owner, $vehicle, $bookingRequest->pickup_at, $bookingRequest->return_at);
        Sanctum::actingAs($owner);

        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['vehicle_id']);

        $this->assertSame('pending', $bookingRequest->fresh()->status);
        $this->assertDatabaseCount('bookings', 1);
        $this->assertDatabaseMissing('customers', ['email' => 'customer@example.com']);
    }

    public function test_decline_and_document_access_are_organization_and_permission_scoped(): void
    {
        Notification::fake();
        Storage::fake('local');
        [$organization, $owner] = $this->createWorkspace('Permission Request');
        $organization->update(['online_booking_requirements' => ['primary_id']]);
        $vehicle = $this->createVehicle($organization, 'PERM-1');
        $payload = $this->publicRequestPayload($vehicle);
        $payload['documents'] = [
            'primary_id' => UploadedFile::fake()->create('private-id.pdf', 20, 'application/pdf'),
        ];
        $submitted = $this->post('/api/booking-form/permission-request/requests', $payload, ['Accept' => 'application/json'])
            ->assertCreated();
        $bookingRequest = BookingRequest::query()->where('reference', $submitted->json('reference'))->firstOrFail();
        $document = $bookingRequest->documents()->firstOrFail();

        $role = OrganizationRole::create([
            'organization_id' => $organization->id,
            'name' => 'Booking Reader',
            'permissions' => ['Bookings View'],
            'is_owner' => false,
            'is_active' => true,
        ]);
        $reader = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($reader->id, ['role' => 'staff', 'role_id' => $role->id]);
        Sanctum::actingAs($reader);

        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve")->assertForbidden();
        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/decline")->assertForbidden();
        $this->get("/api/dashboard/booking-requests/{$bookingRequest->id}/documents/{$document->id}")
            ->assertOk();

        [$otherOrganization, $otherOwner] = $this->createWorkspace('Other Request Workspace');
        Sanctum::actingAs($otherOwner);
        $this->getJson('/api/dashboard/booking-requests')
            ->assertOk()
            ->assertExactJson(['requests' => []]);
        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/approve")->assertNotFound();
        $this->get("/api/dashboard/booking-requests/{$bookingRequest->id}/documents/{$document->id}")->assertNotFound();

        Sanctum::actingAs($owner);
        $this->postJson("/api/dashboard/booking-requests/{$bookingRequest->id}/decline", [
            'reason' => 'Vehicle is not suitable for this rental.',
        ])->assertOk()
            ->assertJsonPath('booking_request.status', 'declined')
            ->assertJsonPath('booking_request.decline_reason', 'Vehicle is not suitable for this rental.');
        $this->assertSame('declined', $bookingRequest->fresh()->status);
        $this->assertDatabaseCount('bookings', 0);
        Notification::assertSentOnDemand(\App\Notifications\BookingRequestStatusNotification::class);
    }

    public function test_expired_private_documents_are_removed_by_the_scheduled_cleanup_command(): void
    {
        Notification::fake();
        Storage::fake('local');
        [$organization] = $this->createWorkspace('Document Retention');
        $organization->update(['online_booking_requirements' => ['primary_id']]);
        $vehicle = $this->createVehicle($organization, 'RET-1');
        $payload = $this->publicRequestPayload($vehicle);
        $payload['documents'] = [
            'primary_id' => UploadedFile::fake()->create('expired-id.pdf', 20, 'application/pdf'),
        ];
        $submitted = $this->post('/api/booking-form/document-retention/requests', $payload, ['Accept' => 'application/json'])
            ->assertCreated();
        $bookingRequest = BookingRequest::query()->where('reference', $submitted->json('reference'))->firstOrFail();
        $document = $bookingRequest->documents()->firstOrFail();
        $document->update(['expires_at' => now()->subMinute()]);

        $this->artisan('booking-requests:purge-expired-documents')
            ->assertExitCode(0);

        Storage::disk('local')->assertMissing($document->file_path);
        $this->assertDatabaseMissing('booking_request_documents', ['id' => $document->id]);
    }

    public function test_admin_booking_creation_and_extensions_cannot_overlap_existing_reservations(): void
    {
        [$organization, $owner] = $this->createWorkspace('Admin Availability');
        $vehicle = $this->createVehicle($organization, 'ADMIN-1');
        $customer = Customer::create([
            'organization_id' => $organization->id,
            'name' => 'Admin Customer',
        ]);
        $existingPickup = now()->addDays(3)->startOfHour();
        $existingReturn = $existingPickup->copy()->addDay();
        $booking = $this->createBooking($organization, $owner, $vehicle, $existingPickup, $existingReturn);
        $this->createBooking(
            $organization,
            $owner,
            $vehicle,
            $existingReturn->copy()->addHour(),
            $existingReturn->copy()->addDay(),
        );
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/bookings', [
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'pickup_at' => $existingPickup->copy()->addHours(2)->toDateTimeString(),
            'return_at' => $existingReturn->copy()->addHours(2)->toDateTimeString(),
            'rental_amount' => 1000,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['vehicle_id']);

        $this->postJson("/api/dashboard/bookings/{$booking->id}/extensions", [
            'new_return_at' => $existingReturn->copy()->addDay()->toDateTimeString(),
            'pricing_mode' => 'hourly',
            'fee' => 500,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['vehicle_id']);

        $this->assertDatabaseCount('bookings', 2);
        $this->assertDatabaseCount('booking_extensions', 0);
    }

    private function createWorkspace(string $name): array
    {
        $slug = str($name)->slug();
        $organization = Organization::create([
            'name' => $name,
            'slug' => $slug,
            'plan' => 'Business',
            'subscription_status' => 'active',
            'online_booking_enabled' => true,
            'online_booking_slug' => $slug,
            'online_booking_requirements' => [],
            'delivery_methods' => ['renter_pickup_renter_return'],
            'currency' => 'PHP',
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);

        return [$organization, $owner];
    }

    private function createVehicle(Organization $organization, string $plate, string $status = 'available'): Vehicle
    {
        return Vehicle::create([
            'organization_id' => $organization->id,
            'brand' => 'Toyota',
            'model' => 'Vios',
            'year' => 2025,
            'plate_number' => $plate,
            'daily_rate' => 1200,
            'status' => $status,
        ]);
    }

    private function createBooking(
        Organization $organization,
        User $owner,
        Vehicle $vehicle,
        $pickupAt,
        $returnAt,
    ): Booking {
        $customer = Customer::create([
            'organization_id' => $organization->id,
            'name' => 'Existing Customer',
        ]);

        return Booking::create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'created_by' => $owner->id,
            'reference' => 'BOOK-'.strtoupper(str()->random(8)),
            'pickup_at' => $pickupAt,
            'return_at' => $returnAt,
            'rental_amount' => 1200,
            'additional_charges' => 0,
            'total_amount' => 1200,
            'status' => 'upcoming',
            'payment_status' => 'unpaid',
        ]);
    }

    private function publicRequestPayload(Vehicle $vehicle): array
    {
        $pickupAt = now()->addDays(5)->startOfHour();

        return [
            'customer_name' => 'Pending Request',
            'customer_email' => 'customer@example.com',
            'customer_phone' => '+639001234567',
            'customer_address' => '12 Rental Street, Makati',
            'customer_facebook_profile' => 'https://facebook.com/customer',
            'referral_source' => 'Facebook',
            'vehicle_id' => $vehicle->id,
            'pickup_at' => $pickupAt->toDateTimeString(),
            'return_at' => $pickupAt->copy()->addDay()->toDateTimeString(),
            'destination_province' => 'Metro Manila',
            'destination_city' => 'Makati',
            'delivery_method' => 'renter_pickup_renter_return',
            'privacy_acknowledged' => '1',
        ];
    }
}
