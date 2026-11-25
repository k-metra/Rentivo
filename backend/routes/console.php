<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use App\Models\BookingRequestDocument;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('booking-requests:purge-expired-documents', function (): int {
    $disk = Storage::disk('local');
    $deleted = 0;
    $failed = false;

    BookingRequestDocument::query()
        ->whereNotNull('expires_at')
        ->where('expires_at', '<=', now())
        ->chunkById(100, function ($documents) use ($disk, &$deleted, &$failed): void {
            foreach ($documents as $document) {
                if ($disk->exists($document->file_path) && ! $disk->delete($document->file_path)) {
                    $this->error("Unable to remove expired document {$document->id}.");
                    $failed = true;
                    continue;
                }

                $document->delete();
                $deleted++;
            }
        });

    if ($failed) {
        return self::FAILURE;
    }

    $this->info("Removed {$deleted} expired booking request document(s).");

    return self::SUCCESS;
})->purpose('Remove expired private booking request documents');
