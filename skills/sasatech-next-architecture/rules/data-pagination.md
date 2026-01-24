---
title: ページネーション必須
impact: CRITICAL
impactDescription: 大量データでもレスポンス時間を一定に保つ
tags: data-access, pagination, repository, api
---

## ページネーション必須

リスト取得APIは必ずページネーションを実装する。

**NG (全件返却、大量データでレスポンス遅延):**

```typescript
// Handler
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const products = await getProducts(supabase)  // 全件返却
  return ok(products)
}

// Repository
async findMany(supabase: SupabaseClient): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*')
  return data ?? []
}
```

**OK (ページネーション付きで総件数を返却):**

```typescript
// Handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 20

  const supabase = await createClient()
  const result = await getProducts(supabase, { page, limit })

  return paginated(result.data, result.pagination)
}

// Service
export async function getProducts(
  supabase: SupabaseClient,
  options: { page: number; limit: number }
): Promise<PaginatedResult<Product>> {
  return productRepository.findMany(supabase, options)
}

// Repository
const MAX_LIMIT = 100

async findMany(
  supabase: SupabaseClient,
  options: { page: number; limit: number }
): Promise<PaginatedResult<Product>> {
  const limit = Math.min(options.limit, MAX_LIMIT)
  const offset = (options.page - 1) * limit

  const { data, error, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new AppError(error.message, 500)

  const total = count ?? 0

  return {
    data: data ?? [],
    pagination: {
      page: options.page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
```

## ページネーションレスポンス構造

```typescript
// 型定義
export type PaginatedResult<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// レスポンス例
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

## 検索スキーマ

```typescript
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})
```
