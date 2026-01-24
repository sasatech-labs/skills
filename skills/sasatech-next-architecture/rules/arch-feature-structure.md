---
title: Feature モジュール構成
impact: HIGH
impactDescription: 機能単位でのコード管理、依存関係の明確化
tags: architecture, feature, module, directory-structure
---

## Feature モジュール構成

機能ごとに `features/` ディレクトリにモジュールを作成し、公開 API を `index.ts` で制御する。

**Incorrect (機能が分散、関連ファイルの把握が困難):**

```
src/
├── services/
│   ├── product-service.ts
│   └── user-service.ts
├── repositories/
│   ├── product-repository.ts
│   └── user-repository.ts
├── schemas/
│   ├── product-schema.ts
│   └── user-schema.ts
└── types/
    ├── product-types.ts
    └── user-types.ts
```

**Correct (機能単位でまとめ、index.ts で公開 API を制御):**

```
src/features/
├── products/
│   ├── index.ts# 公開API
│   ├── core/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   ├── service.ts
│   │   └── repository.ts
│   ├── fetcher.ts
│   └── hooks.ts
│
└── users/
    ├── index.ts
    ├── schema.ts
    ├── service.ts
    └── repository.ts
```

## 公開 API の制御

`index.ts` で外部に公開するものを明示的に制御:

```typescript
// src/features/products/index.ts
// 公開するもののみ export
export { getProducts, createProduct, updateProduct } from './core/service'
export type { Product, CreateProductInput } from './core/schema'

// 内部実装は export しない
// repository は外部から直接アクセスさせない
```

```typescript
// 利用側
import { getProducts, Product } from '@/features/products'  // OK

// import { productRepository } from '@/features/products'  // 公開されていない
```

## グループ化された機能

関連する複数の機能をグループ化:

```
src/features/products/
├── index.ts          # 親機能の公開API
├── core/             # 製品のコア機能
│   ├── index.ts
│   ├── schema.ts
│   ├── service.ts
│   └── repository.ts
├── reviews/          # レビュー機能
│   ├── index.ts
│   ├── schema.ts
│   ├── service.ts
│   └── repository.ts
├── inventory/        # 在庫機能
│   └── ...
├── fetcher.ts        # 共通のフェッチャー
└── hooks.ts          # 共通のフック
```

```typescript
// src/features/products/index.ts
export * from './core'
export * as reviews from './reviews'
export * as inventory from './inventory'
```

```typescript
// 利用側
import { getProducts, reviews } from '@/features/products'

const products = await getProducts(supabase)
const productReviews = await reviews.getReviews(supabase, productId)
```

## 単一機能の場合

サブ機能がない場合は `core/` を省略:

```
src/features/auth/
├── index.ts
├── schema.ts
├── service.ts
├── repository.ts
├── fetcher.ts
└── hooks.ts
```

## ディレクトリ命名

- **kebab-case** を使用: `user-profile/`, `order-items/`
- 複数形を使用: `products/`, `users/`（単数の機能でも）
