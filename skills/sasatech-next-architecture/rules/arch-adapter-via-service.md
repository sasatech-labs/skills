---
id: arch-adapter-via-service
title: Handler層からのAdapter直接呼び出し禁止
category: アーキテクチャ
impact: HIGH
tags: [architecture, layers, adapter, service, handler]
---

## ルール

Handler層からAdapter層を直接呼び出さない。外部サービスとの連携は、Service層を経由する。

## NG例

```typescript
// src/features/payments/core/handler.ts
import 'server-only'

import { stripeAdapter } from '@/lib/adapters/stripe'
import { withHTTPError } from '@/lib/with-http-error'
import { AppResponse } from '@/lib/api-response'
import { paymentSchema } from './schema'

// NG: Handler層からAdapterを直接呼び出している
export const handleCreatePayment = withHTTPError(async (request) => {
  const body = await request.json()
  const input = paymentSchema.parse(body)

  // NG: Service層をバイパスしてAdapterを直接使用している
  const paymentIntent = await stripeAdapter.createPaymentIntent({
    amount: input.amount,
    currency: 'jpy',
  })

  return AppResponse.ok(paymentIntent)
})
```

## OK例

```typescript
// src/features/payments/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { withHTTPError } from '@/lib/with-http-error'
import { AppResponse } from '@/lib/api-response'
import { paymentSchema } from './schema'
import { createPayment } from './service'

// OK: Handler層はService層を呼び出す
export const handleCreatePayment = withHTTPError(async (request) => {
  const supabase = await createClient()
  const body = await request.json()
  const input = paymentSchema.parse(body)

  // OK: Service層を経由してAdapterを利用する
  const payment = await createPayment(supabase, input)
  return AppResponse.ok(payment)
})
```

```typescript
// src/features/payments/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { paymentRepository } from './repository'
import type { CreatePaymentInput } from './schema'

// OK: Service層でAdapterとRepositoryを連携する
export async function createPayment(
  supabase: SupabaseClient,
  input: CreatePaymentInput
) {
  // ビジネスロジック: 決済インテントの作成
  const paymentIntent = await stripeAdapter.createPaymentIntent({
    amount: input.amount,
    currency: 'jpy',
  })

  // データベースに決済記録を保存する
  await paymentRepository.create(supabase, {
    stripePaymentIntentId: paymentIntent.id,
    amount: input.amount,
    status: 'pending',
  })

  return paymentIntent
}
```

## 理由

Handler層からAdapter層を直接呼び出すことを禁止する理由は以下の通りである：

1. **ビジネスロジックの集約**: 外部サービス呼び出しにはビジネスルール（金額計算、権限チェック、データ保存）が伴う。Service層を経由することで、ビジネスロジックが一箇所に集約される
2. **エラーハンドリングと補償処理**: Service層で外部サービス呼び出しとデータベース操作を組み合わせることで、失敗時の補償処理（ロールバック、キャンセル）を実装できる。Handler層で直接呼び出すと、補償処理の実装場所が不明確になる
3. **テスタビリティ**: Service層のテストでAdapterをモックすることで、外部サービスに依存しないテストが可能になる。Handler層がAdapterに直接依存すると、テストの粒度が粗くなる

違反すると、ビジネスロジックがHandler層に漏洩し、レイヤーの責務分離が崩壊する。

## 参照

- [Adapter層ガイド](../guides/architecture/adapter.md)
- [arch-three-layers](arch-three-layers.md)
- [arch-external-services](arch-external-services.md)
