<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Fund;
use App\Models\Organization;
use App\Models\OrganizationRole;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_recording_payment_updates_booking_and_fund_and_rejects_overpayment(): void
    {
        $organization = $this->createOrganization('Payments');
        $owner = $this->createOwner($organization);
        $booking = $this->createBooking($organization, $owner);
        $fund = Fund::create([
            'organization_id' => $organization->id,
            'name' => 'Main Cash',
            'type' => 'cash',
            'opening_balance' => 1000,
            'created_by' => $owner->id,
        ]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/dashboard/bookings/{$booking->id}/payments", [
            'amount' => 400,
            'method' => 'Cash',
            'paid_at' => now()->toDateTimeString(),
            'fund_id' => $fund->id,
            'notes' => 'Deposit',
        ])->assertCreated()
            ->assertJsonPath('payment_status', 'partial');

        $payment = Payment::query()->where('booking_id', $booking->id)->firstOrFail();
        $this->assertDatabaseHas('fund_transactions', [
            'payment_id' => $payment->id,
            'fund_id' => $fund->id,
            'type' => 'inflow',
            'amount' => 400,
        ]);

        $this->postJson("/api/dashboard/bookings/{$booking->id}/payments", [
            'amount' => 600,
            'method' => 'Online',
            'paid_at' => now()->toDateTimeString(),
        ])->assertCreated()
            ->assertJsonPath('payment_status', 'paid');

        $this->postJson("/api/dashboard/bookings/{$booking->id}/payments", [
            'amount' => 1,
            'method' => 'Online',
            'paid_at' => now()->toDateTimeString(),
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Payment cannot exceed the booking balance.');

        $this->assertDatabaseCount('payments', 2);
        $this->assertSame('paid', $booking->fresh()->payment_status);
    }

    public function test_deleting_payment_recalculates_booking_status_and_removes_fund_transaction(): void
    {
        $organization = $this->createOrganization('Payment Deletion');
        $owner = $this->createOwner($organization);
        $booking = $this->createBooking($organization, $owner);
        $fund = Fund::create([
            'organization_id' => $organization->id,
            'name' => 'Main Cash',
            'type' => 'cash',
            'opening_balance' => 0,
            'created_by' => $owner->id,
        ]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/dashboard/bookings/{$booking->id}/payments", [
            'amount' => 600,
            'method' => 'Cash',
            'paid_at' => now()->toDateTimeString(),
            'fund_id' => $fund->id,
        ])->assertCreated()->assertJsonPath('payment_status', 'partial');

        $payment = Payment::query()->where('booking_id', $booking->id)->firstOrFail();
        $this->deleteJson("/api/dashboard/payments/{$payment->id}")
            ->assertOk()
            ->assertJsonPath('payment_status', 'unpaid');

        $this->assertDatabaseMissing('payments', ['id' => $payment->id]);
        $this->assertDatabaseMissing('fund_transactions', ['payment_id' => $payment->id]);
        $this->assertSame('unpaid', $booking->fresh()->payment_status);
    }

    public function test_payment_endpoints_are_scoped_to_the_current_organization(): void
    {
        $organization = $this->createOrganization('Current Workspace');
        $owner = $this->createOwner($organization);
        $otherOrganization = $this->createOrganization('Other Workspace');
        $otherOwner = $this->createOwner($otherOrganization);
        $otherBooking = $this->createBooking($otherOrganization, $otherOwner);
        $otherPayment = Payment::create([
            'organization_id' => $otherOrganization->id,
            'booking_id' => $otherBooking->id,
            'created_by' => $otherOwner->id,
            'amount' => 100,
            'method' => 'Cash',
            'status' => 'paid',
            'paid_at' => now(),
        ]);
        Sanctum::actingAs($owner);

        $this->postJson("/api/dashboard/bookings/{$otherBooking->id}/payments", [
            'amount' => 100,
            'method' => 'Cash',
            'paid_at' => now()->toDateTimeString(),
        ])->assertNotFound();

        $this->deleteJson("/api/dashboard/payments/{$otherPayment->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('payments', ['id' => $otherPayment->id]);
        $this->assertSame('unpaid', $otherBooking->fresh()->payment_status);
    }

    public function test_deleting_a_payment_requires_the_bookings_payments_permission(): void
    {
        $organization = $this->createOrganization('Restricted Workspace');
        $owner = $this->createOwner($organization);
        $booking = $this->createBooking($organization, $owner);
        $payment = Payment::create([
            'organization_id' => $organization->id,
            'booking_id' => $booking->id,
            'created_by' => $owner->id,
            'amount' => 100,
            'method' => 'Cash',
            'status' => 'paid',
            'paid_at' => now(),
        ]);
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

        $this->deleteJson("/api/dashboard/payments/{$payment->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('payments', ['id' => $payment->id]);
    }

    public function test_expired_subscription_blocks_booking_payment_creation(): void
    {
        $organization = $this->createOrganization('Expired Payments', 'expired');
        $owner = $this->createOwner($organization);
        $booking = $this->createBooking($organization, $owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/dashboard/bookings/{$booking->id}/payments", [
            'amount' => 100,
            'method' => 'Cash',
            'paid_at' => now()->toDateTimeString(),
        ])->assertStatus(402)
            ->assertJsonPath('code', 'subscription_expired');

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('unpaid', $booking->fresh()->payment_status);
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
            'total_amount' => 1000,
            'status' => 'confirmed',
            'payment_status' => 'unpaid',
        ]);
    }
}
