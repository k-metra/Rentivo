<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\Vehicle;
use App\Models\VehicleRentalRate;
use App\Services\PlanLimits;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class VehicleController extends Controller
{
    private const GALLERY_CATEGORIES = [
        'interior_front',
        'interior_back',
        'left',
        'right',
        'back',
        'trunk',
        'front',
    ];

    private const LEGACY_GALLERY_CATEGORIES = ['exterior', 'interior'];

    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    private function requirePermission(Request $request, string $permission): void
    {
        $organization = $this->organization($request);
        app(RolePermissionService::class)->abortUnless($request->user(), $organization, $permission);
    }

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Vehicle View');
        $organization = $this->organization($request);
        $vehicles = Vehicle::where('organization_id', $organization->id)
            ->with(['rentalRates', 'images', 'partner:id,name,first_name,middle_name,last_name'])
            ->orderBy('brand')
            ->orderBy('model')
            ->get()
            ->map(function (Vehicle $vehicle) use ($request) {
                $vehicle->setAttribute('image_url', $vehicle->image_path
                    ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
                    : null);
                $vehicle->setAttribute('marketing_image_url', $vehicle->marketing_image_path
                    ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->marketing_image_path
                    : null);

                return $vehicle;
            });

        return response()->json($vehicles);
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Vehicle Create');
        $organization = $this->organization($request);
        $vehicleLimit = app(PlanLimits::class)->vehicleLimit($organization->plan);
        abort_if(
            $vehicleLimit !== null && $organization->vehicles()->count() >= $vehicleLimit,
            422,
            "Your {$organization->plan} plan allows up to {$vehicleLimit} vehicles.",
        );
        $request->merge([
            'plate_number' => strtoupper(trim((string) $request->input('plate_number'))),
        ]);
        $rules = [
            'name' => ['nullable', 'string', 'max:255'],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $organization->id)],
            'brand' => ['required', 'string', 'max:255'],
            'model' => ['required', 'string', 'max:255'],
            'year' => ['required', 'integer', 'min:1900', 'max:2100'],
            'color' => ['nullable', 'string', 'max:255'],
            'plate_number' => ['required', 'string', 'max:255', Rule::unique('vehicles', 'plate_number')->where('organization_id', $organization->id)],
            'seat_count' => ['required', 'integer', 'min:1', 'max:99'],
            'daily_rate' => ['nullable', 'numeric', 'min:0'],
            'carwash_fee' => ['nullable', 'numeric', 'min:0'],
            'security_deposit' => ['nullable', 'numeric', 'min:0'],
            'hourly_extension_rate' => ['nullable', 'numeric', 'min:0'],
            'mileage_limit' => ['nullable', 'integer', 'min:0'],
            'mileage_limit_unit' => ['nullable', 'in:rental,day'],
            'excess_mileage_rate' => ['nullable', 'numeric', 'min:0'],
            'type' => ['required', 'in:Sedan,Motorcycle,Motorcycle 400CC+,AUV,SUV,Crossover,MPV,Van,Pickup,Hatchback'],
            'transmission' => ['required', 'in:Automatic,Manual'],
            'fuel_type' => ['required', 'in:Unleaded 91,Premium 95,Premium 98,Diesel,EV'],
            'status' => ['required', 'in:available,rented,maintenance'],
            'rental_rates' => ['nullable', 'string'],
            'remove_background' => ['nullable'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'marketing_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
        $validated = $request->validate(array_merge($rules, $this->galleryValidationRules()));

        $warning = null;

        $imagePath = null;
        $marketingImagePath = null;
        $image = $request->file('image');
        if ($image) {
            $imagePath = $image->store('vehicles', 'public');

            if ($request->boolean('remove_background')) {
                $apiKey = config('services.removebg.key');
                if (! $apiKey) {
                    $warning = 'Background removal was skipped because REMOVE_BG_API_KEY is not configured.';
                } else {
                    try {
                        $response = Http::withHeaders(['X-Api-Key' => $apiKey])
                            ->attach('image_file', file_get_contents($image->getRealPath()), $image->getClientOriginalName())
                            ->post('https://api.remove.bg/v1.0/removebg', ['size' => 'auto']);

                        if ($response->successful()) {
                            $processedName = 'vehicles/removed-bg-'.uniqid('', true).'.png';
                            Storage::disk('public')->put($processedName, $response->body());
                            $imagePath = $processedName;
                        } else {
                            $warning = 'Background removal failed. The original vehicle image was kept. You can try remove.bg directly at remove.bg.';
                        }
                    } catch (\Throwable) {
                        $warning = 'Background removal failed. The original vehicle image was kept. You can try remove.bg directly at remove.bg.';
                    }
                }
            }
        } elseif ($request->boolean('remove_background')) {
            $warning = 'Upload a vehicle image before requesting background removal.';
        }
        if ($request->file('marketing_image')) {
            $marketingImagePath = $request->file('marketing_image')->store('vehicles/marketing', 'public');
        }

        $name = $validated['name'] ?? trim(implode(' ', array_filter([
            $validated['brand'],
            $validated['model'],
            (string) $validated['year'],
        ])));

        $vehicle = Vehicle::create([
            'organization_id' => $organization->id,
            'partner_id' => $validated['partner_id'] ?? null,
            'name' => $name,
            'brand' => $validated['brand'],
            'model' => $validated['model'],
            'year' => $validated['year'],
            'color' => $validated['color'] ?? null,
            'plate_number' => $validated['plate_number'],
            'seat_count' => $validated['seat_count'],
            'daily_rate' => $validated['daily_rate'] ?? 0,
            'carwash_fee' => $validated['carwash_fee'] ?? 200,
            'security_deposit' => $validated['security_deposit'] ?? null,
            'hourly_extension_rate' => $validated['hourly_extension_rate'] ?? null,
            'mileage_limit' => $validated['mileage_limit'] ?? null,
            'mileage_limit_unit' => $validated['mileage_limit_unit'] ?? 'rental',
            'excess_mileage_rate' => $validated['excess_mileage_rate'] ?? null,
            'type' => $validated['type'],
            'transmission' => $validated['transmission'],
            'fuel_type' => $validated['fuel_type'],
            'image_path' => $imagePath,
            'marketing_image_path' => $marketingImagePath,
            'status' => $validated['status'],
        ]);

        $rentalRates = json_decode($validated['rental_rates'] ?? '[]', true);
        if (is_array($rentalRates)) {
            foreach ($rentalRates as $rate) {
                if (! isset($rate['duration_hours'], $rate['amount'])) {
                    continue;
                }
                VehicleRentalRate::create([
                    'vehicle_id' => $vehicle->id,
                    'duration_hours' => (int) $rate['duration_hours'],
                    'location_scope' => $rate['coverage_type'] ?? 'all',
                    'province' => null,
                    'amount' => (float) $rate['amount'],
                    'amount_type' => $rate['amount_type'] ?? 'fixed',
                    'outside_amount' => (float) ($rate['outside_amount'] ?? 0),
                    'coverage_type' => $rate['coverage_type'] ?? 'all',
                    'coverage_locations' => $rate['coverage_locations'] ?? [],
                ]);
            }
        }

        $this->storeGalleryImages($request, $vehicle);
        $vehicle->load(['rentalRates', 'images', 'partner:id,name,first_name,middle_name,last_name']);
        $vehicle->setAttribute('image_url', $vehicle->image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
            : null);
        $vehicle->setAttribute('marketing_image_url', $vehicle->marketing_image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->marketing_image_path
            : null);

        return response()->json([
            'vehicle' => $vehicle,
            'warning' => $warning,
        ], 201);
    }

    public function show(Request $request, Vehicle $vehicle): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($vehicle->organization_id !== $organization->id, 404);
        $vehicle->load(['rentalRates', 'images', 'partner:id,name,first_name,middle_name,last_name']);
        $vehicle->setAttribute('image_url', $vehicle->image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
            : null);
        $vehicle->setAttribute('marketing_image_url', $vehicle->marketing_image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->marketing_image_path
            : null);

        return response()->json($vehicle);
    }

    public function update(Request $request, Vehicle $vehicle): JsonResponse
    {
        $this->requirePermission($request, 'Vehicle Update');
        $organization = $this->organization($request);
        abort_if($vehicle->organization_id !== $organization->id, 404);
        $request->merge(['plate_number' => strtoupper(trim((string) $request->input('plate_number')))]);

        $rules = [
            'name' => ['nullable', 'string', 'max:255'],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $organization->id)],
            'brand' => ['required', 'string', 'max:255'],
            'model' => ['required', 'string', 'max:255'],
            'year' => ['required', 'integer', 'min:1900', 'max:2100'],
            'color' => ['nullable', 'string', 'max:255'],
            'plate_number' => ['required', 'string', 'max:255', Rule::unique('vehicles', 'plate_number')->ignore($vehicle->id)->where('organization_id', $organization->id)],
            'seat_count' => ['required', 'integer', 'min:1', 'max:99'],
            'daily_rate' => ['nullable', 'numeric', 'min:0'],
            'carwash_fee' => ['nullable', 'numeric', 'min:0'],
            'security_deposit' => ['nullable', 'numeric', 'min:0'],
            'hourly_extension_rate' => ['nullable', 'numeric', 'min:0'],
            'mileage_limit' => ['nullable', 'integer', 'min:0'],
            'mileage_limit_unit' => ['nullable', 'in:rental,day'],
            'excess_mileage_rate' => ['nullable', 'numeric', 'min:0'],
            'type' => ['required', 'in:Sedan,Motorcycle,Motorcycle 400CC+,AUV,SUV,Crossover,MPV,Van,Pickup,Hatchback'],
            'transmission' => ['required', 'in:Automatic,Manual'],
            'fuel_type' => ['required', 'in:Unleaded 91,Premium 95,Premium 98,Diesel,EV'],
            'status' => ['required', 'in:available,rented,maintenance'],
            'rental_rates' => ['nullable', 'string'],
            'remove_background' => ['nullable'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'marketing_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
        $validated = $request->validate(array_merge($rules, $this->galleryValidationRules()));

        $imagePath = $vehicle->image_path;
        $marketingImagePath = $vehicle->marketing_image_path;
        $warning = null;
        if ($request->file('image')) {
            $image = $request->file('image');
            $imagePath = $image->store('vehicles', 'public');
        }
        if ($request->file('marketing_image')) {
            $marketingImagePath = $request->file('marketing_image')->store('vehicles/marketing', 'public');
        }

        $vehicle->update([
            'name' => $validated['name'] ?? trim(implode(' ', array_filter([$validated['brand'], $validated['model'], (string) $validated['year']]))),
            'partner_id' => $validated['partner_id'] ?? null,
            'brand' => $validated['brand'],
            'model' => $validated['model'],
            'year' => $validated['year'],
            'color' => $validated['color'] ?? null,
            'plate_number' => $validated['plate_number'],
            'seat_count' => $validated['seat_count'],
            'daily_rate' => $validated['daily_rate'] ?? 0,
            'carwash_fee' => $validated['carwash_fee'] ?? 200,
            'security_deposit' => $validated['security_deposit'] ?? null,
            'hourly_extension_rate' => $validated['hourly_extension_rate'] ?? null,
            'mileage_limit' => $validated['mileage_limit'] ?? null,
            'mileage_limit_unit' => $validated['mileage_limit_unit'] ?? 'rental',
            'excess_mileage_rate' => $validated['excess_mileage_rate'] ?? null,
            'type' => $validated['type'],
            'transmission' => $validated['transmission'],
            'fuel_type' => $validated['fuel_type'],
            'image_path' => $imagePath,
            'marketing_image_path' => $marketingImagePath,
            'status' => $validated['status'],
        ]);

        $vehicle->rentalRates()->delete();
        $rentalRates = json_decode($validated['rental_rates'] ?? '[]', true);
        if (is_array($rentalRates)) {
            foreach ($rentalRates as $rate) {
                if (! isset($rate['duration_hours'], $rate['amount'])) {
                    continue;
                }
                VehicleRentalRate::create([
                    'vehicle_id' => $vehicle->id,
                    'duration_hours' => (int) $rate['duration_hours'],
                    'location_scope' => $rate['coverage_type'] ?? 'all',
                    'province' => null,
                    'amount' => (float) $rate['amount'],
                    'amount_type' => 'fixed',
                    'outside_amount' => (float) ($rate['outside_amount'] ?? 0),
                    'coverage_type' => $rate['coverage_type'] ?? 'all',
                    'coverage_locations' => $rate['coverage_locations'] ?? [],
                ]);
            }
        }

        $this->storeGalleryImages($request, $vehicle);
        $vehicle->load(['rentalRates', 'images', 'partner:id,name,first_name,middle_name,last_name']);
        $vehicle->setAttribute('image_url', $vehicle->image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
            : null);
        $vehicle->setAttribute('marketing_image_url', $vehicle->marketing_image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->marketing_image_path
            : null);

        return response()->json(['vehicle' => $vehicle, 'warning' => $warning]);
    }

    private function storeGalleryImages(Request $request, Vehicle $vehicle): void
    {
        foreach (array_merge(self::GALLERY_CATEGORIES, self::LEGACY_GALLERY_CATEGORIES) as $category) {
            foreach ($request->file("{$category}_images", []) ?? [] as $file) {
                $path = $file->store("vehicles/{$vehicle->id}/gallery", 'public');
                $vehicle->images()->create([
                    'category' => $category,
                    'image_path' => $path,
                    'sort_order' => $vehicle->images()->where('category', $category)->count(),
                ]);
            }
        }
    }

    private function galleryValidationRules(): array
    {
        $rules = [];
        foreach (array_merge(self::GALLERY_CATEGORIES, self::LEGACY_GALLERY_CATEGORIES) as $category) {
            $rules["{$category}_images"] = ['sometimes', 'array', 'max:10'];
            $rules["{$category}_images.*"] = ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'];
        }

        return $rules;
    }
}
