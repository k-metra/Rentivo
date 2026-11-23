<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationMembership extends Model
{
    protected $fillable = [
        'organization_id',
        'user_id',
        'role',
        'role_id',
    ];

    public function role(): BelongsTo
    {
        return $this->belongsTo(OrganizationRole::class, 'role_id');
    }
}
