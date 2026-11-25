<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Organization;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class BookingAvailability
{
    private const RESERVED_STATUSES = [
        'pending',
        'confirmed',
        'upcoming',
        'pre_inspection',
        'ongoing',
        'active',
        'for_completion',
    ];

    public function availableVehicles(Organization $organization, Carbon|string $pickupAt, Carbon|string $returnAt): Collection
    {
        $pickup = $this->asCarbon($pickupAt);
        $return = $this->asCarbon($returnAt);
        $vehicles = Vehicle::query()
            ->where('organization_id', $organization->id)
            ->where('status', '!=', 'maintenance')
            ->with('rentalRates')
            ->orderBy('brand')
            ->orderBy('model')
            ->get();

        if ($vehicles->isEmpty()) {
            return $vehicles;
        }

        $bookingsByVehicle = $this->overlappingCandidates($vehicles->modelKeys(), $return)
            ->get()
            ->groupBy('vehicle_id');

        return $vehicles
            ->reject(fn (Vehicle $vehicle): bool => $this->hasConflict(
                $bookingsByVehicle->get($vehicle->id, collect()),
                $pickup,
                $return,
            ))
            ->values();
    }

    public function assertAvailable(
        Vehicle $vehicle,
        Carbon|string $pickupAt,
        Carbon|string $returnAt,
        ?int $exceptBookingId = null,
    ): void {
        if ($vehicle->status === 'maintenance') {
            throw ValidationException::withMessages([
                'vehicle_id' => 'This vehicle is not available for rental.',
            ]);
        }

        $pickup = $this->asCarbon($pickupAt);
        $return = $this->asCarbon($returnAt);
        $bookings = $this->overlappingCandidates([$vehicle->id], $return)
            ->when($exceptBookingId, fn (Builder $query) => $query->where('id', '!=', $exceptBookingId))
            ->get();

        if ($this->hasConflict($bookings, $pickup, $return)) {
            throw ValidationException::withMessages([
                'vehicle_id' => 'This vehicle is no longer available for the selected dates.',
            ]);
        }
    }

    public function reservedRanges(Vehicle $vehicle, Carbon|string $from): Collection
    {
        $from = $this->asCarbon($from);

        return Booking::query()
            ->where('vehicle_id', $vehicle->id)
            ->whereIn('status', self::RESERVED_STATUSES)
            ->where(function (Builder $query) use ($from): void {
                $query->where('return_at', '>', $from)
                    ->orWhereHas('extensions', fn (Builder $extensions) => $extensions
                        ->whereNull('undone_at')
                        ->where('new_return_at', '>', $from));
            })
            ->with([
                'extensions' => fn ($query) => $query
                    ->reorder()
                    ->whereNull('undone_at')
                    ->orderByDesc('id'),
            ])
            ->get()
            ->map(function (Booking $booking): array {
                return [
                    'start' => $booking->pickup_at,
                    'end' => $booking->extensions->first()?->new_return_at ?? $booking->return_at,
                ];
            })
            ->filter(fn (array $range): bool => $range['end']->gt($from))
            ->values();
    }

    private function overlappingCandidates(array $vehicleIds, Carbon $returnAt): Builder
    {
        return Booking::query()
            ->whereIn('vehicle_id', $vehicleIds)
            ->whereIn('status', self::RESERVED_STATUSES)
            ->where('pickup_at', '<', $returnAt)
            ->with([
                'extensions' => fn ($query) => $query
                    ->reorder()
                    ->whereNull('undone_at')
                    ->orderByDesc('id'),
            ]);
    }

    private function hasConflict(Collection $bookings, Carbon $pickupAt, Carbon $returnAt): bool
    {
        return $bookings->contains(function (Booking $booking) use ($pickupAt, $returnAt): bool {
            $effectiveReturn = $booking->extensions->first()?->new_return_at ?? $booking->return_at;

            return $booking->pickup_at->lt($returnAt) && $effectiveReturn->gt($pickupAt);
        });
    }

    private function asCarbon(Carbon|string $value): Carbon
    {
        return $value instanceof Carbon ? $value : Carbon::parse($value);
    }
}
