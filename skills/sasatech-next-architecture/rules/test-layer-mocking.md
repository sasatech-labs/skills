---
title: 各レイヤーは直下の依存のみをモック
impact: HIGH
impactDescription: テストの独立性と保守性を確保
tags: testing, mocking, layers
---

## 各レイヤーは直下の依存のみをモック

テスト対象レイヤーの直下の依存のみをモックする。

**Incorrect (Service テストで Supabase を直接モック、責務が不明確):**

```typescript
// Service のテストで Supabase を直接モック
// Repository を飛び越えている
import { getProducts } from '../core/service'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server')

it('商品一覧を返す', async () => {
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [...], error: null }),
    }),
  })

  const result = await getProducts(mockSupabase)
})
```

**Correct (Service テストでは Repository をモック):**

```typescript
// Service のテストでは Repository をモック
import { getProducts } from '../core/service'
import { productRepository } from '../core/repository'

vi.mock('../core/repository')

it('商品一覧を返す', async () => {
  // 直下の依存（Repository）をモック
  vi.mocked(productRepository.findMany).mockResolvedValue([
    { id: '1', name: 'Product A' },
  ])

  const result = await getProducts(mockSupabase)
  expect(result).toEqual([{ id: '1', name: 'Product A' }])
})
```

## モック対象の対応表

| テスト対象 | モック対象 | モックしない |
|-----------|-----------|-------------|
| Handler | Service | Repository, Supabase |
| Service | Repository | Supabase |
| Repository | Supabase Client | - |

## 理由

1. **テストの独立性** - 各レイヤーを独立して検証できる
2. **保守性** - 下位レイヤーの実装変更がテストに影響しない
3. **明確な責務** - 各テストが何を検証しているか明確

## 例外

統合テストでは複数レイヤーを跨いでテストすることがある:

```typescript
// E2E や統合テストでは複数レイヤーを通す
describe('Products Integration', () => {
  it('API から DB まで一貫して動作する', async () => {
    // テスト用 DB を使用、モックなし
  })
})
```
