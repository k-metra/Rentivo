<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Vehicle;
use App\Models\VehicleRentalRate;
use App\Models\BookingExtension;
use App\Models\CustomerAttachment;
use App\Models\BookingInspection;
use App\Models\BookingInspectionMedia;
use App\Models\BookingPostInspection;
use App\Models\BookingPostInspectionMedia;
use App\Models\Fund;
use App\Models\FundTransaction;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Models\OrganizationRole;
use Illuminate\Validation\Rules\Password;
use Illuminate\Support\Str;

class DashboardController extends Controller
{
    private function organization(Request $request)
    {
        return $request->user()->organizations()->firstOrFail();
    }

    private function calculateRentalAmount(Vehicle $vehicle, string $pickupAt, string $returnAt, ?string $destinationProvince): float
    {
        $pickup = \Illuminate\Support\Carbon::parse($pickupAt);
        $return = \Illuminate\Support\Carbon::parse($returnAt);
        $durationMinutes = max(1, (int) $pickup->diffInMinutes($return, false));
        $rates = $vehicle->rentalRates()->get();
        $rateFor = fn (int $hours) => $rates->firstWhere('duration_hours', $hours);

        $twelve = $rateFor(12);
        $twentyFour = $rateFor(24);
        $six = $rateFor(6);
        $twelveAmount = (float) ($twelve?->amount ?? ($twentyFour ? (float) $twentyFour->amount / 2 : $vehicle->daily_rate / 2));
        $dailyAmount = (float) ($twentyFour?->amount ?? $vehicle->daily_rate);

        $rateForCoverage = function ($rate) use ($destinationProvince): float {
            if (! $rate) return 0;
            $amount = (float) $rate->amount;
            if (($rate->coverage_type ?? 'all') === 'province'
                && $destinationProvince
                && ! in_array($destinationProvince, $rate->coverage_locations ?? [], true)) {
                $amount += (float) ($rate->outside_amount ?? 0);
            }
            return $amount;
        };

        if ($durationMinutes <= 720) {
            $amount = $rateForCoverage($twelve ?? $six);
            return $amount > 0 ? $amount : $twelveAmount;
        }

        if ($durationMinutes <= 1440) {
            $amount = $rateForCoverage($twentyFour);
            return $amount > 0 ? $amount : $dailyAmount;
        }

        $fullDays = intdiv($durationMinutes, 1440);
        $remainder = $durationMinutes % 1440;
        $amount = $fullDays * ($twentyFour ? $rateForCoverage($twentyFour) : $dailyAmount);

        if ($remainder > 0) {
            $remainderHours = (int) ceil($remainder / 60);
            if ($remainderHours === 12) {
                $amount += $rateForCoverage($twelve) ?: $twelveAmount;
            } elseif ($remainderHours < 12) {
                $hourlyExtensionRate = (float) ($vehicle->hourly_extension_rate ?? 0);
                $amount += $remainderHours * $hourlyExtensionRate;
            } else {
                $amount += $rateForCoverage($twelve) ?: $twelveAmount;
                $hourlyExtensionRate = (float) ($vehicle->hourly_extension_rate ?? 0);
                $amount += ($remainderHours - 12) * $hourlyExtensionRate;
            }
        }

        return $amount;
    }

    private function outsideRateAdjustment($rate, ?string $destinationProvince): float
    {
        if (! $rate || ($rate->coverage_type ?? 'all') !== 'province' || ! $destinationProvince) return 0;
        return in_array($destinationProvince, $rate->coverage_locations ?? [], true)
            ? 0
            : (float) ($rate->outside_amount ?? 0);
    }

    public function summary(Request $request): JsonResponse
    {
        Organization::expireDueSubscriptions();
        $organization = $this->organization($request);
        $organizationId = $organization->id;
        $now = now();
        Booking::where('organization_id', $organizationId)
            ->where('status', 'active')
            ->update(['status' => 'ongoing']);
        Booking::where('organization_id', $organizationId)
            ->where('status', 'confirmed')
            ->update(['status' => 'upcoming']);
        Booking::where('organization_id', $organizationId)
            ->where('status', 'pending')
            ->update(['status' => 'upcoming']);
        Booking::where('organization_id', $organizationId)
            ->whereIn('status', ['confirmed', 'upcoming'])
            ->where('pickup_at', '<=', $now)
            ->update(['status' => 'pre_inspection']);
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
            ->whereIn('status', ['ongoing', 'confirmed', 'upcoming'])
            ->count();
        $customers = Customer::where('organization_id', $organizationId)->count();

        $upcoming = Booking::where('organization_id', $organizationId)
            ->with(['customer:id,name', 'vehicle:id,name,brand,model,year,image_path'])
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

        $organization->setAttribute('logo_url', $organization->logo_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
            : null);

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

    public function publicBookingForm(Request $request, string $slug): JsonResponse
    {
        $organization = Organization::where('online_booking_slug', $slug)
            ->where('online_booking_enabled', true)
            ->first();
        abort_unless($organization, 404, 'This online booking form is unavailable.');
        $organization->setAttribute('logo_url', $organization->logo_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
            : null);
        return response()->json([
            'organization' => $organization,
            'requirements' => $organization->online_booking_requirements ?? [],
            'delivery_methods' => $organization->delivery_methods ?? [],
            'professional_driver_enabled' => $organization->professional_driver_enabled,
            'contact_number' => $organization->online_booking_phone,
        ]);
    }

    public function settings(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $organization->setAttribute('logo_url', $organization->logo_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
            : null);
        $planRank = [
            'Solo' => 1,
            'Growth' => 2,
            'Professional' => 3,
            'Business' => 4,
            'Enterprise' => 5,
        ];
        $rank = $planRank[$organization->plan] ?? 2;
        $organization->setAttribute('e_signature_eligible', $rank >= 2);
        $organization->setAttribute('online_booking_eligible', $rank >= 3);
        $organization->setAttribute('online_booking_url', $organization->online_booking_slug
            ? $request->getSchemeAndHttpHost().'/booking/'.$organization->online_booking_slug
            : null);
        return response()->json($organization);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'primary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'electronic_signature_enabled' => ['nullable', 'boolean'],
            'online_booking_enabled' => ['nullable', 'boolean'],
            'customer_requirements_expiry_months' => ['nullable', 'integer', 'min:1', 'max:120'],
            'online_booking_phone' => ['nullable', 'string', 'max:255'],
            'online_booking_requirements' => ['nullable', 'array'],
            'delivery_methods' => ['nullable', 'array'],
            'professional_driver_enabled' => ['nullable', 'boolean'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $planRank = [
            'Solo' => 1,
            'Growth' => 2,
            'Professional' => 3,
            'Business' => 4,
            'Enterprise' => 5,
        ];
        $rank = $planRank[$organization->plan] ?? 2;
        $electronicSignatureEnabled = $rank >= 2
            ? $request->boolean('electronic_signature_enabled')
            : false;
        $onlineBookingEnabled = $rank >= 3
            ? $request->boolean('online_booking_enabled')
            : false;

        $logoPath = $organization->logo_path;
        if ($request->hasFile('logo')) {
            if ($logoPath) Storage::disk('public')->delete($logoPath);
            $logoPath = $request->file('logo')->store('logos', 'public');
        }

        $slug = $organization->online_booking_slug;
        if (! $slug) {
            $base = Str::slug($validated['name']) ?: 'rentals';
            $candidate = $base;
            $suffix = 1;
            while (Organization::where('online_booking_slug', $candidate)->where('id', '!=', $organization->id)->exists()) {
                $candidate = $base.'-'.$suffix;
                $suffix++;
            }
            $slug = $candidate;
        }

        $organization->update([
            'name' => $validated['name'],
            'logo_path' => $logoPath,
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'province' => $validated['province'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'primary_color' => $validated['primary_color'] ?? '#5b21b6',
            'electronic_signature_enabled' => $electronicSignatureEnabled,
            'online_booking_enabled' => $onlineBookingEnabled,
            'online_booking_slug' => $slug,
            'online_booking_phone' => $validated['online_booking_phone'] ?? null,
            'customer_requirements_expiry_months' => $validated['customer_requirements_expiry_months'] ?? 12,
            'online_booking_requirements' => $validated['online_booking_requirements'] ?? [
                'primary_id',
                'secondary_id',
                'proof_of_billing',
                'ltms_screenshots',
                'selfie_with_primary_id',
            ],
            'delivery_methods' => $validated['delivery_methods'] ?? [
                'renter_pickup_renter_return',
                'renter_pickup_owner_collection',
                'owner_delivery_renter_return',
                'owner_delivery_owner_collection',
            ],
            'professional_driver_enabled' => $request->boolean('professional_driver_enabled'),
        ]);

        $organization->setAttribute('logo_url', $organization->logo_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
            : null);
        $organization->setAttribute('online_booking_url', $slug
            ? $request->getSchemeAndHttpHost().'/booking/'.$slug
            : null);
        return response()->json($organization->fresh());
    }

    public function vehicles(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $vehicles = Vehicle::where('organization_id', $organization->id)
            ->with(['rentalRates', 'partner:id,name,first_name,middle_name,last_name'])
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
        $query = Customer::where('organization_id', $organization->id)
            ->withCount('bookings')
            ->with('attachments');
        if (! $request->boolean('include_archived')) {
            $query->whereNull('archived_at');
        }
        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }
        return response()->json($query->orderBy('name')->get());
    }

    public function showCustomer(Request $request, Customer $customer): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($customer->organization_id !== $organization->id, 404);
        return response()->json($customer->load([
            'attachments',
            'bookings' => fn ($query) => $query
                ->with(['vehicle:id,name,brand,model,year,plate_number,image_path'])
                ->orderByDesc('pickup_at'),
        ])->loadCount('bookings'));
    }

    public function bookings(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'for_completion')
            ->whereHas('postInspection', fn ($query) => $query->where('status', 'completed'))
            ->update(['status' => 'complete']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'for_completion')
            ->update(['status' => 'ongoing']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'active')
            ->update(['status' => 'ongoing']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'confirmed')
            ->update(['status' => 'upcoming']);
        Booking::where('organization_id', $organization->id)
            ->where('status', 'pending')
            ->update([
                'status' => 'upcoming',
            ]);
        Booking::where('organization_id', $organization->id)
            ->whereIn('status', ['confirmed', 'upcoming'])
            ->where('pickup_at', '<=', now())
            ->update(['status' => 'pre_inspection']);
        $query = Booking::where('organization_id', $organization->id)
            ->with([
                'customer:id,name',
                'vehicle:id,name,brand,model,year,plate_number,image_path,partner_id',
                'vehicle.partner:id,name,first_name,middle_name,last_name',
                'payments:id,booking_id,amount,status,paid_at',
            ]);

        $sort = $request->input('sort', 'priority');
        if (in_array($sort, ['latest', 'oldest'], true)) {
            $query
                ->orderBy('pickup_at', $sort === 'oldest' ? 'asc' : 'desc')
                ->orderByDesc('id');
        } else {
            $query
                ->orderByRaw("CASE
                    WHEN status = 'pending' THEN 0
                    WHEN status = 'pre_inspection' THEN 1
                    WHEN status IN ('confirmed', 'upcoming') THEN 2
                    WHEN status IN ('ongoing', 'active') THEN 3
                    WHEN status IN ('complete', 'completed') THEN 4
                    WHEN status = 'rejected' THEN 5
                    WHEN status = 'cancelled' THEN 6
                    ELSE 6
                END")
                ->orderBy('pickup_at', 'asc')
                ->orderBy('id', 'asc');
        }

        return response()->json($query->get());
    }

    public function payments(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        return response()->json(Payment::where('organization_id', $organization->id)
            ->with([
                'booking.customer:id,name',
                'booking.vehicle:id,name,brand,model,year,plate_number,partner_id',
                'booking.vehicle.partner:id,name,first_name,middle_name,last_name',
            ])
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
                'role_id' => $user->pivot->role_id,
                'created_at' => $user->created_at,
            ])
            ->values());
    }

    public function storeUser(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
            'role_id' => ['required', 'integer'],
        ]);

        $role = OrganizationRole::where('organization_id', $organization->id)
            ->whereKey($validated['role_id'])
            ->where('is_active', true)
            ->first();
        abort_unless($role, 422, 'The selected role is invalid.');

        $user = User::where('email', $validated['email'])->first();
        if ($user) {
            abort_if(
                $organization->users()->whereKey($user->id)->exists(),
                422,
                'This email already belongs to a user in this organization.',
            );
        } else {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => $role->name,
                'email_verified_at' => now(),
            ]);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        if ($user->name !== $validated['name']) {
            $user->update(['name' => $validated['name']]);
        }
        $user->role = $role->name;
        $user->save();

        $organization->users()->syncWithoutDetaching([
            $user->id => [
                'role' => $role->name,
                'role_id' => $role->id,
            ],
        ]);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role->name,
            'role_id' => $role->id,
        ], 201);
    }

    public function updateUser(Request $request, int $userId): JsonResponse
    {
        $organization = $this->organization($request);
        $membership = DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->first();
        abort_unless($membership, 404);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => ['nullable', 'string', 'confirmed', Password::min(8)],
            'role_id' => ['nullable', 'integer'],
        ]);

        $user = User::findOrFail($userId);
        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
        ];
        if (! empty($validated['password'])) {
            $data['password'] = $validated['password'];
        }
        $user->update($data);

        if ($membership->role !== 'owner' && ! empty($validated['role_id'])) {
            $role = OrganizationRole::where('organization_id', $organization->id)
                ->whereKey($validated['role_id'])
                ->where('is_active', true)
                ->first();
            abort_unless($role, 422, 'The selected role is invalid.');
            DB::table('organization_memberships')
                ->where('organization_id', $organization->id)
                ->where('user_id', $userId)
                ->update([
                    'role' => $role->name,
                    'role_id' => $role->id,
                    'updated_at' => now(),
                ]);
            $user->update(['role' => $role->name]);
            $resolvedRole = $role->name;
        } else {
            $resolvedRole = $membership->role;
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $resolvedRole,
            'role_id' => $membership->role !== 'owner' && ! empty($validated['role_id'])
                ? (int) $validated['role_id']
                : $membership->role_id,
        ]);
    }

    public function destroyUser(Request $request, int $userId): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($request->user()->id === $userId, 422, 'You cannot remove your own account.');

        $membership = DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->first();
        abort_unless($membership, 404);
        abort_if($membership->role === 'owner', 422, 'The Owner account cannot be deleted.');

        DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->delete();

        return response()->json([
            'deleted' => true,
            'id' => $userId,
        ]);
    }

    public function updateUserRole(Request $request, int $userId): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'role_id' => ['required', 'integer'],
        ]);

        $membership = DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->first();
        abort_unless($membership, 404);
        abort_if($membership->role === 'owner', 422, 'The Owner role is untamperable.');

        $role = \App\Models\OrganizationRole::where('organization_id', $organization->id)
            ->whereKey($validated['role_id'])
            ->where('is_active', true)
            ->first();
        abort_unless($role, 422, 'The selected role is invalid.');

        DB::table('organization_memberships')
            ->where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->update([
                'role' => $role->name,
                'role_id' => $role->id,
                'updated_at' => now(),
            ]);

        return response()->json([
            'id' => $userId,
            'role' => $role->name,
            'role_id' => $role->id,
        ]);
    }

    public function partners(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        if (! Schema::hasTable('partners')) return response()->json([]);
        return response()->json(DB::table('partners')
            ->where('organization_id', $organization->id)
            ->orderBy('name')
            ->get());
    }

    public function storePartner(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
        ]);
        $id = DB::table('partners')->insertGetId([
            'organization_id' => $organization->id,
            ...$validated,
            'type' => $validated['type'] ?? 'agency',
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('partners')->where('id', $id)->first(), 201);
    }

    public function updatePartner(Request $request, int $partner): JsonResponse
    {
        $organization = $this->organization($request);
        $existing = DB::table('partners')->where('id', $partner)->where('organization_id', $organization->id)->first();
        abort_unless($existing, 404);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
        ]);
        DB::table('partners')->where('id', $partner)->update([
            ...$validated,
            'type' => $validated['type'] ?? $existing->type,
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('partners')->where('id', $partner)->first());
    }

    public function deletePartner(Request $request, int $partner): JsonResponse
    {
        $organization = $this->organization($request);
        $deleted = DB::table('partners')->where('id', $partner)->where('organization_id', $organization->id)->delete();
        abort_unless($deleted, 404);
        return response()->json(['deleted' => true]);
    }

    public function bookingSources(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        if (! Schema::hasTable('booking_sources')) return response()->json([]);
        return response()->json(DB::table('booking_sources')
            ->where('organization_id', $organization->id)
            ->orderBy('name')
            ->get());
    }

    public function bookingSourceStats(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $labels = [
            'facebook' => 'Facebook',
            'tiktok' => 'TikTok',
            'google_search' => 'Google Search',
            'word_of_mouth' => 'Word of Mouth',
        ];
        $stats = [];
        foreach ($labels as $source => $label) {
            $customers = Customer::where('organization_id', $organization->id)
                ->where('referral_source', $source)
                ->count();
            $bookings = Booking::where('organization_id', $organization->id)
                ->whereHas('customer', fn ($query) => $query->where('referral_source', $source))
                ->count();
            $revenue = (float) Payment::where('organization_id', $organization->id)
                ->where('status', 'paid')
                ->whereHas('booking.customer', fn ($query) => $query->where('referral_source', $source))
                ->sum('amount');
            $stats[] = [
                'source' => $source,
                'label' => $label,
                'customers' => $customers,
                'bookings' => $bookings,
                'revenue' => $revenue,
            ];
        }

        $unassignedCustomers = Customer::where('organization_id', $organization->id)
            ->where(function ($query) {
                $query->whereNull('referral_source')->orWhere('referral_source', '');
            })
            ->count();
        $stats[] = [
            'source' => 'not_set',
            'label' => 'Not set',
            'customers' => $unassignedCustomers,
            'bookings' => Booking::where('organization_id', $organization->id)
                ->whereHas('customer', fn ($query) => $query->where(function ($inner) {
                    $inner->whereNull('referral_source')->orWhere('referral_source', '');
                }))
                ->count(),
            'revenue' => (float) Payment::where('organization_id', $organization->id)
                ->where('status', 'paid')
                ->whereHas('booking.customer', fn ($query) => $query->where(function ($inner) {
                    $inner->whereNull('referral_source')->orWhere('referral_source', '');
                }))
                ->sum('amount'),
        ];

        return response()->json(['stats' => $stats]);
    }

    public function storeBookingSource(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:255'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
        ]);
        $id = DB::table('booking_sources')->insertGetId([
            'organization_id' => $organization->id,
            ...$validated,
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('booking_sources')->where('id', $id)->first(), 201);
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
            'destination_city' => ['nullable', 'string', 'max:255'],
            'destination_province' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:5000'],
            'custom_rental_rate' => ['nullable', 'boolean'],
        ]);

        $additional = (float) ($validated['additional_charges'] ?? 0);
        $vehicle = Vehicle::where('organization_id', $organization->id)->findOrFail($validated['vehicle_id']);
        $customRentalRate = (bool) ($validated['custom_rental_rate'] ?? false);
        $rentalAmount = $customRentalRate
            ? (float) $validated['rental_amount']
            : $this->calculateRentalAmount(
                $vehicle,
                $validated['pickup_at'],
                $validated['return_at'],
                $validated['destination_province'] ?? null,
            );
        $total = $rentalAmount + $additional;
        $booking = Booking::create([
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
            'reference' => 'RV-'.now()->format('Ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
            'customer_id' => $validated['customer_id'],
            'vehicle_id' => $validated['vehicle_id'],
            'pickup_at' => $validated['pickup_at'],
            'return_at' => $validated['return_at'],
            'rental_amount' => $rentalAmount,
            'custom_rental_rate' => $customRentalRate,
            'additional_charges' => $additional,
            'total_amount' => $total,
            'destination_city' => $validated['destination_city'] ?? null,
            'destination_province' => $validated['destination_province'] ?? null,
            'remarks' => $validated['remarks'] ?? null,
            'status' => now()->gte(\Illuminate\Support\Carbon::parse($validated['pickup_at'])) ? 'pre_inspection' : 'upcoming',
            'payment_status' => 'unpaid',
        ]);

        return response()->json($booking->load(['customer:id,name', 'vehicle:id,brand,model']), 201);
    }

    public function updateBooking(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'customer_id' => ['required', Rule::exists('customers', 'id')->where('organization_id', $organization->id)],
            'vehicle_id' => ['required', Rule::exists('vehicles', 'id')->where('organization_id', $organization->id)],
            'pickup_at' => ['required', 'date'],
            'return_at' => ['required', 'date', 'after:pickup_at'],
            'rental_amount' => ['required', 'numeric', 'min:0'],
            'additional_charges' => ['nullable', 'numeric', 'min:0'],
            'destination_city' => ['nullable', 'string', 'max:255'],
            'destination_province' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:5000'],
            'custom_rental_rate' => ['nullable', 'boolean'],
        ]);
        $additional = (float) ($validated['additional_charges'] ?? 0);
        $vehicle = Vehicle::where('organization_id', $organization->id)->findOrFail($validated['vehicle_id']);
        $customRentalRate = (bool) ($validated['custom_rental_rate'] ?? $booking->custom_rental_rate);
        $rentalAmount = $customRentalRate
            ? (float) $validated['rental_amount']
            : $this->calculateRentalAmount(
                $vehicle,
                $validated['pickup_at'],
                $validated['return_at'],
                $validated['destination_province'] ?? null,
            );
        $booking->update([
            'customer_id' => $validated['customer_id'],
            'vehicle_id' => $validated['vehicle_id'],
            'pickup_at' => $validated['pickup_at'],
            'return_at' => $validated['return_at'],
            'rental_amount' => $rentalAmount,
            'custom_rental_rate' => $customRentalRate,
            'additional_charges' => $additional,
            'total_amount' => $rentalAmount + $additional,
            'destination_city' => $validated['destination_city'] ?? null,
            'destination_province' => $validated['destination_province'] ?? null,
            'remarks' => $validated['remarks'] ?? null,
        ]);
        return response()->json($booking->load(['customer:id,name', 'vehicle:id,brand,model']), 200);
    }

    public function showBooking(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        return response()->json($booking->load([
            'customer',
            'vehicle.rentalRates',
            'payments.creator:id,name',
            'extensions.creator:id,name',
            'inspection.media',
            'postInspection.media',
        ]));
    }

    public function showBookingInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $inspection = $booking->inspection()->with('media')->first();
        return response()->json(['inspection' => $inspection]);
    }

    public function saveBookingInspection(Request $request, Booking $booking): JsonResponse
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

        $this->storeInspectionMedia($request, $inspection);
        return response()->json(['inspection' => $inspection->fresh('media')]);
    }

    public function completeBookingInspection(Request $request, Booking $booking): JsonResponse
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

    private function storeInspectionMedia(Request $request, BookingInspection $inspection): void
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

    public function showBookingPostInspection(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $inspection = $booking->postInspection()->with('media')->first();
        return response()->json(['inspection' => $inspection]);
    }

    public function saveBookingPostInspection(Request $request, Booking $booking): JsonResponse
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

    public function completeBookingPostInspection(Request $request, Booking $booking): JsonResponse
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

    public function storeBookingPayment(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'string', 'max:255'],
            'paid_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'fund_id' => ['nullable', 'integer'],
        ]);
        if (!empty($validated['fund_id'])) {
            abort_unless(Fund::where('organization_id', $organization->id)->whereKey($validated['fund_id'])->exists(), 422, 'The selected fund is invalid.');
        }

        $paid = (float) $booking->payments()->where('status', 'paid')->sum('amount');
        $balance = max(0, (float) $booking->total_amount - $paid);
        abort_if((float) $validated['amount'] > $balance + 0.001, 422, 'Payment cannot exceed the booking balance.');

        $payment = Payment::create([
            'organization_id' => $organization->id,
            'booking_id' => $booking->id,
            'fund_id' => $validated['fund_id'] ?? null,
            'created_by' => $request->user()->id,
            'amount' => $validated['amount'],
            'method' => $validated['method'],
            'status' => 'paid',
            'paid_at' => $validated['paid_at'],
            'notes' => $validated['notes'] ?? null,
        ]);
        if (!empty($validated['fund_id'])) {
            FundTransaction::create([
                'organization_id' => $organization->id,
                'fund_id' => $validated['fund_id'],
                'payment_id' => $payment->id,
                'type' => 'inflow',
                'transacted_at' => $validated['paid_at'],
                'amount' => $validated['amount'],
                'description' => "Booking payment {$booking->reference}",
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);
        }
        $paid = (float) $booking->payments()->where('status', 'paid')->sum('amount');
        $booking->update([
            'payment_status' => $paid >= (float) $booking->total_amount - 0.001
                ? 'paid'
                : ($paid > 0 ? 'partial' : 'unpaid'),
        ]);

        return response()->json($booking->fresh([
            'customer',
            'vehicle.rentalRates',
            'payments.creator:id,name',
            'extensions.creator:id,name',
        ]), 201);
    }

    public function deleteBookingPayment(Request $request, Payment $payment): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($payment->organization_id !== $organization->id, 404);
        $booking = $payment->booking;
        $payment->delete();
        $paid = (float) $booking->payments()->where('status', 'paid')->sum('amount');
        $booking->update([
            'payment_status' => $paid >= (float) $booking->total_amount - 0.001
                ? 'paid'
                : ($paid > 0 ? 'partial' : 'unpaid'),
        ]);
        return response()->json($booking->fresh([
            'customer',
            'vehicle.rentalRates',
            'payments.creator:id,name',
            'extensions.creator:id,name',
        ]));
    }

    public function storeBookingExtension(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'new_return_at' => ['required', 'date', 'after:'.$booking->return_at],
            'pricing_mode' => ['required', 'in:hourly,twelve_hour'],
            'fee' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $extension = BookingExtension::create([
            'booking_id' => $booking->id,
            'created_by' => $request->user()->id,
            'previous_return_at' => $booking->return_at,
            'new_return_at' => $validated['new_return_at'],
            'fee' => $validated['fee'],
            'pricing_mode' => $validated['pricing_mode'],
            'notes' => $validated['notes'] ?? null,
        ]);
        $booking->update([
            'return_at' => $validated['new_return_at'],
            'additional_charges' => (float) $booking->additional_charges + (float) $validated['fee'],
            'total_amount' => (float) $booking->rental_amount + (float) $booking->additional_charges + (float) $validated['fee'],
        ]);

        return response()->json($booking->fresh([
            'customer', 'vehicle.rentalRates', 'payments', 'extensions.creator:id,name',
        ]), 201);
    }

    public function undoBookingExtension(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $extension = $booking->extensions()->whereNull('undone_at')->latest('id')->first();
        abort_if(! $extension, 422, 'There is no active extension to undo.');

        $extension->update(['undone_at' => now()]);
        $fee = (float) $extension->fee;
        $booking->update([
            'return_at' => $extension->previous_return_at,
            'additional_charges' => max(0, (float) $booking->additional_charges - $fee),
            'total_amount' => (float) $booking->rental_amount + max(0, (float) $booking->additional_charges - $fee),
        ]);

        return response()->json($booking->fresh([
            'customer', 'vehicle.rentalRates', 'payments', 'extensions.creator:id,name',
        ]));
    }

    public function updateBookingStatus(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'status' => ['required', 'in:pending,confirmed,upcoming,pre_inspection,ongoing,active,completed,complete,cancelled,rejected'],
        ]);
        $allowed = match ($booking->status) {
            'pending' => ['upcoming', 'confirmed', 'cancelled', 'rejected'],
            'confirmed', 'upcoming' => ['pre_inspection', 'cancelled'],
            'pre_inspection' => ['ongoing', 'cancelled'],
            'ongoing', 'active' => ['complete', 'completed', 'cancelled'],
            'completed', 'complete', 'cancelled', 'rejected' => [],
            default => ['cancelled'],
        };
        abort_unless(in_array($validated['status'], $allowed, true), 422, 'This booking status transition is not allowed.');
        if (in_array($validated['status'], ['ongoing', 'active'], true)) {
            $inspection = $booking->inspection()->where('status', 'completed')->first();
            abort_if(! $inspection, 422, 'Complete the pre-inspection before marking the rental active.');
        }
        $booking->update(['status' => $validated['status']]);
        if (in_array($validated['status'], ['ongoing', 'active'], true)) {
            Vehicle::whereKey($booking->vehicle_id)->update(['status' => 'rented']);
        } elseif (in_array($validated['status'], ['complete', 'completed', 'cancelled', 'rejected'], true)) {
            Vehicle::whereKey($booking->vehicle_id)->update(['status' => 'available']);
        }
        return response()->json($booking->fresh(['customer:id,name', 'vehicle:id,brand,model']));
    }

    public function storeVehicle(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $request->merge([
            'plate_number' => strtoupper(trim((string) $request->input('plate_number'))),
        ]);
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $organization->id)],
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
            'excess_mileage_rate' => ['nullable', 'numeric', 'min:0'],
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
            'partner_id' => $validated['partner_id'] ?? null,
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
            'excess_mileage_rate' => $validated['excess_mileage_rate'] ?? null,
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

        $vehicle->load(['rentalRates', 'partner:id,name,first_name,middle_name,last_name']);
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
        $vehicle->load(['rentalRates', 'partner:id,name,first_name,middle_name,last_name']);
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
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $organization->id)],
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
            'excess_mileage_rate' => ['nullable', 'numeric', 'min:0'],
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
            'partner_id' => $validated['partner_id'] ?? null,
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
            'excess_mileage_rate' => $validated['excess_mileage_rate'] ?? null,
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

        $vehicle->load(['rentalRates', 'partner:id,name,first_name,middle_name,last_name']);
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
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'date_of_birth' => ['nullable', 'date'],
            'license_number' => ['nullable', 'string', 'max:255'],
            'license_expiry' => ['nullable', 'date'],
            'identification_information' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'referral_source' => ['nullable', 'string', 'max:255'],
            'social_profile_url' => ['nullable', 'url', 'max:2048'],
            'license' => ['nullable', 'array'],
            'license.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'ltms' => ['nullable', 'array'],
            'ltms.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'proof_of_billing' => ['nullable', 'array'],
            'proof_of_billing.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'secondary_id' => ['nullable', 'array'],
            'secondary_id.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'selfie_license' => ['nullable', 'array'],
            'selfie_license.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $customer = Customer::create(['organization_id' => $organization->id, ...$validated]);
        $this->storeCustomerAttachments($request, $customer);
        return response()->json($customer->fresh(['attachments'])->loadCount('bookings'), 201);
    }

    public function updateCustomer(Request $request, Customer $customer): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($customer->organization_id !== $organization->id, 404);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'date_of_birth' => ['nullable', 'date'],
            'license_number' => ['nullable', 'string', 'max:255'],
            'license_expiry' => ['nullable', 'date'],
            'identification_information' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'referral_source' => ['nullable', 'string', 'max:255'],
            'social_profile_url' => ['nullable', 'url', 'max:2048'],
            'license' => ['nullable', 'array'],
            'license.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'ltms' => ['nullable', 'array'],
            'ltms.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'proof_of_billing' => ['nullable', 'array'],
            'proof_of_billing.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'secondary_id' => ['nullable', 'array'],
            'secondary_id.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'selfie_license' => ['nullable', 'array'],
            'selfie_license.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);
        $customer->update($validated);
        $this->storeCustomerAttachments($request, $customer);
        return response()->json($customer->fresh(['attachments'])->loadCount('bookings'));
    }

    private function storeCustomerAttachments(Request $request, Customer $customer): void
    {
        $categories = [
            'license',
            'ltms',
            'proof_of_billing',
            'secondary_id',
            'selfie_license',
        ];
        foreach ($categories as $category) {
            $files = $request->file($category, []);
            foreach ($files as $file) {
                $path = $file->store("customers/{$customer->id}/{$category}", 'public');
                CustomerAttachment::create([
                    'customer_id' => $customer->id,
                    'category' => $category,
                    'file_path' => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'size' => $file->getSize() ?: 0,
                ]);
            }
        }
    }

    public function archiveCustomer(Request $request, Customer $customer): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($customer->organization_id !== $organization->id, 404);
        $archive = $request->boolean('archive', true);
        $customer->update(['archived_at' => $archive ? now() : null]);
        return response()->json($customer->fresh(['attachments'])->loadCount('bookings'));
    }

    public function deleteCustomer(Request $request, Customer $customer): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($customer->organization_id !== $organization->id, 404);
        abort_if($customer->bookings()->exists(), 422, 'Customers with booking records must be archived instead of deleted.');

        foreach ($customer->attachments as $attachment) {
            Storage::disk('public')->delete($attachment->file_path);
        }
        $customer->delete();
        return response()->json(['message' => 'Customer deleted successfully.']);
    }
}
