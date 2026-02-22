---
id: test-layer-mocking
title: 各レイヤーは直下の依存のみをモック
category: テスト
impact: HIGH
tags: [testing, mocking, layers]
---

## ルール

テスト対象レイヤーの直下の依存のみをモックする。レイヤーを跨いだモックは禁止。

## NG例

```typescript
// Service のテストで Supabase を直接モック
// Repository を飛び越えている
import { getProducts } from '../core/service'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server')

it('商品一覧を返す', async () => {
  // NG: Service テストが Repository を経由せず Supabase を直接モック
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [...], error: null }),
    }),
  })

  const result = await getProducts(mockSupabase)
})
```

## OK例

```typescript
// Service のテストでは Repository をモック
import { getProducts } from '../core/service'
import { productRepository } from '../core/repository'

vi.mock('../core/repository')

it('商品一覧を返す', async () => {
  // OK: 直下の依存（Repository）をモック
  vi.mocked(productRepository.findMany).mockResolvedValue([
    { id: '1', name: 'Product A' },
  ])

  const result = await getProducts(mockSupabase)
  expect(result).toEqual([{ id: '1', name: 'Product A' }])
})
```

### モック対象の対応表

| テスト対象 | モック対象 | モックしない |
|-----------|-----------|-------------|
| Handler | Service | Repository, Adapter, Supabase |
| Service | Repository, Adapter | Supabase |
| Repository | Supabase Client | - |
| Adapter | 外部APIクライアント | - |

## 理由

レイヤーを跨いだモックは、テストの独立性が崩壊し、3層構成の保守性を大きく損なう。

1. **テストの独立性** - 各レイヤーを独立して検証できる
2. **保守性** - 下位レイヤーの実装変更がテストに影響しない
3. **明確な責務** - 各テストが何を検証しているか明確になる

## 例外

統合テストでは複数レイヤーを跨いでテストする。

```typescript
// E2E や統合テストでは複数レイヤーを通す
describe('Products Integration', () => {
  it('API から DB まで一貫して動作する', async () => {
    // テスト用 DB を使用、モックなし
  })
})
```
