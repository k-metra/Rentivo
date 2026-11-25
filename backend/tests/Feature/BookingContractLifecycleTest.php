<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingContract;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationRole;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingContractLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_contract_moves_from_issued_to_renter_signed_to_signed(): void
    {
        [$organization, $owner] = $this->createWorkspace('Contract Signing');
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);

        $issued = $this->generateContract($booking);
        $shareToken = $issued['contract']['share_token'];
        $pin = $issued['pin'];
        $wrongPin = str_pad((string) (((int) $pin + 1) % 1000000), 6, '0', STR_PAD_LEFT);

        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/staff-sign", $this->staffSignature())
            ->assertStatus(422)
            ->assertJsonPath('message', 'The renter must sign before staff signing.');

        $this->postJson("/api/contracts/{$shareToken}/sign", array_merge(
            $this->renterSignature(),
            ['pin' => $wrongPin],
        ))->assertStatus(422)
            ->assertJsonPath('message', 'The PIN is incorrect.');

        $contract = BookingContract::findOrFail($issued['contract']['id']);
        $this->assertSame('issued', $contract->status);
        $this->assertNull($contract->renter_signed_at);

        $this->postJson("/api/contracts/{$shareToken}/sign", array_merge(
            $this->renterSignature(),
            ['pin' => $pin],
        ))->assertOk()
            ->assertJsonPath('contract.status', 'renter_signed')
            ->assertJsonPath('contract.signed_at', null);

        $contract->refresh();
        $this->assertNotNull($contract->renter_signed_at);
        $this->assertNull($contract->signed_at);
        $this->assertTrue($contract->renter_review_confirmed);
        $this->assertNull($contract->staff_signed_at);

        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/staff-sign", $this->staffSignature())
            ->assertOk()
            ->assertJsonPath('contract.status', 'signed');

        $contract->refresh();
        $this->assertNotNull($contract->renter_signed_at);
        $this->assertNotNull($contract->staff_signed_at);
        $this->assertNotNull($contract->signed_at);
        $this->assertTrue($contract->review_confirmed);
        $this->assertTrue($contract->staff_review_confirmed);

        $this->postJson("/api/contracts/{$shareToken}/sign", array_merge(
            $this->renterSignature(),
            ['pin' => $pin],
        ))->assertStatus(422)
            ->assertJsonPath('message', 'The renter has already signed this contract.');
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract", $this->contractDetails())
            ->assertStatus(422)
            ->assertJsonPath('message', 'A fully signed contract cannot be regenerated.');
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/revoke")
            ->assertStatus(422)
            ->assertJsonPath('message', 'A fully signed contract cannot be revoked.');
    }

    public function test_regenerating_a_partially_signed_contract_invalidates_the_old_link_and_signature(): void
    {
        [$organization, $owner] = $this->createWorkspace('Contract Reissue');
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);

        $first = $this->generateContract($booking);
        $this->postJson("/api/contracts/{$first['contract']['share_token']}/sign", array_merge(
            $this->renterSignature(),
            ['pin' => $first['pin']],
        ))->assertOk()
            ->assertJsonPath('contract.status', 'renter_signed');

        $second = $this->generateContract($booking, 'Updated Rental Agreement');
        $this->assertSame($first['contract']['id'], $second['contract']['id']);
        $this->assertNotSame($first['contract']['share_token'], $second['contract']['share_token']);
        $this->assertSame('issued', $second['contract']['status']);
        $this->assertNull($second['contract']['renter_signature_data']);
        $this->assertNull($second['contract']['renter_signed_at']);

        $this->getJson("/api/contracts/{$first['contract']['share_token']}")
            ->assertNotFound();
        $this->postJson("/api/contracts/{$second['contract']['share_token']}/verify", [
            'pin' => $first['pin'],
        ])->assertStatus(422)
            ->assertJsonPath('message', 'The PIN is incorrect.');
        $this->postJson("/api/contracts/{$second['contract']['share_token']}/verify", [
            'pin' => $second['pin'],
        ])->assertOk()
            ->assertJsonPath('contract.status', 'issued');
    }

    public function test_expired_contract_cannot_be_viewed_verified_or_signed(): void
    {
        [$organization, $owner] = $this->createWorkspace('Expired Contract');
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);

        $issued = $this->generateContract($booking);
        $contract = BookingContract::findOrFail($issued['contract']['id']);
        $contract->update(['expires_at' => now()->subMinute()]);

        $this->getJson("/api/contracts/{$issued['contract']['share_token']}")
            ->assertStatus(410)
            ->assertJsonPath('message', 'This contract link has expired.');
        $this->postJson("/api/contracts/{$issued['contract']['share_token']}/verify", [
            'pin' => $issued['pin'],
        ])->assertStatus(410)
            ->assertJsonPath('message', 'This contract link has expired.');
        $this->postJson("/api/contracts/{$issued['contract']['share_token']}/sign", array_merge(
            $this->renterSignature(),
            ['pin' => $issued['pin']],
        ))->assertStatus(410)
            ->assertJsonPath('message', 'This contract link has expired.');
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/staff-sign", $this->staffSignature())
            ->assertStatus(410)
            ->assertJsonPath('message', 'This contract link has expired.');
    }

    public function test_revoked_contract_cannot_be_viewed_verified_or_signed(): void
    {
        [$organization, $owner] = $this->createWorkspace('Revoked Contract');
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);

        $issued = $this->generateContract($booking);
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/revoke")
            ->assertOk()
            ->assertJsonPath('contract.status', 'revoked');

        $this->getJson("/api/contracts/{$issued['contract']['share_token']}")
            ->assertStatus(410)
            ->assertJsonPath('message', 'This contract is no longer available.');
        $this->postJson("/api/contracts/{$issued['contract']['share_token']}/verify", [
            'pin' => $issued['pin'],
        ])->assertStatus(410)
            ->assertJsonPath('message', 'This contract is no longer available.');
        $this->postJson("/api/contracts/{$issued['contract']['share_token']}/sign", array_merge(
            $this->renterSignature(),
            ['pin' => $issued['pin']],
        ))->assertStatus(410)
            ->assertJsonPath('message', 'This contract is no longer available.');
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/staff-sign", $this->staffSignature())
            ->assertStatus(410)
            ->assertJsonPath('message', 'This contract is no longer available.');
    }

    public function test_contract_actions_require_the_matching_permission_and_organization(): void
    {
        [$organization, $owner] = $this->createWorkspace('Scoped Contract');
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);
        $issued = $this->generateContract($booking);

        $role = OrganizationRole::create([
            'organization_id' => $organization->id,
            'name' => 'Booking Viewer',
            'permissions' => ['Bookings View'],
            'is_owner' => false,
            'is_active' => true,
        ]);
        $staff = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($staff->id, [
            'role' => 'staff',
            'role_id' => $role->id,
        ]);
        Sanctum::actingAs($staff);

        $this->getJson("/api/dashboard/bookings/{$booking->id}/contract")
            ->assertOk()
            ->assertJsonPath('contract.id', $issued['contract']['id']);
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract", $this->contractDetails())
            ->assertForbidden();
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/staff-sign", $this->staffSignature())
            ->assertForbidden();
        $this->postJson("/api/dashboard/bookings/{$booking->id}/contract/revoke")
            ->assertForbidden();

        [$otherOrganization, $otherOwner] = $this->createWorkspace('Other Contract Workspace');
        $otherBooking = $this->createBooking($otherOrganization, $otherOwner);
        Sanctum::actingAs($owner);

        $this->getJson("/api/dashboard/bookings/{$otherBooking->id}/contract")
            ->assertNotFound();
        $this->postJson("/api/dashboard/bookings/{$otherBooking->id}/contract", $this->contractDetails())
            ->assertNotFound();
    }

    private function createWorkspace(string $name): array
    {
        $organization = Organization::create([
            'name' => $name,
            'slug' => str($name)->slug(),
            'plan' => 'Business',
            'subscription_status' => 'active',
            'electronic_signature_enabled' => true,
        ]);
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);

        return [$organization, $owner];
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

    private function generateContract(Booking $booking, string $title = 'Rental Agreement'): array
    {
        $response = $this->postJson("/api/dashboard/bookings/{$booking->id}/contract", array_merge(
            $this->contractDetails(),
            ['title' => $title],
        ))->assertOk();

        return $response->json();
    }

    private function contractDetails(): array
    {
        return [
            'title' => 'Rental Agreement',
            'template_html' => '<p>{{renter_signature}}</p><p>{{staff_signature}}</p>',
        ];
    }

    private function renterSignature(): array
    {
        return [
            'renter_signer_name' => 'Casey Customer',
            'signature_data' => str_repeat('renter-signature-', 10),
            'review_confirmed' => true,
        ];
    }

    private function staffSignature(): array
    {
        return [
            'staff_signer_name' => 'Jordan Staff',
            'staff_signature_data' => str_repeat('staff-signature-', 10),
            'staff_review_confirmed' => true,
        ];
    }
}
