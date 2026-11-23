<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table): void {
            $table->decimal('excess_mileage_rate', 12, 2)->nullable()->after('hourly_extension_rate');
        });

        Schema::table('booking_post_inspections', function (Blueprint $table): void {
            $table->decimal('fuel_charge', 12, 2)->default(0);
            $table->decimal('rfid_charge', 12, 2)->default(0);
            $table->decimal('rfid_refund_credit', 12, 2)->default(0);
            $table->unsignedInteger('distance_traveled')->default(0);
            $table->unsignedInteger('allowed_mileage')->default(0);
            $table->unsignedInteger('excess_mileage')->default(0);
            $table->decimal('excess_mileage_charge', 12, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('booking_post_inspections', function (Blueprint $table): void {
            $table->dropColumn([
                'fuel_charge', 'rfid_charge', 'rfid_refund_credit',
                'distance_traveled', 'allowed_mileage', 'excess_mileage',
                'excess_mileage_charge',
            ]);
        });
        Schema::table('vehicles', function (Blueprint $table): void {
            $table->dropColumn('excess_mileage_rate');
        });
    }
};
