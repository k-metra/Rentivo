<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\SubscriptionHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuperAdminController extends Controller
{
    private function organizationOnlyAccounts(Organization $organization): Builder
    {
        return User::query()
            ->where('is_superadmin', false)
            ->whereHas('organizations', fn (Builder $query) => $query->where('organizations.id', $organization->id))
            ->whereDoesntHave('organizations', fn (Builder $query) => $query->where('organizations.id', '!=', $organization->id));
    }

    private function authorizeSuperAdmin(Request $request): void
    {
        abort_unless((bool) $request->user()?->is_superadmin, 403, 'Superadmin access required.');
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        Organization::expireDueSubscriptions();
        $organizations = Organization::query()
            ->withCount(['users', 'vehicles', 'bookings'])
            ->with([
                'subscriptionHistory',
                'users' => fn ($query) => $query->wherePivot('role', 'owner'),
            ])
            ->orderBy('name')
            ->get();
        return response()->json([
            'organizations' => $organizations,
            'totals' => [
                'organizations' => $organizations->count(),
                'free_trials' => $organizations->where('subscription_status', 'free_trial')->count(),
                'active_subscriptions' => $organizations->where('subscription_status', 'active')->count(),
            ],
        ]);
    }

    public function updateOrganization(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $validated = $request->validate([
            'plan' => ['required', 'in:Solo,Growth,Professional,Business,Enterprise'],
            'subscription_status' => ['required', 'in:free_trial,active,expired,suspended'],
            'billing_cycle' => ['nullable', 'in:monthly,quarterly,semiannual,annual,custom'],
            'duration_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after_or_equal:starts_at'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'processing_fee' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $isTrial = $validated['subscription_status'] === 'free_trial';
        $organization->update([
            'plan' => $validated['plan'],
            'subscription_status' => $validated['subscription_status'],
            'trial_started_at' => $isTrial ? $validated['starts_at'] : $organization->trial_started_at,
            'trial_ends_at' => $isTrial ? $validated['ends_at'] : $organization->trial_ends_at,
            'subscription_started_at' => $isTrial ? null : $validated['starts_at'],
            'subscription_ends_at' => $isTrial ? null : $validated['ends_at'],
        ]);

        $price = (float) ($validated['price'] ?? 0);
        $processingFee = (float) ($validated['processing_fee'] ?? 0);
        $discount = (float) ($validated['discount'] ?? 0);
        SubscriptionHistory::create([
            'organization_id' => $organization->id,
            'plan' => $validated['plan'],
            'billing_cycle' => $validated['billing_cycle'] ?? 'monthly',
            'duration_days' => (int) ($validated['duration_days'] ?? 30),
            'price' => $price,
            'processing_fee' => $processingFee,
            'discount' => $discount,
            'total_due' => max(0, $price + $processingFee - $discount),
            'status' => $isTrial ? 'trial' : 'paid',
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'notes' => $validated['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($organization->fresh(['subscriptionHistory']));
    }

    public function storeSubscriptionHistory(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        abort_unless($organization->exists, 404);
        $validated = $request->validate([
            'plan' => ['required', 'in:Solo,Growth,Professional,Business,Enterprise'],
            'billing_cycle' => ['required', 'in:monthly,quarterly,semiannual,annual,custom'],
            'duration_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after_or_equal:starts_at'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'processing_fee' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:trial,paid,pending,expired'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
        $price = (float) ($validated['price'] ?? 0);
        $processingFee = (float) ($validated['processing_fee'] ?? 0);
        $discount = (float) ($validated['discount'] ?? 0);
        $history = SubscriptionHistory::create([
            'organization_id' => $organization->id,
            'plan' => $validated['plan'],
            'billing_cycle' => $validated['billing_cycle'],
            'duration_days' => $validated['duration_days'],
            'price' => $price,
            'processing_fee' => $processingFee,
            'discount' => $discount,
            'total_due' => max(0, $price + $processingFee - $discount),
            'status' => $validated['status'] ?? 'paid',
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'notes' => $validated['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);
        $organization->update([
            'plan' => $validated['plan'],
            'subscription_status' => ($validated['status'] ?? 'paid') === 'paid' ? 'active' : ($validated['status'] ?? 'active'),
            'subscription_started_at' => $validated['starts_at'],
            'subscription_ends_at' => $validated['ends_at'],
        ]);

        return response()->json($history, 201);
    }

    public function updateSubscriptionHistory(Request $request, Organization $organization, SubscriptionHistory $history): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        abort_unless($history->organization_id === $organization->id, 404);
        $validated = $request->validate([
            'plan' => ['required', 'in:Solo,Growth,Professional,Business,Enterprise'],
            'billing_cycle' => ['required', 'in:monthly,quarterly,semiannual,annual,custom'],
            'duration_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after_or_equal:starts_at'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'processing_fee' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:trial,paid,pending,expired'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
        $price = (float) ($validated['price'] ?? 0);
        $processingFee = (float) ($validated['processing_fee'] ?? 0);
        $discount = (float) ($validated['discount'] ?? 0);
        $history->update([
            ...$validated,
            'price' => $price,
            'processing_fee' => $processingFee,
            'discount' => $discount,
            'total_due' => max(0, $price + $processingFee - $discount),
        ]);
        $organization->update([
            'plan' => $validated['plan'],
            'subscription_status' => ($validated['status'] ?? 'paid') === 'paid' ? 'active' : ($validated['status'] ?? 'active'),
            'subscription_started_at' => $validated['starts_at'],
            'subscription_ends_at' => $validated['ends_at'],
        ]);
        return response()->json($history->fresh());
    }

    public function showOrganization(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        Organization::expireDueSubscriptions();
        $organization->load([
            'users' => fn ($query) => $query->withPivot('role')->orderBy('name'),
            'vehicles:id,organization_id,name,brand,model,year,plate_number,type,status',
            'customers:id,organization_id,name,email,phone,address,referral_source',
            'bookings:id,organization_id,customer_id,vehicle_id,reference,status,total_amount,pickup_at,return_at',
            'subscriptionHistory',
        ]);
        $organization->loadCount(['users', 'vehicles', 'bookings']);
        $organization->setAttribute('accounts_to_delete_count', $this->organizationOnlyAccounts($organization)->count());

        return response()->json($organization);
    }

    public function destroySubscriptionHistory(Request $request, Organization $organization, SubscriptionHistory $history): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        abort_unless($history->organization_id === $organization->id, 404);
        $history->delete();
        return response()->json(['deleted' => true]);
    }

    public function destroyOrganization(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $name = $organization->name;

        return DB::transaction(function () use ($organization, $name): JsonResponse {
            $accounts = $this->organizationOnlyAccounts($organization)->get();
            $deletedUserAccounts = $accounts->count();
            $accounts->each->delete();
            $organization->delete();

            return response()->json([
                'deleted' => true,
                'name' => $name,
                'deleted_user_accounts' => $deletedUserAccounts,
            ]);
        });
    }
}
