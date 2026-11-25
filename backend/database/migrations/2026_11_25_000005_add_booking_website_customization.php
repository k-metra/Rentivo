<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->string('online_booking_hero_title', 120)->nullable()->after('online_booking_slug');
            $table->text('online_booking_hero_subtitle')->nullable()->after('online_booking_hero_title');
            $table->string('online_booking_banner_path')->nullable()->after('online_booking_hero_subtitle');
        });

        DB::table('organizations')
            ->whereIn('plan', ['Growth', 'Professional', 'Business', 'Enterprise'])
            ->update(['online_booking_enabled' => true]);
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn([
                'online_booking_hero_title',
                'online_booking_hero_subtitle',
                'online_booking_banner_path',
            ]);
        });
    }
};
