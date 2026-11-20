<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'logo_path',
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
        ];
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
}
