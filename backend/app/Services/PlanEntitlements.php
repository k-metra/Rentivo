<?php

namespace App\Services;

use App\Models\Organization;

class PlanEntitlements
{
    public function rank(?string $plan): int
    {
        return match ($plan) {
            'Solo' => 1,
            'Growth' => 2,
            'Professional' => 3,
            'Business' => 4,
            'Enterprise' => 5,
            default => 2,
        };
    }

    public function requireRank(Organization $organization, int $minimumRank, string $feature): void
    {
        abort_unless(
            $this->rank($organization->plan) >= $minimumRank,
            422,
            "{$feature} is not available on the {$organization->plan} plan.",
        );
    }
}
