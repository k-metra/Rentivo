<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_rental_rates', function (Blueprint $table): void {
            $table->string('amount_type')->default('fixed')->after('amount');
            $table->decimal('outside_amount', 12, 2)->nullable()->after('amount_type');
            $table->string('coverage_type')->default('none')->after('outside_amount');
            $table->json('coverage_locations')->nullable()->after('coverage_type');
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_rental_rates', function (Blueprint $table): void {
            $table->dropColumn(['amount_type', 'outside_amount', 'coverage_type', 'coverage_locations']);
        });
    }
};
