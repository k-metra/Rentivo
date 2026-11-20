<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    protected $fillable = [
        'organization_id', 'name', 'brand', 'model', 'year', 'color', 'plate_number',
        'seat_count', 'type', 'daily_rate', 'security_deposit', 'hourly_extension_rate',
        'mileage_limit', 'mileage_limit_unit', 'transmission', 'fuel_type', 'image_path', 'status',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'seat_count' => 'integer',
            'daily_rate' => 'decimal:2',
            'security_deposit' => 'decimal:2',
            'hourly_extension_rate' => 'decimal:2',
            'mileage_limit' => 'integer',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function rentalRates(): HasMany
    {
        return $this->hasMany(VehicleRentalRate::class);
    }
}
