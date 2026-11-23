<?php

namespace App\Http\Controllers;

use App\Models\Fund;
use App\Models\FundTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FundController extends Controller
{
    private function organization(Request $request)
    {
        return $request->user()->organizations()->firstOrFail();
    }

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $sort = $request->input('sort', 'date_latest');

        $funds = Fund::where('organization_id', $organization->id)
            ->withCount('transactions')
            ->get()
            ->map(fn (Fund $fund) => $this->withBalance($fund));

        $query = FundTransaction::where('organization_id', $organization->id)
            ->with(['fund:id,name,type', 'payment'])
            ->when($request->search, fn ($query, $search) => $query->where(function ($query) use ($search) {
                $query->where('description', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('fund', fn ($fund) => $fund->where('name', 'like', "%{$search}%"));
            }))
            ->when($request->fund_id, fn ($query, $fundId) => $query->where('fund_id', $fundId))
            ->when($request->type, fn ($query, $type) => $query->where('type', $type));

        match ($sort) {
            'date_oldest' => $query->orderBy('transacted_at'),
            'amount_asc' => $query->orderBy('amount'),
            'amount_desc' => $query->orderByDesc('amount'),
            'type_inflow' => $query->orderByRaw("CASE WHEN type = 'inflow' THEN 0 ELSE 1 END")->orderByDesc('transacted_at'),
            'type_outflow' => $query->orderByRaw("CASE WHEN type = 'outflow' THEN 0 ELSE 1 END")->orderByDesc('transacted_at'),
            default => $query->orderByDesc('transacted_at'),
        };

        $transactions = $query->paginate(50);

        return response()->json([
            'funds' => $funds,
            'transactions' => $transactions->items(),
            'current_page' => $transactions->currentPage(),
            'last_page' => $transactions->lastPage(),
            'total' => $transactions->total(),
            'total_balance' => $funds->sum('balance'),
            'total_inflows' => (float) FundTransaction::where('organization_id', $organization->id)->where('type', 'inflow')->sum('amount'),
            'total_outflows' => (float) FundTransaction::where('organization_id', $organization->id)->where('type', 'outflow')->sum('amount'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $data = $request->validate($this->fundRules());
        $data = $this->storeQrCode($request, $data);
        $fund = Fund::create([
            ...$data,
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
        ]);
        return response()->json($this->withBalance($fund), 201);
    }

    public function update(Request $request, Fund $fund): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($fund->organization_id !== $organization->id, 404);
        $data = $this->storeQrCode($request, $request->validate($this->fundRules()));
        if (array_key_exists('qr_code_path', $data) && $fund->qr_code_path) {
            Storage::disk('public')->delete($fund->qr_code_path);
        }
        $fund->update($data);
        return response()->json($this->withBalance($fund->fresh()));
    }

    public function destroy(Request $request, Fund $fund): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($fund->organization_id !== $organization->id, 404);
        if ($fund->qr_code_path) Storage::disk('public')->delete($fund->qr_code_path);
        $fund->delete();
        return response()->json(['deleted' => true]);
    }

    public function storeTransaction(Request $request, Fund $fund): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($fund->organization_id !== $organization->id, 404);
        $data = $request->validate($this->transactionRules());
        $transaction = FundTransaction::create([
            ...$data,
            'organization_id' => $organization->id,
            'fund_id' => $fund->id,
            'created_by' => $request->user()->id,
        ]);
        return response()->json($transaction->load(['fund:id,name,type', 'payment']), 201);
    }

    public function transfer(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $data = $request->validate([
            'source_fund_id' => ['required', 'integer', 'different:destination_fund_id'],
            'destination_fund_id' => ['required', 'integer'],
            'transacted_at' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $transferId = (string) Str::uuid();
        $transactions = DB::transaction(function () use ($organization, $data, $transferId, $request): array {
            $funds = Fund::where('organization_id', $organization->id)
                ->whereIn('id', [(int) $data['source_fund_id'], (int) $data['destination_fund_id']])
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $source = $funds->get((int) $data['source_fund_id']);
            $destination = $funds->get((int) $data['destination_fund_id']);
            abort_unless($source && $destination, 404, 'Both funds must exist.');

            $balance = (float) $source->opening_balance
                + (float) $source->transactions()->where('type', 'inflow')->sum('amount')
                - (float) $source->transactions()->where('type', 'outflow')->sum('amount');
            abort_if((float) $data['amount'] > $balance, 422, 'The source fund does not have enough available balance.');

            $common = [
                'organization_id' => $organization->id,
                'transacted_at' => $data['transacted_at'],
                'amount' => $data['amount'],
                'notes' => trim(($data['notes'] ?? '')."\nTransfer ID: {$transferId}"),
                'transfer_reference' => $transferId,
                'created_by' => $request->user()->id,
            ];
            return [
                FundTransaction::create([...$common, 'fund_id' => $source->id, 'type' => 'outflow', 'description' => "Transfer to {$destination->name}"])->load('fund'),
                FundTransaction::create([...$common, 'fund_id' => $destination->id, 'type' => 'inflow', 'description' => "Transfer from {$source->name}"])->load('fund'),
            ];
        });

        return response()->json(['transactions' => $transactions], 201);
    }

    public function updateTransaction(Request $request, FundTransaction $transaction): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($transaction->organization_id !== $organization->id, 404);
        abort_if($transaction->transfer_reference, 422, 'Fund transfer transactions cannot be edited as standalone transactions.');
        $data = $request->validate($this->transactionRules());
        $transaction->update($data);
        if ($transaction->payment_id) {
            $transaction->payment()->update(['fund_id' => $transaction->fund_id]);
        }
        return response()->json($transaction->fresh(['fund:id,name,type', 'payment']));
    }

    public function destroyTransaction(Request $request, FundTransaction $transaction): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($transaction->organization_id !== $organization->id, 404);
        abort_if($transaction->transfer_reference, 422, 'Fund transfer transactions cannot be deleted separately.');
        $transaction->delete();
        return response()->json(['deleted' => true]);
    }

    private function withBalance(Fund $fund): Fund
    {
        $inflows = $fund->transactions()->where('type', 'inflow')->sum('amount');
        $outflows = $fund->transactions()->where('type', 'outflow')->sum('amount');
        $fund->setAttribute('balance', (float) $fund->opening_balance + (float) $inflows - (float) $outflows);
        return $fund;
    }

    private function fundRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'in:cash,bank,e-wallet,other'],
            'account_name' => ['nullable', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:100'],
            'qr_code' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp,gif', 'max:20480'],
            'opening_balance' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ];
    }

    private function storeQrCode(Request $request, array $data): array
    {
        if ($request->hasFile('qr_code')) {
            $path = $request->file('qr_code')->store('funds/qr-codes', 'public');
            abort_unless($path && Storage::disk('public')->exists($path), 500, 'The QR code image could not be stored.');
            $data['qr_code_path'] = $path;
        }
        unset($data['qr_code']);
        return $data;
    }

    private function transactionRules(): array
    {
        return [
            'fund_id' => ['sometimes', 'exists:funds,id'],
            'type' => ['required', 'in:inflow,outflow'],
            'transacted_at' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
