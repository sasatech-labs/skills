---
title: server-only はテスト環境でモック必須
impact: HIGH
impactDescription: テスト実行の前提条件
tags: testing, server-only, setup
---

## server-only はテスト環境でモック必須

`server-only` パッケージはテスト環境では無効化が必要。

**Incorrect (モックなし、テスト実行時にエラー):**

```typescript
// vitest.setup.ts
// server-only のモックがない

// テスト実行時
// Error: This module cannot be imported from a Client Component module.
```

**Correct (vitest.setup.ts でグローバルにモック):**

```typescript
// vitest.setup.ts
import { vi } from 'vitest'

// server-only を無効化
vi.mock('server-only', () => ({}))
```

## なぜ必要か

`server-only` パッケージは、サーバー専用コードがクライアントにバンドルされることを防ぐ。テスト環境は Node.js で実行されるため、この制約を無効化する必要がある。

```typescript
// src/features/products/core/service.ts
import 'server-only'  // ← テスト時にエラーになる

export async function getProducts(supabase: SupabaseClient) {
  // ...
}
```

## 推奨セットアップ

```typescript
// vitest.setup.ts
import { vi } from 'vitest'

// server-only のモック（必須）
vi.mock('server-only', () => ({}))

// Supabase クライアントのグローバルモック（オプション）
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
```

## Vitest 設定

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],  // ← 必ず指定
    // ...
  },
})
```

## 注意点

- `vitest.setup.ts` は**すべてのテストファイルより前**に実行される
- 個別のテストファイルでモックする必要はない
- CI 環境でも同じセットアップが適用される
