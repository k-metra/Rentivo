<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('expenses')) {
            return;
        }

        Schema::table('expenses', function (Blueprint $table): void {
            if (! Schema::hasColumn('expenses', 'vehicle_id')) {
                $table->foreignId('vehicle_id')->nullable()->after('category')->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('expenses', 'expense_type')) {
                $table->string('expense_type')->nullable()->after('vehicle_id');
            }
        });

        $legacyExpenses = DB::table('expenses')
            ->whereNotIn('category', ['unit-related', 'general'])
            ->get(['id', 'category', 'expense_type']);

        foreach ($legacyExpenses as $expense) {
            DB::table('expenses')->where('id', $expense->id)->update([
                'category' => 'general',
                'expense_type' => $expense->expense_type ?: $expense->category,
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('expenses')) {
            return;
        }
        Schema::table('expenses', function (Blueprint $table): void {
            if (Schema::hasColumn('expenses', 'vehicle_id')) {
                $table->dropConstrainedForeignId('vehicle_id');
            }
        });
        if (Schema::hasColumn('expenses', 'expense_type')) {
            Schema::table('expenses', function (Blueprint $table): void {
                $table->dropColumn('expense_type');
            });
        }
    }
};
