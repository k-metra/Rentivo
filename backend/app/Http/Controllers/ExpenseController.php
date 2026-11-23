<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Fund;
use App\Models\FundTransaction;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ExpenseController extends Controller
{
    private function organization(Request $request)
    {
        return $request->user()->organizations()->firstOrFail();
    }

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $query = Expense::where('organization_id', $organization->id)
            ->with(['fund:id,name,type', 'vehicle:id,name,brand,model,year,plate_number,image_path,image_url'])
            ->when($request->search, function ($query, string $search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('title', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%")
                        ->orWhere('expense_type', 'like', "%{$search}%")
                        ->orWhere('reference', 'like', "%{$search}%")
                        ->orWhereHas('vehicle', fn ($vehicle) => $vehicle
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('brand', 'like', "%{$search}%")
                            ->orWhere('model', 'like', "%{$search}%")
                            ->orWhere('plate_number', 'like', "%{$search}%"));
                });
            })
            ->when($request->category, fn ($query, $category) => $query->where('category', $category))
            ->when($request->fund_id, fn ($query, $fundId) => $query->where('fund_id', $fundId));

        $sort = $request->input('sort', 'date_latest');
        match ($sort) {
            'date_oldest' => $query->orderBy('incurred_at'),
            'amount_asc' => $query->orderBy('amount'),
            'amount_desc' => $query->orderByDesc('amount'),
            default => $query->orderByDesc('incurred_at'),
        };

        $expenses = $query->paginate(50);
        $base = Expense::where('organization_id', $organization->id);
        $monthStart = now()->startOfMonth();

        return response()->json([
            'expenses' => $expenses->items(),
            'current_page' => $expenses->currentPage(),
            'last_page' => $expenses->lastPage(),
            'total' => $expenses->total(),
            'total_expenses' => (float) (clone $base)->sum('amount'),
            'month_expenses' => (float) (clone $base)->where('incurred_at', '>=', $monthStart)->sum('amount'),
            'unit_expenses' => (float) (clone $base)->where('category', 'unit-related')->sum('amount'),
            'general_expenses' => (float) (clone $base)->where('category', 'general')->sum('amount'),
            'funds' => Fund::where('organization_id', $organization->id)->orderBy('name')->get(['id', 'name', 'type']),
            'vehicles' => Vehicle::where('organization_id', $organization->id)->orderBy('name')->orderBy('brand')->get(['id', 'name', 'brand', 'model', 'year', 'plate_number', 'image_path', 'image_url']),
            'categories' => (clone $base)->whereNotNull('category')->distinct()->orderBy('category')->pluck('category')->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $data = $request->validate($this->rules());
        $this->validateFund($organization->id, $data['fund_id'] ?? null);
        $data = $this->normalize($organization->id, $data);

        $expense = DB::transaction(function () use ($request, $organization, $data): Expense {
            $receipt = null;
            if ($request->hasFile('receipt')) {
                $receipt = $request->file('receipt')->store('expenses/receipts', 'public');
                abort_unless($receipt && Storage::disk('public')->exists($receipt), 500, 'The receipt could not be stored.');
            }

            $expense = Expense::create([
                ...$data,
                'receipt_path' => $receipt,
                'organization_id' => $organization->id,
                'created_by' => $request->user()->id,
            ]);

            if ($expense->fund_id) {
                FundTransaction::create([
                    'organization_id' => $organization->id,
                    'fund_id' => $expense->fund_id,
                    'expense_id' => $expense->id,
                    'type' => 'outflow',
                    'transacted_at' => $expense->incurred_at,
                    'amount' => $expense->amount,
                    'description' => $expense->title,
                    'notes' => $expense->notes,
                    'created_by' => $request->user()->id,
                ]);
            }
            return $expense;
        });

        return response()->json($expense->load(['fund:id,name,type', 'vehicle:id,name,brand,model,year,plate_number,image_path,image_url']), 201);
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($expense->organization_id !== $organization->id, 404);
        $data = $request->validate($this->rules());
        $this->validateFund($organization->id, $data['fund_id'] ?? null);
        $data = $this->normalize($organization->id, $data);

        $expense = DB::transaction(function () use ($request, $organization, $expense, $data): Expense {
            if ($request->hasFile('receipt')) {
                if ($expense->receipt_path) Storage::disk('public')->delete($expense->receipt_path);
                $receipt = $request->file('receipt')->store('expenses/receipts', 'public');
                abort_unless($receipt && Storage::disk('public')->exists($receipt), 500, 'The receipt could not be stored.');
                $data['receipt_path'] = $receipt;
            }
            $expense->update($data);

            $transaction = FundTransaction::where('expense_id', $expense->id)->first();
            if ($expense->fund_id) {
                $transactionData = [
                    'organization_id' => $organization->id,
                    'fund_id' => $expense->fund_id,
                    'type' => 'outflow',
                    'transacted_at' => $expense->incurred_at,
                    'amount' => $expense->amount,
                    'description' => $expense->title,
                    'notes' => $expense->notes,
                    'created_by' => $request->user()->id,
                ];
                $transaction
                    ? $transaction->update($transactionData)
                    : FundTransaction::create([...$transactionData, 'expense_id' => $expense->id]);
            } elseif ($transaction) {
                $transaction->delete();
            }
            return $expense;
        });

        return response()->json($expense->load(['fund:id,name,type', 'vehicle:id,name,brand,model,year,plate_number,image_path,image_url']));
    }

    public function destroy(Request $request, Expense $expense): JsonResponse
    {
        $organization = $this->organization($request);
        abort_if($expense->organization_id !== $organization->id, 404);
        if ($expense->receipt_path) Storage::disk('public')->delete($expense->receipt_path);
        $expense->delete();
        return response()->json(['deleted' => true]);
    }

    private function validateFund(int $organizationId, ?int $fundId): void
    {
        if ($fundId) {
            abort_unless(Fund::where('organization_id', $organizationId)->whereKey($fundId)->exists(), 422, 'The selected fund is invalid.');
        }
    }

    private function normalize(int $organizationId, array $data): array
    {
        if (($data['category'] ?? null) === 'unit-related') {
            $vehicleId = $data['vehicle_id'] ?? null;
            abort_unless($vehicleId && Vehicle::where('organization_id', $organizationId)->whereKey($vehicleId)->exists(), 422, 'The selected unit is invalid.');
            $data['vehicle_id'] = (int) $vehicleId;
            $data['expense_type'] = null;
        } else {
            $data['vehicle_id'] = null;
        }

        $data['title'] = $data['title'] ?? $data['expense_type'] ?? 'General expense';
        return $data;
    }

    private function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'category' => ['required', 'in:unit-related,general'],
            'vehicle_id' => ['nullable', 'required_if:category,unit-related', 'integer'],
            'expense_type' => ['nullable', 'required_if:category,general', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'incurred_at' => ['required', 'date'],
            'fund_id' => ['nullable', 'integer'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'receipt' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp,pdf', 'max:20480'],
        ];
    }
}
