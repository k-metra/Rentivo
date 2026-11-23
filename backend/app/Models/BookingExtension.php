<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingExtension extends Model
{
    protected $fillable = [
        'booking_id', 'created_by', 'previous_return_at', 'new_return_at',
        'fee', 'pricing_mode', 'notes', 'undone_at',
    ];

    protected function casts(): array
    {
        return [
            'previous_return_at' => 'datetime',
            'new_return_at' => 'datetime',
            'undone_at' => 'datetime',
            'fee' => 'decimal:2',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
