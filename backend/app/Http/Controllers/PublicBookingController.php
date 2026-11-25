<?php

namespace App\Http\Controllers;

use App\Models\BookingRequest;
use App\Models\BookingRequestDocument;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Services\BookingAvailability;
use App\Services\BookingPricing;
use App\Services\PlanEntitlements;
use App\Services\BookingRequestNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class PublicBookingController extends Controller
{
    private const MAX_BOOKING_FILE_KILOBYTES = 1800;

    private const MAX_BOOKING_ATTACHMENT_BYTES = 7 * 1024 * 1024;

    private const REQUIREMENT_KEYS = [
        'primary_id',
        'secondary_id',
        'proof_of_billing',
        'ltms_screenshots',
        'selfie_with_primary_id',
    ];

    public function form(Request $request, string $slug): JsonResponse
    {
        $organization = $this->bookingOrganization($slug);
        $fullWebsite = app(PlanEntitlements::class)->rank($organization->plan) >= 3;
        $fleet = $fullWebsite
            ? Vehicle::query()
                ->where('organization_id', $organization->id)
                ->where('status', '!=', 'maintenance')
                ->with(['rentalRates', 'images'])
                ->orderBy('brand')
                ->orderBy('model')
                ->get([
                    'id',
                    'name',
                    'brand',
                    'model',
                    'year',
                    'color',
                    'seat_count',
                    'type',
                    'transmission',
                    'fuel_type',
                    'image_path',
                    'marketing_image_path',
                    'daily_rate',
                ])
                ->map(fn (Vehicle $vehicle): array => [
                    'id' => $vehicle->id,
                    'name' => $vehicle->name,
                    'brand' => $vehicle->brand,
                    'model' => $vehicle->model,
                    'year' => $vehicle->year,
                    'color' => $vehicle->color,
                    'seat_count' => $vehicle->seat_count,
                    'type' => $vehicle->type,
                    'transmission' => $vehicle->transmission,
                    'fuel_type' => $vehicle->fuel_type,
                    'image_url' => $vehicle->image_url,
                    'marketing_image_url' => $vehicle->marketing_image_url,
                    'daily_rate' => $vehicle->daily_rate,
                    'rental_rates' => $vehicle->rentalRates->map(fn ($rate): array => [
                        'duration_hours' => $rate->duration_hours,
                        'amount' => $rate->amount,
                        'outside_amount' => $rate->outside_amount,
                    ])->values(),
                    'images' => $vehicle->images->map(fn ($image): array => [
                        'id' => $image->id,
                        'category' => $image->category,
                        'image_url' => $image->image_url,
                    ])->values(),
                ])
                ->values()
            : [];

        return response()->json([
            'website_tier' => $fullWebsite ? 'full' : 'basic',
            'organization' => [
                'name' => $organization->name,
                'address' => $organization->address,
                'city' => $organization->city,
                'province' => $organization->province,
                'primary_color' => $organization->primary_color,
                'logo_url' => $organization->logo_path
                    ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
                    : null,
                'hero_title' => $fullWebsite ? $organization->online_booking_hero_title : null,
                'hero_subtitle' => $fullWebsite ? $organization->online_booking_hero_subtitle : null,
                'banner_url' => $fullWebsite && $organization->online_booking_banner_path
                    ? $request->getSchemeAndHttpHost().'/storage/'.$organization->online_booking_banner_path
                    : null,
            ],
            'fleet' => $fleet,
            'requirements' => $this->enabledOptions($organization->online_booking_requirements),
            'delivery_methods' => $this->enabledOptions($organization->delivery_methods),
            'professional_driver_enabled' => $organization->professional_driver_enabled,
            'contact_number' => $organization->online_booking_phone,
            'reservation_fee' => $this->reservationFee($request, $organization),
            'currency' => $organization->currency ?: 'PHP',
        ]);
    }

    public function vehicleProfile(Request $request, string $slug, int $vehicleId): JsonResponse
    {
        $organization = $this->bookingOrganization($slug);
        $vehicle = Vehicle::query()
            ->where('organization_id', $organization->id)
            ->where('status', '!=', 'maintenance')
            ->with(['rentalRates', 'images'])
            ->findOrFail($vehicleId);

        return response()->json([
            'organization' => [
                'name' => $organization->name,
                'primary_color' => $organization->primary_color,
                'logo_url' => $organization->logo_path
                    ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
                    : null,
            ],
            'vehicle' => [
                'id' => $vehicle->id,
                'name' => $vehicle->name,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'year' => $vehicle->year,
                'color' => $vehicle->color,
                'seat_count' => $vehicle->seat_count,
                'type' => $vehicle->type,
                'transmission' => $vehicle->transmission,
                'fuel_type' => $vehicle->fuel_type,
                'daily_rate' => $vehicle->daily_rate,
                'security_deposit' => $vehicle->security_deposit,
                'hourly_extension_rate' => $vehicle->hourly_extension_rate,
                'image_url' => $vehicle->image_url,
                'marketing_image_url' => $vehicle->marketing_image_url,
                'rental_rates' => $vehicle->rentalRates->map(fn ($rate): array => [
                    'duration_hours' => $rate->duration_hours,
                    'amount' => $rate->amount,
                    'outside_amount' => $rate->outside_amount,
                ])->values(),
                'images' => $vehicle->images->map(fn ($image): array => [
                    'id' => $image->id,
                    'category' => $image->category,
                    'image_url' => $image->image_url,
                ])->values(),
            ],
            'requirements' => $this->enabledOptions($organization->online_booking_requirements),
            'delivery_methods' => $this->enabledOptions($organization->delivery_methods),
            'professional_driver_enabled' => $organization->professional_driver_enabled,
            'reservation_fee' => $this->reservationFee($request, $organization),
            'currency' => $organization->currency ?: 'PHP',
        ]);
    }

    public function vehicleCalendar(string $slug, int $vehicleId): JsonResponse
    {
        $organization = $this->bookingOrganization($slug);
        $vehicle = Vehicle::query()
            ->where('organization_id', $organization->id)
            ->where('status', '!=', 'maintenance')
            ->findOrFail($vehicleId);

        $ranges = app(BookingAvailability::class)
            ->reservedRanges($vehicle, now())
            ->map(fn (array $range): array => [
                'start' => $range['start']->toIso8601String(),
                'end' => $range['end']->toIso8601String(),
            ])
            ->values();

        return response()->json(['booked_ranges' => $ranges]);
    }

    public function estimate(Request $request, string $slug): JsonResponse
    {
        $organization = $this->bookingOrganization($slug);
        $validated = $request->validate([
            'vehicle_id' => [
                'required',
                'integer',
                Rule::exists('vehicles', 'id')->where('organization_id', $organization->id),
            ],
            'pickup_at' => ['required', 'date', 'after:now'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'destination_province' => ['required', 'string', 'max:255'],
        ]);
        $vehicle = Vehicle::query()
            ->where('organization_id', $organization->id)
            ->findOrFail($validated['vehicle_id']);
        app(BookingAvailability::class)->assertAvailable(
            $vehicle,
            $validated['pickup_at'],
            $validated['return_at'],
        );
        $estimate = app(BookingPricing::class)->calculateEstimate(
            $vehicle,
            $validated['pickup_at'],
            $validated['return_at'],
            $validated['destination_province'],
        );
        $reservationFee = $this->reservationFee($request, $organization);

        if ($reservationFee && $reservationFee['deductible'] && $reservationFee['amount'] > $estimate['rental_amount']) {
            throw ValidationException::withMessages([
                'reservation_fee' => 'The configured reservation fee is higher than this rental estimate. Please contact the rental company.',
            ]);
        }

        return response()->json([
            'estimate' => $estimate,
            'reservation_fee' => $reservationFee,
        ]);
    }

    public function availability(Request $request, string $slug): JsonResponse
    {
        $organization = $this->bookingOrganization($slug);
        $validated = $request->validate([
            'pickup_at' => ['required', 'date', 'after:now'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'destination_province' => ['nullable', 'string', 'max:255'],
        ]);
        $pickupAt = Carbon::parse($validated['pickup_at']);
        $returnAt = Carbon::parse($validated['return_at']);

        $vehicles = app(BookingAvailability::class)
            ->availableVehicles($organization, $pickupAt, $returnAt)
            ->map(function (Vehicle $vehicle) use ($validated, $pickupAt, $returnAt): array {
                return [
                    'id' => $vehicle->id,
                    'name' => $vehicle->name,
                    'brand' => $vehicle->brand,
                    'model' => $vehicle->model,
                    'year' => $vehicle->year,
                    'color' => $vehicle->color,
                    'seat_count' => $vehicle->seat_count,
                    'type' => $vehicle->type,
                    'transmission' => $vehicle->transmission,
                    'fuel_type' => $vehicle->fuel_type,
                    'daily_rate' => $vehicle->daily_rate,
                    'image_url' => $vehicle->image_url,
                    'marketing_image_url' => $vehicle->marketing_image_url,
                    'estimated_rental_amount' => app(BookingPricing::class)->calculateRentalAmount(
                        $vehicle,
                        $pickupAt->toDateTimeString(),
                        $returnAt->toDateTimeString(),
                        $validated['destination_province'] ?? null,
                    ),
                ];
            })
            ->values();

        return response()->json(['vehicles' => $vehicles]);
    }

    public function submit(Request $request, string $slug): JsonResponse
    {
        $organization = $this->bookingOrganization($slug);
        $requirements = $this->enabledOptions($organization->online_booking_requirements);
        $deliveryMethods = $this->enabledOptions($organization->delivery_methods);
        $rules = [
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_email' => ['required', 'email', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:255'],
            'customer_address' => ['required', 'string', 'max:2000'],
            'customer_facebook_profile' => ['nullable', 'url', 'max:255'],
            'referral_source' => ['required', 'string', 'max:255'],
            'vehicle_id' => [
                'required',
                'integer',
                Rule::exists('vehicles', 'id')->where('organization_id', $organization->id),
            ],
            'pickup_at' => ['required', 'date', 'after:now'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'destination_city' => ['required', 'string', 'max:255'],
            'destination_province' => ['required', 'string', 'max:255'],
            'delivery_method' => ['required', Rule::in($deliveryMethods)],
            'professional_driver' => ['nullable', 'boolean'],
            'remarks' => ['nullable', 'string', 'max:5000'],
            'privacy_acknowledged' => ['accepted'],
            'documents' => ['sometimes', 'array'],
            'documents.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:'.self::MAX_BOOKING_FILE_KILOBYTES],
            'reservation_payment_proof' => [
                $organization->online_booking_reservation_fee_amount ? 'required' : 'prohibited',
                'file',
                'mimes:jpg,jpeg,png,webp,pdf',
                'max:'.self::MAX_BOOKING_FILE_KILOBYTES,
            ],
        ];
        foreach ($requirements as $requirement) {
            $rules["documents.{$requirement}"] = [
                'required',
                'file',
                'mimes:jpg,jpeg,png,webp,pdf',
                'max:'.self::MAX_BOOKING_FILE_KILOBYTES,
            ];
        }
        $validated = $request->validate($rules);

        $uploadedFiles = $request->file('documents', []);
        abort_if(
            array_diff(array_keys($uploadedFiles), self::REQUIREMENT_KEYS),
            422,
            'One or more uploaded document types are not supported.',
        );
        if ($request->hasFile('reservation_payment_proof')) {
            $uploadedFiles['reservation_payment_proof'] = $request->file('reservation_payment_proof');
        }
        $totalUploadBytes = array_sum(array_map(
            static fn ($file): int => (int) $file->getSize(),
            $uploadedFiles,
        ));
        if ($totalUploadBytes > self::MAX_BOOKING_ATTACHMENT_BYTES) {
            throw ValidationException::withMessages([
                'documents' => 'The combined size of booking attachments must not exceed 7 MB.',
            ]);
        }
        $professionalDriver = $request->boolean('professional_driver');
        abort_if(
            $professionalDriver && ! $organization->professional_driver_enabled,
            422,
            'Professional driver service is not available.',
        );

        $storedPaths = [];
        try {
            $bookingRequest = DB::transaction(function () use (
                $organization,
                $validated,
                $uploadedFiles,
                $professionalDriver,
                &$storedPaths,
            ): BookingRequest {
                $vehicle = Vehicle::query()
                    ->where('organization_id', $organization->id)
                    ->lockForUpdate()
                    ->findOrFail($validated['vehicle_id']);
                app(BookingAvailability::class)->assertAvailable(
                    $vehicle,
                    $validated['pickup_at'],
                    $validated['return_at'],
                );
                $quote = app(BookingPricing::class)->calculateEstimate(
                    $vehicle,
                    $validated['pickup_at'],
                    $validated['return_at'],
                    $validated['destination_province'],
                );
                $reservationFeeAmount = (float) ($organization->online_booking_reservation_fee_amount ?? 0);
                $reservationFeeDeductible = (bool) $organization->online_booking_reservation_fee_deductible;
                if ($reservationFeeAmount > 0 && $reservationFeeDeductible && $reservationFeeAmount > $quote['rental_amount']) {
                    throw ValidationException::withMessages([
                        'reservation_fee' => 'The configured reservation fee is higher than this rental estimate. Please contact the rental company.',
                    ]);
                }
                $bookingRequest = BookingRequest::create([
                    'organization_id' => $organization->id,
                    'vehicle_id' => $vehicle->id,
                    'reference' => 'RQ-'.now()->format('Ymd').'-'.strtoupper(Str::random(6)),
                    'customer_name' => $validated['customer_name'],
                    'customer_email' => strtolower($validated['customer_email']),
                    'customer_phone' => $validated['customer_phone'],
                    'customer_address' => $validated['customer_address'],
                    'customer_facebook_profile' => $validated['customer_facebook_profile'] ?? null,
                    'referral_source' => $validated['referral_source'],
                    'pickup_at' => $validated['pickup_at'],
                    'return_at' => $validated['return_at'],
                    'destination_city' => $validated['destination_city'] ?? null,
                    'destination_province' => $validated['destination_province'] ?? null,
                    'delivery_method' => $validated['delivery_method'],
                    'professional_driver_requested' => $professionalDriver,
                    'remarks' => $validated['remarks'] ?? null,
                    'quoted_rental_amount' => $quote['rental_amount'],
                    'quoted_rental_breakdown' => $quote['breakdown'],
                    'reservation_fee_amount' => $reservationFeeAmount > 0 ? $reservationFeeAmount : null,
                    'reservation_fee_deductible' => $reservationFeeDeductible,
                    'privacy_acknowledged_at' => now(),
                    'status' => 'pending',
                ]);

                foreach ($uploadedFiles as $category => $file) {
                    $path = $file->store("booking-requests/{$bookingRequest->id}", 'local');
                    if (! $path) {
                        throw new RuntimeException('The booking request document could not be stored.');
                    }
                    $storedPaths[] = $path;
                    BookingRequestDocument::create([
                        'booking_request_id' => $bookingRequest->id,
                        'category' => $category,
                        'file_path' => $path,
                        'original_name' => Str::limit(
                            basename(str_replace('\\', '/', $file->getClientOriginalName())),
                            255,
                            '',
                        ),
                        'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                        'size' => $file->getSize(),
                        'expires_at' => now()->addMonths(max(1, (int) ($organization->customer_requirements_expiry_months ?? 12))),
                    ]);
                }

                return $bookingRequest;
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }

        $notificationSent = app(BookingRequestNotifier::class)->send($bookingRequest, 'received');

        return response()->json([
            'message' => $notificationSent
                ? 'Your request has been received. The rental is not confirmed until the company approves it.'
                : 'Your request was saved, but we could not send a confirmation email. Keep your reference and contact the rental company if needed.',
            'reference' => $bookingRequest->reference,
            'notification_sent' => $notificationSent,
        ], 201);
    }

    private function bookingOrganization(string $slug): Organization
    {
        $organization = Organization::query()
            ->where('online_booking_slug', $slug)
            ->where('online_booking_enabled', true)
            ->first();

        abort_unless($organization, 404, 'This online booking form is unavailable.');
        abort_unless(app(PlanEntitlements::class)->rank($organization->plan) >= 2, 404, 'This online booking form is unavailable.');
        abort_unless(
            in_array($organization->subscription_status, ['active', 'free_trial'], true)
            && ! ($organization->subscription_status === 'active'
                && $organization->subscription_ends_at
                && $organization->subscription_ends_at->isPast())
            && ! ($organization->subscription_status === 'free_trial'
                && $organization->trial_ends_at
                && $organization->trial_ends_at->isPast()),
            404,
            'This online booking form is unavailable.',
        );

        return $organization;
    }

    private function enabledOptions(mixed $options): array
    {
        if (! is_array($options)) {
            return [];
        }

        if (array_is_list($options)) {
            return array_values(array_filter($options, 'is_string'));
        }

        return array_keys(array_filter($options));
    }

    private function reservationFee(Request $request, Organization $organization): ?array
    {
        $amount = (float) ($organization->online_booking_reservation_fee_amount ?? 0);
        if ($amount <= 0) {
            return null;
        }

        return [
            'amount' => $amount,
            'deductible' => (bool) $organization->online_booking_reservation_fee_deductible,
            'instructions' => $organization->online_booking_reservation_payment_instructions,
            'qr_url' => $organization->online_booking_reservation_qr_path
                ? $request->getSchemeAndHttpHost().'/storage/'.$organization->online_booking_reservation_qr_path
                : null,
        ];
    }
}
