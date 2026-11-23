<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fund_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('category');
            $table->string('vendor')->nullable();
            $table->decimal('amount', 12, 2);
            $table->dateTime('incurred_at');
            $table->string('payment_method')->default('cash');
            $table->string('reference')->nullable();
            $table->string('receipt_path')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('fund_transactions', function (Blueprint $table): void {
            $table->foreignId('expense_id')->nullable()->unique()->after('payment_id')->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fund_transactions', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('expense_id');
        });
        Schema::dropIfExists('expenses');
    }
};
