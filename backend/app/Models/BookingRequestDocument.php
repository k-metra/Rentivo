<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingRequestDocument extends Model
{
    protected $fillable = [
        'booking_request_id',
        'category',
        'file_path',
        'original_name',
        'mime_type',
        'size',
        'expires_at',
    ];

    protected $hidden = ['file_path'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    public function bookingRequest(): BelongsTo
    {
        return $this->belongsTo(BookingRequest::class);
    }
}
