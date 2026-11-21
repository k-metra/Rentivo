<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Vehicle;
use App\Models\VehicleRentalRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DashboardController extends Controller
{
    private function organization(Request $request)
    {
        return $request->user()->organizations()->firstOrFail();
    }

    public function summary(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $organizationId = $organization->id;
        $now = now();
        $monthStart = $now->copy()->startOfMonth();

        $revenue = (float) Payment::where('organization_id', $organizationId)
            ->where('status', 'paid')
            ->sum('amount');
        $monthRevenue = (float) Payment::where('organization_id', $organizationId)
            ->where('status', 'paid')
            ->where('paid_at', '>=', $monthStart)
            ->sum('amount');
        $previousMonthRevenue = (float) Payment::where('organization_id', $organizationId)
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$monthStart->copy()->subMonth(), $monthStart])
            ->sum('amount');
        $revenueChange = $previousMonthRevenue > 0
            ? round((($monthRevenue - $previousMonthRevenue) / $previousMonthRevenue) * 100, 1)
            : 0.0;

        $totalVehicles = Vehicle::where('organization_id', $organizationId)->count();
        $rentedVehicles = Vehicle::where('organization_id', $organizationId)
            ->where('status', 'rented')->count();
        $availableVehicles = Vehicle::where('organization_id', $organizationId)
            ->where('status', 'available')->count();
        $serviceVehicles = Vehicle::where('organization_id', $organizationId)
            ->where('status', 'maintenance')->count();
        $utilization = $totalVehicles > 0 ? round(($rentedVehicles / $totalVehicles) * 100, 1) : 0.0;

        $activeBookings = Booking::where('organization_id', $organizationId)
            ->whereIn('status', ['active', 'confirmed'])
            ->count();
        $customers = Customer::where('organization_id', $organizationId)->count();

        $upcoming = Booking::where('organization_id', $organizationId)
            ->with(['customer:id,name', 'vehicle:id,brand,model'])
            ->where('pickup_at', '>=', $now)
            ->orderBy('pickup_at')
            ->limit(5)
            ->get();

        $activities = Payment::where('organization_id', $organizationId)
            ->with(['booking.customer:id,name'])
            ->where('status', 'paid')
            ->orderByDesc('paid_at')
            ->limit(5)
            ->get()
            ->map(fn (Payment $payment) => [
                'title' => 'Payment received',
                'text' => '₱'.number_format((float) $payment->amount, 2).' from '.($payment->booking?->customer?->name ?? 'customer'),
                'time' => $payment->paid_at?->diffForHumans(),
            ]);

        $revenueByMonth = Payment::where('organization_id', $organizationId)
            ->where('status', 'paid')
            ->where('paid_at', '>=', $now->copy()->subMonths(5)->startOfMonth())
            ->selectRaw("strftime('%Y-%m', paid_at) as period, SUM(amount) as total")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(fn ($row) => ['period' => $row->period, 'value' => (float) $row->total])
            ->values();

        return response()->json([
            'organization' => $organization,
            'stats' => [
                'total_revenue' => $revenue,
                'month_revenue' => $monthRevenue,
                'revenue_change' => $revenueChange,
                'active_bookings' => $activeBookings,
                'fleet_utilization' => $utilization,
                'total_customers' => $customers,
                'total_vehicles' => $totalVehicles,
                'rented_vehicles' => $rentedVehicles,
                'available_vehicles' => $availableVehicles,
                'service_vehicles' => $serviceVehicles,
            ],
            'upcoming_bookings' => $upcoming,
            'recent_activity' => $activities,
            'revenue_by_month' => $revenueByMonth,
        ]);
    }

    public function vehicles(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $vehicles = Vehicle::where('organization_id', $organization->id)
            ->with('rentalRates')
            ->orderBy('brand')
            ->orderBy('model')
            ->get()
            ->map(function (Vehicle $vehicle) use ($request) {
                $vehicle->setAttribute('image_url', $vehicle->image_path
                    ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
                    : null);
                return $vehicle;
            });
        return response()->json($vehicles);
    }

    public function customers(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        return response()->json(Customer::where('organization_id', $organization->id)->orderBy('name')->get());
    }

    public function bookings(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        return response()->json(Booking::where('organization_id', $organization->id)
            ->with(['customer:id,name', 'vehicle:id,brand,model,plate_number'])
            ->orderByDesc('pickup_at')
            ->get());
    }

    public function payments(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        return response()->json(Payment::where('organization_id', $organization->id)
            ->with(['booking.customer:id,name'])
            ->orderByDesc('paid_at')
            ->get());
    }

    public function users(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        return response()->json($organization->users()
            ->get()
            ->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->pivot->role,
                'created_at' => $user->created_at,
            ])
            ->values());
    }

    public function storeBooking(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where('organization_id', $organization->id)],
            'vehicle_id' => ['required', Rule::exists('vehicles', 'id')->where('organization_id', $organization->id)],
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'rental_amount' => ['required', 'numeric', 'min:0'],
            'additional_charges' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', 'in:pending,confirmed,active,completed,cancelled'],
        ]);

        $additional = (float) ($validated['additional_charges'] ?? 0);
        $total = (float) $validated['rental_amount'] + $additional;
        $booking = Booking::create([
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
            'reference' => 'RV-'.now()->format('Ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
            'customer_id' => $validated['customer_id'],
            'vehicle_id' => $validated['vehicle_id'],
            'pickup_at' => $validated['pickup_at'],
            'return_at' => $validated['return_at'],
            'rental_amount' => $validated['rental_amount'],
            'additional_charges' => $additional,
            'total_amount' => $total,
            'status' => $validated['status'],
            'payment_status' => 'unpaid',
        ]);

        return response()->json($booking->load(['customer:id,name', 'vehicle:id,brand,model']), 201);
    }

    public function storeVehicle(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $request->merge([
            'plate_number' => strtoupper(trim((string) $request->input('plate_number'))),
        ]);
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'brand' => ['required', 'string', 'max:255'],
            'model' => ['required', 'string', 'max:255'],
            'year' => ['required', 'integer', 'min:1900', 'max:2100'],
            'color' => ['nullable', 'string', 'max:255'],
            'plate_number' => ['required', 'string', 'max:255', Rule::unique('vehicles', 'plate_number')->where('organization_id', $organization->id)],
            'seat_count' => ['required', 'integer', 'min:1', 'max:99'],
            'daily_rate' => ['nullable', 'numeric', 'min:0'],
            'security_deposit' => ['nullable', 'numeric', 'min:0'],
            'hourly_extension_rate' => ['nullable', 'numeric', 'min:0'],
            'mileage_limit' => ['nullable', 'integer', 'min:0'],
            'mileage_limit_unit' => ['nullable', 'in:rental,day'],
            'type' => ['required', 'in:Sedan,Motorcycle,Motorcycle 400CC+,AUV,SUV,Crossover,MPV,Van,Pickup,Hatchback'],
            'transmission' => ['required', 'in:Automatic,Manual'],
            'fuel_type' => ['required', 'in:Unleaded 91,Premium 95,Premium 98,Diesel,EV'],
            'status' => ['required', 'in:available,rented,maintenance'],
            'rental_rates' => ['nullable', 'string'],
            'remove_background' => ['nullable'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $imagePath = null;
        $warning = null;

        if ($request->hasFile('image')) {
            $image = $request->file('image');
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
                            $extension = 'png';
                            $processedName = 'vehicles/removed-bg-'.uniqid('', true).'.'.$extension;
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

        $name = $validated['name'] ?? trim(implode(' ', array_filter([
            $validated['brand'],
            $validated['model'],
            (string) $validated['year'],
        ])));

        $vehicle = Vehicle::create([
            'organization_id' => $organization->id,
            'name' => $name,
            'brand' => $validated['brand'],
            'model' => $validated['model'],
            'year' => $validated['year'],
            'color' => $validated['color'] ?? null,
            'plate_number' => $validated['plate_number'],
            'seat_count' => $validated['seat_count'],
            'daily_rate' => $validated['daily_rate'] ?? 0,
            'security_deposit' => $validated['security_deposit'] ?? null,
            'hourly_extension_rate' => $validated['hourly_extension_rate'] ?? null,
            'mileage_limit' => $validated['mileage_limit'] ?? null,
            'mileage_limit_unit' => $validated['mileage_limit_unit'] ?? 'rental',
            'type' => $validated['type'],
            'transmission' => $validated['transmission'],
            'fuel_type' => $validated['fuel_type'],
            'image_path' => $imagePath,
            'status' => $validated['status'],
        ]);

        $rentalRates = json_decode($validated['rental_rates'] ?? '[]', true);
        if (is_array($rentalRates)) {
            foreach ($rentalRates as $rate) {
                if (! isset($rate['duration_hours'], $rate['amount'])) continue;
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

        $vehicle->load('rentalRates');
        $vehicle->setAttribute('image_url', $vehicle->image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
            : null);
        return response()->json([
            'vehicle' => $vehicle,
            'warning' => $warning,
        ], 201);
    }

    public function showVehicle(Request $request, Vehicle $vehicle): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($vehicle->organization_id !== $organization->id, 404);
        $vehicle->load('rentalRates');
        $vehicle->setAttribute('image_url', $vehicle->image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
            : null);
        return response()->json($vehicle);
    }

    public function updateVehicle(Request $request, Vehicle $vehicle): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($vehicle->organization_id !== $organization->id, 404);
        $request->merge(['plate_number' => strtoupper(trim((string) $request->input('plate_number')))]);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'brand' => ['required', 'string', 'max:255'],
            'model' => ['required', 'string', 'max:255'],
            'year' => ['required', 'integer', 'min:1900', 'max:2100'],
            'color' => ['nullable', 'string', 'max:255'],
            'plate_number' => ['required', 'string', 'max:255', Rule::unique('vehicles', 'plate_number')->ignore($vehicle->id)->where('organization_id', $organization->id)],
            'seat_count' => ['required', 'integer', 'min:1', 'max:99'],
            'daily_rate' => ['nullable', 'numeric', 'min:0'],
            'security_deposit' => ['nullable', 'numeric', 'min:0'],
            'hourly_extension_rate' => ['nullable', 'numeric', 'min:0'],
            'mileage_limit' => ['nullable', 'integer', 'min:0'],
            'mileage_limit_unit' => ['nullable', 'in:rental,day'],
            'type' => ['required', 'in:Sedan,Motorcycle,Motorcycle 400CC+,AUV,SUV,Crossover,MPV,Van,Pickup,Hatchback'],
            'transmission' => ['required', 'in:Automatic,Manual'],
            'fuel_type' => ['required', 'in:Unleaded 91,Premium 95,Premium 98,Diesel,EV'],
            'status' => ['required', 'in:available,rented,maintenance'],
            'rental_rates' => ['nullable', 'string'],
            'remove_background' => ['nullable'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $imagePath = $vehicle->image_path;
        $warning = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imagePath = $image->store('vehicles', 'public');
        }

        $vehicle->update([
            'name' => $validated['name'] ?? trim(implode(' ', array_filter([$validated['brand'], $validated['model'], (string) $validated['year']]))),
            'brand' => $validated['brand'],
            'model' => $validated['model'],
            'year' => $validated['year'],
            'color' => $validated['color'] ?? null,
            'plate_number' => $validated['plate_number'],
            'seat_count' => $validated['seat_count'],
            'daily_rate' => $validated['daily_rate'] ?? 0,
            'security_deposit' => $validated['security_deposit'] ?? null,
            'hourly_extension_rate' => $validated['hourly_extension_rate'] ?? null,
            'mileage_limit' => $validated['mileage_limit'] ?? null,
            'mileage_limit_unit' => $validated['mileage_limit_unit'] ?? 'rental',
            'type' => $validated['type'],
            'transmission' => $validated['transmission'],
            'fuel_type' => $validated['fuel_type'],
            'image_path' => $imagePath,
            'status' => $validated['status'],
        ]);

        $vehicle->rentalRates()->delete();
        $rentalRates = json_decode($validated['rental_rates'] ?? '[]', true);
        if (is_array($rentalRates)) {
            foreach ($rentalRates as $rate) {
                if (! isset($rate['duration_hours'], $rate['amount'])) continue;
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

        $vehicle->load('rentalRates');
        $vehicle->setAttribute('image_url', $vehicle->image_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$vehicle->image_path
            : null);
        return response()->json(['vehicle' => $vehicle, 'warning' => $warning]);
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        $customer = Customer::create(['organization_id' => $organization->id, ...$validated]);
        return response()->json($customer, 201);
    }
}
