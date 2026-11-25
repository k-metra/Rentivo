<?php

namespace App\Services;

class PlanLimits
{
    public function userLimit(?string $plan): ?int
    {
        return match ($plan) {
            'Solo' => 1,
            'Growth' => 3,
            'Professional' => 5,
            'Business' => 10,
            'Enterprise' => null,
            default => 10,
        };
    }

    public function vehicleLimit(?string $plan): ?int
    {
        return match ($plan) {
            'Solo' => 3,
            'Growth' => 7,
            'Professional' => 15,
            'Business' => 35,
            'Enterprise' => null,
            default => 35,
        };
    }
}
