<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingContract extends Model
{
    protected $fillable = [
        'booking_id',
        'organization_id',
        'created_by',
        'title',
        'template_html',
        'resolved_html',
        'share_token',
        'pin_hash',
        'status',
        'renter_signature_data',
        'renter_signer_name',
        'staff_signature_data',
        'staff_signer_name',
        'review_confirmed',
        'renter_review_confirmed',
        'staff_review_confirmed',
        'signed_at',
        'renter_signed_at',
        'staff_signed_at',
        'expires_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'review_confirmed' => 'boolean',
            'renter_review_confirmed' => 'boolean',
            'staff_review_confirmed' => 'boolean',
            'signed_at' => 'datetime',
            'renter_signed_at' => 'datetime',
            'staff_signed_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
