<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingInspectionMedia extends Model
{
    protected $fillable = [
        'booking_inspection_id', 'section', 'media_type', 'file_path',
        'original_name', 'mime_type', 'label', 'condition',
    ];

    protected $appends = ['url'];

    public function getUrlAttribute(): string
    {
        return url('/storage/'.$this->file_path);
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(BookingInspection::class, 'booking_inspection_id');
    }
}
