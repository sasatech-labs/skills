---
id: naming-files
title: ファイル・ディレクトリ命名規則
category: 命名規則
impact: LOW
tags: [naming, files, directory, convention, kebab-case]
---

## ルール

すべてのファイル名・ディレクトリ名は **kebab-case** を使用する。

## 理由

### 一貫性の確保

ファイル名とディレクトリ名を kebab-case に統一することで、以下の利点がある。

1. **可読性の向上**: プロジェクト全体で統一された命名規則により、ファイル検索とナビゲーションが容易になる
2. **クロスプラットフォーム互換性**: macOS は大文字小文字を区別しない場合があるが、Linux は区別する。kebab-case の使用により、プラットフォーム間での問題を回避できる
3. **URL との整合性**: Next.js のファイルベースルーティングでは、ファイル名が URL パスになる。kebab-case は URL の一般的な規約と一致する
4. **開発体験の向上**: 混在したケーススタイル（PascalCase、snake_case、camelCase）を避けることで、チーム全体の認知負荷を軽減する

### 違反時の影響

- コードベース全体での一貫性が損なわれる
- 新規メンバーが既存のパターンを理解しにくくなる
- ファイル検索時に予測可能性が低下する

## OK例

すべての命名を kebab-case に統一する。

```plaintext
# ディレクトリ名を kebab-case に統一
src/features/
├── user-profile/             # kebab-case - OK
├── order-items/              # kebab-case - OK
└── product-reviews/          # kebab-case - OK

# ファイル名を kebab-case に統一
src/components/
├── user-card.tsx             # kebab-case - OK
└── product-list.tsx          # kebab-case - OK
```

### ファイル種別ごとの規則

| 種類 | 規則 | 例 |
|------|------|-----|
| コンポーネント | kebab-case | `user-profile.tsx` |
| Hook | kebab-case | `use-auth.ts` |
| ユーティリティ | kebab-case | `format-date.ts` |
| Schema | kebab-case | `schema.ts` |
| Service | kebab-case | `service.ts` |
| Repository | kebab-case | `repository.ts` |
| テスト | 元ファイル名 + `.test` | `service.test.ts` |

### ディレクトリ規則

| 種類 | 規則 | 例 |
|------|------|-----|
| Feature | kebab-case + 複数形 | `products/`, `user-profiles/` |
| Route Group | (kebab-case) | `(auth)/`, `(public)/` |
| API Route | kebab-case | `api/user-posts/` |
| コンポーネント | kebab-case | `components/server/`, `components/client/` |

### 例: Feature ディレクトリ

```plaintext
src/features/products/
├── index.server.ts          # サーバー専用の公開API
├── index.client.ts          # クライアント利用可の公開API
├── core/
│   ├── schema.ts            # 単数形
│   ├── handler.ts           # 単数形
│   ├── service.ts           # 単数形
│   ├── repository.ts        # 単数形
│   ├── fetcher.ts           # 単数形
│   └── hooks.ts             # 単数形
└── components/
    ├── server/
    │   └── product-list.tsx
    └── client/
        └── product-form.tsx
```

### 例: API Route

```plaintext
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

### コンポーネント内のエクスポート名

ファイル名は kebab-case、エクスポートする関数・コンポーネントは PascalCase とする。

```typescript
// src/features/products/components/product-card.tsx
export function ProductCard({ product }: ProductCardProps) {
  // コンポーネント名は PascalCase で記述
}
```

## NG例

PascalCase/snake_case/camelCase が混在する命名は避ける。

```plaintext
# ディレクトリ名が統一されていない
src/features/
├── UserProfile/              # PascalCase - NG
├── order_items/              # snake_case - NG
└── productReviews/           # camelCase - NG

# ファイル名が統一されていない
src/components/
├── UserCard.tsx              # PascalCase - NG
└── productList.tsx           # camelCase - NG
```

## 例外

フレームワークが特定の命名規則を要求する場合は、この限りではない。

### Next.js の規約ファイル

Next.js App Router では、以下の特殊ファイルはフレームワークの規約に従う。

```plaintext
src/app/
├── layout.tsx              # ルートレイアウト
├── page.tsx                # トップページ
├── error.tsx               # エラーハンドリング
├── loading.tsx             # ローディング状態
├── not-found.tsx           # 404ページ
├── middleware.ts           # ミドルウェア
└── products/
    ├── layout.tsx
    ├── page.tsx
    └── [id]/
        └── page.tsx
```

これらのファイルは、Next.js が特定の名前を期待するため、kebab-case ルールの適用外とする。

### Dynamic Routing

Next.js の動的ルーティングでは、角括弧 `[]` を使用したディレクトリ名はフレームワークの規約に従う。

```plaintext
src/app/
├── products/
│   └── [id]/               # 動的ルートセグメント
│       └── page.tsx
├── blog/
│   └── [slug]/             # 動的ルートセグメント
│       └── page.tsx
├── docs/
│   └── [...slug]/          # Catch-all セグメント
│       └── page.tsx
└── shop/
    └── [[...slug]]/        # Optional catch-all セグメント
        └── page.tsx
```

角括弧内のパラメータ名（`id`、`slug` など）は、単一の単語を使用することを推奨する。複数単語が必要な場合は camelCase を使用する（例: `[userId]/`、`[postId]/`）。
