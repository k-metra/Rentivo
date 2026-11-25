<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('organizations')
            ->whereIn('plan', ['Professional', 'Business', 'Enterprise'])
            ->update(['online_booking_enabled' => true]);
    }

    public function down(): void
    {
        // Keep workspace settings unchanged when rolling back this data migration.
    }
};
