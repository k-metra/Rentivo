<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VehicleManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_vehicle_creation_and_update_preserve_images_and_rental_rates(): void
    {
        Storage::fake('public');
        $organization = $this->createOrganization('Vehicle Workspace');
        $owner = $this->createOwner($organization);
        Sanctum::actingAs($owner);

        $create = $this->post('/api/dashboard/vehicles', [
            ...$this->vehiclePayload('abc-1234'),
            'image' => $this->fakePng('vios.png'),
            'exterior_images' => [$this->fakePng('exterior.png')],
            'interior_images' => [$this->fakePng('interior.png')],
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('vehicle.plate_number', 'ABC-1234')
            ->assertJsonPath('vehicle.rental_rates.0.duration_hours', 12)
            ->assertJsonPath('warning', null);

        $vehicle = Vehicle::query()->findOrFail($create->json('vehicle.id'));
        Storage::disk('public')->assertExists($vehicle->image_path);
        $this->assertDatabaseCount('vehicle_images', 2);
        foreach ($vehicle->images()->get() as $image) {
            Storage::disk('public')->assertExists($image->image_path);
        }
        $this->assertDatabaseHas('vehicle_rental_rates', [
            'vehicle_id' => $vehicle->id,
            'duration_hours' => 12,
            'amount' => 800,
            'coverage_type' => 'province',
        ]);

        $this->put("/api/dashboard/vehicles/{$vehicle->id}", [
            ...$this->vehiclePayload('xyz-9876', 'Honda', 'City'),
            'rental_rates' => json_encode([
                [
                    'duration_hours' => 24,
                    'amount' => 1500,
                    'coverage_type' => 'all',
                    'coverage_locations' => [],
                ],
            ]),
            'image' => $this->fakePng('city.png'),
            'interior_images' => [$this->fakePng('new-interior.png')],
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('vehicle.plate_number', 'XYZ-9876')
            ->assertJsonPath('vehicle.rental_rates.0.duration_hours', 24);

        $vehicle->refresh();
        Storage::disk('public')->assertExists($vehicle->image_path);
        $this->assertDatabaseCount('vehicle_rental_rates', 1);
        $this->assertDatabaseCount('vehicle_images', 3);
        $this->assertDatabaseHas('vehicle_rental_rates', [
            'vehicle_id' => $vehicle->id,
            'duration_hours' => 24,
            'amount' => 1500,
        ]);
    }

    public function test_vehicle_can_save_a_marketing_photo_and_named_gallery_views(): void
    {
        Storage::fake('public');
        $organization = $this->createOrganization('Marketing Fleet');
        $owner = $this->createOwner($organization);
        Sanctum::actingAs($owner);

        $payload = $this->vehiclePayload('MKT-1234');
        $payload['image'] = $this->fakePng('vehicle-icon.png');
        $payload['marketing_image'] = $this->fakePng('marketing.png');
        foreach (['interior_front', 'interior_back', 'left', 'right', 'back', 'trunk', 'front'] as $category) {
            $payload["{$category}_images"] = [$this->fakePng("{$category}.png")];
        }

        $response = $this->post('/api/dashboard/vehicles', $payload, ['Accept' => 'application/json'])
            ->assertCreated();
        $vehicle = Vehicle::query()->findOrFail($response->json('vehicle.id'));
        $images = $vehicle->images()->get();

        Storage::disk('public')->assertExists($vehicle->image_path);
        Storage::disk('public')->assertExists($vehicle->marketing_image_path);
        $this->assertNotSame($vehicle->image_path, $vehicle->marketing_image_path);
        $response->assertJsonPath('vehicle.image_url', url('/storage/'.$vehicle->image_path))
            ->assertJsonPath('vehicle.marketing_image_url', url('/storage/'.$vehicle->marketing_image_path));
        $this->assertCount(7, $images);
        $this->assertEqualsCanonicalizing(
            ['interior_front', 'interior_back', 'left', 'right', 'back', 'trunk', 'front'],
            $images->pluck('category')->all(),
        );
        foreach ($images as $image) {
            Storage::disk('public')->assertExists($image->image_path);
        }

        $iconPath = $vehicle->image_path;
        $marketingPath = $vehicle->marketing_image_path;
        $this->put("/api/dashboard/vehicles/{$vehicle->id}", [
            ...$this->vehiclePayload('MKT-1234'),
            'marketing_image' => $this->fakePng('updated-marketing.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $vehicle->refresh();
        $this->assertSame($iconPath, $vehicle->image_path);
        $this->assertNotSame($marketingPath, $vehicle->marketing_image_path);
        Storage::disk('public')->assertExists($vehicle->marketing_image_path);
    }

    public function test_vehicle_endpoints_only_return_or_modify_the_current_organizations_vehicles(): void
    {
        $organization = $this->createOrganization('Current Vehicle Workspace');
        $owner = $this->createOwner($organization);
        $otherOrganization = $this->createOrganization('Other Vehicle Workspace');
        $otherOwner = $this->createOwner($otherOrganization);
        $otherVehicle = $this->createVehicle($otherOrganization);
        Sanctum::actingAs($owner);

        $this->getJson('/api/dashboard/vehicles')
            ->assertOk()
            ->assertExactJson([]);

        $this->getJson("/api/dashboard/vehicles/{$otherVehicle->id}")
            ->assertNotFound();
        $this->putJson("/api/dashboard/vehicles/{$otherVehicle->id}", $this->vehiclePayload('ABC-1234'))
            ->assertNotFound();

        $this->assertSame('Toyota', $otherVehicle->fresh()->brand);
        $this->assertSame($otherOwner->id, $otherVehicle->organization->users()->firstOrFail()->id);
    }

    public function test_vehicle_creation_obeys_the_plan_vehicle_limit(): void
    {
        $organization = $this->createOrganization('Solo Fleet', 'Solo');
        $owner = $this->createOwner($organization);
        foreach (['AAA-001', 'AAA-002', 'AAA-003'] as $plateNumber) {
            $this->createVehicle($organization, $plateNumber);
        }
        Sanctum::actingAs($owner);

        $this->postJson('/api/dashboard/vehicles', $this->vehiclePayload('AAA-004'))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Your Solo plan allows up to 3 vehicles.');

        $this->assertDatabaseCount('vehicles', 3);
    }

    private function createOrganization(string $name, string $plan = 'Business'): Organization
    {
        return Organization::create([
            'name' => $name,
            'slug' => str($name)->slug(),
            'plan' => $plan,
            'subscription_status' => 'active',
        ]);
    }

    private function createOwner(Organization $organization): User
    {
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $organization->users()->attach($owner->id, ['role' => 'owner']);

        return $owner;
    }

    private function createVehicle(Organization $organization, string $plateNumber = 'AAA-001'): Vehicle
    {
        return Vehicle::create([
            'organization_id' => $organization->id,
            'brand' => 'Toyota',
            'model' => 'Vios',
            'year' => 2025,
            'plate_number' => $plateNumber,
        ]);
    }

    private function vehiclePayload(string $plateNumber, string $brand = 'Toyota', string $model = 'Vios'): array
    {
        return [
            'brand' => $brand,
            'model' => $model,
            'year' => 2025,
            'plate_number' => $plateNumber,
            'seat_count' => 5,
            'daily_rate' => 1500,
            'type' => 'Sedan',
            'transmission' => 'Automatic',
            'fuel_type' => 'Unleaded 91',
            'status' => 'available',
            'rental_rates' => json_encode([
                [
                    'duration_hours' => 12,
                    'amount' => 800,
                    'coverage_type' => 'province',
                    'coverage_locations' => ['Cebu'],
                    'outside_amount' => 100,
                ],
            ]),
        ];
    }

    private function fakePng(string $name): UploadedFile
    {
        $contents = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');

        return UploadedFile::fake()->createWithContent($name, $contents);
    }
}
