# SasaTech Architecture Guide

Feature-based Clean Architecture for Next.js App Router + Supabase.

> **Note:** This document is for agents and LLMs to follow when generating, maintaining, or refactoring code in SasaTech projects.

---

## Quick Reference

### Directory Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Auth required routes
│   ├── (public)/             # Public routes
│   └── api/                  # API Routes (handler を re-export)
│       └── products/
│           └── route.ts      # → export { GET, POST } from '@/features/products/core/handler'
├── features/                 # Feature modules
│   └── [feature]/
│       ├── index.ts          # Public API
│       ├── core/
│       │   ├── handler.ts    # Handler layer (server-only)
│       │   ├── schema.ts     # Zod schemas + types
│       │   ├── service.ts    # server-only
│       │   └── repository.ts # server-only
│       ├── fetcher.ts
│       └── hooks.ts
├── components/               # Shared UI components
├── hooks/                    # Shared hooks
├── lib/                      # Utilities
└── types/                    # Supabase generated types only
```

### Layer Architecture

```
route.ts (Next.js routing) → Handler → Service → Repository → Supabase
```

**Important:** `route.ts` is NOT a handler. It only re-exports from `features/*/handler.ts`.

### 5 Critical Rules

1. **No `getAll`** - Always enforce `MAX_LIMIT` on server
2. **`server-only` required** - Add to Handler/Service/Repository files
3. **`schema.ts` only** - No `types.ts`, use `z.infer` for types
4. **4-layer architecture** - Always go through route.ts → Handler → Service → Repository
5. **API Route only** - No direct Supabase access from client

---

## Rules by Priority

### CRITICAL - Security/Architecture Breaking

#### 1. No getAll/findAll

Never use unlimited data fetching. Always enforce server-side limits.

```typescript
// NG
async findAll(supabase: SupabaseClient): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*')
  return data
}

// OK
const MAX_LIMIT = 100

async findMany(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  const offset = options.offset ?? 0

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .range(offset, offset + limit - 1)

  if (error) throw new AppError(error.message, 500)
  return data
}
```

#### 2. Pagination Required

All list endpoints must include pagination.

```typescript
// OK response structure
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### 3. server-only Directive

Service and Repository files must include `import 'server-only'`.

```typescript
// src/features/products/service.ts
import 'server-only'  // ← Required

import type { SupabaseClient } from '@supabase/supabase-js'
// ...
```

Files that need `server-only`:
- `handler.ts` - Required
- `service.ts` - Required
- `repository.ts` - Required
- `route.ts` (API) - Not needed (only re-exports)
- `schema.ts` - Not needed (used by frontend)
- `fetcher.ts` - Not needed (client only)
- `hooks.ts` - Not needed (client only)

#### 4. No NEXT_PUBLIC_ for Supabase

Environment variables must not use `NEXT_PUBLIC_` prefix.

```bash
# NG
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# OK
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

#### 5. No Direct Supabase from Client

Client components must not access Supabase directly. Always go through API routes.

```typescript
// NG - Direct Supabase in client
'use client'
const supabase = createBrowserClient(...)
const { data } = await supabase.from('products').select('*')

// OK - Through API route
'use client'
const { products } = useProducts()  // Hook calls API
```

---

### HIGH - Maintainability Impact

#### 6. Single Source in schema.ts

All type definitions go in `schema.ts`. Never create `types.ts`.

```typescript
// src/features/products/core/schema.ts
import { z } from 'zod'
import type { ProductRow } from '@/types'

// Entity type (from Supabase)
export type Product = ProductRow

// Input schema
export const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0),
})

// Input type (derived from schema)
export type CreateProductInput = z.infer<typeof createProductSchema>
```

#### 7. No types.ts File

Never create `types.ts` in feature directories. Use:
- `schema.ts` for feature types
- `src/types/` for Supabase generated types only

#### 8. Use z.infer for Input Types

Derive input types from Zod schemas, don't define manually.

```typescript
// NG
export type CreateProductInput = {
  name: string
  price: number
}

// OK
export const createProductSchema = z.object({
  name: z.string(),
  price: z.number(),
})
export type CreateProductInput = z.infer<typeof createProductSchema>

// Update schema
export const updateProductSchema = createProductSchema.partial()
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

#### 9. Layer Architecture (route.ts → Handler → Service → Repository)

Always go through all layers. Never skip. `route.ts` only re-exports from handler.

```typescript
// NG - route.ts directly accesses DB
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*')
  return NextResponse.json(data)
}

// OK - route.ts re-exports from handler
// src/app/api/products/route.ts
export { GET, POST } from '@/features/products/core/handler'

// src/features/products/core/handler.ts
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const products = await getProducts(supabase)  // Service
  return ok(products)
}
```

#### 10. Feature Module Structure

Organize code by feature, not by type.

```
// NG - Organized by type
src/services/product-service.ts
src/repositories/product-repository.ts

// OK - Organized by feature
src/features/products/
├── index.ts
├── core/
│   ├── schema.ts
│   ├── service.ts
│   └── repository.ts
```

---

### MEDIUM - Consistency Impact

#### 11. Validate Request Body

Use `validateBody()` for POST/PATCH requests.

```typescript
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }
  // validation.data is typed
}
```

#### 12. Validate URL Params

Use `validateParams()` for dynamic route parameters.

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const validation = validateParams(params, productIdSchema)
  if (!validation.success) {
    return validation.response
  }
  // validation.data.id is typed
}
```

#### 13. Use Response Helpers

Use `ok()`, `created()`, `notFound()` instead of raw `NextResponse.json()`.

```typescript
// NG
return NextResponse.json(product)
return NextResponse.json(product, { status: 201 })

// OK
return ok(product)
return created(product)
return notFound('Product not found')
```

#### 14. Use AppError Class

Throw `AppError` instead of raw `Error`.

```typescript
// NG
throw new Error('Not found')

// OK
throw AppError.notFound('Product not found')
throw AppError.forbidden('Cannot edit others posts')
throw new AppError('Custom error', 400, 'CUSTOM_CODE')
```

#### 15. kebab-case File Names

All files and directories use kebab-case.

```
// NG
UserProfile.tsx
productList.tsx
UserService.ts

// OK
user-profile.tsx
product-list.tsx
service.ts
```

#### 16. Method Naming Convention

Repository: `findMany`, `findById`, `create`, `update`, `delete`
Service: `get*`, `create*`, `update*`, `delete*`, action verbs

```typescript
// Repository
productRepository.findMany()
productRepository.findById(id)
productRepository.create(data)

// Service
getProducts()
getProductById(id)
createProduct(input)
publishProduct(id)
```

---

### LOW - Recommended

#### 17. Fetcher Pattern

Create `fetcher.ts` per feature for API calls.

```typescript
// src/features/products/fetcher.ts
export const productsFetcher = {
  getAll: (page, limit) => fetchPaginated(`/api/products?page=${page}&limit=${limit}`),
  getById: (id) => fetchData(`/api/products/${id}`),
  create: (input) => mutate('/api/products', { method: 'POST', body: input }),
}
```

#### 18. SWR Hooks Pattern

Create `hooks.ts` per feature for data fetching hooks.

```typescript
// src/features/products/hooks.ts
export function useProducts(page = 1, limit = 20) {
  const { data, error, isLoading } = useSWR(
    ['products', page, limit],
    () => productsFetcher.getAll(page, limit)
  )
  return { products: data?.data ?? [], pagination: data?.pagination, isLoading, error }
}
```

---

## Database

### Required Columns

All tables must have:
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated via trigger)
- `create_user` (uuid, references auth.users)
- `update_user` (uuid, auto-updated via trigger)

### RLS Required

All tables must enable Row Level Security:

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

---

## Supabase

### Authentication

- `getSession()`: For UI display, light auth (fast, local validation)
- `getUser()`: For data mutations, secure operations (server validation)

### Type Generation

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

---

## Setup

1. Create project: `npx create-next-app@latest --typescript --tailwind --app --src-dir`
2. Install deps: `npm install @supabase/supabase-js @supabase/ssr zod server-only swr`
3. Copy base files from `scripts/` to `src/lib/` and `src/types/`
4. Initialize Supabase: `npx supabase init && npx supabase start`
5. Generate types: `npx supabase gen types typescript --local > src/types/database.ts`
