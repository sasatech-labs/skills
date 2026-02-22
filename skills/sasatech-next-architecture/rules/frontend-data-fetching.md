---
id: frontend-data-fetching
title: CSRデータ取得パターン（Fetcher + SWR Hooks）
category: フロントエンド
impact: LOW
tags: [frontend, fetcher, hooks, swr, client]
---

## ルール

Featureごとに`fetcher.ts`と`hooks.ts`を作成し、コンポーネントから直接`fetch`や`useState`+`useEffect`を使用しない。

## NG例

### コンポーネント内で直接fetch

```typescript
// src/features/products/components/product-list.tsx
'use client'

export function ProductList() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    // NG: コンポーネント内で直接fetch
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => setProducts(data))
  }, [])

  // ...
}
```

### useState/useEffectで状態管理

```typescript
// NG: コンポーネント内でuseState/useEffectによる複雑な状態管理
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

### 1. Fetcher: API呼び出しの一元化

```typescript
// src/features/products/core/fetcher.ts
import { fetchData, fetchPaginated, mutate } from '@/lib/fetcher'
import type { Product, CreateProductInput } from './schema'
import type { PaginatedResponse } from '@/types/api'

const BASE_URL = '/api/products'

export const productsFetcher = {
  getAll(page = 1, limit = 20): Promise<PaginatedResponse<Product>> {
    return fetchPaginated<Product>(`${BASE_URL}?page=${page}&limit=${limit}`)
  },

  getById(id: string): Promise<Product> {
    return fetchData<Product>(`${BASE_URL}/${id}`)
  },

  create(input: CreateProductInput): Promise<Product> {
    return mutate<Product>(BASE_URL, {
      method: 'POST',
      body: input,
    })
  },

  update(id: string, input: Partial<CreateProductInput>): Promise<Product> {
    return mutate<Product>(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      body: input,
    })
  },

  delete(id: string): Promise<void> {
    return mutate<void>(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    })
  },
}
```

### 2. Hooks: SWRによるデータフェッチ

```typescript
// src/features/products/core/hooks.ts
'use client'

import useSWR from 'swr'
import { productsFetcher } from './fetcher'
import type { Product } from './schema'
import type { Pagination } from '@/types/api'

// SWRを使用したデータフェッチHookを提供
export function useProducts(page = 1, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR(
    ['products', page, limit],
    () => productsFetcher.getAll(page, limit),
    { keepPreviousData: true }
  )

  return {
    products: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    limit: data?.limit ?? limit,
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

### 3. コンポーネントでの使用

```typescript
// src/features/products/components/product-list.tsx
'use client'

import { useProducts } from '../core/hooks'

// コンポーネントはHookを使用してシンプルになる
export function ProductList() {
  const { products, total, isLoading, error } = useProducts()

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

FetcherとSWR Hooksのパターンを使用しない場合、以下の問題が発生する：

1. **API呼び出しの分散**: エラーハンドリングがコンポーネントごとに分散し、一貫性が失われる
2. **URL管理の困難**: API URLの変更時に複数のコンポーネントを修正する必要がある
3. **テスト容易性の低下**: API呼び出しのモック化が困難になる
4. **キャッシュの欠如**: SWRの自動キャッシュ管理、重複排除、自動再検証が利用できない
5. **コンポーネントの肥大化**: 状態管理ロジックがコンポーネントに混在し、表示に集中できない

FetcherでエラーハンドリングとAPI呼び出しを一元管理し、SWR Hooksで状態管理を分離することで、保守性とパフォーマンスが向上する。

## 参考実装

### 共通Fetcher

```typescript
// src/lib/fetcher.ts
import { ApiError } from './api-error'

// 単一リソース取得
async function _fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const json = await response.json()

  if (!response.ok) {
    throw new ApiError(
      json.error?.message ?? 'An error occurred',
      response.status,
      json.error?.error_code || 'UNKNOWN_ERROR'
    )
  }

  return json.data
}

// ページネーション付きリスト取得
async function _fetchPaginated<T>(url: string): Promise<PaginatedResponse<T>> {
  const response = await fetch(url)
  const json = await response.json()

  if (!response.ok) {
    throw new ApiError(
      json.error?.message ?? 'An error occurred',
      response.status,
      json.error?.error_code || 'UNKNOWN_ERROR'
    )
  }

  return json
}

// 作成・更新・削除
async function _mutate<T>(
  url: string,
  options: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }
): Promise<T> {
  const response = await fetch(url, {
    method: options.method,
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const json = await response.json()

  if (!response.ok) {
    throw new ApiError(
      json.error?.message ?? 'An error occurred',
      response.status,
      json.error?.error_code || 'UNKNOWN_ERROR',
      json.error?.details
    )
  }

  return json.data
}

export const fetchData = _fetchData
export const fetchPaginated = _fetchPaginated
export const mutate = _mutate
```

### ApiErrorクラス

```typescript
// src/lib/api-error.ts
class _ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isUnauthorized() { return this.status === 401 }
  get isForbidden() { return this.status === 403 }
  get isNotFound() { return this.status === 404 }
  get isValidationError() { return this.status === 400 && this.details !== undefined }
}

export type ApiError = _ApiError
export const ApiError = _ApiError
```

## 参照

- [データ取得戦略](../guides/fetch-strategy.md)
- [arch-three-layers](arch-three-layers.md)
