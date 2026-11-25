<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingExtension;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Services\BookingAvailability;
use App\Services\BookingPricing;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BookingController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    private function requirePermission(Request $request, string $permission): void
    {
        $organization = $this->organization($request);
        app(RolePermissionService::class)->abortUnless($request->user(), $organization, $permission);
    }

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Bookings View');
        $organization = $this->organization($request);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'for_completion')
            ->whereHas('postInspection', fn ($query) => $query->where('status', 'completed'))
            ->update(['status' => 'complete']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'for_completion')
            ->update(['status' => 'ongoing']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'active')
            ->update(['status' => 'ongoing']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'confirmed')
            ->update(['status' => 'upcoming']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'pending')
            ->update(['status' => 'upcoming']);
        Booking::where('organization_id', $organization->id)
            ->whereIn('status', ['confirmed', 'upcoming'])
            ->where('pickup_at', '<=', now())
            ->update(['status' => 'pre_inspection']);
        $query = Booking::where('organization_id', $organization->id)
            ->with([
                'customer:id,name',
                'vehicle:id,name,brand,model,year,plate_number,image_path,partner_id',
                'vehicle.partner:id,name,first_name,middle_name,last_name',
                'payments:id,booking_id,amount,status,paid_at',
            ]);

        $sort = $request->input('sort', 'priority');
        if (in_array($sort, ['latest', 'oldest'], true)) {
            $query
                ->orderBy('pickup_at', $sort === 'oldest' ? 'asc' : 'desc')
                ->orderByDesc('id');
        } else {
            $query
                ->orderByRaw("CASE
                    WHEN status = 'pending' THEN 0
                    WHEN status = 'pre_inspection' THEN 1
                    WHEN status IN ('confirmed', 'upcoming') THEN 2
                    WHEN status IN ('ongoing', 'active') THEN 3
                    WHEN status IN ('complete', 'completed') THEN 4
                    WHEN status = 'rejected' THEN 5
                    WHEN status = 'cancelled' THEN 6
                    ELSE 6
                END")
                ->orderBy('pickup_at', 'asc')
                ->orderBy('id', 'asc');
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Bookings Create');
        $organization = $this->organization($request);
        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where('organization_id', $organization->id)],
            'vehicle_id' => ['required', Rule::exists('vehicles', 'id')->where('organization_id', $organization->id)],
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'rental_amount' => ['required', 'numeric', 'min:0'],
            'additional_charges' => ['nullable', 'numeric', 'min:0'],
            'destination_city' => ['nullable', 'string', 'max:255'],
            'destination_province' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:5000'],
            'custom_rental_rate' => ['nullable', 'boolean'],
        ]);

        $additional = (float) ($validated['additional_charges'] ?? 0);
        $customRentalRate = (bool) ($validated['custom_rental_rate'] ?? false);
        $booking = DB::transaction(function () use ($request, $organization, $validated, $customRentalRate, $additional): Booking {
            $vehicle = Vehicle::query()
                ->where('organization_id', $organization->id)
                ->lockForUpdate()
                ->findOrFail($validated['vehicle_id']);
            app(BookingAvailability::class)->assertAvailable(
                $vehicle,
                $validated['pickup_at'],
                $validated['return_at'],
            );
            $rentalAmount = $customRentalRate
                ? (float) $validated['rental_amount']
                : app(BookingPricing::class)->calculateRentalAmount(
                    $vehicle,
                    $validated['pickup_at'],
                    $validated['return_at'],
                    $validated['destination_province'] ?? null,
                );

            return Booking::create([
                'organization_id' => $organization->id,
                'created_by' => $request->user()->id,
                'reference' => 'RV-'.now()->format('Ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'customer_id' => $validated['customer_id'],
                'vehicle_id' => $validated['vehicle_id'],
                'pickup_at' => $validated['pickup_at'],
                'return_at' => $validated['return_at'],
                'rental_amount' => $rentalAmount,
                'custom_rental_rate' => $customRentalRate,
                'additional_charges' => $additional,
                'total_amount' => $rentalAmount + $additional,
                'destination_city' => $validated['destination_city'] ?? null,
                'destination_province' => $validated['destination_province'] ?? null,
                'remarks' => $validated['remarks'] ?? null,
                'status' => now()->gte(Carbon::parse($validated['pickup_at'])) ? 'pre_inspection' : 'upcoming',
                'payment_status' => 'unpaid',
            ]);
        });

        return response()->json($booking->load(['customer:id,name', 'vehicle:id,brand,model']), 201);
    }

    public function update(Request $request, Booking $booking): JsonResponse
    {
        $this->requirePermission($request, 'Bookings Update');
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where('organization_id', $organization->id)],
            'vehicle_id' => ['required', Rule::exists('vehicles', 'id')->where('organization_id', $organization->id)],
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'rental_amount' => ['required', 'numeric', 'min:0'],
            'additional_charges' => ['nullable', 'numeric', 'min:0'],
            'destination_city' => ['nullable', 'string', 'max:255'],
            'destination_province' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:5000'],
            'custom_rental_rate' => ['nullable', 'boolean'],
        ]);
        $additional = (float) ($validated['additional_charges'] ?? 0);
        $customRentalRate = (bool) ($validated['custom_rental_rate'] ?? $booking->custom_rental_rate);
        DB::transaction(function () use ($organization, $booking, $validated, $customRentalRate, $additional): void {
            $vehicle = Vehicle::query()
                ->where('organization_id', $organization->id)
                ->lockForUpdate()
                ->findOrFail($validated['vehicle_id']);
            app(BookingAvailability::class)->assertAvailable(
                $vehicle,
                $validated['pickup_at'],
                $validated['return_at'],
                $booking->id,
            );
            $rentalAmount = $customRentalRate
                ? (float) $validated['rental_amount']
                : app(BookingPricing::class)->calculateRentalAmount(
                    $vehicle,
                    $validated['pickup_at'],
                    $validated['return_at'],
                    $validated['destination_province'] ?? null,
                );
            $booking->update([
                'customer_id' => $validated['customer_id'],
                'vehicle_id' => $validated['vehicle_id'],
                'pickup_at' => $validated['pickup_at'],
                'return_at' => $validated['return_at'],
                'rental_amount' => $rentalAmount,
                'custom_rental_rate' => $customRentalRate,
                'additional_charges' => $additional,
                'total_amount' => $rentalAmount + $additional,
                'destination_city' => $validated['destination_city'] ?? null,
                'destination_province' => $validated['destination_province'] ?? null,
                'remarks' => $validated['remarks'] ?? null,
            ]);
        });

        return response()->json($booking->load(['customer:id,name', 'vehicle:id,brand,model']), 200);
    }

    public function show(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $bookingData = $booking->load([
            'customer',
            'vehicle.rentalRates',
            'payments.creator:id,name',
            'extensions.creator:id,name',
            'inspection.media',
            'postInspection.media',
        ]);

        $vehicle = $bookingData->vehicle;
        $rentalDays = max(1, (int) ceil(
            max(1, strtotime($bookingData->return_at) - strtotime($bookingData->pickup_at)) / 86400
        ));
        $dailyRate = 0.0;
        if ($bookingData->custom_rental_rate) {
            $dailyRate = (float) $bookingData->rental_amount / $rentalDays;
        } elseif ($vehicle) {
            $twentyFourHourRate = $vehicle->rentalRates->firstWhere('duration_hours', 24);
            $dailyRate = $twentyFourHourRate
                ? (float) $twentyFourHourRate->amount
                : (float) ($vehicle->daily_rate ?? 0);
            if (
                $twentyFourHourRate
                && ($twentyFourHourRate->coverage_type ?? 'all') === 'province'
                && $bookingData->destination_province
                && ! in_array(
                    $bookingData->destination_province,
                    $twentyFourHourRate->coverage_locations ?? [],
                    true,
                )
            ) {
                $dailyRate += (float) ($twentyFourHourRate->outside_amount ?? 0);
            }
        }

        $bookingData->setAttribute('daily_rate', round($dailyRate, 2));

        return response()->json($bookingData);
    }

    public function storeExtension(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'new_return_at' => ['required', 'date', 'after:'.$booking->return_at],
            'pricing_mode' => ['required', 'in:hourly,twelve_hour'],
            'fee' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        DB::transaction(function () use ($request, $booking, $validated): void {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($booking->vehicle_id);
            app(BookingAvailability::class)->assertAvailable(
                $vehicle,
                $booking->pickup_at,
                $validated['new_return_at'],
                $booking->id,
            );
            BookingExtension::create([
                'booking_id' => $booking->id,
                'created_by' => $request->user()->id,
                'previous_return_at' => $booking->return_at,
                'new_return_at' => $validated['new_return_at'],
                'fee' => $validated['fee'],
                'pricing_mode' => $validated['pricing_mode'],
                'notes' => $validated['notes'] ?? null,
            ]);
            $booking->update([
                'return_at' => $validated['new_return_at'],
                'additional_charges' => (float) $booking->additional_charges + (float) $validated['fee'],
                'total_amount' => (float) $booking->rental_amount + (float) $booking->additional_charges + (float) $validated['fee'],
            ]);
        });

        return response()->json($booking->fresh([
            'customer', 'vehicle.rentalRates', 'payments', 'extensions.creator:id,name',
        ]), 201);
    }

    public function undoExtension(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $extension = $booking->extensions()->whereNull('undone_at')->latest('id')->first();
        abort_if(! $extension, 422, 'There is no active extension to undo.');

        $extension->update(['undone_at' => now()]);
        $fee = (float) $extension->fee;
        $booking->update([
            'return_at' => $extension->previous_return_at,
            'additional_charges' => max(0, (float) $booking->additional_charges - $fee),
            'total_amount' => (float) $booking->rental_amount + max(0, (float) $booking->additional_charges - $fee),
        ]);

        return response()->json($booking->fresh([
            'customer', 'vehicle.rentalRates', 'payments', 'extensions.creator:id,name',
        ]));
    }

    public function updateStatus(Request $request, Booking $booking): JsonResponse
    {
        $this->requirePermission($request, 'Bookings Update');
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'status' => ['required', 'in:pending,confirmed,upcoming,pre_inspection,ongoing,active,completed,complete,cancelled,rejected'],
        ]);
        $allowed = match ($booking->status) {
            'pending' => ['upcoming', 'confirmed', 'cancelled', 'rejected'],
            'confirmed', 'upcoming' => ['pre_inspection', 'cancelled'],
            'pre_inspection' => ['ongoing', 'cancelled'],
            'ongoing', 'active' => ['complete', 'completed', 'cancelled'],
            'completed', 'complete', 'cancelled', 'rejected' => [],
            default => ['cancelled'],
        };
        abort_unless(in_array($validated['status'], $allowed, true), 422, 'This booking status transition is not allowed.');
        if (in_array($validated['status'], ['ongoing', 'active'], true)) {
            $inspection = $booking->inspection()->where('status', 'completed')->first();
            abort_if(! $inspection, 422, 'Complete the pre-inspection before marking the rental active.');
        }
        $booking->update(['status' => $validated['status']]);
        if (in_array($validated['status'], ['ongoing', 'active'], true)) {
            Vehicle::whereKey($booking->vehicle_id)->update(['status' => 'rented']);
        } elseif (in_array($validated['status'], ['complete', 'completed', 'cancelled', 'rejected'], true)) {
            Vehicle::whereKey($booking->vehicle_id)->update(['status' => 'available']);
        }

        return response()->json($booking->fresh(['customer:id,name', 'vehicle:id,brand,model']));
    }
}
