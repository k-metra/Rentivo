<?php

namespace App\Services;

use App\Models\Vehicle;
use Illuminate\Support\Carbon;

class BookingPricing
{
    public function calculateRentalAmount(
        Vehicle $vehicle,
        string $pickupAt,
        string $returnAt,
        ?string $destinationProvince,
    ): float {
        return $this->calculateEstimate($vehicle, $pickupAt, $returnAt, $destinationProvince)['rental_amount'];
    }

    public function calculateEstimate(
        Vehicle $vehicle,
        string $pickupAt,
        string $returnAt,
        ?string $destinationProvince,
    ): array {
        $pickup = Carbon::parse($pickupAt);
        $return = Carbon::parse($returnAt);
        $durationMinutes = max(1, (int) $pickup->diffInMinutes($return, false));
        $rates = $vehicle->rentalRates()->get();
        $rateFor = fn (int $hours) => $rates->firstWhere('duration_hours', $hours);

        $twelve = $rateFor(12);
        $twentyFour = $rateFor(24);
        $six = $rateFor(6);
        $twelveAmount = (float) ($twelve?->amount ?? ($twentyFour ? (float) $twentyFour->amount / 2 : $vehicle->daily_rate / 2));
        $dailyAmount = (float) ($twentyFour?->amount ?? $vehicle->daily_rate);
        $breakdown = [];
        $addRate = function ($rate, float $fallback, string $label, int $units = 1) use ($destinationProvince, &$breakdown): float {
            $baseAmount = $rate ? (float) $rate->amount : $fallback;
            $outsideAmount = $rate
                && ($rate->coverage_type ?? 'all') === 'province'
                && $destinationProvince
                && ! in_array($destinationProvince, $rate->coverage_locations ?? [], true)
                    ? (float) ($rate->outside_amount ?? 0)
                    : 0;

            if ($rate && $baseAmount + $outsideAmount <= 0) {
                $baseAmount = $fallback;
                $outsideAmount = 0;
            }

            if ($baseAmount > 0) {
                $breakdown[] = [
                    'label' => $label.($units > 1 ? " × {$units}" : ''),
                    'amount' => $baseAmount * $units,
                ];
            }
            if ($outsideAmount > 0) {
                $breakdown[] = [
                    'label' => 'Outside-area charge'.($units > 1 ? " × {$units}" : ''),
                    'amount' => $outsideAmount * $units,
                ];
            }

            return ($baseAmount + $outsideAmount) * $units;
        };

        if ($durationMinutes <= 720) {
            $rate = $twelve ?? $six;
            $amount = $addRate($rate, $twelveAmount, $twelve ? '12-hour rental rate' : '6-hour rental rate');
        } elseif ($durationMinutes <= 1440) {
            $amount = $addRate($twentyFour, $dailyAmount, '24-hour rental rate');
        } else {
            $fullDays = intdiv($durationMinutes, 1440);
            $remainder = $durationMinutes % 1440;
            $amount = $addRate($twentyFour, $dailyAmount, '24-hour rental rate', $fullDays);

            if ($remainder > 0) {
                $remainderHours = (int) ceil($remainder / 60);
                if ($remainderHours === 12) {
                    $amount += $addRate($twelve, $twelveAmount, '12-hour rental rate');
                } elseif ($remainderHours < 12) {
                    $hourlyExtensionRate = (float) ($vehicle->hourly_extension_rate ?? 0);
                    $extensionAmount = $remainderHours * $hourlyExtensionRate;
                    if ($extensionAmount > 0) {
                        $breakdown[] = [
                            'label' => "Hourly extension × {$remainderHours}",
                            'amount' => $extensionAmount,
                        ];
                    }
                    $amount += $extensionAmount;
                } else {
                    $amount += $addRate($twelve, $twelveAmount, '12-hour rental rate');
                    $extensionHours = $remainderHours - 12;
                    $hourlyExtensionRate = (float) ($vehicle->hourly_extension_rate ?? 0);
                    $extensionAmount = $extensionHours * $hourlyExtensionRate;
                    if ($extensionAmount > 0) {
                        $breakdown[] = [
                            'label' => "Hourly extension × {$extensionHours}",
                            'amount' => $extensionAmount,
                        ];
                    }
                    $amount += $extensionAmount;
                }
            }
        }

        return [
            'rental_amount' => $amount,
            'daily_rate' => $dailyAmount,
            'breakdown' => $breakdown,
            'security_deposit' => (float) ($vehicle->security_deposit ?? 0),
        ];
    }
}
