<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardDomainExtractionTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_management_preserves_attachments_and_organization_scoping(): void
    {
        Storage::fake('public');
        $organization = $this->createOrganization('Customer Workspace');
        $owner = $this->createOwner($organization);
        $otherOrganization = $this->createOrganization('Other Customer Workspace');
        $otherCustomer = Customer::create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Tenant Customer',
        ]);
        Sanctum::actingAs($owner);

        $response = $this->post('/api/dashboard/customers', [
            'name' => 'New Customer',
            'email' => 'customer@example.com',
            'license' => [
                UploadedFile::fake()->createWithContent('license.pdf', "%PDF-1.4\ncustomer license"),
            ],
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('name', 'New Customer');

        $customerId = $response->json('id');
        $attachmentPath = $response->json('attachments.0.file_path');
        $this->assertNotNull($attachmentPath);
        Storage::disk('public')->assertExists($attachmentPath);

        $this->getJson('/api/dashboard/customers')
            ->assertOk()
            ->assertJsonCount(1);
        $this->getJson("/api/dashboard/customers/{$otherCustomer->id}")
            ->assertNotFound();

        $archiveResponse = $this->patchJson("/api/dashboard/customers/{$customerId}/archive", ['archive' => true])
            ->assertOk();
        $this->assertNotNull($archiveResponse->json('archived_at'));
        $this->getJson('/api/dashboard/customers')
            ->assertOk()
            ->assertExactJson([]);
        $this->getJson('/api/dashboard/customers?include_archived=1')
            ->assertOk()
            ->assertJsonCount(1);

        $this->deleteJson("/api/dashboard/customers/{$customerId}")
            ->assertOk();
        Storage::disk('public')->assertMissing($attachmentPath);
    }

    public function test_partner_and_booking_source_routes_remain_functional(): void
    {
        $organization = $this->createOrganization('Referral Workspace');
        $owner = $this->createOwner($organization);
        Sanctum::actingAs($owner);

        $partner = $this->postJson('/api/dashboard/partners', [
            'name' => 'Local Agency',
            'status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('organization_id', $organization->id);

        $partnerId = $partner->json('id');
        $this->getJson('/api/dashboard/partners')
            ->assertOk()
            ->assertJsonCount(1);
        $this->putJson("/api/dashboard/partners/{$partnerId}", [
            'name' => 'Updated Agency',
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('name', 'Updated Agency');
        $this->deleteJson("/api/dashboard/partners/{$partnerId}")
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->postJson('/api/dashboard/booking-sources', [
            'name' => 'Website',
            'type' => 'direct',
            'status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('name', 'Website');
        $this->getJson('/api/dashboard/booking-sources')
            ->assertOk()
            ->assertJsonCount(1);
        $this->getJson('/api/dashboard/booking-sources/stats')
            ->assertOk()
            ->assertJsonCount(5, 'stats');
    }

    public function test_booking_creation_pricing_and_contract_routes_use_the_extracted_controllers(): void
    {
        $organization = $this->createOrganization('Booking Workspace');
        $organization->update(['electronic_signature_enabled' => true]);
        $owner = $this->createOwner($organization);
        $customer = Customer::create([
            'organization_id' => $organization->id,
            'name' => 'Booking Customer',
        ]);
        $vehicle = Vehicle::create([
            'organization_id' => $organization->id,
            'brand' => 'Toyota',
            'model' => 'Vios',
            'year' => 2025,
            'plate_number' => 'BOOK-123',
            'daily_rate' => 1200,
        ]);
        Sanctum::actingAs($owner);

        $pickupAt = now()->addDays(2)->startOfHour();
        $returnAt = $pickupAt->copy()->addDay();
        $bookingResponse = $this->postJson('/api/dashboard/bookings', [
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'pickup_at' => $pickupAt->toDateTimeString(),
            'return_at' => $returnAt->toDateTimeString(),
            'rental_amount' => 5000,
            'additional_charges' => 100,
            'custom_rental_rate' => false,
        ])->assertCreated();

        $bookingId = $bookingResponse->json('id');
        $this->assertDatabaseHas('bookings', [
            'id' => $bookingId,
            'rental_amount' => 1200,
            'total_amount' => 1300,
        ]);
        $this->getJson("/api/dashboard/bookings/{$bookingId}")
            ->assertOk()
            ->assertJsonPath('daily_rate', 1200);

        $template = $this->postJson('/api/dashboard/contract-templates', [
            'title' => 'Rental Agreement',
            'content' => '<p>{{renter_signature}}</p><p>{{staff_signature}}</p>',
            'margins' => ['top' => 10, 'right' => 10, 'bottom' => 10, 'left' => 10],
            'is_active' => true,
        ])->assertOk()
            ->assertJsonPath('template.title', 'Rental Agreement');

        $contractResponse = $this->postJson("/api/dashboard/bookings/{$bookingId}/contract", [
            'title' => $template->json('template.title'),
            'template_html' => $template->json('template.content'),
        ])->assertOk();

        $shareToken = $contractResponse->json('contract.share_token');
        $this->getJson("/api/contracts/{$shareToken}")
            ->assertOk()
            ->assertJsonPath('requires_pin', true);
        $this->postJson("/api/contracts/{$shareToken}/verify", [
            'pin' => $contractResponse->json('pin'),
        ])->assertOk()
            ->assertJsonPath('contract.title', 'Rental Agreement');
    }

    private function createOrganization(string $name): Organization
    {
        return Organization::create([
            'name' => $name,
            'slug' => str($name)->slug(),
            'plan' => 'Business',
            'subscription_status' => 'active',
        ]);
    }

    private function createOwner(Organization $organization): User
    {
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);

        return $owner;
    }
}
