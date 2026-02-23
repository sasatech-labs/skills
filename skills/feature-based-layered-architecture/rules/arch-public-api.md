---
id: arch-public-api
title: Feature公開APIの管理
category: アーキテクチャ
impact: MEDIUM
tags: [architecture, feature, module, exports, public-api]
---

## ルール

Featureの`index.ts`は公開API（Service関数、Handler関数、Fetcher関数、型）のみをexportする。Repository、Adapter、内部実装はexportしない。

## NG例

```typescript
// src/features/products/index.ts
// NG: RepositoryやAdapterを外部に公開している
export { getProducts, createProduct } from './core/service'
export { handleGetProducts, handleCreateProduct } from './core/handler'
export { productRepository } from './core/repository'  // NG: 内部実装の公開
export { stripeAdapter } from './core/adapter'          // NG: 内部実装の公開
export type { Product, CreateProductInput } from './core/schema'
```

```typescript
// NG: 他のFeatureからRepositoryを直接参照
// src/features/orders/core/service.ts
import { productRepository } from '@/features/products'  // NG: Feature境界を越えた内部参照

export async function createOrder(supabase: SupabaseClient, input: CreateOrderInput) {
  // 他のFeatureのRepositoryを直接呼び出している
  const product = await productRepository.findById(supabase, input.productId)
  // ...
}
```

## OK例

```typescript
// src/features/products/index.ts
// OK: Service関数、Handler関数、Fetcher関数、型のみをexport
export { getProducts, getProduct, createProduct, updateProduct, deleteProduct } from './core/service'
export { handleGetProducts, handleGetProduct, handleCreateProduct, handleUpdateProduct, handleDeleteProduct } from './core/handler'
export { productsFetcher } from './core/fetcher'
export type { Product, CreateProductInput, UpdateProductInput } from './core/schema'

// Repository、Adapter、内部実装はexportしない
```

```typescript
// OK: 他のFeatureからはService関数を経由する
// src/features/orders/core/service.ts
import { getProduct } from '@/features/products'  // OK: 公開APIのService関数を使用

export async function createOrder(supabase: SupabaseClient, input: CreateOrderInput) {
  // 公開されたService関数を呼び出す
  const product = await getProduct(supabase, input.productId)
  // ...
}
```

## 理由

公開APIを制御することで、以下の効果がある：

1. **カプセル化**: 内部実装の変更がFeature外に影響しない
2. **依存関係の明確化**: Feature間の依存がService関数と型に限定され、依存グラフが明確になる
3. **リファクタリングの安全性**: Repository構造やAdapter実装を変更しても、公開APIが変わらなければ他のFeatureに影響しない

内部実装を公開すると、Feature間の結合度が高まり、変更の影響範囲が予測困難になる。

## 公開APIの構成

| 公開対象 | 理由 |
|----------|------|
| Service関数 | 他のFeatureから呼び出すため（サーバーサイド） |
| Handler関数 | API Routeから呼び出すため |
| Fetcher関数 | SSR page.tsxやCSR hooks.tsから呼び出すため |
| 型（Schema由来） | コンポーネントや他のFeatureで型として使用するため |

| 非公開対象 | 理由 |
|------------|------|
| Repository | データアクセスの詳細はFeature内部に閉じる |
| Adapter | 外部サービス連携の詳細はFeature内部に閉じる |
| 内部ヘルパー関数 | 実装の詳細はFeature内部に閉じる |

## 参照

- [architecture.md](../guides/architecture.md) - アーキテクチャ概要ガイド
- [arch-feature-structure](arch-feature-structure.md) - Featureモジュール構成ルール
- [naming-exports](naming-exports.md) - Export戦略ルール
