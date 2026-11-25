<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleImage extends Model
{
    protected $fillable = ['vehicle_id', 'category', 'image_path', 'sort_order'];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): string
    {
        return url('/storage/'.$this->image_path);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
