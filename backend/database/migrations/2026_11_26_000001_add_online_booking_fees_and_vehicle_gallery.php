<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->decimal('online_booking_reservation_fee_amount', 12, 2)->nullable();
            $table->boolean('online_booking_reservation_fee_deductible')->default(true);
            $table->text('online_booking_reservation_payment_instructions')->nullable();
            $table->string('online_booking_reservation_qr_path')->nullable();
        });

        Schema::table('booking_requests', function (Blueprint $table): void {
            $table->text('customer_address')->nullable();
            $table->string('customer_facebook_profile')->nullable();
            $table->string('referral_source')->nullable();
            $table->json('quoted_rental_breakdown')->nullable();
            $table->decimal('reservation_fee_amount', 12, 2)->nullable();
            $table->boolean('reservation_fee_deductible')->default(true);
            $table->timestamp('privacy_acknowledged_at')->nullable();
        });

        Schema::create('vehicle_images', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            $table->string('image_path');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['vehicle_id', 'category', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_images');

        Schema::table('booking_requests', function (Blueprint $table): void {
            $table->dropColumn([
                'customer_address',
                'customer_facebook_profile',
                'referral_source',
                'quoted_rental_breakdown',
                'reservation_fee_amount',
                'reservation_fee_deductible',
                'privacy_acknowledged_at',
            ]);
        });

        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn([
                'online_booking_reservation_fee_amount',
                'online_booking_reservation_fee_deductible',
                'online_booking_reservation_payment_instructions',
                'online_booking_reservation_qr_path',
            ]);
        });
    }
};
