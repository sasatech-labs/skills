---
id: test-server-only
title: server-only はテスト環境でモック必須
category: テスト
impact: MEDIUM
tags: [testing, server-only, setup]
---

## ルール

`server-only`パッケージはテスト環境で無効化する。`vitest.setup.ts`でグローバルにモックする。

## NG例

```typescript
// vitest.setup.ts
// server-only のモックがない

// テスト実行時にエラーが発生する
// Error: This module cannot be imported from a Client Component module.
```

## OK例

```typescript
// vitest.setup.ts
import { vi } from 'vitest'

// server-only を無効化する
vi.mock('server-only', () => ({}))
```

## 理由

`server-only`パッケージは、サーバー専用コードがクライアントにバンドルされることを防ぐ。テスト環境はNode.jsで実行されるため、この制約を無効化する必要がある。モックを設定しないとテスト実行時にエラーが発生し、コード品質と一貫性が低下する。

```typescript
// src/features/products/core/service.ts
import 'server-only'  // テスト時にエラーになる

export async function getProducts(supabase: SupabaseClient) {
  // ...
}
```

## 推奨セットアップ

```typescript
// vitest.setup.ts
import { vi } from 'vitest'

// server-only のモック(必須)
vi.mock('server-only', () => ({}))

// Supabaseクライアントのグローバルモック(オプション)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
```

## Vitest設定

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],  // 必ず指定する
    // ...
  },
})
```

## 注意点

- `vitest.setup.ts`はすべてのテストファイルより前に実行される
- 個別のテストファイルでモックする必要はない
- CI環境でも同じセットアップが適用される
