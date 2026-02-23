---
id: validation-request
title: リクエスト入力値のバリデーション
category: バリデーション
impact: MEDIUM
tags: [validation, zod, handler, api]
---

## ルール

リクエストの入力値（ボディ、パスパラメータ、クエリパラメータ）はZodスキーマでバリデーションする。

## NG例

### ボディ未検証

```typescript
// src/features/products/core/handler.ts
export const handleCreateProduct = withHTTPError(async (request) => {
  // NG: バリデーションなしで直接使用
  const body = await request.json()

  const supabase = await createClient()
  const product = await createProduct(supabase, body)
  return AppResponse.created(product)
})
```

### パスパラメータ未検証

```typescript
// src/features/products/core/handler.ts
export const handleGetProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  // NG: バリデーションなしで直接使用
  const supabase = await createClient()
  const product = await getProduct(supabase, id)
  return AppResponse.ok(product)
})
```

## OK例

### ボディバリデーション（validateBody）

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
  // OK: Zodスキーマでボディをバリデーション
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response  // 400 Bad Request
  }

  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return AppResponse.created(product)
})
```

### パスパラメータバリデーション（safeParse）

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProduct } from './service'

const paramsSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
})

// OK: パラメータをZodでバリデーション
export const handleGetProduct = withHTTPError(async (request, context) => {
  const params = await context.params
  const result = paramsSchema.safeParse(params)
  if (!result.success) {
    return AppResponse.badRequest('Invalid product ID format')
  }

  const supabase = await createClient()
  const product = await getProduct(supabase, result.data.id)
  return AppResponse.ok(product)
})
```

### クエリパラメータバリデーション（validateSearchParams）

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { validateSearchParams } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { productSearchSchema } from './schema'
import { getProducts } from './service'

export const handleGetProducts = withHTTPError(async (request) => {
  // OK: クエリパラメータをZodでバリデーション
  const validation = validateSearchParams(request, productSearchSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const products = await getProducts(supabase, validation.data)
  return AppResponse.ok(products)
})
```

## 理由

バリデーションを行わない場合、不正な入力値がそのまま処理される。これにより、以下の問題が発生する：

1. **型安全性の欠如**: TypeScriptの型推論が機能せず、ランタイムエラーが発生する可能性がある
2. **セキュリティリスク**: 不正なデータがDBに保存され、データの整合性が損なわれる
3. **エラーハンドリングの複雑化**: バリデーションエラーと実行時エラーの区別が困難になる
4. **一貫性の欠如**: APIレスポンスのエラー形式が統一されず、フロントエンドでの処理が複雑化する
5. **不正なクエリの実行**: 未検証のパラメータがデータベースクエリに渡され、予期しない結果を招く

Zodスキーマによるバリデーションを必須とすることで、型安全性とデータの整合性を保証し、コード品質を維持する。

## 参考実装

### validateBody

```typescript
// src/lib/validation.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { AppResponse } from './api-response'

type _ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response }

async function _validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<_ValidationResult<T>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return {
        success: false,
        response: AppResponse.badRequest(message),
      }
    }
    return {
      success: false,
      response: AppResponse.badRequest('Invalid request body'),
    }
  }
}

export type ValidationResult<T> = _ValidationResult<T>
export const validateBody = _validateBody
```

### validateSearchParams

```typescript
// src/lib/validation.ts
function _validateSearchParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): _ValidationResult<T> {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return {
        success: false,
        response: AppResponse.badRequest(message),
      }
    }
    return {
      success: false,
      response: AppResponse.badRequest('Invalid query parameters'),
    }
  }
}

export const validateSearchParams = _validateSearchParams
```

## 参照

- [Handler層の実装](../guides/architecture/handler.md)
- [schema-single-source](schema-single-source.md)
