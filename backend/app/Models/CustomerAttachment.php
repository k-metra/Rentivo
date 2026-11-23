<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerAttachment extends Model
{
    protected $fillable = ['customer_id', 'category', 'file_path', 'original_name', 'mime_type', 'size'];
    protected $appends = ['url'];

    public function getUrlAttribute(): string
    {
        return url('/storage/'.$this->file_path);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
