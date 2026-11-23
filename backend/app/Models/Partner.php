<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Partner extends Model
{
    protected $fillable = [
        'organization_id',
        'name',
        'first_name',
        'middle_name',
        'last_name',
        'type',
        'email',
        'phone',
        'address',
        'notes',
        'commission_rate',
        'status',
    ];

    protected function casts(): array
    {
        return ['commission_rate' => 'decimal:2'];
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }
}
