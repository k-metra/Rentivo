<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingContract;
use App\Models\ContractTemplate;
use App\Models\Organization;
use App\Services\PlanEntitlements;
use App\Services\RolePermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class BookingContractController extends Controller
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

    private function contractShareUrl(string $shareToken): string
    {
        $frontendUrl = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');

        return $frontendUrl.'/contract/'.$shareToken;
    }

    public function templates(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Generate and Manage Booking Contracts');
        $organization = $this->organization($request);
        app(PlanEntitlements::class)->requireRank($organization, 2, 'Electronic signatures');
        $templates = ContractTemplate::where('organization_id', $organization->id)
            ->latest()
            ->get();
        $active = $templates->firstWhere('is_active', true);

        return response()->json([
            'templates' => $templates,
            'active' => $active,
        ]);
    }

    public function saveTemplate(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'Generate and Manage Booking Contracts');
        $organization = $this->organization($request);
        app(PlanEntitlements::class)->requireRank($organization, 2, 'Electronic signatures');
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'margins' => ['required', 'array'],
            'margins.top' => ['required', 'numeric', 'min:0', 'max:60'],
            'margins.right' => ['required', 'numeric', 'min:0', 'max:60'],
            'margins.bottom' => ['required', 'numeric', 'min:0', 'max:60'],
            'margins.left' => ['required', 'numeric', 'min:0', 'max:60'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $sanitizedContent = trim(strip_tags(
            $validated['content'],
            '<p><br><b><strong><i><em><u><h1><h2><h3><ul><ol><li><table><thead><tbody><tr><th><td><div><span><blockquote><hr>'
        ));
        if (! str_contains($sanitizedContent, '{{renter_signature}}')
            || ! str_contains($sanitizedContent, '{{staff_signature}}')) {
            abort(422, 'The contract template must contain both renter and staff signature fields.');
        }

        $template = ContractTemplate::where('organization_id', $organization->id)
            ->where('title', $validated['title'])
            ->first();

        $isActive = (bool) ($validated['is_active'] ?? true);
        if ($isActive) {
            ContractTemplate::where('organization_id', $organization->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);
        }

        $template = $template
            ? tap($template)->update([
                'content' => $sanitizedContent,
                'margins' => $validated['margins'],
                'is_active' => $isActive,
            ])
            : ContractTemplate::create([
                'organization_id' => $organization->id,
                'created_by' => $request->user()->id,
                'title' => $validated['title'],
                'content' => $sanitizedContent,
                'margins' => $validated['margins'],
                'is_active' => $isActive,
            ]);

        return response()->json(['template' => $template], 200);
    }

    public function deleteTemplate(Request $request, ContractTemplate $template): JsonResponse
    {
        $this->requirePermission($request, 'Generate and Manage Booking Contracts');
        $organization = $this->organization($request);
        app(PlanEntitlements::class)->requireRank($organization, 2, 'Electronic signatures');
        abort_if($template->organization_id !== $organization->id, 404);
        $wasActive = $template->is_active;
        $template->delete();
        if ($wasActive) {
            $fallback = ContractTemplate::where('organization_id', $organization->id)->latest()->first();
            if ($fallback) {
                $fallback->update(['is_active' => true]);
            }
        }

        return response()->json(['message' => 'Contract template deleted.']);
    }

    public function show(Request $request, Booking $booking): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($booking->organization_id !== $organization->id, 404);
        $contract = $booking->contract()->latest()->first();
        if ($contract && $contract->status === 'signed' && $contract->renter_signature_data) {
            $signatureHtml = '<div><img src="'.e($contract->renter_signature_data).'" alt="Renter signature" style="display:block;width:220px;height:64px;object-fit:contain;object-position:left bottom" /><div style="margin-top:6px;font-size:12px;border-top:1px solid #17141f;width:220px;padding-top:4px">'.e($contract->renter_signer_name ?: 'Renter').'</div></div>';
            $resolved = str_replace('{{renter_signature}}', $signatureHtml, $contract->resolved_html);
            $resolved = preg_replace(
                '/<span[^>]*data-dynamic-field="renter_signature"[^>]*>[\s\S]*?<\/span>/i',
                $signatureHtml,
                $resolved,
                1,
            ) ?? $resolved;
            $patterns = [
                '/<div style="width:220px;height:64px;border-bottom:1px solid #17141f"><\/div><div style="margin-top:6px;font-size:12px">Renter signature<\/div>/i',
                '/<div[^>]*height:64px[^>]*border-bottom:[^>]*><\/div>\s*<div[^>]*>Renter signature<\/div>/i',
                '/Renter signature/i',
            ];
            foreach ($patterns as $index => $pattern) {
                $resolved = preg_replace($pattern, $signatureHtml, $resolved, 1) ?? $resolved;
                if (str_contains($resolved, '<img src="'.e($contract->renter_signature_data).'"')) {
                    break;
                }
            }
            $contract->update(['resolved_html' => $resolved]);
            $contract->setAttribute('resolved_html', $resolved);
        }

        return response()->json([
            'contract' => $contract,
            'share_url' => $contract
                ? $this->contractShareUrl($contract->share_token)
                : null,
        ]);
    }

    public function generate(Request $request, Booking $booking): JsonResponse
    {
        $this->requirePermission($request, 'Generate and Manage Booking Contracts');
        $organization = $this->organization($request);
        app(PlanEntitlements::class)->requireRank($organization, 2, 'Electronic signatures');
        abort_if($booking->organization_id !== $organization->id, 404);
        abort_unless($organization->electronic_signature_enabled, 422, 'Electronic signatures are not enabled.');

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'template_html' => ['required', 'string'],
            'resolved_html' => ['nullable', 'string'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $templateHtml = trim(strip_tags($validated['template_html'], '<p><br><b><strong><i><em><u><h1><h2><h3><ul><ol><li><table><thead><tbody><tr><th><td><div><span><blockquote><hr>'));
        abort_unless(
            str_contains($templateHtml, '{{renter_signature}}')
            && str_contains($templateHtml, '{{staff_signature}}'),
            422,
            'The contract must contain both renter and staff signature fields.',
        );

        $pin = (string) random_int(100000, 999999);
        $contract = $booking->contract()->latest()->first();
        abort_if($contract && $contract->status === 'signed', 422, 'A fully signed contract cannot be regenerated.');
        $contract = $contract
            ? $contract->fill([
                'title' => $validated['title'],
                'template_html' => $templateHtml,
                'resolved_html' => $validated['resolved_html'] ?? $templateHtml,
                'share_token' => Str::random(64),
                'pin_hash' => Hash::make($pin),
                'status' => 'issued',
                'renter_signature_data' => null,
                'renter_signer_name' => null,
                'staff_signature_data' => null,
                'staff_signer_name' => null,
                'review_confirmed' => false,
                'signed_at' => null,
                'renter_signed_at' => null,
                'staff_signed_at' => null,
                'renter_review_confirmed' => false,
                'staff_review_confirmed' => false,
                'expires_at' => isset($validated['expires_at']) ? Carbon::parse($validated['expires_at']) : now()->addDays(7),
                'revoked_at' => null,
            ])
            : new BookingContract([
                'booking_id' => $booking->id,
                'organization_id' => $organization->id,
                'created_by' => $request->user()->id,
                'title' => $validated['title'],
                'template_html' => $templateHtml,
                'resolved_html' => $validated['resolved_html'] ?? $templateHtml,
                'share_token' => Str::random(64),
                'pin_hash' => Hash::make($pin),
                'status' => 'issued',
                'renter_signature_data' => null,
                'renter_signer_name' => null,
                'staff_signature_data' => null,
                'staff_signer_name' => null,
                'review_confirmed' => false,
                'renter_review_confirmed' => false,
                'staff_review_confirmed' => false,
                'signed_at' => null,
                'renter_signed_at' => null,
                'staff_signed_at' => null,
                'expires_at' => isset($validated['expires_at']) ? Carbon::parse($validated['expires_at']) : now()->addDays(7),
                'revoked_at' => null,
            ]);
        $contract->save();

        return response()->json([
            'contract' => $contract,
            'pin' => $pin,
            'share_url' => $this->contractShareUrl($contract->share_token),
        ]);
    }

    public function signAsStaff(Request $request, Booking $booking): JsonResponse
    {
        $this->requirePermission($request, 'Sign booking contracts for the company');
        $organization = $this->organization($request);
        app(PlanEntitlements::class)->requireRank($organization, 2, 'Electronic signatures');
        abort_if($booking->organization_id !== $organization->id, 404);
        $contract = $booking->contract()->latest()->firstOrFail();
        abort_if($contract->revoked_at || $contract->status === 'revoked', 410, 'This contract is no longer available.');
        if ($contract->expires_at && $contract->expires_at->isPast()) {
            abort(410, 'This contract link has expired.');
        }
        abort_if(! $contract->renter_signature_data, 422, 'The renter must sign before staff signing.');
        abort_if($contract->staff_signature_data, 422, 'The staff representative has already signed this contract.');

        $validated = $request->validate([
            'staff_signer_name' => ['required', 'string', 'max:255'],
            'staff_signature_data' => ['required', 'string', 'min:100'],
            'staff_review_confirmed' => ['required', 'accepted'],
        ]);

        $signatureHtml = '<div><img src="'.e($validated['staff_signature_data']).'" alt="Staff signature" style="display:block;width:220px;height:64px;object-fit:contain;object-position:left bottom" /><div style="margin-top:6px;font-size:12px;border-top:1px solid #17141f;width:220px;padding-top:4px">'.e($validated['staff_signer_name']).'</div></div>';
        $resolved = str_replace('{{staff_signature}}', $signatureHtml, $contract->resolved_html);
        $resolved = preg_replace(
            '/<span[^>]*data-dynamic-field="staff_signature"[^>]*>[\s\S]*?<\/span>/i',
            $signatureHtml,
            $resolved,
            1,
        ) ?? $resolved;

        $contract->update([
            'resolved_html' => $resolved,
            'staff_signature_data' => $validated['staff_signature_data'],
            'staff_signer_name' => $validated['staff_signer_name'],
            'staff_review_confirmed' => true,
            'staff_signed_at' => now(),
            'status' => 'signed',
            'signed_at' => now(),
            'review_confirmed' => true,
        ]);

        return response()->json([
            'message' => 'Contract fully signed.',
            'contract' => $contract,
        ]);
    }

    public function revoke(Request $request, Booking $booking): JsonResponse
    {
        $this->requirePermission($request, 'Generate and Manage Booking Contracts');
        $organization = $this->organization($request);
        app(PlanEntitlements::class)->requireRank($organization, 2, 'Electronic signatures');
        abort_if($booking->organization_id !== $organization->id, 404);
        $contract = $booking->contract()->latest()->firstOrFail();
        abort_if($contract->status === 'signed', 422, 'A fully signed contract cannot be revoked.');
        $contract->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);

        return response()->json(['message' => 'Contract link revoked.', 'contract' => $contract]);
    }

    public function viewPublic(string $token): JsonResponse
    {
        $contract = BookingContract::with(['booking.customer', 'booking.vehicle'])->where('share_token', $token)->firstOrFail();
        abort_if($contract->revoked_at || $contract->status === 'revoked', 410, 'This contract is no longer available.');
        if ($contract->expires_at && $contract->expires_at->isPast()) {
            abort(410, 'This contract link has expired.');
        }

        return response()->json([
            'title' => $contract->title,
            'status' => $contract->status,
            'requires_pin' => true,
            'signed_at' => $contract->signed_at,
            'expires_at' => $contract->expires_at,
        ]);
    }

    public function verifyPublic(Request $request, string $token): JsonResponse
    {
        $contract = BookingContract::with(['booking.customer', 'booking.vehicle'])->where('share_token', $token)->firstOrFail();
        abort_if($contract->revoked_at || $contract->status === 'revoked', 410, 'This contract is no longer available.');
        if ($contract->expires_at && $contract->expires_at->isPast()) {
            abort(410, 'This contract link has expired.');
        }

        $validated = $request->validate([
            'pin' => ['required', 'digits:6'],
        ]);
        if (! Hash::check($validated['pin'], $contract->pin_hash)) {
            return response()->json(['message' => 'The PIN is incorrect.'], 422);
        }

        $resolved = $contract->resolved_html;
        if ($contract->status === 'signed' && $contract->renter_signature_data) {
            $signatureHtml = '<div><img src="'.e($contract->renter_signature_data).'" alt="Renter signature" style="display:block;width:220px;height:64px;object-fit:contain;object-position:left bottom" /><div style="margin-top:6px;font-size:12px;border-top:1px solid #17141f;width:220px;padding-top:4px">'.e($contract->renter_signer_name ?: 'Renter').'</div></div>';
            $resolved = str_replace('{{renter_signature}}', $signatureHtml, $resolved);
            $resolved = preg_replace(
                '/<span[^>]*data-dynamic-field="renter_signature"[^>]*>[\s\S]*?<\/span>/i',
                $signatureHtml,
                $resolved,
                1,
            ) ?? $resolved;
            foreach ([
                '/<div style="width:220px;height:64px;border-bottom:1px solid #17141f"><\/div><div style="margin-top:6px;font-size:12px">Renter signature<\/div>/i',
                '/<div[^>]*height:64px[^>]*border-bottom:[^>]*><\/div>\s*<div[^>]*>Renter signature<\/div>/i',
                '/Renter signature/i',
            ] as $pattern) {
                $resolved = preg_replace($pattern, $signatureHtml, $resolved, 1) ?? $resolved;
                if (str_contains($resolved, '<img src="'.e($contract->renter_signature_data).'"')) {
                    break;
                }
            }
        }
        $resolved = str_replace('{{staff_signature}}', '<div style="width:220px;height:64px;border-bottom:1px solid #17141f"></div><div style="margin-top:6px;font-size:12px">Staff / authorized representative signature</div>', $resolved);

        return response()->json([
            'contract' => [
                'title' => $contract->title,
                'resolved_html' => $resolved,
                'status' => $contract->status,
                'signed_at' => $contract->signed_at,
                'renter_name' => $contract->booking->customer->name ?? '',
                'renter_signer_name' => $contract->renter_signer_name,
                'renter_signature_data' => $contract->renter_signature_data,
                'staff_signer_name' => $contract->staff_signer_name,
                'staff_signature_data' => $contract->staff_signature_data,
                'expires_at' => $contract->expires_at,
            ],
        ]);
    }

    public function signPublic(Request $request, string $token): JsonResponse
    {
        $contract = BookingContract::with(['booking.customer'])->where('share_token', $token)->firstOrFail();
        $organization = Organization::findOrFail($contract->organization_id);
        app(PlanEntitlements::class)->requireRank($organization, 2, 'Electronic signatures');
        abort_if($contract->revoked_at || $contract->status === 'revoked', 410, 'This contract is no longer available.');
        if ($contract->expires_at && $contract->expires_at->isPast()) {
            abort(410, 'This contract link has expired.');
        }
        abort_if($contract->renter_signature_data, 422, 'The renter has already signed this contract.');

        $validated = $request->validate([
            'pin' => ['required', 'digits:6'],
            'renter_signer_name' => ['required', 'string', 'max:255'],
            'signature_data' => ['required', 'string', 'min:100'],
            'review_confirmed' => ['required', 'accepted'],
        ]);
        if (! Hash::check($validated['pin'], $contract->pin_hash)) {
            return response()->json(['message' => 'The PIN is incorrect.'], 422);
        }

        $signatureHtml = '<div><img src="'.e($validated['signature_data']).'" alt="Renter signature" style="display:block;width:220px;height:64px;object-fit:contain;object-position:left bottom" /><div style="margin-top:6px;font-size:12px;border-top:1px solid #17141f;width:220px;padding-top:4px">'.e($validated['renter_signer_name']).'</div></div>';
        $resolved = str_replace('{{renter_signature}}', $signatureHtml, $contract->resolved_html);
        $resolved = preg_replace(
            '/<span[^>]*data-dynamic-field="renter_signature"[^>]*>[\s\S]*?<\/span>/i',
            $signatureHtml,
            $resolved,
            1,
        ) ?? $resolved;
        if (! str_contains($contract->resolved_html, '{{renter_signature}}')) {
            $resolved = preg_replace(
                '/<div style="width:220px;height:64px;border-bottom:1px solid #17141f"><\/div><div style="margin-top:6px;font-size:12px">Renter signature<\/div>/i',
                $signatureHtml,
                $resolved,
                1,
            ) ?? $resolved;
        }
        $resolved = str_replace('{{staff_signature}}', '<div style="width:220px;height:64px;border-bottom:1px solid #17141f"></div><div style="margin-top:6px;font-size:12px">Staff / authorized representative signature</div>', $resolved);

        $contract->update([
            'resolved_html' => $resolved,
            'renter_signature_data' => $validated['signature_data'],
            'renter_signer_name' => $validated['renter_signer_name'],
            'review_confirmed' => true,
            'renter_review_confirmed' => true,
            'renter_signed_at' => now(),
            'status' => $contract->staff_signature_data ? 'signed' : 'renter_signed',
            'signed_at' => $contract->staff_signature_data ? now() : null,
        ]);

        return response()->json([
            'message' => 'Contract signed successfully.',
            'contract' => [
                'title' => $contract->title,
                'resolved_html' => $resolved,
                'status' => $contract->status,
                'signed_at' => $contract->signed_at,
                'renter_signer_name' => $contract->renter_signer_name,
                'renter_signature_data' => $contract->renter_signature_data,
                'staff_signer_name' => $contract->staff_signer_name,
                'staff_signature_data' => $contract->staff_signature_data,
            ],
        ]);
    }
}
