<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->string('destination_city')->nullable()->after('total_amount');
            $table->string('destination_province')->nullable()->after('destination_city');
            $table->text('remarks')->nullable()->after('destination_province');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->dropColumn(['destination_city', 'destination_province', 'remarks']);
        });
    }
};
