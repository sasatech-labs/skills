---
id: arch-adapter-placement
title: Adapterの配置基準
category: アーキテクチャ
impact: MEDIUM
tags: [architecture, adapter, feature, placement]
---

## ルール

Adapter層は用途に応じて適切な場所に配置する。複数Featureから利用する汎用Adapterは`src/lib/adapters/`に、特定Feature専用のAdapterは`src/features/{feature}/core/adapter.ts`に配置する。

## 判断基準

```
複数のFeatureから使用される？
  → YES: src/lib/adapters/ に配置
  → NO:
    Feature固有のビジネスロジックを含む？
      → YES: src/features/{feature}/core/adapter.ts に配置
      → NO: src/lib/adapters/ に配置
```

## 理由

Adapterの配置場所が不適切だと、責務の境界が曖昧になり保守性が低下する：

1. **責務の明確化**: 汎用Adapterは技術的ラッパーに専念し、Feature固有のAdapterはドメイン知識を含む。配置場所が責務を表現する
2. **依存関係の管理**: Feature固有のAdapterが`lib/adapters/`に配置されると、他のFeatureから誤って利用される可能性がある。Feature内に配置することで、スコープを明確にする
3. **変更の影響範囲**: Feature固有のAdapterはビジネス要件の変更に伴い頻繁に変更される。`lib/adapters/`に配置すると、変更の影響範囲が不明確になる

## OK例

**複数Featureから利用する汎用Adapterを共通ディレクトリに配置:**

```typescript
// src/lib/adapters/stripe/index.ts
// OK: 複数Featureから利用する汎用的なStripe連携
// 純粋な技術的ラッパーで、ビジネスロジックを含まない
export const stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency ?? 'jpy',
      })
      return { id: intent.id, amount: intent.amount, clientSecret: intent.client_secret! }
    } catch (error) {
      throw handleStripeError(error)
    }
  },
}
```

**Feature固有のビジネスロジックを含むAdapterをFeature内に配置:**

```typescript
// src/features/inventory/core/adapter.ts
// OK: 在庫Feature専用のAdapter
// Feature固有のビジネスロジック（在庫引当の優先順位計算）を含む
export const warehouseAdapter = {
  async allocateStock(input: StockAllocationInput) {
    const locations = await fetchWarehouseLocations(input.warehouseId)
    // Feature固有のビジネスルール
    const sorted = calculateAllocationPriority(locations, input.priority)
    // ...
  },
}
```

## NG例

**Feature固有のビジネスロジックを含むAdapterが共通ディレクトリに配置:**

```typescript
// src/lib/adapters/warehouse/index.ts
// NG: 在庫Feature専用のビジネスロジックを含むAdapterが共通ディレクトリに配置されている
export const warehouseAdapter = {
  // NG: Feature固有の在庫引当ロジックを含んでいる
  async allocateStock(input: StockAllocationInput) {
    const locations = await this.getLocations()
    // Feature固有のビジネスルール: 在庫引当の優先順位計算
    const sorted = calculateAllocationPriority(locations)
    // ...
  },
}
```

**汎用的な外部連携がFeature内に配置:**

```typescript
// src/features/payments/core/adapter.ts
// NG: 汎用的なStripe連携がFeature内に配置されている
// 他のFeature（サブスクリプション、寄付等）からも利用されるべき
export const stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput) {
    // ...
  },
}
```

## 参照

- [Adapter層ガイド](../guides/architecture/adapter.md)
- [arch-external-services](arch-external-services.md)
