<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerAttachment;
use App\Models\Organization;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CustomerController extends Controller
{
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
        $this->requirePermission($request, 'Customers View');
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

    public function show(Request $request, Customer $customer): JsonResponse
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

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Customers Create');
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
        $this->storeAttachments($request, $customer);

        return response()->json($customer->fresh(['attachments'])->loadCount('bookings'), 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $this->requirePermission($request, 'Customers Update');
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
        $this->storeAttachments($request, $customer);

        return response()->json($customer->fresh(['attachments'])->loadCount('bookings'));
    }

    private function storeAttachments(Request $request, Customer $customer): void
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

    public function archive(Request $request, Customer $customer): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($customer->organization_id !== $organization->id, 404);
        $archive = $request->boolean('archive', true);
        $customer->update(['archived_at' => $archive ? now() : null]);

        return response()->json($customer->fresh(['attachments'])->loadCount('bookings'));
    }

    public function destroy(Request $request, Customer $customer): JsonResponse
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
