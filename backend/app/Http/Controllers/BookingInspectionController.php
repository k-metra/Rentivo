<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingInspection;
use App\Models\BookingInspectionMedia;
use App\Models\BookingPostInspectionMedia;
use App\Models\Organization;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingInspectionController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    public function showPreInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $inspection = $booking->inspection()->with('media')->first();

        return response()->json(['inspection' => $inspection]);
    }

    public function savePreInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $existingInspection = $booking->inspection()->first();
        abort_if($existingInspection?->status === 'completed', 422, 'Completed pre-inspection details cannot be changed.');

        foreach (['functions', 'tires'] as $jsonField) {
            $raw = $request->input($jsonField);
            if (is_string($raw)) {
                $request->merge([$jsonField => json_decode($raw, true) ?: []]);
            }
        }

        $validated = $request->validate([
            'fuel_level' => ['required', 'integer', 'min:0', 'max:100'],
            'odometer_reading' => ['required', 'integer', 'min:0'],
            'easytrip_balance' => ['nullable', 'numeric', 'min:0'],
            'autosweep_balance' => ['nullable', 'numeric', 'min:0'],
            'functions' => ['nullable', 'array'],
            'tires' => ['nullable', 'array'],
            'signature_data' => ['nullable', 'string'],
            'signer_name' => ['nullable', 'string', 'max:255'],
            'actual_release_at' => ['nullable', 'date'],
        ]);

        $inspection = $booking->inspection()->firstOrNew();
        $inspection->fill([
            'booking_id' => $booking->id,
            'created_by' => $request->user()->id,
            'fuel_level' => $validated['fuel_level'],
            'odometer_reading' => $validated['odometer_reading'],
            'easytrip_balance' => $validated['easytrip_balance'] ?? 0,
            'autosweep_balance' => $validated['autosweep_balance'] ?? 0,
            'functions' => $validated['functions'] ?? [],
            'tires' => $validated['tires'] ?? [],
            'signature_data' => $validated['signature_data'] ?? null,
            'signer_name' => $validated['signer_name'] ?? null,
            'actual_release_at' => $validated['actual_release_at'] ?? null,
            'status' => $inspection->status === 'completed' ? 'completed' : 'draft',
        ]);
        $inspection->save();

        $this->storePreInspectionMedia($request, $inspection);

        return response()->json(['inspection' => $inspection->fresh('media')]);
    }

    public function completePreInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $inspection = $booking->inspection()->with('media')->first();
        abort_if(! $inspection, 422, 'Save the pre-inspection before completing it.');
        abort_if($inspection->status === 'completed', 422, 'This pre-inspection has already been completed.');
        $validated = $request->validate([
            'signature_data' => ['required', 'string', 'min:100'],
            'signer_name' => ['required', 'string', 'max:255'],
            'actual_release_at' => ['required', 'date'],
        ]);
        $inspection->update([
            'signature_data' => $validated['signature_data'],
            'signer_name' => $validated['signer_name'],
            'actual_release_at' => $validated['actual_release_at'],
            'status' => 'completed',
            'completed_at' => now(),
        ]);
        $booking->update([
            'status' => 'ongoing',
            'pickup_at' => $validated['actual_release_at'],
        ]);
        Vehicle::whereKey($booking->vehicle_id)->update(['status' => 'rented']);

        return response()->json([
            'inspection' => $inspection->fresh('media'),
            'booking' => $booking->fresh(['customer:id,name', 'vehicle:id,name,brand,model,year,image_path']),
        ]);
    }

    private function storePreInspectionMedia(Request $request, BookingInspection $inspection): void
    {
        foreach (['exterior', 'interior'] as $section) {
            $files = $request->file($section, []);
            foreach ($files as $index => $file) {
                $path = $file->store("inspections/{$inspection->id}/{$section}", 'public');
                BookingInspectionMedia::create([
                    'booking_inspection_id' => $inspection->id,
                    'section' => $section,
                    'media_type' => str_starts_with($file->getMimeType(), 'video/') ? 'video' : 'photo',
                    'file_path' => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getMimeType(),
                    'label' => $request->input("{$section}_labels.$index"),
                    'condition' => $request->input("{$section}_conditions.$index"),
                ]);
            }
        }
    }

    public function showPostInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $inspection = $booking->postInspection()->with('media')->first();

        return response()->json(['inspection' => $inspection]);
    }

    public function savePostInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);

        foreach (['functions', 'tires'] as $jsonField) {
            $raw = $request->input($jsonField);
            if (is_string($raw)) {
                $request->merge([$jsonField => json_decode($raw, true) ?: []]);
            }
        }

        $validated = $request->validate([
            'fuel_level' => ['required', 'integer', 'min:0', 'max:100'],
            'odometer_reading' => ['required', 'integer', 'min:0'],
            'easytrip_balance' => ['nullable', 'numeric', 'min:0'],
            'autosweep_balance' => ['nullable', 'numeric', 'min:0'],
            'functions' => ['nullable', 'array'],
            'tires' => ['nullable', 'array'],
            'signature_data' => ['nullable', 'string'],
            'signer_name' => ['nullable', 'string', 'max:255'],
            'actual_return_at' => ['nullable', 'date'],
        ]);

        $inspection = $booking->postInspection()->firstOrNew();
        if ($inspection->status === 'completed') {
            abort(422, 'Completed post-inspection details cannot be changed.');
        }
        $inspection->fill([
            'booking_id' => $booking->id,
            'created_by' => $request->user()->id,
            'fuel_level' => $validated['fuel_level'],
            'odometer_reading' => $validated['odometer_reading'],
            'easytrip_balance' => $validated['easytrip_balance'] ?? 0,
            'autosweep_balance' => $validated['autosweep_balance'] ?? 0,
            'functions' => $validated['functions'] ?? [],
            'tires' => $validated['tires'] ?? [],
            'signature_data' => $validated['signature_data'] ?? null,
            'signer_name' => $validated['signer_name'] ?? null,
            'actual_return_at' => $validated['actual_return_at'] ?? null,
            'status' => 'draft',
        ]);
        $inspection->save();

        foreach (['exterior', 'interior'] as $section) {
            $files = $request->file($section, []);
            foreach ($files as $index => $file) {
                $path = $file->store("post-inspections/{$inspection->id}/{$section}", 'public');
                BookingPostInspectionMedia::create([
                    'booking_post_inspection_id' => $inspection->id,
                    'section' => $section,
                    'media_type' => str_starts_with($file->getMimeType(), 'video/') ? 'video' : 'photo',
                    'file_path' => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getMimeType(),
                    'label' => $request->input("{$section}_labels.$index"),
                    'condition' => $request->input("{$section}_conditions.$index"),
                ]);
            }
        }

        return response()->json(['inspection' => $inspection->fresh('media')]);
    }

    public function completePostInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $inspection = $booking->postInspection()->with('media')->first();
        abort_if(! $inspection, 422, 'Save the post-inspection before completing it.');
        abort_if($inspection->status === 'completed', 422, 'This post-inspection has already been completed.');
        $validated = $request->validate([
            'signature_data' => ['required', 'string', 'min:100'],
            'signer_name' => ['required', 'string', 'max:255'],
            'actual_return_at' => ['required', 'date'],
        ]);
        $inspection->update([
            'signature_data' => $validated['signature_data'],
            'signer_name' => $validated['signer_name'],
            'actual_return_at' => $validated['actual_return_at'],
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $preInspection = $booking->inspection()->first();
        $vehicle = $booking->vehicle()->first();
        $missingFuelBars = $preInspection
            ? max(0, (int) $preInspection->fuel_level - (int) $inspection->fuel_level) / 5
            : 0;
        $fuelCharge = round($missingFuelBars * 500, 2);

        $rfidCharge = 0.0;
        $rfidRefundCredit = 0.0;
        if ($preInspection) {
            $easytripDifference = (float) $preInspection->easytrip_balance - (float) $inspection->easytrip_balance;
            $autosweepDifference = (float) $preInspection->autosweep_balance - (float) $inspection->autosweep_balance;
            $rfidCharge = max(0, $easytripDifference) + max(0, $autosweepDifference);
            $rfidRefundCredit = max(0, -$easytripDifference) + max(0, -$autosweepDifference);
        }

        $distanceTraveled = max(0, (int) $inspection->odometer_reading - (int) ($preInspection->odometer_reading ?? 0));
        $allowedMileage = 0;
        $excessMileage = 0;
        $excessMileageCharge = 0.0;
        if ($vehicle && $vehicle->mileage_limit) {
            $allowedMileage = (int) $vehicle->mileage_limit;
            if ($vehicle->mileage_limit_unit === 'day') {
                $rentalDays = max(1, (int) ceil(max(1, strtotime($booking->return_at) - strtotime($booking->pickup_at)) / 86400));
                $allowedMileage *= $rentalDays;
            }
            $excessMileage = max(0, $distanceTraveled - $allowedMileage);
            $excessMileageCharge = round($excessMileage * (float) ($vehicle->excess_mileage_rate ?? 0), 2);
        }

        $inspection->update([
            'fuel_charge' => $fuelCharge,
            'rfid_charge' => $rfidCharge,
            'rfid_refund_credit' => $rfidRefundCredit,
            'distance_traveled' => $distanceTraveled,
            'allowed_mileage' => $allowedMileage,
            'excess_mileage' => $excessMileage,
            'excess_mileage_charge' => $excessMileageCharge,
        ]);

        $additionalAdjustment = $fuelCharge + $rfidCharge + $excessMileageCharge;
        $newAdditionalCharges = (float) $booking->additional_charges + $additionalAdjustment;
        $booking->update([
            'status' => 'complete',
            'return_at' => $validated['actual_return_at'],
            'additional_charges' => $newAdditionalCharges,
            'total_amount' => (float) $booking->rental_amount + $newAdditionalCharges,
        ]);
        Vehicle::whereKey($booking->vehicle_id)->update(['status' => 'available']);

        return response()->json([
            'inspection' => $inspection->fresh('media'),
            'booking' => $booking->fresh(['customer:id,name', 'vehicle:id,name,brand,model,year,image_path']),
        ]);
    }
}
