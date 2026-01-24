---
title: SWR Hooks パターン
impact: LOW
impactDescription: データフェッチの状態管理を簡潔化
tags: frontend, hooks, swr, client
---

## SWR Hooks パターン

Feature ごとに `hooks.ts` を作成し、SWR を使用したデータフェッチ Hook を提供する。

**NG (コンポーネント内で複雑な状態管理):**

```typescript
// コンポーネント内で複雑な状態管理
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

  // ...
}
```

**OK (SWR Hook でキャッシュ・重複排除・自動再検証):**

```typescript
// src/features/products/hooks.ts
'use client'

import useSWR from 'swr'
import { productsFetcher } from './fetcher'
import type { Product } from './core/schema'
import type { Pagination } from '@/types/api'

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
// コンポーネントはシンプルに
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

## ミューテーション Hook

```typescript
// src/features/products/hooks.ts
import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { productsFetcher } from './fetcher'
import { ApiError } from '@/lib/api-error'
import type { CreateProductInput } from './core/schema'

export function useCreateProduct() {
  const { mutate } = useSWRConfig()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const create = async (input: CreateProductInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const product = await productsFetcher.create(input)
      // キャッシュを再検証
      await mutate((key) => Array.isArray(key) && key[0] === 'products')
      return product
    } catch (e) {
      const apiError = e instanceof ApiError ? e : new ApiError('Unknown error', 500)
      setError(apiError)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { create, isLoading, error }
}

export function useUpdateProduct() {
  const { mutate } = useSWRConfig()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const update = async (id: string, input: Partial<CreateProductInput>) => {
    setIsLoading(true)
    setError(null)

    try {
      const product = await productsFetcher.update(id, input)
      await mutate(['product', id])
      await mutate((key) => Array.isArray(key) && key[0] === 'products')
      return product
    } catch (e) {
      const apiError = e instanceof ApiError ? e : new ApiError('Unknown error', 500)
      setError(apiError)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { update, isLoading, error }
}

export function useDeleteProduct() {
  const { mutate } = useSWRConfig()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const remove = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await productsFetcher.delete(id)
      await mutate((key) => Array.isArray(key) && key[0] === 'products')
      return true
    } catch (e) {
      const apiError = e instanceof ApiError ? e : new ApiError('Unknown error', 500)
      setError(apiError)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { remove, isLoading, error }
}
```

## セットアップ

```bash
npm install swr
```

## SWR の利点

1. **自動再検証**: フォーカス時、再接続時に自動でデータを更新
2. **重複排除**: 同じキーへのリクエストを自動で重複排除
3. **キャッシュ**: データをキャッシュし、高速に表示
4. **楽観的更新**: `mutate` で即座にUIを更新
