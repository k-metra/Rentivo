<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    protected $fillable = ['organization_id', 'name', 'brand', 'model', 'year', 'plate_number', 'type', 'daily_rate', 'status'];

    protected function casts(): array
    {
        return ['year' => 'integer', 'daily_rate' => 'decimal:2'];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}
