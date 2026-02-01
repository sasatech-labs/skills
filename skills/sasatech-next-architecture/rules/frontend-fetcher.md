---
id: frontend-fetcher
title: Fetcher パターン
category: フロントエンド
impact: LOW
tags: [frontend, fetcher, api, client]
---

## ルール

Featureごとに`fetcher.ts`を作成し、API呼び出しを一元化する。コンポーネント内で直接`fetch`を使用しない。

## NG例

```typescript
// src/features/products/components/product-list.tsx
'use client'

export function ProductList() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    // コンポーネント内で直接 fetch
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => setProducts(data))
  }, [])

  // ...
}
```

## OK例

```typescript
// src/features/products/fetcher.ts
import { fetchData, fetchPaginated, mutate } from '@/lib/fetcher'
import type { Product, CreateProductInput } from './core/schema'
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

```typescript
// src/features/products/components/product-list.tsx
'use client'

import { useProducts } from '../hooks'

export function ProductList() {
  const { products, isLoading, error } = useProducts()

  // ...
}
```

## 理由

API呼び出しをコンポーネント内に直接記述すると、以下の問題が発生する：

- エラーハンドリングがコンポーネントごとに分散し、一貫性が失われる
- API URLの変更時に複数のコンポーネントを修正する必要がある
- テスト時にAPI呼び出しのモック化が困難になる
- 型安全性が確保できず、ランタイムエラーのリスクが高まる

Fetcherパターンを使用することで、API呼び出しロジックを一元管理し、保守性とテスト容易性が向上する。

## 参考実装

### 共通 Fetcher の実装

```typescript
// src/lib/fetcher.ts
import { ApiError } from './api-error'

// 単一リソース取得
export async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const json = await response.json()

  if (!response.ok) {
    throw new ApiError(
      json.error?.message ?? 'An error occurred',
      response.status,
      json.error?.code
    )
  }

  return json.data
}

// ページネーション付きリスト取得
export async function fetchPaginated<T>(url: string): Promise<PaginatedResponse<T>> {
  const response = await fetch(url)
  const json = await response.json()

  if (!response.ok) {
    throw new ApiError(
      json.error?.message ?? 'An error occurred',
      response.status,
      json.error?.code
    )
  }

  return json
}

// 作成・更新・削除
export async function mutate<T>(
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
      json.error?.code,
      json.error?.details
    )
  }

  return json.data
}
```

## ApiError クラス

```typescript
// src/lib/api-error.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
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
```
