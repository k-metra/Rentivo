<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Organization extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'logo_path',
        'plan',
        'subscription_status',
        'trial_started_at',
        'trial_ends_at',
        'subscription_started_at',
        'subscription_ends_at',
        'billing_currency',
        'primary_color',
        'electronic_signature_enabled',
        'online_booking_enabled',
        'online_booking_slug',
        'online_booking_phone',
        'customer_requirements_expiry_months',
        'online_booking_requirements',
        'delivery_methods',
        'professional_driver_enabled',
        'phone',
        'website',
        'address',
        'city',
        'country',
        'province',
        'social_pages',
        'timezone',
        'currency',
        'rental_unit',
        'tax_name',
        'tax_rate',
        'onboarding_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'tax_rate' => 'decimal:2',
            'onboarding_completed_at' => 'datetime',
            'social_pages' => 'array',
            'trial_started_at' => 'datetime',
            'trial_ends_at' => 'datetime',
            'subscription_started_at' => 'datetime',
            'subscription_ends_at' => 'datetime',
            'electronic_signature_enabled' => 'boolean',
            'online_booking_enabled' => 'boolean',
            'professional_driver_enabled' => 'boolean',
            'online_booking_requirements' => 'array',
            'delivery_methods' => 'array',
        ];
    }

    public static function expireDueSubscriptions(): int
    {
        $expiredTrials = static::query()
            ->where('subscription_status', 'free_trial')
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', now())
            ->update(['subscription_status' => 'expired']);

        $expiredPaidSubscriptions = static::query()
            ->where('subscription_status', 'active')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<=', now())
            ->update(['subscription_status' => 'expired']);

        return $expiredTrials + $expiredPaidSubscriptions;
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_memberships')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function subscriptionHistory(): HasMany
    {
        return $this->hasMany(SubscriptionHistory::class)->latest();
    }
}
