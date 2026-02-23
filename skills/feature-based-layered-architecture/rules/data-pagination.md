---
id: data-pagination
title: ページネーション必須・全件取得禁止
category: データ
impact: HIGH
tags: [data-access, pagination, repository, api, security]
---

## ルール

リスト取得APIは必ずページネーションを実装する。Repository層で上限なしの全件取得を行わない。サーバー側で`MAX_LIMIT`による上限を強制する。

## NG例

```typescript
// Handler - NG: ページネーションなしで全件返却
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})

// Repository - NG: 上限なしの全件取得
async findMany(supabase: SupabaseClient): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*')
  return data ?? []
}

// Repository - NG: クライアントのlimitをそのまま使用
async findMany(supabase: SupabaseClient, limit: number) {
  // limit=10000 が来たらそのまま10000件取得してしまう
  return supabase.from('products').select('*').limit(limit)
}
```

## OK例

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { validateSearchParams } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts } from './service'

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})

export const handleGetProducts = withHTTPError(async (request) => {
  const validation = validateSearchParams(request, querySchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const result = await getProducts(supabase, validation.data)
  return AppResponse.ok(result)
})
```

```typescript
// src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'

export async function getProducts(
  supabase: SupabaseClient,
  options: { page: number; limit: number }
) {
  return productRepository.findMany(supabase, options)
}
```

```typescript
// src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'

// クライアントのリクエストに関わらず上限を強制
const MAX_LIMIT = 100

export const productRepository = {
  async findMany(
    supabase: SupabaseClient,
    options: { page: number; limit: number }
  ) {
    const limit = Math.min(options.limit, MAX_LIMIT)
    const offset = (options.page - 1) * limit

    const { data, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new AppError(error.message, 500, 'INTERNAL_ERROR')

    const total = count ?? 0

    return {
      items: data ?? [],
      total,
      page: options.page,
      limit,
    }
  },
}
```

```typescript
// 型定義（schema.tsに定義）
export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}
```

## 理由

全件取得はデータ量の増加に伴いメモリ枯渇やDoS脆弱性を招く。サーバー側で`MAX_LIMIT`による上限を強制し、ページネーションを実装することで以下を実現する：

- データ取得量の制限によるパフォーマンス向上
- 悪意ある大量リクエストの防止
- クライアント側での段階的なデータ表示
- データベース負荷の軽減
- 総件数の提供によるUI/UX改善

## 例外

以下の条件を**すべて**満たす場合のみ、ページネーションなしの取得を許可する：

1. 件数が明確に制限されている（例: 都道府県47件）
2. 増加しない、または増加が極めて緩やか
3. UI上で全件表示が必要（ドロップダウン等）

```typescript
// OK: 明確に件数が制限されたマスタデータ（上限付き）
async findAll(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('prefectures')
    .select('*')
    .order('code', { ascending: true })
    .limit(100)  // 安全のため上限を設定

  if (error) throw new AppError(error.message, 500, 'INTERNAL_ERROR')
  return data
}
```

## 命名規則

| パターン | 用途 |
|---------|------|
| `findMany` | ページネーション付きの複数件取得 |
| `findById` | ID指定の1件取得 |
| `search` | 検索条件付きの取得 |
| `count` | 件数のみ取得 |
| ~~`findAll`~~ | **使用禁止**（マスタデータ以外） |
| ~~`getAll`~~ | **使用禁止** |
