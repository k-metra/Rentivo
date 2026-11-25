<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BookingRequest extends Model
{
    protected $fillable = [
        'organization_id',
        'vehicle_id',
        'reviewed_by',
        'booking_id',
        'reference',
        'customer_name',
        'customer_email',
        'customer_phone',
        'customer_address',
        'customer_facebook_profile',
        'referral_source',
        'pickup_at',
        'return_at',
        'destination_city',
        'destination_province',
        'delivery_method',
        'professional_driver_requested',
        'remarks',
        'quoted_rental_amount',
        'quoted_rental_breakdown',
        'reservation_fee_amount',
        'reservation_fee_deductible',
        'privacy_acknowledged_at',
        'status',
        'decline_reason',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'pickup_at' => 'datetime',
            'return_at' => 'datetime',
            'professional_driver_requested' => 'boolean',
            'quoted_rental_amount' => 'decimal:2',
            'quoted_rental_breakdown' => 'array',
            'reservation_fee_amount' => 'decimal:2',
            'reservation_fee_deductible' => 'boolean',
            'privacy_acknowledged_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(BookingRequestDocument::class);
    }
}
