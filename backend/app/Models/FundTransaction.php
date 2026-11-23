<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FundTransaction extends Model
{
    protected $fillable = [
        'organization_id',
        'fund_id',
        'payment_id',
        'expense_id',
        'type',
        'transacted_at',
        'amount',
        'description',
        'notes',
        'transfer_reference',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transacted_at' => 'datetime',
            'amount' => 'decimal:2',
        ];
    }

    public function fund(): BelongsTo
    {
        return $this->belongsTo(Fund::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
