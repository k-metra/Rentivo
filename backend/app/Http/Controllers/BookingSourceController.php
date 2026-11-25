<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BookingSourceController extends Controller
{
    private function organization(Request $request): Organization
    {
        return $request->user()->organizations()->firstOrFail();
    }

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        if (! Schema::hasTable('booking_sources')) {
            return response()->json([]);
        }

        return response()->json(DB::table('booking_sources')
            ->where('organization_id', $organization->id)
            ->orderBy('name')
            ->get());
    }

    public function stats(Request $request): JsonResponse
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

    public function store(Request $request): JsonResponse
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
}
