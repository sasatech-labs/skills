---
title: ファイル・ディレクトリ命名規則
impact: LOW
impactDescription: ファイル命名規則の統一は開発体験・パターンの統一に関する推奨事項
tags: naming, files, directory, convention
---

## ファイル・ディレクトリ命名規則

すべてのファイル名・ディレクトリ名は **kebab-case** を使用する。

**NG (PascalCase/snake_case/camelCase が混在):**

```
src/features/
├── UserProfile/              # PascalCase
├── order_items/              # snake_case
└── productReviews/           # camelCase

src/components/
├── UserCard.tsx              # PascalCase
└── productList.tsx           # camelCase
```

**OK (全て kebab-case で統一):**

```
src/features/
├── user-profile/             # kebab-case
├── order-items/              # kebab-case
└── product-reviews/          # kebab-case

src/components/
├── user-card.tsx             # kebab-case
└── product-list.tsx          # kebab-case
```

## ファイル種別ごとの規則

| 種類 | 規則 | 例 |
|------|------|-----|
| コンポーネント | kebab-case | `user-profile.tsx` |
| Hook | kebab-case | `use-auth.ts` |
| ユーティリティ | kebab-case | `format-date.ts` |
| Schema | kebab-case | `schema.ts` |
| Service | kebab-case | `service.ts` |
| Repository | kebab-case | `repository.ts` |
| テスト | 元ファイル名 + `.test` | `service.test.ts` |

## ディレクトリ規則

| 種類 | 規則 | 例 |
|------|------|-----|
| Feature | kebab-case + 複数形 | `products/`, `user-profiles/` |
| Route Group | (kebab-case) | `(auth)/`, `(public)/` |
| API Route | kebab-case | `api/user-posts/` |
| コンポーネント | kebab-case | `components/server/`, `components/client/` |

## 例: Feature ディレクトリ

```
src/features/products/
├── index.ts
├── core/
│   ├── index.ts
│   ├── schema.ts            # 単数形
│   ├── service.ts           # 単数形
│   └── repository.ts        # 単数形
├── components/
│   ├── server/
│   │   └── product-list.tsx
│   └── client/
│       └── product-form.tsx
├── fetcher.ts
└── hooks.ts
```

## 例: API Route

```
src/app/api/
├── products/
│   ├── route.ts              # GET /api/products, POST /api/products
│   └── [id]/
│       ├── route.ts          # GET/PATCH/DELETE /api/products/[id]
│       └── reviews/
│           └── route.ts      # GET /api/products/[id]/reviews
└── user-settings/
    └── route.ts              # GET/PATCH /api/user-settings
```

## コンポーネント内のエクスポート名

ファイル名は kebab-case、エクスポートする関数・コンポーネントは PascalCase:

```typescript
// src/features/products/components/product-card.tsx
export function ProductCard({ product }: ProductCardProps) {
  // ...
}
```
