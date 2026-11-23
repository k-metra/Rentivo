<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BookingPostInspection extends Model
{
    protected $fillable = [
        'booking_id', 'created_by', 'fuel_level', 'odometer_reading',
        'easytrip_balance', 'autosweep_balance', 'functions', 'tires',
        'signature_data', 'signer_name', 'status', 'completed_at', 'actual_return_at',
        'fuel_charge', 'rfid_charge', 'rfid_refund_credit',
        'distance_traveled', 'allowed_mileage', 'excess_mileage', 'excess_mileage_charge',
    ];

    protected function casts(): array
    {
        return [
            'fuel_level' => 'integer',
            'odometer_reading' => 'integer',
            'easytrip_balance' => 'decimal:2',
            'autosweep_balance' => 'decimal:2',
            'functions' => 'array',
            'tires' => 'array',
            'completed_at' => 'datetime',
            'actual_return_at' => 'datetime',
            'fuel_charge' => 'decimal:2',
            'rfid_charge' => 'decimal:2',
            'rfid_refund_credit' => 'decimal:2',
            'distance_traveled' => 'integer',
            'allowed_mileage' => 'integer',
            'excess_mileage' => 'integer',
            'excess_mileage_charge' => 'decimal:2',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(BookingPostInspectionMedia::class)->orderBy('created_at');
    }
}
