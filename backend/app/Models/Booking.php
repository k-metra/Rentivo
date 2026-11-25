<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Booking extends Model
{
    protected $fillable = [
        'organization_id', 'customer_id', 'vehicle_id', 'created_by', 'reference',
        'pickup_at', 'return_at', 'rental_amount', 'additional_charges',
        'total_amount', 'destination_city', 'destination_province', 'remarks', 'status', 'payment_status',
        'custom_rental_rate', 'delivery_method', 'professional_driver_requested',
    ];

    protected function casts(): array
    {
        return [
            'pickup_at' => 'datetime',
            'return_at' => 'datetime',
            'rental_amount' => 'decimal:2',
            'additional_charges' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'custom_rental_rate' => 'boolean',
            'professional_driver_requested' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(BookingExtension::class)->orderBy('created_at');
    }

    public function inspection(): HasOne
    {
        return $this->hasOne(BookingInspection::class);
    }

    public function postInspection(): HasOne
    {
        return $this->hasOne(BookingPostInspection::class);
    }

    public function contract(): HasOne
    {
        return $this->hasOne(BookingContract::class)->latestOfMany();
    }
}
