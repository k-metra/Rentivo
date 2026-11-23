<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionHistory extends Model
{
    protected $table = 'subscription_history';
    protected $fillable = [
        'organization_id',
        'plan',
        'billing_cycle',
        'duration_days',
        'price',
        'processing_fee',
        'discount',
        'total_due',
        'status',
        'starts_at',
        'ends_at',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'duration_days' => 'integer',
            'price' => 'decimal:2',
            'processing_fee' => 'decimal:2',
            'discount' => 'decimal:2',
            'total_due' => 'decimal:2',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
