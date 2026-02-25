---
id: arch-feature-adapter-isolation
title: Feature内Adapterのクロスフィーチャー依存禁止
category: アーキテクチャ
impact: MEDIUM
tags: [architecture, adapter, feature, isolation, dependency]
---

## ルール

Feature内のAdapterは、他のFeatureの内部Adapterに依存しない。共通処理のAdapter（`src/lib/adapters/`）のみをインポートする。

## 理由

Feature内のAdapterは内部実装であり、他のFeatureから直接参照することを禁止する理由は以下の通りである：

1. **Feature間の疎結合**: Feature内のAdapterは内部実装であり、公開APIではない。他のFeatureが直接依存すると、内部実装の変更がFeature境界を超えて波及する
2. **カプセル化の維持**: Featureの内部構造（Adapter, Repository）はService関数を通じてのみアクセスする。Adapterへの直接依存はカプセル化を破壊する
3. **依存方向の統一**: Feature間の依存はService関数（公開API）を経由するという原則を維持する。Adapter間の直接依存は、この原則に反する隠れた依存関係を作成する

違反すると、Feature間の暗黙的な結合が発生し、独立した変更やテストが困難になる。

## OK例

```typescript
// src/features/orders/core/adapter.ts
// OK: 共通処理のAdapterのみをインポートしている
import { stripeAdapter } from '@/lib/adapters/stripe'

export const orderPaymentAdapter = {
  async processPayment(amount: number) {
    // OK: 共通Adapterを利用している
    return stripeAdapter.createPaymentIntent({ amount, currency: 'jpy' })
  },
}
```

```typescript
// src/features/orders/core/service.ts
// OK: 他FeatureのService関数を経由してアクセスする
import { allocateStock } from '@/features/inventory/index.server'

export async function fulfillOrder(
  supabase: SupabaseClient,
  orderId: string
) {
  // OK: inventoryFeatureの公開APIであるService関数を経由する
  const allocation = await allocateStock(supabase, {
    orderId,
    priority: 'normal',
  })
  // ...
}
```

```typescript
// src/features/inventory/core/service.ts
// OK: 同一Feature内のAdapterは利用可能
import { warehouseAdapter } from './adapter'

export async function allocateStock(
  supabase: SupabaseClient,
  input: AllocateStockInput
) {
  // OK: 同じFeature内のAdapterを使用する
  return warehouseAdapter.allocateStock(input)
}
```

## NG例

```typescript
// src/features/orders/core/adapter.ts
// NG: 他のFeatureの内部Adapterをインポートしている
import { warehouseAdapter } from '@/features/inventory/core/adapter'

export const orderFulfillmentAdapter = {
  async fulfillOrder(orderId: string) {
    // NG: inventoryFeatureの内部実装に依存している
    const allocation = await warehouseAdapter.allocateStock({
      orderId,
      priority: 'normal',
    })
    // ...
  },
}
```

## 参照

- [Adapter層ガイド](../guides/architecture/adapter.md)
- [arch-adapter-placement](arch-adapter-placement.md)
- [arch-public-api](arch-public-api.md)
