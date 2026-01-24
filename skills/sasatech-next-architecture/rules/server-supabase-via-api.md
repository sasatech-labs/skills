---
title: クライアントから Supabase 直接使用禁止
impact: CRITICAL
impactDescription: セキュリティとアーキテクチャの一貫性を確保
tags: server, security, supabase, architecture
---

## クライアントから Supabase 直接使用禁止

クライアントコンポーネントから Supabase を直接使用しない。必ず API Route を経由する。

**Incorrect (環境変数がクライアントに露出):**

```typescript
// src/features/products/components/product-list.tsx
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function ProductList() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // クライアントから直接 Supabase にアクセス
  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*')
    return data
  }

  // ...
}
```

**Correct (Hook + Fetcher + API Route でデータ取得):**

```typescript
// src/features/products/components/product-list.tsx
'use client'

import { useProducts } from '../hooks'

export function ProductList() {
  // API Route を経由してデータ取得
  const { products, isLoading, error } = useProducts()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

```typescript
// src/features/products/hooks.ts
'use client'

import useSWR from 'swr'
import { productsFetcher } from './fetcher'

export function useProducts() {
  const { data, error, isLoading } = useSWR(
    '/api/products',
    () => productsFetcher.getAll()
  )

  return {
    products: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    error,
  }
}
```

```typescript
// src/features/products/fetcher.ts
import { fetchPaginated } from '@/lib/fetcher'
import type { Product } from './core/schema'

export const productsFetcher = {
  getAll(page = 1, limit = 20) {
    return fetchPaginated<Product>(`/api/products?page=${page}&limit=${limit}`)
  },
}
```

## データフロー

```
クライアント (React Component)
    ↓ fetch('/api/products')
API Route (Handler層)
    ↓ createClient()
Service層
    ↓
Repository層
    ↓ supabase.from('products')...
Supabase
```

## 理由

1. **セキュリティ**: 環境変数をクライアントに露出しない
2. **一貫性**: Handler → Service → Repository の3層を維持
3. **バリデーション**: サーバーサイドで入力検証を行える
4. **ログ**: サーバーサイドでリクエストを記録できる
5. **キャッシュ**: サーバーサイドでキャッシュ戦略を制御できる

## 例外

認証フローでは `@supabase/ssr` のクライアントを使用する場合がある:

```typescript
// src/features/auth/components/login-form.tsx
'use client'

// 認証のみ例外的にクライアントサイドで Supabase を使用
// ただし、データ操作は API Route 経由
```
