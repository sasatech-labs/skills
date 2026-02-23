---
id: arch-no-direct-layer-exports
title: Repository/Adapterの直接export禁止
category: アーキテクチャ
impact: HIGH
tags: [architecture, layers, exports, service, repository, adapter]
---

## ルール

Featureの公開API（`index.server.ts`/`index.client.ts`）からRepository/Adapterを直接exportしない。外部からのデータアクセスや外部サービス連携は、Service関数を経由して公開する。

## NG例

```typescript
// src/features/products/index.server.ts
import 'server-only'

// NG: Repositoryを直接exportしている
export { productRepository } from './core/repository'

// NG: Adapterを直接exportしている
export { productSearchAdapter } from './core/adapter'
```

```typescript
// src/features/orders/core/service.ts
// NG: 他のFeatureのRepositoryを直接使用している
import { productRepository } from '@/features/products/index.server'

export async function createOrder(supabase: SupabaseClient, input: CreateOrderInput) {
  // NG: Repositoryを直接呼び出してService層をバイパスしている
  const product = await productRepository.findById(supabase, input.productId)
  // ...
}
```

## OK例

```typescript
// src/features/products/index.server.ts
import 'server-only'

// OK: Service関数とHandler関数のみをexportしている
export { getProducts, getProductById, createProduct } from './core/service'
export { handleGetProducts, handleCreateProduct } from './core/handler'
```

```typescript
// src/features/products/index.client.ts
// OK: Fetcher関数と型をexportしている
export { productsFetcher } from './core/fetcher'
export type { Product, CreateProductInput } from './core/schema'
```

```typescript
// src/features/orders/core/service.ts
// OK: 他のFeatureのService関数を経由してアクセスしている
import { getProductById } from '@/features/products/index.server'

export async function createOrder(supabase: SupabaseClient, input: CreateOrderInput) {
  // OK: Service関数を経由してデータを取得する
  const product = await getProductById(supabase, input.productId)
  // ...
}
```

## 理由

Repository/Adapterの直接exportを禁止する理由は以下の通りである：

1. **レイヤー境界の維持**: Repositoryを直接exportすると、Service層のバリデーション、認可、ビジネスルールをバイパスできる。Service関数を経由することで、レイヤーの責務分離を保証する
2. **変更の影響範囲の限定**: Repositoryの内部実装（テーブル構造、クエリ方法）が変更された場合、直接利用している全箇所に影響する。Service関数を経由していれば、内部実装の変更はFeature内で吸収できる
3. **Feature間の疎結合**: 他のFeatureがRepositoryに直接依存すると、データベーススキーマの変更がFeature境界を超えて波及する。Service関数を公開APIとすることで、Feature間の依存を最小化する

違反すると、レイヤー構成の意味が失われ、Feature間の密結合を引き起こす。

## 参照

- [Service層ガイド](../guides/architecture/service.md)
- [arch-public-api](arch-public-api.md)
- [arch-three-layers](arch-three-layers.md)
