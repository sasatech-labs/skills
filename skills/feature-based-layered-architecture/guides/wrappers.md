# Wrapper Utilities

## 概要

このガイドでは、Handler層のボイラープレートを排除するラッパーユーティリティを説明する。

- **withHTTPError**: Handler層のtry-catchを統一し、AppErrorをHTTPレスポンスに自動変換する

## 設計思想

### ボイラープレートの排除

Handler層では、すべての関数で同一のtry-catch + AppError判定パターンが繰り返される。withHTTPErrorでこのパターンを一箇所に集約し、Handler関数をビジネスロジック呼び出しに専念させる。

## withHTTPError

### 実装

```typescript
// src/lib/with-http-error.ts
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { AppResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<Record<string, string>> }
type HandlerFn = (
  request: NextRequest,
  context: RouteContext
) => Promise<NextResponse>

function _withHTTPError(handler: HandlerFn): HandlerFn {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: { error_code: error.code, message: error.message } },
          { status: error.statusCode }
        )
      }
      return AppResponse.serverError()
    }
  }
}

export const withHTTPError = _withHTTPError
```

### 使用パターン

#### 基本的なGETハンドラー

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts } from './service'

export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})
```

#### パラメータ付きハンドラー

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProduct } from './service'

export const handleGetProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()
  const product = await getProduct(supabase, id)
  return AppResponse.ok(product)
})
```

#### バリデーション付きPOSTハンドラー

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createProductSchema } from './schema'
import { createProduct } from './service'

export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return AppResponse.created(product)
})
```

#### 認証付きハンドラー

```typescript
// src/features/users/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { getMyProfile } from './service'

export const handleGetMyProfile = withHTTPError(async (request) => {
  const supabase = await createClient()

  // 楽観的認証: セッション存在チェック
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  const profile = await getMyProfile(supabase, session.user.id)
  return AppResponse.ok(profile)
})
```

Handler層で`getSession()`による楽観的認証を行い、認証済みユーザーIDをService層に渡す。詳細は[認証・認可ガイド](authentication.md)を参照。

### handleApiErrorからの移行

```typescript
// Before: 手動try-catch + handleApiError
import { handleApiError } from '@/lib/api-response/error-handler'

export async function handleGetProducts(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    return AppResponse.ok(products)
  } catch (error) {
    return handleApiError(error)
  }
}

// After: withHTTPError
import { withHTTPError } from '@/lib/with-http-error'

export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})
```

## 使用例: CRUD全体

withHTTPErrorを使用したCRUD実装の全体像を示す。

### Service層

```typescript
// src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, CreateProductInput, UpdateProductInput } from './schema'
import { productRepository } from './repository'
import { AppError } from '@/lib/errors'

export async function getProduct(
  supabase: SupabaseClient,
  id: string
): Promise<Product> {
  const product = await productRepository.findById(supabase, id)
  if (!product) {
    throw new AppError('Product not found', 404)
  }
  return product
}

export async function getProducts(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  return productRepository.findMany(supabase, options)
}

export async function createProduct(
  supabase: SupabaseClient,
  input: CreateProductInput
): Promise<Product> {
  return productRepository.create(supabase, input)
}

export async function updateProduct(
  supabase: SupabaseClient,
  id: string,
  input: UpdateProductInput
): Promise<Product> {
  return productRepository.update(supabase, id, input)
}

export async function deleteProduct(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await productRepository.delete(supabase, id)
}
```

### Handler層(withHTTPErrorでエラーハンドリング統一)

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createProductSchema, updateProductSchema } from './schema'
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from './service'

export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})

export const handleGetProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()
  const product = await getProduct(supabase, id)
  return AppResponse.ok(product)
})

export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return AppResponse.created(product)
})

export const handleUpdateProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const validation = await validateBody(request, updateProductSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const product = await updateProduct(supabase, id, validation.data)
  return AppResponse.ok(product)
})

export const handleDeleteProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()
  await deleteProduct(supabase, id)
  return AppResponse.noContent()
})
```

### API Route(薄いエントリーポイント)

```typescript
// src/app/api/products/route.ts
import { handleGetProducts, handleCreateProduct } from '@/features/products/index.server'

export const GET = handleGetProducts
export const POST = handleCreateProduct
```

```typescript
// src/app/api/products/[id]/route.ts
import {
  handleGetProduct,
  handleUpdateProduct,
  handleDeleteProduct,
} from '@/features/products/index.server'

export const GET = handleGetProduct
export const PATCH = handleUpdateProduct
export const DELETE = handleDeleteProduct
```

## 参照

- [architecture/handler.md](architecture/handler.md) - Handler層の実装
- [architecture/service.md](architecture/service.md) - Service層の実装
- [response-with-http-error](../rules/response-with-http-error.md) - withHTTPError必須ルール
