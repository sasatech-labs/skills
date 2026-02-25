---
id: server-supabase-via-api
title: クライアントから Supabase 直接使用禁止
category: サーバーサイド保護
impact: CRITICAL
tags: [server, security, supabase, architecture]
---

## ルール

クライアントコンポーネントから Supabaseを直接使用しない。必ず Repositoryを経由する。

## 理由

クライアントから Supabase への直接アクセスを禁止する理由は以下の通りである。

**セキュリティ**
環境変数がクライアントに露出すると、データベースの接続情報が漏洩するリスクがある。API Route を経由することで、サーバーサイドのみが Supabase にアクセスし、認証情報を保護できる。

**アーキテクチャの一貫性**
3層構成（Handler → Service → Repository）を維持することで、責務の分離が明確になる。クライアントが直接データベースにアクセスすると、この設計パターンが成立しなくなる。

**バリデーション**
API Route でリクエストを受け取ることで、サーバーサイドで入力検証を行える。クライアントからの直接アクセスでは、バリデーションをバイパスされる可能性がある。

**ログとキャッシュ**
サーバーサイドでリクエストを記録し、キャッシュ戦略を制御できる。これにより、パフォーマンスの最適化とデバッグが容易になる。

## OK例

```typescript
// src/features/products/components/product-list.tsx
'use client'

import { useProducts } from '../hooks'

export function ProductList() {
  // OK: API Route を経由してデータ取得する
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
// src/features/products/core/hooks.ts
'use client'

import useSWR from 'swr'
import { productsFetcher } from './fetcher'

export function useProducts() {
  // OK: Fetcher経由でAPI Routeを呼び出す
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
// src/features/products/core/fetcher.ts
import { fetchPaginated } from '@/lib/fetcher'
import type { Product } from './schema'

export const productsFetcher = {
  // OK: API Routeのエンドポイントを呼び出す
  getAll(page = 1, limit = 20) {
    return fetchPaginated<Product>(`/api/products?page=${page}&limit=${limit}`)
  },
}
```

## NG例

```typescript
// src/features/products/components/product-list.tsx
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function ProductList() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // NG: クライアントから直接 Supabase にアクセスしている
  // NG: 環境変数がクライアントに露出する
  // NG: サーバーサイドのバリデーションをバイパスしている
  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*')
    return data
  }

  // ...
}
```

## 例外

認証フローでは `@supabase/ssr` のクライアントを使用する場合がある。

```typescript
// src/features/auth/components/login-form.tsx
'use client'

// 認証のみ例外的にクライアントサイドで Supabase を使用する
// ただし、データ操作は API Route を経由する
```

認証機能は Supabase の認証 API を直接使用する必要があるため、例外として許可される。ただし、データの取得や更新は API Route を経由する必要がある。
