<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('funds', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type')->default('cash');
            $table->decimal('opening_balance', 12, 2)->default(0);
            $table->string('account_name')->nullable();
            $table->string('account_number')->nullable();
            $table->string('qr_code_path')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('fund_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fund_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->dateTime('transacted_at');
            $table->decimal('amount', 12, 2);
            $table->string('description');
            $table->text('notes')->nullable();
            $table->string('transfer_reference')->nullable()->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->foreignId('fund_id')->nullable()->after('booking_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('fund_id');
        });
        Schema::dropIfExists('fund_transactions');
        Schema::dropIfExists('funds');
    }
};
