---
id: data-pagination
title: ページネーション必須
category: データ
impact: HIGH
tags: [data-access, pagination, repository, api]
---

## ルール

リスト取得APIは必ずページネーションを実装する。

## NG例

```typescript
// Handler
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const products = await getProducts(supabase)  // 問題: 全件返却、大量データでレスポンス遅延
  return ok(products)
}

// Repository
async findMany(supabase: SupabaseClient): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*')
  return data ?? []
}
```

## OK例

```typescript
// Handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 20

  const supabase = await createClient()
  const result = await getProducts(supabase, { page, limit })

  return paginated(result.data, result.pagination)  // ページネーション付きレスポンス
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
    .select('*', { count: 'exact' })  // 総件数を取得
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)  // ページング範囲を指定

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
```

## 理由

ページネーションを実装しない場合、大量データでの性能劣化を招く。全件取得はデータベースとネットワークに負荷をかけ、レスポンス時間が増大する。これは保守性を大きく損ない、スケーラビリティを阻害する。

ページネーションは以下を実現する：

- データ取得量の制限によるパフォーマンス向上
- クライアント側での段階的なデータ表示
- データベース負荷の軽減
- 総件数の提供によるUI/UX改善

## 参照

- [data-no-getall.md](data-no-getall.md) - 全件取得禁止ルール
