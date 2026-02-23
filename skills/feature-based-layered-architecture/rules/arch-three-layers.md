---
id: arch-three-layers
title: Handler → Service → Repository, Adapter の構成
category: アーキテクチャ
impact: CRITICAL
tags: [architecture, layers, handler, service, repository, adapter]
---

## ルール

アプリケーションは Handler → Service → Repository / Adapter の層構成を経由する。SSR/CSR問わず、fetcher → API Route → Handler → Service → Repository / Adapter の経路でデータを取得する。各層の責務を明確に分離し、レイヤーをスキップしない。

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

### CSRパス: API Route → Handler → Service → Repository

```typescript
// OK: API Route - src/app/api/products/route.ts
import { handleGetProducts } from '@/features/products/index.server'

// API Routeは薄いWrapper、Handler関数を呼び出すだけ
export const GET = handleGetProducts
```

```typescript
// OK: Handler層 - src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts } from './service'

// withHTTPErrorでラップし、エラーハンドリングを統一する
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})
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

### Adapter層（外部API連携）

```typescript
// OK: Adapter層 - src/lib/adapters/stripe/index.ts
import 'server-only'

import { stripe } from './client'
import { handleStripeError } from './errors'
import type { CreatePaymentIntentInput, PaymentIntent } from './types'

// 外部APIのエラーをAppErrorに変換し、アプリケーション型を返す
export const stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency ?? 'jpy',
      })

      return {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        clientSecret: intent.client_secret!,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },
}
```

## 理由

レイヤードアーキテクチャを採用する理由は以下の通りである：

1. **責務の明確化**: 各層が単一の責務を持つことで、コードの理解と保守が容易になる
2. **テスタビリティ**: 各層を独立してテストできる
3. **変更の局所化**: データソースの変更はRepository層のみ、ビジネスロジックの変更はService層のみに影響
4. **再利用性**: Serviceは複数のHandlerから呼び出し可能。SSR/CSR両パスから同じfetcher → API Route → Handler → Serviceの経路を使用する

各層の責務は以下の通り：

| 層 | ファイル | 責務 |
|---|---------|------|
| API Route | `app/api/*/route.ts` | 薄いエントリーポイント（Handler関数を呼び出すだけ） |
| Handler | `features/*/core/handler.ts` | リクエスト/レスポンス処理、バリデーション、楽観的認証 |
| Service | `features/*/core/service.ts` | ビジネスロジック、厳密な認可、Repository/Adapterの連携 |
| Repository | `features/*/core/repository.ts` | データアクセス、Supabaseクエリ |
| Adapter | `features/*/core/adapter.ts` | 外部API連携（Stripe, Resend等）。Repositoryと同階層 |

違反すると、責務分離が崩壊し、アーキテクチャパターン自体が成立しない。

## 例外

### 単純なCRUD操作

ビジネスロジックがない単純なCRUD操作でも、将来の拡張性のために層構成を維持する：

```typescript
// 単純な処理でもRepositoryを経由する
export async function getProductById(supabase: SupabaseClient, id: string) {
  return productRepository.findById(supabase, id)
}
```

ビジネスロジックが追加された場合に、Service層で対応できる。

### SSR（Server Components）

SSRでもfetcher経由でAPI Routeを呼び出す。データ取得経路はSSR/CSRで統一する。詳細は[arch-fetch-strategy](arch-fetch-strategy.md)を参照。

## 参照

- [データ取得戦略](../guides/fetch-strategy.md)
- [アーキテクチャガイド](../guides/architecture.md)
