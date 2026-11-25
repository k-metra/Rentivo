<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_request_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_request_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type');
            $table->unsignedBigInteger('size');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->unique(['booking_request_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_request_documents');
    }
};
