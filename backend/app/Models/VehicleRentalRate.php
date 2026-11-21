<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleRentalRate extends Model
{
    protected $fillable = ['vehicle_id', 'duration_hours', 'location_scope', 'province', 'amount', 'amount_type', 'outside_amount', 'coverage_type', 'coverage_locations'];

    protected function casts(): array
    {
        return [
            'duration_hours' => 'integer',
            'amount' => 'decimal:2',
            'outside_amount' => 'decimal:2',
            'coverage_locations' => 'array',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
