<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name')->nullable();
            $table->string('user_email')->nullable();
            $table->string('module', 100);
            $table->string('action', 100);
            $table->string('route_name')->nullable();
            $table->string('http_method', 10);
            $table->string('ip_address', 45);
            $table->text('user_agent')->nullable();
            $table->string('target_type', 100)->nullable();
            $table->string('target_id', 100)->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedSmallInteger('response_status');
            $table->string('previous_hash', 64);
            $table->string('entry_hash', 64)->unique();
            $table->timestamp('created_at');
            $table->index(['organization_id', 'created_at']);
            $table->index(['organization_id', 'module', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
