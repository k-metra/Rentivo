<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingInspection;
use App\Models\BookingInspectionMedia;
use App\Models\BookingPostInspection;
use App\Models\BookingPostInspectionMedia;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingInspectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_pre_inspection_saves_media_and_completion_updates_booking_and_vehicle(): void
    {
        Storage::fake('public');
        $organization = $this->createOrganization('Pre Inspection');
        $owner = $this->createOwner($organization);
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);

        $this->post("/api/dashboard/bookings/{$booking->id}/inspection", [
            'fuel_level' => 85,
            'odometer_reading' => 12000,
            'easytrip_balance' => 50,
            'autosweep_balance' => 75,
            'functions' => ['Lights' => true],
            'tires' => ['Front Left' => 'good'],
            'exterior' => [UploadedFile::fake()->create('front.jpg', 10, 'image/jpeg')],
            'exterior_labels' => ['Front bumper'],
            'exterior_conditions' => ['good'],
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('inspection.status', 'draft')
            ->assertJsonPath('inspection.fuel_level', 85)
            ->assertJsonPath('inspection.media.0.label', 'Front bumper');

        $media = BookingInspectionMedia::query()->firstOrFail();
        Storage::disk('public')->assertExists($media->file_path);

        $releaseAt = now()->addDay()->toDateTimeString();
        $this->postJson("/api/dashboard/bookings/{$booking->id}/inspection/complete", [
            'signature_data' => str_repeat('signature-data-', 10),
            'signer_name' => 'Casey Customer',
            'actual_release_at' => $releaseAt,
        ])->assertOk()
            ->assertJsonPath('inspection.status', 'completed')
            ->assertJsonPath('booking.status', 'ongoing');

        $this->assertSame('rented', $booking->vehicle()->firstOrFail()->fresh()->status);
        $this->postJson("/api/dashboard/bookings/{$booking->id}/inspection", [
            'fuel_level' => 80,
            'odometer_reading' => 12010,
        ])->assertStatus(422);
        $this->assertSame('completed', $booking->inspection()->firstOrFail()->status);
    }

    public function test_post_inspection_calculates_charges_and_stores_media_on_completion(): void
    {
        Storage::fake('public');
        $organization = $this->createOrganization('Post Inspection');
        $owner = $this->createOwner($organization);
        $booking = $this->createBooking($organization, $owner);
        $booking->vehicle()->update([
            'status' => 'rented',
            'mileage_limit' => 100,
            'mileage_limit_unit' => 'rental',
            'excess_mileage_rate' => 10,
        ]);
        BookingInspection::create([
            'booking_id' => $booking->id,
            'created_by' => $owner->id,
            'fuel_level' => 100,
            'odometer_reading' => 10000,
            'easytrip_balance' => 50,
            'autosweep_balance' => 80,
            'status' => 'completed',
        ]);
        Sanctum::actingAs($owner);

        $this->post("/api/dashboard/bookings/{$booking->id}/post-inspection", [
            'fuel_level' => 90,
            'odometer_reading' => 10125,
            'easytrip_balance' => 40,
            'autosweep_balance' => 100,
            'functions' => ['Lights' => true],
            'tires' => ['Front Left' => 'good'],
            'exterior' => [UploadedFile::fake()->create('rear.jpg', 10, 'image/jpeg')],
            'exterior_labels' => ['Rear bumper'],
            'exterior_conditions' => ['fair'],
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('inspection.status', 'draft')
            ->assertJsonPath('inspection.media.0.label', 'Rear bumper');

        $media = BookingPostInspectionMedia::query()->firstOrFail();
        Storage::disk('public')->assertExists($media->file_path);

        $returnAt = now()->addDays(3)->toDateTimeString();
        $this->postJson("/api/dashboard/bookings/{$booking->id}/post-inspection/complete", [
            'signature_data' => str_repeat('signature-data-', 10),
            'signer_name' => 'Casey Customer',
            'actual_return_at' => $returnAt,
        ])->assertOk()
            ->assertJsonPath('inspection.status', 'completed')
            ->assertJsonPath('booking.status', 'complete');

        $inspection = BookingPostInspection::query()->firstOrFail();
        $this->assertSame(1000.0, (float) $inspection->fuel_charge);
        $this->assertSame(10.0, (float) $inspection->rfid_charge);
        $this->assertSame(20.0, (float) $inspection->rfid_refund_credit);
        $this->assertSame(125, $inspection->distance_traveled);
        $this->assertSame(100, $inspection->allowed_mileage);
        $this->assertSame(25, $inspection->excess_mileage);
        $this->assertSame(250.0, (float) $inspection->excess_mileage_charge);
        $this->assertSame(1260.0, (float) $booking->fresh()->additional_charges);
        $this->assertSame(2260.0, (float) $booking->fresh()->total_amount);
        $this->assertSame('available', $booking->vehicle()->firstOrFail()->fresh()->status);
    }

    public function test_inspection_endpoints_are_scoped_to_the_current_organization(): void
    {
        $organization = $this->createOrganization('Current Inspection Workspace');
        $owner = $this->createOwner($organization);
        $otherOrganization = $this->createOrganization('Other Inspection Workspace');
        $otherOwner = $this->createOwner($otherOrganization);
        $otherBooking = $this->createBooking($otherOrganization, $otherOwner);
        Sanctum::actingAs($owner);

        $this->getJson("/api/dashboard/bookings/{$otherBooking->id}/inspection")
            ->assertNotFound();
        $this->postJson("/api/dashboard/bookings/{$otherBooking->id}/post-inspection", [
            'fuel_level' => 90,
            'odometer_reading' => 10100,
        ])->assertNotFound();

        $this->assertDatabaseCount('booking_inspections', 0);
        $this->assertDatabaseCount('booking_post_inspections', 0);
    }

    public function test_expired_workspace_can_read_inspection_but_cannot_save_one(): void
    {
        $organization = $this->createOrganization('Expired Inspection Workspace', 'expired');
        $owner = $this->createOwner($organization);
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);

        $this->getJson("/api/dashboard/bookings/{$booking->id}/inspection")
            ->assertOk()
            ->assertJsonPath('inspection', null);
        $this->postJson("/api/dashboard/bookings/{$booking->id}/inspection", [
            'fuel_level' => 90,
            'odometer_reading' => 10100,
        ])->assertStatus(402)
            ->assertJsonPath('code', 'subscription_expired');

        $this->assertDatabaseCount('booking_inspections', 0);
    }

    private function createOrganization(string $name, string $subscriptionStatus = 'active'): Organization
    {
        return Organization::create([
            'name' => $name,
            'slug' => str($name)->slug(),
            'subscription_status' => $subscriptionStatus,
        ]);
    }

    private function createOwner(Organization $organization): User
    {
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);

        return $owner;
    }

    private function createBooking(Organization $organization, User $owner): Booking
    {
        $customer = Customer::create([
            'organization_id' => $organization->id,
            'name' => 'Casey Customer',
        ]);
        $vehicle = Vehicle::create([
            'organization_id' => $organization->id,
            'brand' => 'Toyota',
            'model' => 'Vios',
            'year' => 2025,
            'plate_number' => strtoupper(substr($organization->slug, 0, 3)).'-001',
        ]);

        return Booking::create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'created_by' => $owner->id,
            'reference' => 'BOOK-'.$organization->slug,
            'pickup_at' => now()->addDay(),
            'return_at' => now()->addDays(2),
            'rental_amount' => 1000,
            'additional_charges' => 0,
            'total_amount' => 1000,
            'status' => 'confirmed',
            'payment_status' => 'unpaid',
        ]);
    }
}
