<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_contracts', function (Blueprint $table): void {
            $table->longText('staff_signature_data')->nullable()->after('renter_signer_name');
            $table->string('staff_signer_name')->nullable()->after('staff_signature_data');
            $table->timestamp('renter_signed_at')->nullable()->after('renter_signer_name');
            $table->timestamp('staff_signed_at')->nullable()->after('staff_signer_name');
            $table->timestamp('expires_at')->nullable()->after('signed_at');
            $table->boolean('renter_review_confirmed')->default(false)->after('review_confirmed');
            $table->boolean('staff_review_confirmed')->default(false)->after('renter_review_confirmed');
        });
    }

    public function down(): void
    {
        Schema::table('booking_contracts', function (Blueprint $table): void {
            $table->dropColumn([
                'staff_signature_data',
                'staff_signer_name',
                'renter_signed_at',
                'staff_signed_at',
                'expires_at',
                'renter_review_confirmed',
                'staff_review_confirmed',
            ]);
        });
    }
};
