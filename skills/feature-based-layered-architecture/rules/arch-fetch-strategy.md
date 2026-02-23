---
id: arch-fetch-strategy
title: SSR/CSR データ取得戦略
category: アーキテクチャ
impact: CRITICAL
tags: [architecture, ssr, csr, data-fetching, server-components]
---

## ルール

SSR/CSR問わず、fetcher.ts経由でAPI Routeを呼び出す。Server ComponentからService層を直接呼び出さない。

## NG例

### Server ComponentからService直接呼び出し

```typescript
// src/app/(auth)/products/[id]/page.tsx
import { getProduct } from '@/features/products/index.server'
import { createClient } from '@/lib/supabase/server'

// NG: Server ComponentからService層を直接呼び出している
export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const product = await getProduct(supabase, params.id)

  return <ProductDetail product={product} />
}
```

### Server ComponentからHandler関数を呼び出す

```typescript
// src/app/(auth)/products/[id]/page.tsx
import { handleGetProduct } from '@/features/products/index.server'

// NG: Server ComponentからHandler関数を呼び出している
export default async function ProductPage({ params }: { params: { id: string } }) {
  const response = await handleGetProduct(params.id)
  const product = await response.json()

  return <ProductDetail product={product} />
}
```

## OK例

### SSR: Server Componentからfetcher経由でAPI Route呼び出し

```typescript
// src/features/products/core/fetcher.ts
import { fetchData } from '@/lib/fetcher'
import type { Product } from './schema'

export const productsFetcher = {
  getById(id: string): Promise<Product> {
    return fetchData<Product>(`/api/products/${id}`)
  },
}
```

```typescript
// src/app/(auth)/products/[id]/page.tsx
import { productsFetcher } from '@/features/products/index.client'

// OK: SSRでもfetcher経由でAPI Routeを呼び出す
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await productsFetcher.getById(params.id)

  return <ProductDetail product={product} />
}
```

### CSR: hooks.ts → fetcher.ts → API Route → Handler → Service

```typescript
// src/features/products/core/hooks.ts
'use client'

import useSWR from 'swr'
import { productsFetcher } from './fetcher'

// OK: CSRではSWR Hook → fetcher → API Route経由でデータを取得
export function useProduct(id: string) {
  const { data, error, isLoading } = useSWR(
    id ? ['product', id] : null,
    () => productsFetcher.getById(id)
  )

  return { product: data, isLoading, error }
}
```

## 理由

SSRとCSRでデータ取得経路を統一する理由は以下の通りである：

1. **経路の統一**: SSR/CSR共通でfetcher → API Route → Handler → Serviceの経路を使用する。データフローが一貫し、理解しやすい
2. **Handler層の一元化**: バリデーション、楽観的認証、エラーハンドリングがHandler層に集約される。Service層はビジネスロジックに専念する
3. **API Routeの活用**: SSRでもAPI Routeを経由することで、すべてのデータアクセスがAPI Routeを通る。監視やログの一元化が容易になる

## 判定基準

| 条件 | 戦略 | 経路 |
|------|------|------|
| ページ表示時点でデータが確定する | SSR | page.tsx → fetcher.ts → route.ts → handler.ts → service.ts |
| ユーザー操作に応じてデータが変化する | CSR | hooks.ts → fetcher.ts → route.ts → handler.ts → service.ts |

## 参照

- [データ取得戦略](../guides/fetch-strategy.md)
- [arch-three-layers](arch-three-layers.md)
