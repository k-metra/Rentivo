<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Vehicle;
use App\Services\PlanEntitlements;
use App\Services\PlanLimits;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
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

        $periodExpression = match (DB::connection()->getDriverName()) {
            'mysql' => "DATE_FORMAT(paid_at, '%Y-%m')",
            'pgsql' => "TO_CHAR(paid_at, 'YYYY-MM')",
            default => "strftime('%Y-%m', paid_at)",
        };
        $revenueByMonth = Payment::where('organization_id', $organizationId)
            ->where('status', 'paid')
            ->where('paid_at', '>=', $now->copy()->subMonths(5)->startOfMonth())
            ->selectRaw("$periodExpression as period, SUM(amount) as total")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(fn ($row) => ['period' => $row->period, 'value' => (float) $row->total])
            ->values();

        $organization->setAttribute('logo_url', $organization->logo_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
            : null);
        $planLimits = app(PlanLimits::class);
        $planEntitlements = app(PlanEntitlements::class);

        return response()->json([
            'organization' => $organization,
            'permissions' => app(RolePermissionService::class)->permissionsFor($request->user(), $organization),
            'limits' => [
                'users' => $planLimits->userLimit($organization->plan),
                'vehicles' => $planLimits->vehicleLimit($organization->plan),
            ],
            'entitlements' => [
                'advanced_reports' => $planEntitlements->rank($organization->plan) >= 2,
                'electronic_signatures' => $planEntitlements->rank($organization->plan) >= 2,
                'online_booking' => $planEntitlements->rank($organization->plan) >= 3,
                'priority_support' => $planEntitlements->rank($organization->plan) >= 3,
                'customer_portal' => $planEntitlements->rank($organization->plan) >= 3,
                'partner_portal' => $planEntitlements->rank($organization->plan) >= 3,
                'multiple_branches' => $planEntitlements->rank($organization->plan) >= 4,
            ],
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
}
