<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BookingInspection extends Model
{
    protected $fillable = [
        'booking_id', 'created_by', 'fuel_level', 'odometer_reading',
        'easytrip_balance', 'autosweep_balance', 'functions', 'tires',
        'signature_data', 'signer_name', 'status', 'completed_at', 'actual_release_at',
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
            'actual_release_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(BookingInspectionMedia::class)->orderBy('created_at');
    }
}
