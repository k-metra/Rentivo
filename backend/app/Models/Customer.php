<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'organization_id', 'name', 'first_name', 'middle_name', 'last_name',
        'email', 'phone', 'address', 'date_of_birth', 'license_number',
        'license_expiry', 'identification_information', 'notes',
        'referral_source', 'social_profile_url', 'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'license_expiry' => 'date',
            'archived_at' => 'datetime',
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

    public function attachments(): HasMany
    {
        return $this->hasMany(CustomerAttachment::class);
    }
}
