---
id: arch-three-layers
title: Handler → Service → Repository, Adapter の構成
category: アーキテクチャ
impact: CRITICAL
tags: [architecture, layers, handler, service, repository, adapter]
---

## ルール

API RouteからSupabaseまで、Handler → Service → Repository の3層を経由する。各層の責務を明確に分離し、レイヤーをスキップしない。

## NG例

```typescript
// NG: API Routeから直接Supabaseにアクセス
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // 問題: Handlerで直接DBアクセスを行っている
  const { data } = await supabase.from('products').select('*')

  return NextResponse.json(data)
}
```

```typescript
// NG: ServiceからSupabaseに直接アクセス
export async function getProducts(supabase: SupabaseClient) {
  // 問題: Repositoryを経由せずに直接DBアクセスを行っている
  const { data } = await supabase.from('products').select('*')
  return data
}
```

## OK例

```typescript
// OK: API Route - src/app/api/products/route.ts
import { handleGetProducts } from '@/features/products'

// API Routeは薄いWrapper、Handler関数を呼び出すだけ
export const GET = handleGetProducts
```

```typescript
// OK: Handler層 - src/features/products/core/handler.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ok, serverError } from '@/lib/api-response'
import { getProducts } from './service'

export async function handleGetProducts(request: NextRequest) {
  try {
    const supabase = await createClient()
    // 推奨: Serviceを呼び出し、Repositoryへのアクセスを委譲
    const products = await getProducts(supabase)
    return ok(products)
  } catch (error) {
    return serverError()
  }
}
```

```typescript
// OK: Service層 - src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'

export async function getProducts(supabase: SupabaseClient) {
  // 推奨: Repositoryを呼び出し、DBアクセスを委譲
  return productRepository.findMany(supabase)
}
```

```typescript
// OK: Repository層 - src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export const productRepository = {
  async findMany(supabase: SupabaseClient) {
    // 推奨: Repositoryでのみデータアクセスを実行
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(100)

    if (error) throw new AppError(error.message, 500)
    return data
  },
}
```

## 理由

3層アーキテクチャを採用する理由は以下の通りである：

1. **責務の明確化**: 各層が単一の責務を持つことで、コードの理解と保守が容易になる
2. **テスタビリティ**: 各層を独立してテストできる
3. **変更の局所化**: データソースの変更はRepository層のみ、ビジネスロジックの変更はService層のみに影響
4. **再利用性**: Serviceは複数のHandlerから呼び出し可能

各層の責務は以下の通り：

| 層 | ファイル | 責務 |
|---|---------|------|
| API Route | `app/api/*/route.ts` | 薄いエントリーポイント（Handler関数を呼び出すだけ） |
| Handler | `features/*/core/handler.ts` | リクエスト/レスポンス処理、バリデーション、認証 |
| Service | `features/*/core/service.ts` | ビジネスロジック、複数Repositoryの連携 |
| Repository | `features/*/core/repository.ts` | データアクセス、Supabaseクエリ |

違反すると、責務分離が崩壊し、アーキテクチャパターン自体が成立しない。

## 例外

ビジネスロジックがない単純なCRUD操作でも、将来の拡張性のために3層を維持する：

```typescript
// 単純な処理でもRepositoryを経由する
export async function getProductById(supabase: SupabaseClient, id: string) {
  return productRepository.findById(supabase, id)
}
```

ビジネスロジックが追加された場合に、Service層で対応できる。
