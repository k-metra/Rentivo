<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrganizationRole extends Model
{
    protected $fillable = [
        'organization_id',
        'name',
        'description',
        'permissions',
        'is_owner',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'is_owner' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(OrganizationMembership::class, 'role_id');
    }
}
