---
id: frontend-hooks
title: SWR Hooks パターン
category: フロントエンド
impact: LOW
tags: [frontend, hooks, swr, client]
---

## ルール

Featureごとに`hooks.ts`を作成し、SWRを使用したデータフェッチHookを提供する。コンポーネント内で直接useState/useEffectによる複雑な状態管理を行わない。

## NG例

```typescript
// コンポーネント内でuseState/useEffectを使用した複雑な状態管理
export function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setIsLoading(true)
    productsFetcher.getAll()
      .then(setProducts)
      .catch(setError)
      .finally(() => setIsLoading(false))
  }, [])

  // キャッシュ、重複排除、自動再検証が実装されていない
  // ...
}
```

## OK例

```typescript
// src/features/products/hooks.ts
'use client'

import useSWR from 'swr'
import { productsFetcher } from './fetcher'
import type { Product } from './core/schema'
import type { Pagination } from '@/types/api'

// SWRを使用したデータフェッチHookを提供
export function useProducts(page = 1, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR(
    ['products', page, limit],
    () => productsFetcher.getAll(page, limit),
    { keepPreviousData: true }
  )

  return {
    products: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: mutate,
  }
}

export function useProduct(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? ['product', id] : null,
    () => productsFetcher.getById(id)
  )

  return {
    product: data,
    isLoading,
    error,
    refetch: mutate,
  }
}
```

```typescript
// コンポーネントはHookを使用してシンプルになる
export function ProductList() {
  const { products, pagination, isLoading, error } = useProducts()

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

## 理由

SWR Hooksパターンを使用することで、以下の利点が得られる：

1. **自動キャッシュ管理**: データをキャッシュし、高速に表示する
2. **重複排除**: 同じキーへのリクエストを自動で重複排除し、無駄なAPI呼び出しを防ぐ
3. **自動再検証**: フォーカス時、再接続時に自動でデータを更新し、常に最新の状態を保つ
4. **コンポーネントの簡素化**: 状態管理のロジックをHookに分離し、コンポーネントは表示のみに集中できる

このパターンを使用しない場合、各コンポーネントで重複した状態管理ロジックを実装することになり、保守性とパフォーマンスが低下する
