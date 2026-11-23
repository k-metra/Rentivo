<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_post_inspections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('fuel_level')->default(100);
            $table->unsignedBigInteger('odometer_reading')->default(0);
            $table->decimal('easytrip_balance', 12, 2)->default(0);
            $table->decimal('autosweep_balance', 12, 2)->default(0);
            $table->json('functions')->nullable();
            $table->json('tires')->nullable();
            $table->longText('signature_data')->nullable();
            $table->string('signer_name')->nullable();
            $table->string('status')->default('draft');
            $table->dateTime('completed_at')->nullable();
            $table->dateTime('actual_return_at')->nullable();
            $table->timestamps();
        });

        Schema::create('booking_post_inspection_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_post_inspection_id')->constrained()->cascadeOnDelete();
            $table->string('section');
            $table->string('media_type');
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->string('label')->nullable();
            $table->string('condition')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_post_inspection_media');
        Schema::dropIfExists('booking_post_inspections');
    }
};
