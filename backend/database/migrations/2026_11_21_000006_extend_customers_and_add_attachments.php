<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('first_name')->nullable()->after('name');
            $table->string('middle_name')->nullable()->after('first_name');
            $table->string('last_name')->nullable()->after('middle_name');
            $table->date('date_of_birth')->nullable();
            $table->string('license_number')->nullable();
            $table->date('license_expiry')->nullable();
            $table->text('identification_information')->nullable();
            $table->text('notes')->nullable();
            $table->string('referral_source')->nullable();
            $table->string('social_profile_url')->nullable();
            $table->dateTime('archived_at')->nullable();
        });

        Schema::create('customer_attachments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_attachments');
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropColumn([
                'first_name', 'middle_name', 'last_name', 'date_of_birth',
                'license_number', 'license_expiry', 'identification_information',
                'notes', 'referral_source', 'social_profile_url', 'archived_at',
            ]);
        });
    }
};
