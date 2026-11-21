<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_rental_rates', function (Blueprint $table): void {
            if (! Schema::hasColumn('vehicle_rental_rates', 'outside_amount')) {
                $table->decimal('outside_amount', 12, 2)->nullable()->after('amount_type');
            }
            if (! Schema::hasColumn('vehicle_rental_rates', 'coverage_type')) {
                $table->string('coverage_type')->default('all')->after('outside_amount');
            }
            if (! Schema::hasColumn('vehicle_rental_rates', 'coverage_locations')) {
                $table->json('coverage_locations')->nullable()->after('coverage_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_rental_rates', function (Blueprint $table): void {
            $table->dropColumn(['outside_amount', 'coverage_type', 'coverage_locations']);
        });
    }
};
