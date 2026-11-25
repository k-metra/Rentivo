<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Services\PlanEntitlements;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrganizationSettingsController extends Controller
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

    private function onlineBookingUrl(string $slug): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/booking/'.$slug;
    }

    public function show(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Settings View');
        $organization = $this->organization($request);
        $organization->setAttribute('logo_url', $organization->logo_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
            : null);
        $rank = app(PlanEntitlements::class)->rank($organization->plan);
        $organization->setAttribute('e_signature_eligible', $rank >= 2);
        $organization->setAttribute('online_booking_eligible', $rank >= 2);
        $organization->setAttribute('online_booking_full_website_eligible', $rank >= 3);
        $organization->setAttribute('online_booking_url', $organization->online_booking_slug
            ? $this->onlineBookingUrl($organization->online_booking_slug)
            : null);
        $organization->setAttribute('online_booking_banner_url', $organization->online_booking_banner_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->online_booking_banner_path
            : null);
        $organization->setAttribute('online_booking_reservation_qr_url', $organization->online_booking_reservation_qr_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->online_booking_reservation_qr_path
            : null);

        return response()->json($organization);
    }

    public function update(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Settings Update');
        $organization = $this->organization($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:255'],
            'currency' => ['sometimes', 'required', 'string', 'in:USD,EUR,GBP,PHP,SGD'],
            'phone' => ['nullable', 'string', 'max:255'],
            'primary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'electronic_signature_enabled' => ['nullable', 'boolean'],
            'online_booking_enabled' => ['nullable', 'boolean'],
            'online_booking_hero_title' => ['nullable', 'string', 'max:120'],
            'online_booking_hero_subtitle' => ['nullable', 'string', 'max:500'],
            'online_booking_reservation_fee_amount' => ['nullable', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'online_booking_reservation_fee_deductible' => ['nullable', 'boolean'],
            'online_booking_reservation_payment_instructions' => ['nullable', 'string', 'max:5000'],
            'customer_requirements_expiry_months' => ['nullable', 'integer', 'min:1', 'max:120'],
            'online_booking_phone' => ['nullable', 'string', 'max:255'],
            'online_booking_requirements' => ['nullable', 'array'],
            'delivery_methods' => ['nullable', 'array'],
            'professional_driver_enabled' => ['nullable', 'boolean'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'online_booking_banner' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'online_booking_reservation_qr' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $rank = app(PlanEntitlements::class)->rank($organization->plan);
        $electronicSignatureEnabled = $rank >= 2
            ? $request->boolean('electronic_signature_enabled')
            : false;
        $onlineBookingEnabled = $rank >= 2
            ? $request->boolean('online_booking_enabled')
            : false;
        abort_if(
            $rank < 3 && (
                $request->filled('online_booking_hero_title')
                || $request->filled('online_booking_hero_subtitle')
                || $request->hasFile('online_booking_banner')
            ),
            422,
            'Full website customization is available on Professional plans and above.',
        );

        $logoPath = $organization->logo_path;
        if ($request->hasFile('logo')) {
            if ($logoPath) {
                Storage::disk('public')->delete($logoPath);
            }
            $logoPath = $request->file('logo')->store('logos', 'public');
        }

        $bannerPath = $organization->online_booking_banner_path;
        if ($rank >= 3 && $request->hasFile('online_booking_banner')) {
            if ($bannerPath) {
                Storage::disk('public')->delete($bannerPath);
            }
            $bannerPath = $request->file('online_booking_banner')->store('booking-website-banners', 'public');
        }

        $reservationQrPath = $organization->online_booking_reservation_qr_path;
        $reservationQrUploaded = $rank >= 2 && $request->hasFile('online_booking_reservation_qr');
        $reservationFeeAmount = $rank >= 2
            ? ($validated['online_booking_reservation_fee_amount'] ?? null)
            : $organization->online_booking_reservation_fee_amount;
        $reservationInstructions = $rank >= 2
            ? ($validated['online_booking_reservation_payment_instructions'] ?? null)
            : $organization->online_booking_reservation_payment_instructions;
        abort_if(
            $rank >= 2
                && (float) ($reservationFeeAmount ?? 0) > 0
                && blank($reservationInstructions)
                && ! $reservationQrUploaded
                && ! $reservationQrPath,
            422,
            'Add payment instructions or a QR code before setting a reservation fee.',
        );
        if ($reservationQrUploaded) {
            if ($reservationQrPath) {
                Storage::disk('public')->delete($reservationQrPath);
            }
            $reservationQrPath = $request->file('online_booking_reservation_qr')->store('booking-reservation-qr', 'public');
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
            'currency' => $validated['currency'] ?? $organization->currency,
            'phone' => $validated['phone'] ?? null,
            'primary_color' => $validated['primary_color'] ?? '#5b21b6',
            'electronic_signature_enabled' => $electronicSignatureEnabled,
            'online_booking_enabled' => $onlineBookingEnabled,
            'online_booking_slug' => $slug,
            'online_booking_banner_path' => $bannerPath,
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
            'online_booking_reservation_fee_amount' => $reservationFeeAmount,
            'online_booking_reservation_fee_deductible' => $rank >= 2
                ? $request->boolean('online_booking_reservation_fee_deductible', true)
                : $organization->online_booking_reservation_fee_deductible,
            'online_booking_reservation_payment_instructions' => $reservationInstructions,
            'online_booking_reservation_qr_path' => $reservationQrPath,
        ]);

        if ($rank >= 3) {
            $organization->update([
                'online_booking_hero_title' => $validated['online_booking_hero_title'] ?? null,
                'online_booking_hero_subtitle' => $validated['online_booking_hero_subtitle'] ?? null,
            ]);
        }

        $organization->setAttribute('logo_url', $organization->logo_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->logo_path
            : null);
        $organization->setAttribute('online_booking_url', $slug
            ? $this->onlineBookingUrl($slug)
            : null);

        $organization = $organization->fresh();
        $organization->setAttribute('online_booking_eligible', $rank >= 2);
        $organization->setAttribute('online_booking_full_website_eligible', $rank >= 3);
        $organization->setAttribute('online_booking_banner_url', $organization->online_booking_banner_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->online_booking_banner_path
            : null);
        $organization->setAttribute('online_booking_reservation_qr_url', $organization->online_booking_reservation_qr_path
            ? $request->getSchemeAndHttpHost().'/storage/'.$organization->online_booking_reservation_qr_path
            : null);

        return response()->json($organization);
    }
}
