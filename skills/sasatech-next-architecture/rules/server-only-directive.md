---
id: server-only-directive
title: server-only ディレクティブ必須
category: サーバーサイド保護
impact: HIGH
tags: [server, security, next-js, bundling]
---

## ルール

Service層とRepository層のファイルには必ず `import 'server-only'` を記述する。

## NG例

```typescript
// src/features/products/service.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'

// NG: server-onlyがないため、このファイルがクライアントにバンドルされる可能性がある
export async function getProducts(supabase: SupabaseClient) {
  return productRepository.findMany(supabase)
}
```

## OK例

```typescript
// src/features/products/service.ts
import 'server-only'  // OK: server-onlyを記述し、ビルド時に誤使用を検出する

import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'

export async function getProducts(supabase: SupabaseClient) {
  return productRepository.findMany(supabase)
}
```

```typescript
// src/features/products/repository.ts
import 'server-only'  // OK: Repository層でもserver-onlyを記述する

import type { SupabaseClient } from '@supabase/supabase-js'

export const productRepository = {
  async findMany(supabase: SupabaseClient) {
    // ...
  },
}
```

```typescript
// src/app/api/products/route.ts
import 'server-only'  // OK: API RouteでもServer-onlyを記述する

import { getProducts } from '@/features/products/service'

export async function GET() {
  // ...
}
```

## 理由

`server-only`を記述することで、サーバー専用コードのクライアントバンドルへの混入を防ぐ。`server-only`をインポートしたファイルをクライアントコンポーネントからインポートすると、ビルド時にエラーが発生する。これにより、機密情報の漏洩やバンドルサイズの肥大化を防止できる。

server-onlyを欠如させると、サーバー専用コードがクライアントに混入し、整合性を大きく損なう。

## 対象ファイル

| ファイル | server-only |
|---------|-------------|
| `service.ts` | 必須 |
| `repository.ts` | 必須 |
| API Route (`route.ts`) | 必須 |
| `schema.ts` | 不要（フロントエンドでも使用） |
| `fetcher.ts` | 不要（クライアント専用） |
| `hooks.ts` | 不要（クライアント専用） |

## 検出方法

`server-only`をインポートしたファイルをクライアントコンポーネントからインポートすると、ビルド時に以下のエラーが発生する:

```
Error: You're importing a component that needs server-only.
This only works in Server Components.
```

## セットアップ

```bash
npm install server-only
```
