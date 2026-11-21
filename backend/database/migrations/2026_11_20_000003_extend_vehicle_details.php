<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table): void {
            $table->string('color')->nullable()->after('name');
            $table->unsignedInteger('seat_count')->default(4)->after('plate_number');
            $table->decimal('security_deposit', 12, 2)->nullable()->after('daily_rate');
            $table->decimal('hourly_extension_rate', 12, 2)->nullable()->after('security_deposit');
            $table->unsignedInteger('mileage_limit')->nullable()->after('hourly_extension_rate');
            $table->string('mileage_limit_unit')->default('rental')->after('mileage_limit');
            $table->string('transmission')->nullable()->after('type');
            $table->string('fuel_type')->nullable()->after('transmission');
            $table->string('image_path')->nullable()->after('fuel_type');
        });

        Schema::create('vehicle_rental_rates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('duration_hours');
            $table->string('location_scope')->default('all');
            $table->string('province')->nullable();
            $table->decimal('amount', 12, 2);
            $table->timestamps();
            $table->unique(['vehicle_id', 'duration_hours', 'location_scope', 'province'], 'vehicle_duration_location_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_rental_rates');
        Schema::table('vehicles', function (Blueprint $table): void {
            $table->dropColumn([
                'color',
                'seat_count',
                'security_deposit',
                'hourly_extension_rate',
                'mileage_limit',
                'mileage_limit_unit',
                'transmission',
                'fuel_type',
                'image_path',
            ]);
        });
    }
};
