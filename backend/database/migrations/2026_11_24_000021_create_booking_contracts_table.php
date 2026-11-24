<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_contracts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->longText('template_html');
            $table->longText('resolved_html');
            $table->string('share_token', 64)->unique();
            $table->string('pin_hash');
            $table->string('status')->default('issued');
            $table->longText('renter_signature_data')->nullable();
            $table->string('renter_signer_name')->nullable();
            $table->boolean('review_confirmed')->default(false);
            $table->timestamp('signed_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_contracts');
    }
};
