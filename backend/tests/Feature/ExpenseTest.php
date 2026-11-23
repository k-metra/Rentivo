<?php

namespace Tests\Feature;

use App\Models\Fund;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpenseTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_organization_can_create_edit_and_delete_an_expense(): void
    {
        $organization = Organization::create([
            'name' => 'Expense Rentals',
            'slug' => 'expense-rentals',
        ]);
        $user = User::factory()->create();
        $organization->users()->attach($user->id, ['role' => 'owner']);
        $fund = Fund::create([
            'organization_id' => $organization->id,
            'name' => 'Main Cash',
            'type' => 'cash',
            'opening_balance' => 10000,
            'created_by' => $user->id,
        ]);
        Sanctum::actingAs($user);

        $create = $this->postJson('/api/dashboard/expenses', [
            'title' => 'Vehicle repair',
            'category' => 'general',
            'expense_type' => 'Repairs',
            'amount' => 1250,
            'incurred_at' => now()->toISOString(),
            'fund_id' => $fund->id,
            'reference' => 'INV-100',
            'notes' => 'Brake replacement',
        ]);

        $create->assertCreated()->assertJsonPath('title', 'Vehicle repair');
        $expenseId = $create->json('id');
        $this->assertDatabaseHas('fund_transactions', [
            'expense_id' => $expenseId,
            'type' => 'outflow',
            'amount' => 1250,
        ]);

        $this->patchJson("/api/dashboard/expenses/{$expenseId}", [
            'title' => 'Updated vehicle repair',
            'category' => 'general',
            'expense_type' => 'Repairs',
            'amount' => 1500,
            'incurred_at' => now()->toISOString(),
            'fund_id' => null,
            'reference' => 'INV-101',
            'notes' => 'Updated',
        ])->assertOk();

        $this->assertDatabaseMissing('fund_transactions', [
            'expense_id' => $expenseId,
        ]);

        $this->deleteJson("/api/dashboard/expenses/{$expenseId}")
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->assertDatabaseMissing('expenses', ['id' => $expenseId]);
    }
}
