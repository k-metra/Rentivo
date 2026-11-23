<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->string('plan')->default('Business')->after('slug');
            $table->string('primary_color')->default('#5b21b6')->after('logo_path');
            $table->boolean('electronic_signature_enabled')->default(false)->after('primary_color');
            $table->boolean('online_booking_enabled')->default(false)->after('electronic_signature_enabled');
            $table->string('online_booking_slug')->nullable()->after('online_booking_enabled');
            $table->string('online_booking_phone')->nullable()->after('online_booking_slug');
            $table->unsignedInteger('customer_requirements_expiry_months')->default(12)->after('online_booking_slug');
            $table->json('online_booking_requirements')->nullable()->after('customer_requirements_expiry_months');
            $table->json('delivery_methods')->nullable()->after('online_booking_requirements');
            $table->boolean('professional_driver_enabled')->default(false)->after('delivery_methods');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn([
                'plan',
                'primary_color',
                'electronic_signature_enabled',
                'online_booking_enabled',
                'online_booking_slug',
                'online_booking_phone',
                'customer_requirements_expiry_months',
                'online_booking_requirements',
                'delivery_methods',
                'professional_driver_enabled',
            ]);
        });
    }
};
