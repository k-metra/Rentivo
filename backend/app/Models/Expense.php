<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Storage;

class Expense extends Model
{
    protected $fillable = [
        'organization_id',
        'fund_id',
        'created_by',
        'title',
        'category',
        'vehicle_id',
        'expense_type',
        'amount',
        'incurred_at',
        'reference',
        'receipt_path',
        'notes',
    ];

    protected $appends = ['receipt_url'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'incurred_at' => 'datetime',
        ];
    }

    public function fund(): BelongsTo
    {
        return $this->belongsTo(Fund::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function getReceiptUrlAttribute(): ?string
    {
        return $this->receipt_path ? Storage::disk('public')->url($this->receipt_path) : null;
    }
}
