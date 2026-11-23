<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->string('subscription_status')->default('free_trial')->after('plan');
            $table->timestamp('trial_started_at')->nullable()->after('subscription_status');
            $table->timestamp('trial_ends_at')->nullable()->after('trial_started_at');
            $table->timestamp('subscription_started_at')->nullable()->after('trial_ends_at');
            $table->timestamp('subscription_ends_at')->nullable()->after('subscription_started_at');
            $table->string('billing_currency')->default('PHP')->after('subscription_ends_at');
        });

        DB::table('organizations')->orderBy('id')->each(function ($organization): void {
            $startedAt = $organization->created_at ? \Illuminate\Support\Carbon::parse($organization->created_at) : now();
            DB::table('organizations')->where('id', $organization->id)->update([
                'plan' => 'Business',
                'subscription_status' => 'free_trial',
                'trial_started_at' => $startedAt,
                'trial_ends_at' => $startedAt->copy()->addDays(21),
                'billing_currency' => 'PHP',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn([
                'subscription_status',
                'trial_started_at',
                'trial_ends_at',
                'subscription_started_at',
                'subscription_ends_at',
                'billing_currency',
            ]);
        });
    }
};
