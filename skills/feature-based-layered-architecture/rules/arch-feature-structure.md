---
id: arch-feature-structure
title: Feature モジュール構成
category: アーキテクチャ
impact: CRITICAL
tags: [architecture, feature, module, directory-structure]
---

## ルール

機能ごとに`features/`ディレクトリにモジュールを作成し、公開APIを`index.server.ts`と`index.client.ts`で制御する。

## NG例

機能が分散し、関連ファイルの把握が困難になる。

```text
src/
├── services/
│   ├── product-service.ts    # 製品のビジネスロジックが分散
│   └── user-service.ts
├── repositories/
│   ├── product-repository.ts  # 製品のデータアクセス層が分散
│   └── user-repository.ts
├── schemas/
│   ├── product-schema.ts      # 製品のスキーマが分散
│   └── user-schema.ts
└── types/
    ├── product-types.ts       # 製品の型定義が分散
    └── user-types.ts
```

## OK例

機能単位でまとめ、`index.server.ts`と`index.client.ts`で公開APIを制御する。

```text
src/features/
├── products/
│   ├── index.server.ts       # サーバー専用の公開API（Service, Handler）
│   ├── index.client.ts       # クライアント利用可の公開API（Fetcher, 型）
│   └── core/
│       ├── schema.ts         # 製品のスキーマ
│       ├── service.ts        # 製品のビジネスロジック
│       ├── repository.ts     # 製品のデータアクセス層
│       ├── fetcher.ts        # 製品のフェッチャー
│       └── hooks.ts          # 製品のフック
│
└── users/
    ├── index.server.ts       # サーバー専用の公開API
    ├── index.client.ts       # クライアント利用可の公開API
    ├── schema.ts             # ユーザーのスキーマ
    ├── service.ts            # ユーザーのビジネスロジック
    └── repository.ts         # ユーザーのデータアクセス層
```

## 理由

Feature単位のモジュール構成はアーキテクチャの根幹である。違反すると設計パターン自体が成立しない。

機能ごとにファイルを集約することで以下の利点がある:

- 関連するコードが同じディレクトリにあり、把握しやすい
- 機能の追加や削除が容易になる
- `index.server.ts`/`index.client.ts`による公開API制御で、内部実装の詳細を隠蔽できる
- 機能間の依存関係が明確になる

## 詳細

### 公開APIの制御

`index.server.ts`と`index.client.ts`で外部に公開するものを明示的に制御する。

```typescript
// src/features/products/index.server.ts
// サーバー専用のService関数とHandler関数をexport
import 'server-only'

export { getProducts, createProduct, updateProduct } from './core/service'
export { handleGetProducts, handleCreateProduct } from './core/handler'

// 内部実装はexportしない
```

```typescript
// src/features/products/index.client.ts
// クライアントでも使用可能なFetcher関数と型をexport
export { productsFetcher } from './core/fetcher'
export type { Product, CreateProductInput } from './core/schema'
```

```typescript
// 利用側（サーバー）
import { getProducts } from '@/features/products/index.server'  // OK

// 利用側（クライアント）
import type { Product } from '@/features/products/index.client'  // OK
```

### グループ化された機能

関連する複数の機能をグループ化する。

```text
src/features/products/
├── index.server.ts   # サーバー専用の公開API
├── index.client.ts   # クライアント利用可の公開API
├── core/             # 製品のコア機能
│   ├── schema.ts
│   ├── handler.ts
│   ├── service.ts
│   ├── repository.ts
│   ├── fetcher.ts
│   └── hooks.ts
├── reviews/          # レビュー機能
│   ├── schema.ts
│   ├── handler.ts
│   ├── service.ts
│   ├── repository.ts
│   ├── fetcher.ts
│   └── hooks.ts
└── inventory/        # 在庫機能
    └── ...
```

```typescript
// src/features/products/index.server.ts
import 'server-only'

export { getProducts, createProduct } from './core/service'
export { handleGetProducts, handleCreateProduct } from './core/handler'
export * as reviews from './reviews/service'
```

```typescript
// src/features/products/index.client.ts
export { productsFetcher } from './core/fetcher'
export type { Product, CreateProductInput } from './core/schema'
```

```typescript
// 利用側（サーバー）
import { getProducts, reviews } from '@/features/products/index.server'

const products = await getProducts(supabase)
const productReviews = await reviews.getReviews(supabase, productId)
```

### 単一機能の場合

サブ機能がない場合でも`core/`ディレクトリを使用する。

```text
src/features/auth/
├── index.server.ts
├── index.client.ts
└── core/
    ├── schema.ts
    ├── handler.ts
    ├── service.ts
    ├── repository.ts
    ├── fetcher.ts
    └── hooks.ts
```

### ディレクトリ命名

- **kebab-case**を使用する: `user-profile/`, `order-items/`
- 複数形を使用する: `products/`, `users/`（単数の機能でも）
