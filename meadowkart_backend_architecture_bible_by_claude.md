# Laravel Backend Architecture Guideline

## The Company Standard

*Version 2.0*

This document defines the definitive architectural patterns, conventions, and standards for all Laravel backend projects developed by the company. Every new project must follow these guidelines to ensure consistency, maintainability, and seamless developer onboarding across the portfolio.

This is a living document. Treat it as the single source of truth for "how we build things."

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Routing](#2-routing)
3. [Controllers](#3-controllers)
4. [Service Layer](#4-service-layer)
5. [Action Classes](#5-action-classes)
6. [Models](#6-models)
7. [Enums](#7-enums)
8. [Traits](#8-traits)
9. [API Response Format](#9-api-response-format)
10. [Validation](#10-validation)
11. [API Resources](#11-api-resources)
12. [DTOs (Data Transfer Objects)](#12-dtos-data-transfer-objects)
13. [Authentication & Authorization](#13-authentication--authorization)
14. [Database Conventions](#14-database-conventions)
15. [Testing](#15-testing)
16. [Notifications](#16-notifications)
17. [Jobs & Queues](#17-jobs--queues)
18. [Exception Handling](#18-exception-handling)
19. [Observers](#19-observers)
20. [Configuration & Constants](#20-configuration--constants)
21. [Utilities & Helpers](#21-utilities--helpers)
22. [Package Standards](#22-package-standards)
23. [PHP & Code Style](#23-php--code-style)
24. [Contracts & Interfaces](#24-contracts--interfaces)
25. [Events & Listeners](#25-events--listeners)
26. [Middleware Conventions](#26-middleware-conventions)
27. [Rate Limiting](#27-rate-limiting)
28. [Caching Strategy](#28-caching-strategy)

---

## 1. Project Structure

### The `app/` Directory

Organize the application layer by responsibility. Each top-level directory has a clear, single purpose. Domain logic (Services, Enums, DTOs) lives in its own top-level directory with domain subdirectories — **not** nested inside `Models/`.

```
app/
├── Actions/                  # Single-purpose action classes
│   └── {Domain}/             # Grouped by domain
├── Channels/                 # Custom broadcast channels
├── Console/
│   └── Commands/             # Artisan commands
├── Constants/                # Business rule constants
├── Contracts/                # Interfaces and contracts
│   └── {Domain}/             # Grouped by domain
├── DTOs/                     # Data Transfer Objects
│   └── {Domain}/             # Grouped by domain
├── Enums/                    # All enums (global + domain-specific)
│   └── {Domain}/             # Grouped by domain
├── Events/                   # Event classes
│   └── {Domain}/             # Grouped by domain
├── Exceptions/               # Custom exception classes
├── Exports/                  # Excel/CSV export classes
├── Filters/                  # Query builder filter classes
├── Helpers/                  # Helper classes (not global functions)
├── Http/
│   ├── Controllers/
│   │   └── {Segment}/        # Grouped by API segment (Client, Console, Carrier)
│   │       ├── Auth/
│   │       ├── Orders/
│   │       └── ...
│   ├── Middleware/            # Custom middleware classes
│   ├── Requests/             # Form Request classes
│   │   └── {Segment}/        # Mirroring controller structure
│   └── Resources/            # API Resource transformers
│       └── {Segment}/        # Mirroring controller structure
├── Imports/                  # Excel/CSV import classes
├── Jobs/                     # Queued job classes
├── Listeners/                # Event listener classes
│   └── {Domain}/             # Grouped by domain
├── Models/                   # Eloquent models only
│   └── {Domain}/             # Grouped by domain
│       ├── Traits/           # Model-specific traits (scopes, relationships)
│       └── {Model}.php
├── Notifications/
│   └── Messages/             # Custom message builders
├── Observers/                # Model observers
├── Providers/                # Service providers
├── Rules/                    # Custom validation rules
├── Services/                 # All services (global + domain-specific)
│   └── {Domain}/             # Grouped by domain
├── Support/                  # Framework support classes
├── Traits/                   # Global traits
└── Utils/                    # Utility classes
```

### Key Principles

**Flat domain directories.** Each architectural concept (Models, Services, Enums, DTOs) has its own top-level directory. Domain grouping happens as subdirectories within each. This keeps each directory focused and avoids `Models/` becoming a catch-all.

```
Models/                           Services/
├── Orders/                       ├── Orders/
│   └── Order.php                 │   └── OrderService.php
├── Users/                        ├── Users/
│   └── User.php                  │   └── AuthenticationService.php
                                  └── PaymentService.php     # Global (no domain subdir)

Enums/                            DTOs/
├── Orders/                       └── Delivery/
│   └── OrderStatus.php               └── DeliveryLogDTO.php
├── Users/
│   ├── UserPermissions.php
│   └── UserRoles.php
```

**Segment-based controller organization.** Controllers are grouped by API consumer segment (e.g., `Client/`, `Console/`, `Carrier/`), not by domain. Each segment folder has subdirectories for feature groups. Form Requests mirror this structure.

```
Controllers/                      Requests/
├── Client/                       ├── Client/
│   ├── Auth/                     │   ├── Auth/
│   ├── Cart/                     │   │   └── LoginRequest.php
│   └── Orders/                   │   └── Cart/
├── Console/                      │       └── StoreCartRequest.php
│   ├── Auth/                     └── Console/
│   ├── Order/                        └── Order/
│   └── Product/                          └── UpdateOrderRequest.php
└── Carrier/
    ├── Auth/
    └── Delivery/
```

---

## 2. Routing

### Split Route Files by API Segment

Never put all routes in a single `routes/api.php`. Split into dedicated files per segment.

```
routes/
├── api.php               # Entry point — requires split files
└── splits/
    ├── customer.php       # Customer-facing API routes
    ├── console.php        # Admin panel routes
    └── carrier.php        # Delivery partner routes
```

**`routes/api.php`** — Entry point only:

```php
<?php

// Global routes (webhooks, health checks)
Route::post('webhook/payment', PaymentWebhookController::class)->name('payment-webhook');

// Segment route files
require_once __DIR__.'/splits/customer.php';
require_once __DIR__.'/splits/carrier.php';
require_once __DIR__.'/splits/console.php';
```

### Route File Structure

Each segment file follows this pattern:

```php
<?php

use Illuminate\Support\Facades\Route;

Route::prefix('client')->group(function () {
    // --- Public Routes ---
    Route::post('auth/send-otp', ClientOTPController::class);
    Route::post('auth/login', ClientLoginController::class);

    Route::get('products', [ProductController::class, 'index']);
    Route::get('products/{product}', [ProductController::class, 'show']);

    // --- Authenticated Routes ---
    Route::middleware('auth:sanctum')->group(function () {
        // Profile
        Route::get('profile', [ProfileController::class, 'show']);
        Route::put('profile', [ProfileController::class, 'update']);

        // Cart
        Route::apiResource('cart', CartController::class)->only(['index', 'store', 'destroy']);

        // Orders
        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/{order}', [OrderController::class, 'show']);

        // --- V2 Routes ---
        Route::prefix('v2')->group(function () {
            Route::get('products', [ProductV2Controller::class, 'index']);
        });
    });
});
```

### Routing Conventions

| Convention | Standard |
| :--- | :--- |
| Prefix | Segment name (`client`, `console`, `carrier`) |
| Authentication | `auth:sanctum` middleware group |
| Versioning | Nested `v2` prefix group inside the segment |
| Invokable controllers | `Route::post('action', ActionController::class)` |
| Resource controllers | `Route::apiResource('resource', ResourceController::class)` |
| Naming | Use Laravel's implicit route naming with `->name()` for custom names |

---

## 3. Controllers

### Base Controller

All controllers extend the base `Controller` class, which provides shared functionality via traits.

```php
<?php

namespace App\Http\Controllers;

use App\Traits\ApiResponse;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{
    use ApiResponse;
    use AuthorizesRequests;
    use ValidatesRequests;
}
```

### Controller Types

**1. Invokable Controllers (Single Action)**

Use for endpoints that represent a single action. Named as `{Domain}{Action}Controller`.

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Client\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Client\Auth\LoginRequest;
use App\Services\Users\AuthenticationService;
use Illuminate\Http\JsonResponse;

class ClientLoginController extends Controller
{
    public function __construct(
        private readonly AuthenticationService $authService
    ) {}

    public function __invoke(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();

        $result = $this->authService->loginWithOTP(
            $data['phone'], $data['otp'], $data['device']
        );

        return $this->responseData($result);
    }
}
```

> **No try/catch here.** If `loginWithOTP` throws an `InvalidOtpException`, it renders itself via its `render()` method or is handled centrally in `bootstrap/app.php` (see [Section 18](#18-exception-handling)).

**2. Resource Controllers**

Use for standard CRUD operations. Named as `{Resource}Controller`.

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Client\Cart;

use App\Http\Controllers\Controller;
use App\Http\Requests\Client\Cart\StoreCartRequest;
use App\Http\Resources\Cart\CartResource;
use App\Models\Carts\Cart;
use App\Services\Carts\CartService;
use Illuminate\Http\JsonResponse;

class CartController extends Controller
{
    public function __construct(
        private readonly CartService $cartService
    ) {}

    public function index(): JsonResponse
    {
        $carts = Cart::query()
            ->where('user_id', auth()->id())
            ->with('product')
            ->get();

        return $this->responseData(CartResource::collection($carts));
    }

    public function store(StoreCartRequest $request): JsonResponse
    {
        $data = $request->validated();

        $cart = $this->cartService->addToCart(auth()->id(), $data);

        return $this->responseCreated(CartResource::make($cart));
    }

    public function destroy(Cart $cart): JsonResponse
    {
        $cart->delete();
        return $this->responseSuccess('Item removed from cart.');
    }
}
```

### Controller Rules

1. **Constructor dependency injection** for all services — never use `app()` or `resolve()` inline.
2. **Form Request classes** for validation (see [Section 10](#10-validation)) — inline `$request->validate()` only for trivial 1-2 field endpoints.
3. **Delegate business logic** to services or actions — controllers should be thin.
4. **Return type** is always `JsonResponse`.
5. **Use ApiResponse trait methods** for all responses — never use `response()->json()` directly.
6. **No try/catch** — let exceptions propagate to renderable exception classes or centralized handler.
7. **Use readonly properties** for injected services: `private readonly CartService $cartService`.
8. **Authorization** via Laravel's Gate — use `$this->authorize()` or route middleware, not manual if-checks.

```php
// Authorization pattern — uses Laravel's Gate pipeline (supports Spatie super-admin via Gate::before)
use App\Enums\Users\UserPermissions;

public function index(): JsonResponse
{
    $this->authorize(UserPermissions::VIEW_ORDERS->value);

    // If we reach here, user is authorized. Otherwise, AuthorizationException is thrown automatically.
}

// Or protect entire route groups via middleware (preferred for route-level auth):
Route::middleware(['permission:orders.view_all'])->group(function () {
    Route::get('orders', [OrderController::class, 'index']);
});
```

### Console Controllers (Admin) — Spatie Query Builder

For admin listing endpoints with rich filtering, use Spatie Query Builder:

```php
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;

public function index(Request $request): JsonResponse
{
    $perPage = $request->get('per_page', 20);

    $data = QueryBuilder::for(Order::class)
        ->allowedFilters([
            AllowedFilter::exact('status'),
            AllowedFilter::exact('priority'),
            AllowedFilter::custom('city_id', new CityFilter),
        ])
        ->allowedSorts(['created_at', 'updated_at', 'priority'])
        ->defaultSort('-created_at')
        ->paginate($perPage);

    return $this->responseData(new DataCollection($data));
}
```

---

## 4. Service Layer

Services contain the business logic of the application. There are two types:

### Domain Services

Handle logic specific to a business domain. Live under `app/Services/{Domain}/`.

**Location:** `app/Services/{Domain}/{DomainName}Service.php`

```php
<?php

declare(strict_types=1);

namespace App\Services\Carts;

use App\Exceptions\CartLimitException;
use App\Exceptions\ProductUnavailableException;
use App\Models\Carts\Cart;
use App\Models\Products\Product;
use Illuminate\Support\Collection;

class CartService
{
    public function addToCart(int $userId, array $data): Cart
    {
        $product = Product::findOrFail($data['product_id']);
        $this->validateAddToCart($product, $userId);

        return Cart::create([
            'user_id'    => $userId,
            'product_id' => $product->id,
            'quantity'   => $data['quantity'],
        ]);
    }

    public function calculateCartTotal(Collection $carts): array
    {
        $totalMrp   = $carts->sum(fn (Cart $c) => $c->calculateTotalMRP());
        $totalPrice = $carts->sum(fn (Cart $c) => $c->calculateTotalPrice());

        return [
            'total_mrp'   => $totalMrp,
            'total_price' => $totalPrice,
            'savings'     => $totalMrp - $totalPrice,
        ];
    }

    private function validateAddToCart(Product $product, int $userId): void
    {
        if (!$product->status) {
            throw new ProductUnavailableException($product->name);
        }

        $existingCount = Cart::where('user_id', $userId)->count();
        if ($existingCount >= 50) {
            throw new CartLimitException();
        }
    }
}
```

### Global Services

Live in `app/Services/`. Handle cross-cutting concerns, third-party integrations, or logic that spans multiple domains.

**Location:** `app/Services/{ServiceName}.php`

```php
<?php

namespace App\Services;

use Razorpay\Api\Api;

class PaymentService
{
    protected Api $razorpay;

    public function __construct()
    {
        $this->razorpay = new Api(
            config('razorpay.key'),
            config('razorpay.secret')
        );
    }

    public function createOrder(float $amount, string $orderId): array
    {
        return $this->razorpay->order->create([
            'amount'   => $amount * 100,
            'currency' => 'INR',
            'receipt'  => $orderId,
        ]);
    }
}
```

### Orchestrator Services

When a service coordinates multiple other services, use constructor injection. Orchestrators live in `app/Services/` (global) since they span domains:

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Services\Carts\CartService;
use App\Services\Inventory\InventoryService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CheckoutService
{
    public function __construct(
        private readonly CartService $cartService,
        private readonly PaymentService $paymentService,
        private readonly InventoryService $inventoryService,
    ) {}

    public function processCheckout(int $userId, Collection $carts): array
    {
        return DB::transaction(function () use ($userId, $carts) {
            $this->cartService->validateCheckoutCart($carts);
            $total = $this->cartService->calculateCartTotal($carts);
            $payment = $this->paymentService->createOrder($total['total_price'], $userId);
            $this->inventoryService->reserveStock($carts);

            return ['payment' => $payment, 'total' => $total];
        });
    }
}
```

### Service Rules

1. **Services are stateless** — no instance state is modified during execution.
2. **Constructor injection** for all dependencies.
3. **Throw exceptions** for validation failures and error conditions — let the controller handle the response.
4. **Return arrays, DTOs, or Eloquent models** — never return `JsonResponse`.
5. **Services do not know about HTTP** — no `request()`, no `response()`, no `auth()`. Pass everything as parameters.
6. **Naming:** `{Domain}Service` for domain services, `{Purpose}Service` for global services.

---

## 5. Action Classes

Actions are single-purpose classes that encapsulate one specific operation. Use them when the operation is complex, reusable, or doesn't fit cleanly into an existing service.

**Location:** `app/Actions/{Domain}/{VerbNoun}Action.php`

### Action Template

```php
<?php

namespace App\Actions\Delivery;

use App\Services\GeolocationService;
use Illuminate\Support\Collection;

class OptimizeRouteOrderAction
{
    public function __construct(
        protected readonly GeolocationService $geolocationService,
    ) {}

    public function execute(string $sessionId, Collection $data): Collection
    {
        $coordinates = $this->extractCoordinates($data);
        $optimized = $this->geolocationService->optimizeRoute($coordinates);

        return $this->buildOrderedCollection($data, $optimized);
    }

    private function extractCoordinates(Collection $data): array
    {
        // Private helper method
    }

    private function buildOrderedCollection(Collection $data, array $order): Collection
    {
        // Private helper method
    }
}
```

### Action Rules

1. **One public method:** `execute()` — this is the only entry point.
2. **Naming:** `{Verb}{Noun}Action` (e.g., `OptimizeRouteOrderAction`, `FetchIfscDetailsAction`).
3. **Constructor injection** for dependencies.
4. **Private helper methods** for internal decomposition.
5. **Stateless** — no instance state persists between calls.
6. **Return values:** Collections, arrays, DTOs, or null.

### When to Use Actions vs Services

| Use Actions When | Use Services When |
| :--- | :--- |
| A single, discrete operation | Multiple related operations on a domain |
| Complex logic that doesn't fit a service | CRUD-adjacent business logic |
| Cross-domain operation | Domain-specific logic |
| The operation is independently testable | The logic is tightly coupled to a model |

---

## 6. Models

### Organization

Models live in domain-grouped directories. Only model files and model-specific traits belong here — Services, Enums, and DTOs live in their own top-level directories (see [Section 1](#1-project-structure)).

```
Models/
├── Orders/
│   ├── Traits/HasStatusTransitions.php    # Model-specific trait
│   └── Order.php
├── Products/
│   ├── Traits/HasZoneAvailability.php
│   └── Product.php
```

### Model Template

```php
<?php

declare(strict_types=1);

namespace App\Models\Orders;

use App\Enums\Orders\OrderStatus;
use App\Enums\Orders\OrderType;
use App\Models\Users\User;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'invoice_id',
        'product_id',
        'quantity',
        'mrp',
        'price',
        'type',
        'status',
        'address_id',
    ];

    protected $casts = [
        'type'   => OrderType::class,
        'status' => OrderStatus::class,
        'mrp'    => 'float',
        'price'  => 'float',
    ];

    // --- Relationships ---

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class);
    }

    // --- Scopes ---

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', OrderStatus::PENDING);
    }

    public function scopeDeliveryDate(Builder $query, string $start, ?string $end = null): Builder
    {
        return $end
            ? $query->whereBetween('delivery_date', [$start, $end])
            : $query->where('delivery_date', $start);
    }

    // --- Accessors ---

    protected function orderedOn(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->created_at->format('Y-m-d'),
        );
    }

    // --- Business Methods ---

    public function calculateTotal(): float
    {
        return $this->quantity * $this->price;
    }
}
```

### Model Rules

1. **Always use `$fillable`** — never use `$guarded`.
2. **Cast enums** using PHP 8.2 backed enum classes: `'status' => OrderStatus::class`.
3. **Cast booleans explicitly:** `'is_active' => 'boolean'`.
4. **Cast dates with format:** `'date' => 'date:Y-m-d'`.
5. **Accessors use `Attribute::make()`** — never the legacy `get{Name}Attribute()` syntax.
6. **Section ordering** within the model:
   - `use` traits
   - `$fillable`
   - `$hidden`
   - `$casts`
   - Relationships
   - Scopes
   - Accessors / Mutators (`Attribute::make()`)
   - Business logic methods
7. **Scope naming:** `scope{Name}` (e.g., `scopePending`, `scopeDeliveryDate`).
8. **Keep business logic light** — complex logic goes to services. Models can have calculation methods and simple helpers.
9. **`HasFactory` trait** on every model.
10. **`SoftDeletes`** on important business entities.
11. **No HTTP awareness** — models must never use `request()`, `auth()`, or `session()`. Pass data explicitly.

---

## 7. Enums

All enums are **PHP 8.2 backed enums** with string values.

### Enum Location

| Type | Location |
| :--- | :--- |
| Domain-specific | `app/Enums/{Domain}/` |
| Global | `app/Enums/` |

### Enum Template

```php
<?php

declare(strict_types=1);

namespace App\Enums\Orders;

enum OrderStatus: string
{
    case PENDING        = 'pending';
    case PROCESSING     = 'processing';
    case DELIVERED      = 'delivered';
    case CANCELLED      = 'cancelled';
    case PAYMENT_FAILED = 'payment-failed';

    public function label(): string
    {
        return match ($this) {
            self::PENDING        => 'Pending',
            self::PROCESSING     => 'Processing',
            self::DELIVERED      => 'Delivered',
            self::CANCELLED      => 'Cancelled',
            self::PAYMENT_FAILED => 'Not Placed',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::PENDING        => '808080',
            self::PROCESSING     => '1A4CFC',
            self::DELIVERED      => '017D2B',
            self::CANCELLED,
            self::PAYMENT_FAILED => 'C43030',
        };
    }
}
```

### Permission Enum Pattern

Permissions use dot-notation grouping by module:

```php
<?php

declare(strict_types=1);

namespace App\Enums\Users;

enum UserPermissions: string
{
    // Dashboard
    case VIEW_DASHBOARD = 'dashboard.view';

    // Orders
    case VIEW_ORDERS  = 'orders.view_all';
    case CREATE_ORDER = 'orders.create';
    case CANCEL_ORDER = 'orders.cancel';

    // Products
    case VIEW_PRODUCTS   = 'products.view_all';
    case CREATE_PRODUCT  = 'products.create';
    case UPDATE_PRODUCT  = 'products.update';
    case DELETE_PRODUCT  = 'products.delete';

    /**
     * Group permissions by module for admin UI.
     */
    public static function moduleWisePermissions(): array
    {
        $modules = [];

        foreach (self::cases() as $permission) {
            [$module, $action] = explode('.', $permission->value, 2);
            $module = ucfirst($module);

            $modules[$module]['module'] = $module;
            $modules[$module]['permissions'][] = [
                'key'   => $permission->value,
                'label' => self::formatLabel($permission->name),
            ];
        }

        ksort($modules);
        return array_values($modules);
    }
}
```

### Enum Rules

1. **Always backed** with `string` values.
2. **UPPER_CASE names** for cases.
3. **Lowercase, hyphenated values** (e.g., `'payment-failed'`).
4. **Add display methods** (`label()`, `color()`, `name()`) using `match` expressions.
5. **Add static helpers** when needed (`moduleWisePermissions()`, `toArray()`).
6. **Use in model casts** — never store raw strings.

---

## 8. Traits

### Trait Location

| Type | Location |
| :--- | :--- |
| Global (used across domains) | `app/Traits/` |
| Model-specific (scopes, relationships) | `app/Models/{Domain}/Traits/` |

### Standard Traits

#### ApiResponse Trait (Required on Base Controller)

```php
<?php

declare(strict_types=1);

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response as Status;

trait ApiResponse
{
    protected function responseData(mixed $data, int $status = Status::HTTP_OK, ?string $message = null): JsonResponse
    {
        $response = ['data' => $data];

        if ($message) {
            $response['message'] = $message;
        }

        return response()->json($response, $status);
    }

    protected function responseSuccess(?string $message = null, int $status = Status::HTTP_OK): JsonResponse
    {
        return response()->json([
            'message' => $message ?? 'Successfully processed your request!',
        ], $status);
    }

    protected function responseCreated(mixed $data = null, ?string $message = null): JsonResponse
    {
        if ($data !== null) {
            return $this->responseData($data, Status::HTTP_CREATED, $message);
        }

        return $this->responseSuccess($message ?? 'Resource created successfully.', Status::HTTP_CREATED);
    }

    protected function responseError(?string $message = null, int $status = Status::HTTP_BAD_REQUEST): JsonResponse
    {
        return response()->json([
            'error' => [
                'message' => $message ?? 'Sorry, unable to process your request!',
            ],
        ], $status);
    }
}
```

#### Model Boot Traits

Traits that hook into model lifecycle events use the `boot{TraitName}` convention. **Boot traits must never access HTTP context** (`request()`, `auth()`, `session()`). All data should be set explicitly before `Model::create()`.

```php
<?php

declare(strict_types=1);

namespace App\Traits;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

trait HasUuid
{
    public static function bootHasUuid(): void
    {
        static::creating(function (Model $model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }
}
```

#### Scope Traits

Traits that provide reusable query scopes:

```php
<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait ActiveSort
{
    public function scopeActive(Builder $query, bool $active = true): void
    {
        $query->where('status', $active);
    }

    public function scopeSort(Builder $query, string $direction = 'asc'): void
    {
        $query->orderBy('sort', $direction);
    }
}
```

#### EnumArray Trait

```php
<?php

namespace App\Traits;

trait EnumArray
{
    public static function toArray(): array
    {
        return array_column(self::cases(), 'value');
    }
}
```

### Trait Rules

1. **Composition over inheritance** — use traits to share behavior across unrelated classes.
2. **Boot methods** follow `boot{TraitName}()` naming for model lifecycle hooks.
3. **Stateless** — traits must not maintain instance state.
4. **Single-purpose** — each trait addresses one concern.

---

## 9. API Response Format

All API responses follow a **consistent envelope structure**. Success responses always wrap payload in a `data` key. Errors always use an `error` key. HTTP status codes convey success/failure — no `status: true/false` booleans.

### Success — Single Resource

```json
{
    "data": {
        "id": 1,
        "name": "Product Name",
        "price": 100.00
    }
}
```

### Success — Collection (Paginated)

```json
{
    "data": [
        { "id": 1, "name": "Item 1" },
        { "id": 2, "name": "Item 2" }
    ],
    "meta": {
        "pagination": {
            "total": 100,
            "count": 10,
            "per_page": 10,
            "current_page": 1,
            "total_pages": 10
        }
    }
}
```

### Success — Message Only (No Data)

```json
{
    "message": "Successfully processed your request!"
}
```

### Success — Created with Data (201)

```json
{
    "data": {
        "id": 42,
        "name": "New Product"
    },
    "message": "Product created successfully."
}
```

### Error Response (4xx/5xx)

```json
{
    "error": {
        "message": "Insufficient stock for this product."
    }
}
```

### Validation Error (422)

Laravel's default validation error format (unchanged):

```json
{
    "message": "The given data was invalid.",
    "errors": {
        "email": ["The email field is required."],
        "name": ["The name field is required."]
    }
}
```

### Controller Usage

```php
// Data response (single resource, collection, or any data)
return $this->responseData($data);

// Data with message
return $this->responseData($data, message: 'Order placed successfully.');

// Success message only (no payload)
return $this->responseSuccess('Item removed from cart.');

// Created with data (201)
return $this->responseCreated(ProductResource::make($product));

// Created with data + message (201)
return $this->responseCreated(ProductResource::make($product), 'Product created.');

// Error (400)
return $this->responseError('Insufficient stock.');
```

### HTTP Status Codes

| Code | Usage |
| :--- | :--- |
| `200` | Successful data retrieval or action |
| `201` | Resource successfully created |
| `400` | Bad request / business logic error |
| `401` | Unauthenticated |
| `403` | Forbidden / insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (duplicate, already exists) |
| `422` | Validation error |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## 10. Validation

### Primary Pattern: Form Request Classes

All non-trivial validation uses **Form Request classes**. This keeps controllers thin, makes validation reusable, and provides a built-in `authorize()` hook.

**Location:** `app/Http/Requests/{Segment}/{Feature}/{Action}Request.php`

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Client\Cart;

use Illuminate\Foundation\Http\FormRequest;

class StoreCartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Auth handled by route middleware
    }

    public function rules(): array
    {
        return [
            'product_id' => 'required|exists:products,id',
            'quantity'    => 'required|integer|min:1|max:100',
        ];
    }
}
```

**Controller usage — type-hint the Form Request:**

```php
use App\Http\Requests\Client\Cart\StoreCartRequest;

public function store(StoreCartRequest $request): JsonResponse
{
    $data = $request->validated();

    // $data is validated and safe to use — validation happened before this method was called
}
```

### Form Request Features

Use these hooks when needed:

```php
class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Gate-based authorization right in the request
        return $this->user()->can('orders.update');
    }

    public function rules(): array
    {
        return [
            'status' => 'required|in:processing,shipped,delivered',
            'notes'  => 'nullable|string|max:1000',
        ];
    }

    /**
     * Transform input before validation runs.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'status' => strtolower($this->status),
        ]);
    }
}
```

### Exception: Inline Validation

For trivial endpoints with 1-2 fields, inline validation is acceptable:

```php
public function updateStatus(Request $request, Order $order): JsonResponse
{
    $data = $request->validate([
        'status' => 'required|in:active,inactive',
    ]);

    // ...
}
```

### Custom Validation Rules

For reusable validation logic, create rule classes:

**Location:** `app/Rules/{RuleName}.php`

```php
<?php

declare(strict_types=1);

namespace App\Rules;

use App\Models\Users\User;
use Illuminate\Contracts\Validation\ValidationRule;

class UserHasRole implements ValidationRule
{
    public function __construct(
        private readonly string $role
    ) {}

    public function validate(string $attribute, mixed $value, \Closure $fail): void
    {
        $exists = User::query()
            ->where('id', $value)
            ->role($this->role)
            ->exists();

        if (!$exists) {
            $fail("The selected {$attribute} must have the {$this->role} role.");
        }
    }
}
```

**Usage in Form Requests:**

```php
public function rules(): array
{
    return [
        'carrier_id' => ['required', new UserHasRole('carrier')],
    ];
}
```

### Service-Level Validation

Services throw **domain exceptions** for business rule validation (never generic `\Exception`):

```php
public function validateCheckout(Collection $carts): void
{
    if ($carts->isEmpty()) {
        throw new EmptyCartException();
    }

    foreach ($carts as $cart) {
        if (!$cart->product->status) {
            throw new ProductUnavailableException($cart->product->name);
        }
    }
}
```

### Validation Rules

1. **Form Request classes** are the primary validation pattern — use for any endpoint with 3+ fields.
2. **Inline validation** (`$request->validate()`) only for trivial 1-2 field endpoints.
3. **Custom Rule classes** for reusable validation logic.
4. **Domain exceptions** for business rule validation in services — never generic `\Exception`.
5. **`$request->validated()`** to retrieve only validated data — never access raw `$request->input()` after validation.
6. **Naming:** `{Action}{Resource}Request` (e.g., `StoreCartRequest`, `UpdateOrderRequest`).

---

## 11. API Resources

API Resources transform Eloquent models into JSON responses. They are the **only** place where response shaping happens.

### Resource Location

Mirror the controller segment structure:

```
Resources/
├── Cart/
│   └── CartResource.php
├── Product/
│   └── ProductResource.php
├── Console/
│   ├── DataCollection.php
│   ├── PaginationResource.php
│   └── Orders/
│       └── ConsoleOrderResource.php
```

### Resource Template

```php
<?php

namespace App\Http\Resources\Product;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Products\Product */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'unit'          => $this->unit,
            'category_name' => $this->category->name,
            'image'         => UploadUtil::url($this->image?->path),
            'mrp'           => $this->mrp,
            'price'         => $this->price,
            'discount'      => $this->calculateDiscountPercent(),
            'in_stock'      => $this->in_stock,
        ];
    }
}
```

### Nested Resources

```php
/** @mixin \App\Models\Carts\Cart */
class CartResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'       => $this->id,
            'quantity' => $this->quantity,
            'product'  => ProductResource::make($this->product),
        ];
    }
}
```

### Paginated Collection Wrapper

```php
<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class DataCollection extends ResourceCollection
{
    public function __construct($resource, private readonly mixed $data = null)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return [
            'data' => $this->data ?? $this->collection,
            'meta' => [
                'pagination' => new PaginationResource($this),
            ],
        ];
    }
}
```

```php
<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaginationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'total'       => $this->total(),
            'count'       => $this->count(),
            'per_page'    => $this->perPage(),
            'current_page' => $this->currentPage(),
            'total_pages' => $this->lastPage(),
        ];
    }
}
```

### Resource Rules

1. **Always use `/** @mixin Model */`** PHPDoc for IDE support.
2. **Resources do not contain business logic** — they only shape data. Exception: light formatting (dates, image URLs).
3. **Nested resources** for related models.
4. **Custom pagination** format via `DataCollection` + `PaginationResource` under `meta.pagination`.
5. **Naming:** `{Model}Resource` or `{Segment}{Model}Resource` if segment-specific.

---

## 12. DTOs (Data Transfer Objects)

DTOs are used when you need a structured data container that isn't an Eloquent model. They use PHP 8.2 readonly properties and constructor promotion.

**Location:** `app/DTOs/{Domain}/`

```php
<?php

declare(strict_types=1);

namespace App\DTOs\Delivery;

class DeliveryLogDTO
{
    public function __construct(
        public readonly ?int $deliveryId = null,
        public readonly ?string $action = null,
        public readonly mixed $previous = null,
        public readonly mixed $now = null,
        public readonly mixed $message = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            deliveryId: $data['deliveryId'] ?? null,
            action:     $data['action'] ?? null,
            previous:   $data['previous'] ?? null,
            now:        $data['now'] ?? null,
            message:    $data['message'] ?? null,
        );
    }

    public function toArray(): array
    {
        return [
            'delivery_id' => $this->deliveryId,
            'action'      => $this->action,
            'previous'    => $this->previous,
            'now'         => $this->now,
            'message'     => $this->message,
        ];
    }
}
```

### DTO Rules

1. **Readonly properties** with constructor promotion.
2. **Named parameters** in constructors for clarity.
3. **Static factory method** `fromArray()` for creation from raw data.
4. **Serialization method** `toArray()` for output.
5. **No validation** — DTOs are pure data carriers.
6. **Use sparingly** — arrays are acceptable for simple cases. Use DTOs when the data structure is reused or complex.

---

## 13. Authentication & Authorization

### Authentication: Laravel Sanctum

All authentication uses Sanctum token-based auth.

```php
// Route protection
Route::middleware('auth:sanctum')->group(function () {
    // Protected routes
});
```

### Auth Flow: Token-Based

```php
// Login — returns token
$token = $user->createToken($deviceIdentifier);
return ['token' => $token->plainTextToken];

// Logout — revokes current token
auth()->user()->currentAccessToken()->delete();

// Authenticated user
$user = auth()->user();
```

### Authorization: Spatie Laravel Permission + Laravel Gate

Roles and permissions are managed via the Spatie package, but authorization **always flows through Laravel's Gate pipeline**. This ensures `Gate::before()` callbacks (such as Spatie's super-admin bypass) work consistently.

**Role assignment:**

```php
$user->assignRole('admin');
$user->assignRole(UserRoles::AGENT->value);
```

**Permission checking — route middleware (preferred for route-level protection):**

```php
// Protect entire route groups
Route::middleware(['role:admin'])->group(function () { });

// Protect specific routes
Route::middleware(['permission:orders.view_all'])->group(function () {
    Route::get('orders', [OrderController::class, 'index']);
});
```

**Permission checking — controller authorize (for method-level logic):**

```php
use App\Enums\Users\UserPermissions;

public function update(UpdateOrderRequest $request, Order $order): JsonResponse
{
    // Throws AuthorizationException automatically if denied — no manual if-check needed
    $this->authorize(UserPermissions::UPDATE_ORDER->value);

    // ...
}
```

**Permission checking — Gate facade (for services or non-controller code):**

```php
use Illuminate\Support\Facades\Gate;

if (Gate::allows(UserPermissions::CANCEL_ORDER->value)) {
    // ...
}
```

### Auth Rules

1. **Sanctum tokens** for all API authentication — no session-based auth.
2. **Spatie Permission** for role-based access control.
3. **Permission enums** for type-safe permission references — always access via `->value`.
4. **Route middleware** for protecting route groups — the preferred approach.
5. **`$this->authorize()`** for method-level checks — throws `AuthorizationException` automatically.
6. **Never manually check + return denied** — use Gate/authorize, not `if (!can) return responseDenied()`.
7. **Token revocation** on logout, password reset, and account deactivation.

---

## 14. Database Conventions

### Migrations

**Naming:** Standard Laravel timestamps — `{timestamp}_create_{table}_table.php`

**Pattern:** Anonymous class migrations (Laravel 9+):

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            $table->string('name');
            $table->string('unit');
            $table->float('mrp');
            $table->float('price');

            $table->foreignId('category_id')->index();

            $table->boolean('status')->default(true)->index();
            $table->boolean('maintain_stock')->default(false)
                  ->comment('If enabled, respects stock limits');

            $table->integer('stock')->nullable();
            $table->integer('sort')->index()->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
```

### Migration Rules

1. **Anonymous class syntax** (not named class files).
2. **Index foreign keys** explicitly.
3. **Add `->comment()`** for boolean flags and non-obvious columns.
4. **Soft deletes** on business-critical tables.
5. **Nullable** for optional fields — never use empty string defaults.
6. **Default values** for status flags and booleans.
7. **Always implement `down()`** for rollback.

### Factories

**Location:** `database/factories/{Domain}/{Model}Factory.php`

Mirror the model domain structure:

```
factories/
├── Address/AddressFactory.php
├── Orders/OrderFactory.php
└── Products/ProductFactory.php
```

```php
<?php

namespace Database\Factories\Orders;

use App\Enums\Orders\OrderStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id'    => UserFactory::new(),
            'product_id' => ProductFactory::new(),
            'quantity'    => $this->faker->numberBetween(1, 10),
            'mrp'        => $this->faker->randomFloat(2, 10, 500),
            'price'      => $this->faker->randomFloat(2, 10, 400),
            'status'     => OrderStatus::PENDING,
        ];
    }

    public function delivered(): static
    {
        return $this->state(fn () => ['status' => OrderStatus::DELIVERED]);
    }
}
```

### Seeders

**Location:** `database/seeders/`

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            // ... other seeders in dependency order
        ]);
    }
}
```

### Database Transactions

Wrap multi-model operations in `DB::transaction()` to ensure atomicity. If any step fails, all changes are rolled back.

**When to use transactions:**

| Scenario | Transaction? |
| :--- | :--- |
| Creating a single model | No |
| Creating parent + children together | Yes |
| Multi-step business operation (checkout, transfer) | Yes |
| Read-only queries | No |
| Operations spanning multiple services | Yes — wrap at the orchestrator level |

**Pattern — closure-based (preferred):**

```php
use Illuminate\Support\Facades\DB;

public function processCheckout(int $userId, Collection $carts): Order
{
    return DB::transaction(function () use ($userId, $carts) {
        $order = Order::create([...]);
        $order->items()->createMany($carts->toArray());
        $this->inventoryService->reserveStock($carts);
        $this->paymentService->charge($order);

        return $order;
    });
}
```

**Rules:**
1. **Transactions live in services** — never in controllers or models.
2. **Use closure-based** `DB::transaction()` — it auto-commits on success and rolls back on exception.
3. **Avoid nested transactions** unless you explicitly need savepoints.
4. **Keep transactions short** — don't include external API calls (HTTP, email) inside a transaction.
5. **Dispatch jobs/events after** the transaction commits using `afterCommit()`.

```php
// Dispatch job only after transaction commits successfully
DB::afterCommit(function () use ($order) {
    ProcessOrderJob::dispatch($order->id);
});
```

---

## 15. Testing

### Framework: Pest PHP

All tests are written using Pest PHP syntax, not PHPUnit.

**Location:** `tests/`

```
tests/
├── Feature/              # Integration and API tests
│   ├── Auth/
│   ├── Cart/
│   └── Orders/
├── Unit/                 # Unit tests for services, actions, etc.
├── TestCase.php
└── Pest.php
```

### Test Example

```php
<?php

use App\Models\Orders\Order;
use App\Enums\Orders\OrderStatus;
use App\Services\GroupedDeliverySlot\GroupedSlotService;

uses(Tests\TestCase::class);
uses()->group('integration');

test('slot service returns available delivery slots', function () {
    $service = app(GroupedSlotService::class);

    $result = $service->getGroupedSlotsForProducts(
        addressId: 123,
        productIds: [10],
    );

    expect($result)->not->toHaveKey('error');
    expect($result)->toHaveKey('groups');
    expect($result['groups'])->toBeArray();
});

test('order status transitions correctly', function () {
    $order = Order::factory()->create(['status' => OrderStatus::PENDING]);

    $order->update(['status' => OrderStatus::PROCESSING]);

    expect($order->fresh()->status)->toBe(OrderStatus::PROCESSING);
});
```

### Testing Rules

1. **Pest PHP** — not PHPUnit class syntax.
2. **Descriptive test names** as strings: `test('user can add product to cart', ...)`.
3. **`expect()` fluent assertions** — not `$this->assert*()`.
4. **Test grouping:** `uses()->group('integration')` for categorization.
5. **Carbon time travel:** `Carbon::setTestNow()` for time-dependent tests.
6. **Factories** for test data generation — never hardcode IDs.
7. **Feature tests** for API endpoints; **Unit tests** for services and actions.

---

## 16. Notifications

### Standard: Laravel Notifications

**Location:** `app/Notifications/`

```php
<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class OrderPlacedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly array $orderData
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', OneSignalChannel::class];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title'       => 'Order Confirmation',
            'description' => 'Your order has been successfully placed.',
            'image'       => null,
        ];
    }

    public function toOneSignal(object $notifiable): OneSignalMessage
    {
        return (new OneSignalMessage)
            ->id($notifiable->id)
            ->title('Order Confirmation')
            ->description('Your order has been successfully placed.');
    }
}
```

### Custom Channel Pattern

For third-party push services, create custom channels:

**Location:** `app/Channels/{ProviderName}Channel.php`

```php
<?php

namespace App\Channels;

use Illuminate\Notifications\Notification;

class OneSignalChannel
{
    public function send(mixed $notifiable, Notification $notification): void
    {
        $message = $notification->toOneSignal($notifiable);
        $message->send();
    }
}
```

### Custom Message Builder

**Location:** `app/Notifications/Messages/{ProviderName}Message.php`

```php
<?php

namespace App\Notifications\Messages;

class OneSignalMessage
{
    protected int $id;
    protected string $title;
    protected string $description;

    public function id(int $id): static { $this->id = $id; return $this; }
    public function title(string $title): static { $this->title = $title; return $this; }
    public function description(string $desc): static { $this->description = $desc; return $this; }

    public function send(): void
    {
        // Third-party API call
    }
}
```

### Notification Rules

1. **Implement `ShouldQueue`** — all notifications are queued.
2. **`database` channel** for in-app notification storage.
3. **Custom channels** for third-party push services.
4. **Fluent message builders** for custom channels.
5. **Naming:** `{Event}Notification` (e.g., `OrderPlacedNotification`).

---

## 17. Jobs & Queues

**Location:** `app/Jobs/`

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessCashbackJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly int $userId,
        private readonly float $amount,
    ) {}

    public function handle(WalletService $walletService): void
    {
        $walletService->creditCashback($this->userId, $this->amount);
    }
}
```

### Job Rules

1. **Implement `ShouldQueue`** — all jobs are queued by default.
2. **Standard Laravel traits** on every job.
3. **Constructor for data** — pass only serializable primitives and model IDs, not full models.
4. **Service injection in `handle()`** — not constructor.
5. **Naming:** `{Verb}{Noun}Job` (e.g., `ProcessCashbackJob`, `NotifySubscriptionEndingJob`).

---

## 18. Exception Handling

### Custom Exceptions

**Location:** `app/Exceptions/`

Domain exceptions should be **renderable** — they know how to convert themselves into HTTP responses. This eliminates try/catch blocks in controllers entirely.

```php
<?php

declare(strict_types=1);

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as Status;

class CheckoutException extends Exception
{
    public function __construct(
        string $message = 'Checkout error',
        private readonly array $context = [],
        int $code = 0,
    ) {
        parent::__construct($message, $code);
    }

    /**
     * Render the exception as an HTTP response.
     */
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'error' => [
                'message' => $this->getMessage(),
            ],
        ], Status::HTTP_UNPROCESSABLE_ENTITY);
    }

    /**
     * Context for logging.
     */
    public function context(): array
    {
        return $this->context;
    }
}
```

### Centralized Exception Handling

Since Laravel 11, exception handling is configured in `bootstrap/app.php` via `withExceptions()`. There is **no** `app/Exceptions/Handler.php` class.

```php
<?php

// bootstrap/app.php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Sentry\Laravel\Integration;
use Throwable;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(/* ... */)
    ->withMiddleware(function (Middleware $middleware) {
        // ...
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // --- Error Tracking (Sentry) ---
        $exceptions->reportable(function (Throwable $e) {
            Integration::captureUnhandledException($e);
        });

        // --- Global JSON rendering for API requests ---
        $exceptions->shouldRenderJsonWhen(function (Request $request) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // --- Custom rendering for specific exceptions ---
        $exceptions->render(function (InsufficientStockException $e, Request $request) {
            return response()->json([
                'error' => [
                    'message' => $e->getMessage(),
                    'code'    => 'INSUFFICIENT_STOCK',
                ],
            ], 409);
        });
    })
    ->create();
```

### When to Use Each Pattern

| Pattern | When |
| :--- | :--- |
| `render()` on exception class | Exception is domain-specific and always renders the same way |
| `withExceptions()->render()` | Need centralized control or want to handle framework exceptions |
| `withExceptions()->reportable()` | Custom reporting (Sentry, Slack, etc.) |
| `withExceptions()->shouldRenderJsonWhen()` | Force JSON responses for API routes |

### Exception Rules

1. **Domain-specific exceptions** for business logic errors — never throw generic `\Exception`.
2. **Renderable exceptions** — add `render()` method to domain exceptions so controllers stay clean.
3. **No try/catch in controllers** — let exceptions propagate to the centralized handler or their own `render()` method.
4. **Error tracking** integration (Sentry) via `withExceptions()->reportable()` in `bootstrap/app.php`.
5. **Context arrays** for additional debugging data via the `context()` method.
6. **Naming:** `{Domain}Exception` (e.g., `CheckoutException`, `InvalidOtpException`).

---

## 19. Observers

Use observers for model lifecycle side effects that should not live in the model itself.

**Location:** `app/Observers/`

```php
<?php

namespace App\Observers;

use App\Models\Delivery\Delivery;
use App\Services\Delivery\DeliveryAssignService;

class DeliveryObserver
{
    public function __construct(
        private readonly DeliveryAssignService $assignService
    ) {}

    public function created(Delivery $delivery): void
    {
        $this->assignService->handleNewDelivery($delivery);
    }

    public function updated(Delivery $delivery): void
    {
        if ($delivery->isDirty('carrier_id')) {
            $this->assignService->handleCarrierChange($delivery);
        }
    }
}
```

### Observer Rules

1. **Constructor injection** for services.
2. **Check `isDirty()`** in `updated` to avoid unnecessary processing.
3. **Register** in `AppServiceProvider` or via `#[ObservedBy]` attribute.
4. **Use sparingly** — prefer explicit service calls in controllers for important side effects.

---

## 20. Configuration & Constants

### Custom Config Files

**Location:** `config/{service}.php`

```php
<?php

// config/razorpay.php
return [
    'key'            => env('RAZORPAY_API_KEY'),
    'secret'         => env('RAZORPAY_API_SECRET'),
    'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
];
```

### Business Constants

**Location:** `app/Constants/{Project}Constant.php`

```php
<?php

namespace App\Constants;

class AppConstant
{
    public const RATE_PER_KM = 4.0;
    public const MAX_CART_ITEMS = 50;
    public const DELIVERY_CUT_OFF_TIME = '23:00';
    public const DEFAULT_PAGINATION = 20;
    public const OTP_EXPIRY_MINUTES = 5;
}
```

### Rules

1. **One config file per external service.**
2. **Always use `env()` for secrets** — never hardcode credentials.
3. **Access config via `config('service.key')`** — never `env()` outside config files.
4. **Business constants** in a dedicated class — not scattered across code.

---

## 21. Utilities & Helpers

### Utility Classes

**Location:** `app/Utils/`

Utility classes provide stateless, static helper methods:

```php
<?php

namespace App\Utils;

class DateUtils
{
    public static function calculateDeliveryDate(int $shippingTime): string
    {
        return now()->addDays($shippingTime)->format('Y-m-d');
    }

    public static function isBusinessDay(\Carbon\Carbon $date): bool
    {
        return !$date->isWeekend();
    }
}
```

```php
<?php

namespace App\Utils;

class UploadUtil
{
    public static function url(?string $path): ?string
    {
        if (!$path) return null;
        return config('app.asset_url') . '/' . $path;
    }
}
```

### Helper Classes

**Location:** `app/Helpers/`

Helper classes provide request-aware utilities:

```php
<?php

namespace App\Helpers;

class RequestFilter
{
    public static function getPerPage(int $default = 20, int $max = 100): int
    {
        $perPage = (int) request('per_page', $default);
        return min($perPage, $max);
    }
}
```

### Rules

1. **Utils** are stateless, static-method classes — no dependencies on request or auth.
2. **Helpers** may access request context.
3. **No global helper functions** — use class-based helpers exclusively.
4. **Naming:** `{Purpose}Util` or `{Purpose}Helper`.

---

## 22. Package Standards

### Required Packages (All Projects)

| Package | Purpose |
| :--- | :--- |
| `laravel/sanctum` | API token authentication |
| `spatie/laravel-permission` | Role-based access control |
| `spatie/laravel-activitylog` | Audit logging |
| `spatie/laravel-query-builder` | API query filtering and sorting |
| `sentry/sentry-laravel` | Error tracking and monitoring |

### Testing Packages

| Package | Purpose |
| :--- | :--- |
| `pestphp/pest` | Testing framework |
| `pestphp/pest-plugin-laravel` | Laravel-specific Pest helpers |

### Development Packages

| Package | Purpose |
| :--- | :--- |
| `barryvdh/laravel-ide-helper` | IDE autocompletion for models, facades |

### Optional Packages (As Needed)

| Package | Purpose |
| :--- | :--- |
| `maatwebsite/excel` | Excel/CSV import and export |
| `barryvdh/laravel-dompdf` | PDF generation |
| `league/flysystem-aws-s3-v3` | S3 file storage |

### Package Rules

1. **Spatie packages** are the standard for permissions, activity logging, and query building.
2. **Pest PHP** is the testing framework — not PHPUnit.
3. **Sentry** for production error tracking — always.
4. **IDE Helper** in `require-dev` for every project.
5. **Evaluate before adding** — prefer Laravel's built-in features over third-party packages when possible.

---

## 23. PHP & Code Style

### PHP Version

**Minimum: PHP 8.2** — required by Laravel 12. Use modern PHP features.

### Required PHP Features

```php
// Constructor property promotion
public function __construct(
    private readonly CartService $cartService,
) {}

// Readonly classes (PHP 8.2)
readonly class OrderSummaryDTO {
    public function __construct(
        public string $orderId,
        public float $total,
    ) {}
}

// Enum backing
enum Status: string { case ACTIVE = 'active'; }

// Named arguments
$dto = DeliveryLogDTO::fromArray(
    deliveryId: $id,
    action: 'created',
);

// Match expressions
$label = match ($this) {
    self::PENDING => 'Pending',
    self::ACTIVE  => 'Active',
};

// Null-safe operator
$image = $this->image?->path;

// First-class callable syntax
$prices = $carts->map($this->calculatePrice(...));

// Enum methods
OrderStatus::PENDING->label();

// Union and intersection types
public function execute(string|int $id): ?array

// DNF types (PHP 8.2)
public function process((Countable&Iterator)|null $items): void

// true, false, null as standalone types (PHP 8.2)
public function isEnabled(): true
```

### Code Style Rules

1. **Type declarations** on all method parameters and return types.
2. **`readonly`** on injected service properties.
3. **No `mixed` type** unless genuinely needed.
4. **Single blank line** between method sections (properties, relationships, scopes, etc.).
5. **PHPDoc `/** @mixin Model */`** on all API Resources for IDE support.
6. **`declare(strict_types=1)`** is required on all new files.
7. **No unused imports** — keep `use` statements clean.
8. **Follow PSR-12** coding standards.

### Naming Conventions Summary

| Entity | Convention | Example |
| :--- | :--- | :--- |
| Controller (invokable) | `{Domain}{Action}Controller` | `ClientLoginController` |
| Controller (resource) | `{Resource}Controller` | `CartController` |
| Form Request | `{Action}{Resource}Request` | `StoreCartRequest` |
| Service (domain) | `{Domain}Service` | `CartService` |
| Service (global) | `{Purpose}Service` | `PaymentService` |
| Action | `{Verb}{Noun}Action` | `OptimizeRouteOrderAction` |
| Model | `{SingularNoun}` | `Order`, `Product` |
| Enum | `{Model}{Property}` | `OrderStatus`, `UserPermissions` |
| Trait | `{Capability}` | `ApiResponse`, `ActiveSort` |
| Resource | `{Model}Resource` | `ProductResource` |
| DTO | `{Domain}DTO` | `DeliveryLogDTO` |
| Contract/Interface | `{Capability}Interface` | `ChatRouterInterface` |
| Event | `{Model}{Action}` | `OrderPlaced`, `TicketEscalated` |
| Listener | `{Action}On{Event}` | `NotifyAgentOnTicketEscalated` |
| Notification | `{Event}Notification` | `OrderPlacedNotification` |
| Job | `{Verb}{Noun}Job` | `ProcessCashbackJob` |
| Exception | `{Domain}Exception` | `CheckoutException` |
| Observer | `{Model}Observer` | `DeliveryObserver` |
| Middleware | `{Purpose}Middleware` | `ResolveTenantMiddleware` |
| Rule | `{Validation}` | `UserHasRole` |
| Constant | `{Project}Constant` | `AppConstant` |
| Util | `{Purpose}Util` | `DateUtils`, `UploadUtil` |
| Filter | `{Field}Filter` | `CityFilter` |

---

## 24. Contracts & Interfaces

Use interfaces when there are **multiple implementations of the same behavior**, or when you need clean testability boundaries with external services.

**Location:** `app/Contracts/{Domain}/`

### When to Use Interfaces

| Use Interface | Don't Bother |
| :--- | :--- |
| Multiple implementations (routing strategies, payment gateways) | Single concrete service with no planned alternatives |
| Third-party service wrappers (so you can swap vendors) | Internal business logic tightly coupled to your domain |
| Services you want to mock cleanly in tests | Simple utility classes |

### Interface Template

```php
<?php

declare(strict_types=1);

namespace App\Contracts\Chat;

use App\Models\ChatSessions\ChatSession;
use App\Models\Users\User;

interface ChatRouterInterface
{
    /**
     * Select the next available agent for a chat session.
     */
    public function route(ChatSession $session): ?User;
}
```

### Implementations

```php
<?php

declare(strict_types=1);

namespace App\Services\Chat;

use App\Contracts\Chat\ChatRouterInterface;

class RoundRobinRouter implements ChatRouterInterface
{
    public function route(ChatSession $session): ?User
    {
        // Round-robin logic
    }
}

class LeastLoadedRouter implements ChatRouterInterface
{
    public function route(ChatSession $session): ?User
    {
        // Least-loaded logic
    }
}
```

### Binding in Service Provider

```php
// AppServiceProvider or a dedicated ChatServiceProvider
use App\Contracts\Chat\ChatRouterInterface;
use App\Services\Chat\RoundRobinRouter;

public function register(): void
{
    $this->app->bind(ChatRouterInterface::class, function ($app) {
        $strategy = config('chat.routing_strategy', 'round-robin');

        return match ($strategy) {
            'least-loaded' => $app->make(LeastLoadedRouter::class),
            default         => $app->make(RoundRobinRouter::class),
        };
    });
}
```

### Contract Rules

1. **One public method per interface** when possible — prefer small, focused contracts.
2. **Naming:** `{Capability}Interface` (e.g., `ChatRouterInterface`, `PaymentGatewayInterface`).
3. **Bind in service providers** — use config values to select implementations at runtime.
4. **Don't interface everything** — only when there's a real reason (multiple implementations, testability, vendor swapping).

---

## 25. Events & Listeners

Use Events for side effects that should be decoupled from the main operation (notifications, logging, cache invalidation). Events keep your services focused on their primary responsibility.

**Locations:**
- Events: `app/Events/{Domain}/`
- Listeners: `app/Listeners/{Domain}/`

### Event Template

```php
<?php

declare(strict_types=1);

namespace App\Events\Tickets;

use App\Models\Tickets\Ticket;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TicketEscalated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Ticket $ticket,
        public readonly string $reason,
    ) {}
}
```

### Listener Template

```php
<?php

declare(strict_types=1);

namespace App\Listeners\Tickets;

use App\Events\Tickets\TicketEscalated;
use App\Notifications\TicketEscalatedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;

class NotifyAgentOnTicketEscalated implements ShouldQueue
{
    public function handle(TicketEscalated $event): void
    {
        $event->ticket->assignedAgent?->notify(
            new TicketEscalatedNotification($event->ticket, $event->reason)
        );
    }
}
```

### Registration

Register event-listener mappings in `AppServiceProvider` or use auto-discovery:

```php
// AppServiceProvider::boot()
use Illuminate\Support\Facades\Event;

Event::listen(TicketEscalated::class, NotifyAgentOnTicketEscalated::class);
Event::listen(TicketEscalated::class, LogEscalationActivity::class);
```

### Dispatching Events

```php
// In a service — after the primary operation
public function escalateTicket(Ticket $ticket, string $reason): void
{
    $ticket->update(['priority' => TicketPriority::URGENT]);

    TicketEscalated::dispatch($ticket, $reason);
}
```

### When to Use Events vs Direct Calls

| Use Events | Use Direct Calls |
| :--- | :--- |
| Side effects (notifications, audit logs, cache busting) | Core business logic that must succeed |
| Multiple independent reactions to one action | Single, tightly-coupled consequence |
| Reactions that can be queued/async | Logic that needs the return value |

### Event Rules

1. **Events are data containers** — no business logic inside events.
2. **Listeners do one thing** — one listener per side effect.
3. **Queue listeners** with `implements ShouldQueue` for non-critical side effects.
4. **Naming:** Events are past-tense nouns (`TicketEscalated`, `OrderPlaced`). Listeners describe their action (`NotifyAgentOnTicketEscalated`).
5. **Dispatch in services** — never in controllers or models.

---

## 26. Middleware Conventions

Custom middleware handles cross-cutting concerns that apply to groups of routes.

**Location:** `app/Http/Middleware/`

### Middleware Template

```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenantMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantKey = $request->header('X-Tenant-Key');

        if (!$tenantKey) {
            return response()->json([
                'error' => ['message' => 'Tenant API key is required.'],
            ], 401);
        }

        $tenant = Tenant::where('api_key', $tenantKey)->where('is_active', true)->first();

        if (!$tenant) {
            return response()->json([
                'error' => ['message' => 'Invalid or inactive tenant.'],
            ], 401);
        }

        // Bind tenant to the request lifecycle
        app()->instance('tenant', $tenant);
        $request->merge(['tenant_id' => $tenant->id]);

        return $next($request);
    }
}
```

### Registration in bootstrap/app.php

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'tenant'     => \App\Http\Middleware\ResolveTenantMiddleware::class,
        'role'       => \Spatie\Permission\Middleware\RoleMiddleware::class,
        'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
    ]);

    $middleware->api(append: [
        // Middleware applied to all API routes
    ]);
})
```

### Middleware Rules

1. **Naming:** `{Purpose}Middleware` (e.g., `ResolveTenantMiddleware`, `EnsureJsonResponseMiddleware`).
2. **Register aliases** in `bootstrap/app.php` — not in kernel (removed in Laravel 11+).
3. **Early return** for auth/validation failures — don't call `$next($request)`.
4. **Single responsibility** — one middleware per concern.
5. **Order matters** — auth middleware before permission middleware, tenant resolution before business logic.

---

## 27. Rate Limiting

Define rate limiters in `AppServiceProvider` or a dedicated `RateLimitServiceProvider`. Use Laravel's built-in `RateLimiter` facade.

### Defining Rate Limiters

```php
<?php

// AppServiceProvider::boot()

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Request;

// Global API rate limit
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

// Strict limit for auth endpoints
RateLimiter::for('auth', function (Request $request) {
    return Limit::perMinute(10)->by($request->ip());
});

// Tenant-aware rate limit
RateLimiter::for('tenant-api', function (Request $request) {
    $tenantId = $request->header('X-Tenant-Key', 'unknown');
    return Limit::perMinute(100)->by($tenantId);
});
```

### Applying to Routes

```php
Route::middleware(['throttle:auth'])->group(function () {
    Route::post('auth/login', ClientLoginController::class);
    Route::post('auth/send-otp', ClientOTPController::class);
});

Route::middleware(['throttle:tenant-api'])->group(function () {
    // Tenant-scoped API routes
});
```

### Rate Limiting Rules

1. **Auth endpoints** get strict limits (10/min per IP).
2. **General API** gets moderate limits (60/min per user or IP).
3. **Tenant-aware** limits for multi-tenant systems — limit by tenant key, not just IP.
4. **Define all limiters** in a service provider boot method — centralized and auditable.
5. **Use `throttle:` middleware** on route groups — never implement rate limiting in controllers.

---

## 28. Caching Strategy

Use caching for expensive queries, external API responses, and computed data that changes infrequently. Laravel's cache abstraction supports multiple drivers (Redis, Memcached, file, database).

### Cache Usage Patterns

**Simple key-value caching:**

```php
use Illuminate\Support\Facades\Cache;

// Remember for 1 hour
$categories = Cache::remember('categories:active', 3600, function () {
    return Category::where('status', true)->orderBy('sort')->get();
});
```

**Tenant-scoped caching (multi-tenant systems):**

```php
// Always prefix cache keys with tenant ID in multi-tenant systems
$cacheKey = "tenant:{$tenantId}:settings";

$settings = Cache::remember($cacheKey, 3600, function () use ($tenantId) {
    return TenantSetting::where('tenant_id', $tenantId)->get();
});
```

**Cache invalidation:**

```php
// Invalidate on mutation
public function updateCategory(Category $category, array $data): Category
{
    $category->update($data);

    Cache::forget('categories:active');

    return $category;
}
```

### Where Cache Logic Lives

| Layer | Cache Usage |
| :--- | :--- |
| Services | Primary location — cache expensive queries and computations |
| Controllers | Never — controllers don't know about caching |
| Models | Rarely — only for simple `remember()` in custom scopes |
| Middleware | Acceptable for response caching |

### Caching Rules

1. **Cache in services** — never in controllers.
2. **Prefix keys** with domain context (e.g., `tenant:{id}:resource`).
3. **Set TTLs explicitly** — never cache forever unless the data is truly immutable.
4. **Invalidate on mutation** — every write operation should clear relevant cache keys.
5. **Use `Cache::remember()`** — the atomic get-or-set pattern prevents cache stampedes.
6. **Don't cache user-specific data** in shared cache without proper key scoping.

---

*— End of Document —*

*Version 2.0 — This architecture guideline applies to all Laravel 12+ backend projects. Deviations require explicit justification and team lead approval.*
