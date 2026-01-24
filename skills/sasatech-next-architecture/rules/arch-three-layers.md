---
title: Handler → Service → Repository の3層構成
impact: HIGH
impactDescription: 責務分離による保守性とテスタビリティの向上
tags: architecture, layers, handler, service, repository
---

## Handler → Service → Repository の3層構成

API Route から Supabase まで、必ず3層を経由する。

**重要: route.ts と handler.ts の違い**

- `route.ts` - Next.js App Router のルーティングファイル（handler を re-export するだけ）
- `handler.ts` - 実際の Handler 層（features 内に配置）

```
src/app/api/products/route.ts       ← Next.js ルーティング（エントリーポイント）
src/features/products/core/handler.ts ← Handler層（リクエスト処理、バリデーション）
src/features/products/core/service.ts ← Service層（ビジネスロジック）
src/features/products/core/repository.ts ← Repository層（データアクセス）
```

**NG (Handler から直接 DB アクセス、責務が混在):**

```typescript
// route.ts で直接 Supabase にアクセス
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Handler で直接 DB アクセス
  const { data } = await supabase.from('products').select('*')

  return NextResponse.json(data)
}
```

```typescript
// Service から直接 Supabase にアクセス
export async function getProducts(supabase: SupabaseClient) {
  // Repository を経由せずに直接 DB アクセス
  const { data } = await supabase.from('products').select('*')
  return data
}
```

**OK (route.ts → Handler → Service → Repository を経由):**

```typescript
// ルーティング: src/app/api/products/route.ts
// handler を re-export するだけ
export { GET, POST } from '@/features/products/core/handler'
```

```typescript
// Handler層: src/features/products/core/handler.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProducts, createProduct } from './service'
import { createProductSchema } from './schema'
import { createClient } from '@/lib/supabase/server'
import { ok, created, serverError } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)  // Service を呼び出し
    return ok(products)
  } catch (error) {
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, validation.data)
    return created(product)
  } catch (error) {
    return serverError()
  }
}
```

```typescript
// Service層: src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'

export async function getProducts(supabase: SupabaseClient) {
  return productRepository.findMany(supabase)  // Repository を呼び出し
}
```

```typescript
// Repository層: src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export const productRepository = {
  async findMany(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(100)

    if (error) throw new AppError(error.message, 500)
    return data
  },
}
```

## 各層の責務

| 層 | ファイル | 責務 |
|---|---------|------|
| route.ts | `app/api/*/route.ts` | Next.js ルーティング（handler を re-export） |
| Handler | `features/*/handler.ts` | リクエスト/レスポンス処理、バリデーション、認証 |
| Service | `features/*/service.ts` | ビジネスロジック、複数 Repository の連携 |
| Repository | `features/*/repository.ts` | データアクセス、Supabase クエリ |

## handler.ts を features 内に置く理由

1. **テスタビリティ** - handler も他の層と同様にユニットテスト可能
2. **凝集性** - 機能に関するコードが features 内で完結
3. **一貫性** - すべてのサーバーロジックが features 内にある

## 例外: 単純な CRUD

ビジネスロジックがない単純な CRUD でも、将来の拡張性のために3層を維持する:

```typescript
// 単純でも Repository を経由
export async function getProductById(supabase: SupabaseClient, id: string) {
  return productRepository.findById(supabase, id)
}
```

ビジネスロジックが追加された場合に Service 層で対応できる。
