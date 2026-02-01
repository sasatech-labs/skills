---
id: arch-feature-structure
title: Feature モジュール構成
category: アーキテクチャ
impact: CRITICAL
tags: [architecture, feature, module, directory-structure]
---

## ルール

機能ごとに`features/`ディレクトリにモジュールを作成し、公開APIを`index.ts`で制御する。

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

機能単位でまとめ、`index.ts`で公開APIを制御する。

```text
src/features/
├── products/
│   ├── index.ts              # 公開APIを制御
│   ├── core/
│   │   ├── index.ts
│   │   ├── schema.ts         # 製品のスキーマ
│   │   ├── service.ts        # 製品のビジネスロジック
│   │   └── repository.ts     # 製品のデータアクセス層
│   ├── fetcher.ts            # 製品のフェッチャー
│   └── hooks.ts              # 製品のフック
│
└── users/
    ├── index.ts              # 公開APIを制御
    ├── schema.ts             # ユーザーのスキーマ
    ├── service.ts            # ユーザーのビジネスロジック
    └── repository.ts         # ユーザーのデータアクセス層
```

## 理由

Feature単位のモジュール構成はアーキテクチャの根幹である。違反すると設計パターン自体が成立しない。

機能ごとにファイルを集約することで以下の利点がある:

- 関連するコードが同じディレクトリにあり、把握しやすい
- 機能の追加や削除が容易になる
- `index.ts`による公開API制御で、内部実装の詳細を隠蔽できる
- 機能間の依存関係が明確になる

## 詳細

### 公開APIの制御

`index.ts`で外部に公開するものを明示的に制御する。

```typescript
// src/features/products/index.ts
// 公開するもののみexport
export { getProducts, createProduct, updateProduct } from './core/service'
export type { Product, CreateProductInput } from './core/schema'

// 内部実装はexportしない
// repositoryは外部から直接アクセスさせない
```

```typescript
// 利用側
import { getProducts, Product } from '@/features/products'  // OK

// import { productRepository } from '@/features/products'  // 公開されていないためエラー
```

### グループ化された機能

関連する複数の機能をグループ化する。

```text
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

### 単一機能の場合

サブ機能がない場合は`core/`を省略する。

```text
src/features/auth/
├── index.ts
├── schema.ts
├── service.ts
├── repository.ts
├── fetcher.ts
└── hooks.ts
```

### ディレクトリ命名

- **kebab-case**を使用する: `user-profile/`, `order-items/`
- 複数形を使用する: `products/`, `users/`（単数の機能でも）
