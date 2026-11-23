<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('expenses')) {
            return;
        }
        Schema::table('expenses', function (Blueprint $table): void {
            if (Schema::hasColumn('expenses', 'vendor')) {
                $table->dropColumn('vendor');
            }
            if (Schema::hasColumn('expenses', 'payment_method')) {
                $table->dropColumn('payment_method');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('expenses')) {
            return;
        }
        Schema::table('expenses', function (Blueprint $table): void {
            if (! Schema::hasColumn('expenses', 'vendor')) {
                $table->string('vendor')->nullable()->after('category');
            }
            if (! Schema::hasColumn('expenses', 'payment_method')) {
                $table->string('payment_method')->default('cash')->after('incurred_at');
            }
        });
    }
};
