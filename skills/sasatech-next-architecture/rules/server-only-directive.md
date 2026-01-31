---
title: server-only ディレクティブ必須
impact: HIGH
impactDescription: server-only欠如はサーバー専用コードのクライアント混入を招き、整合性を大きく損なう
tags: server, security, next-js, bundling
---

## server-only ディレクティブ必須

Service層とRepository層のファイルには必ず `import 'server-only'` を記述する。

**NG (クライアントバンドルに混入する可能性):**

```typescript
// src/features/products/service.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'

// このファイルがクライアントにバンドルされる可能性がある
export async function getProducts(supabase: SupabaseClient) {
  return productRepository.findMany(supabase)
}
```

**OK (server-only でビルド時に誤使用を検出):**

```typescript
// src/features/products/service.ts
import 'server-only'  // ← 必須

import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'

export async function getProducts(supabase: SupabaseClient) {
  return productRepository.findMany(supabase)
}
```

```typescript
// src/features/products/repository.ts
import 'server-only'  // ← 必須

import type { SupabaseClient } from '@supabase/supabase-js'

export const productRepository = {
  async findMany(supabase: SupabaseClient) {
    // ...
  },
}
```

## server-only を付けるファイル

| ファイル | server-only |
|---------|-------------|
| `service.ts` | 必須 |
| `repository.ts` | 必須 |
| `schema.ts` | 付けない（フロントエンドでも使用） |
| `fetcher.ts` | 付けない（クライアント専用） |
| `hooks.ts` | 付けない（クライアント専用） |
| API Route (`route.ts`) | 必須 |

## セットアップ

```bash
npm install server-only
```

## 効果

`server-only` をインポートしたファイルをクライアントコンポーネントからインポートすると、ビルド時にエラーが発生する:

```
Error: You're importing a component that needs server-only.
This only works in Server Components.
```
