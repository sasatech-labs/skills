---
title: Handler → Service → Repository, Adapter の構成
impact: CRITICAL
impactDescription: レイヤー構成はアーキテクチャの根幹。違反すると責務分離が崩壊し設計パターン自体が成立しない
tags: architecture, layers, handler, service, repository, adapter
---

## Handler → Service → Repository, Adapter の構成

API Route から Supabase まで、必ず3層を経由する。

**NG (Handler から直接 DB アクセス、責務が混在):**

```typescript
// API Route から直接 Supabase にアクセス
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

**OK (Handler → Service → Repository を経由):**

```typescript
// Handler層: src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProducts } from '@/features/products'
import { createClient } from '@/lib/supabase/server'
import { ok, serverError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)  // Service を呼び出し
    return ok(products)
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
| Handler | `app/api/*/route.ts` | リクエスト/レスポンス処理、バリデーション、認証 |
| Service | `features/*/service.ts` | ビジネスロジック、複数 Repository の連携 |
| Repository | `features/*/repository.ts` | データアクセス、Supabase クエリ |

## 例外: 単純な CRUD

ビジネスロジックがない単純な CRUD でも、将来の拡張性のために3層を維持する:

```typescript
// 単純でも Repository を経由
export async function getProductById(supabase: SupabaseClient, id: string) {
  return productRepository.findById(supabase, id)
}
```

ビジネスロジックが追加された場合に Service 層で対応できる。
