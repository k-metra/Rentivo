<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Fund;
use App\Models\FundTransaction;
use App\Models\Organization;
use App\Models\Payment;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingPaymentController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    private function requirePaymentPermission(Request $request, Organization $organization): void
    {
        app(RolePermissionService::class)
            ->abortUnless($request->user(), $organization, 'Bookings Payments');
    }

    private function bookingRelations(): array
    {
        return [
            'customer',
            'vehicle.rentalRates',
            'payments.creator:id,name',
            'extensions.creator:id,name',
        ];
    }

    private function updatePaymentStatus(Booking $booking): void
    {
        $paid = (float) $booking->payments()->where('status', 'paid')->sum('amount');
        $booking->update([
            'payment_status' => $paid >= (float) $booking->total_amount - 0.001
                ? 'paid'
                : ($paid > 0 ? 'partial' : 'unpaid'),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);

        return response()->json(Payment::where('organization_id', $organization->id)
            ->with([
                'booking.customer:id,name',
                'booking.vehicle:id,name,brand,model,year,plate_number,partner_id',
                'booking.vehicle.partner:id,name,first_name,middle_name,last_name',
            ])
            ->orderByDesc('paid_at')
            ->get());
    }

    public function store(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        $this->requirePaymentPermission($request, $organization);
        abort_if($booking->organization_id !== $organization->id, 404);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'string', 'max:255'],
            'paid_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'fund_id' => ['nullable', 'integer'],
        ]);
        $fundId = $validated['fund_id'] ?? null;
        if ($fundId !== null) {
            abort_unless(
                Fund::where('organization_id', $organization->id)->whereKey($fundId)->exists(),
                422,
                'The selected fund is invalid.',
            );
        }

        $updatedBooking = DB::transaction(function () use ($request, $organization, $booking, $validated, $fundId): Booking {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            abort_if($booking->organization_id !== $organization->id, 404);

            $paid = (float) $booking->payments()->where('status', 'paid')->sum('amount');
            $balance = max(0, (float) $booking->total_amount - $paid);
            abort_if((float) $validated['amount'] > $balance + 0.001, 422, 'Payment cannot exceed the booking balance.');

            $payment = Payment::create([
                'organization_id' => $organization->id,
                'booking_id' => $booking->id,
                'fund_id' => $fundId,
                'created_by' => $request->user()->id,
                'amount' => $validated['amount'],
                'method' => $validated['method'],
                'status' => 'paid',
                'paid_at' => $validated['paid_at'],
                'notes' => $validated['notes'] ?? null,
            ]);

            if ($fundId !== null) {
                FundTransaction::create([
                    'organization_id' => $organization->id,
                    'fund_id' => $fundId,
                    'payment_id' => $payment->id,
                    'type' => 'inflow',
                    'transacted_at' => $validated['paid_at'],
                    'amount' => $validated['amount'],
                    'description' => "Booking payment {$booking->reference}",
                    'notes' => $validated['notes'] ?? null,
                    'created_by' => $request->user()->id,
                ]);
            }

            $this->updatePaymentStatus($booking);

            return $booking->fresh($this->bookingRelations());
        });

        return response()->json($updatedBooking, 201);
    }

    public function destroy(Request $request, Payment $payment): JsonResponse
    {
        $organization = $this->organization($request);
        $this->requirePaymentPermission($request, $organization);

        $updatedBooking = DB::transaction(function () use ($organization, $payment): Booking {
            $payment = Payment::query()
                ->where('organization_id', $organization->id)
                ->lockForUpdate()
                ->findOrFail($payment->id);
            $booking = Booking::query()
                ->where('organization_id', $organization->id)
                ->lockForUpdate()
                ->findOrFail($payment->booking_id);

            $payment->delete();
            $this->updatePaymentStatus($booking);

            return $booking->fresh($this->bookingRelations());
        });

        return response()->json($updatedBooking);
    }
}
