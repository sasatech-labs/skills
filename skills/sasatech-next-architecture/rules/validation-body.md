---
title: リクエストボディのバリデーション
impact: MEDIUM
impactDescription: 不正な入力によるエラーを早期検出
tags: validation, zod, handler, api
---

## リクエストボディのバリデーション

POST/PATCH リクエストのボディは必ず Zod スキーマでバリデーションする。

**NG (バリデーションなし、不正な入力がそのまま処理される):**

```typescript
export async function POST(request: NextRequest) {
  // バリデーションなしで直接使用
  const body = await request.json()

  const supabase = await createClient()
  const product = await createProduct(supabase, body)

  return NextResponse.json(product)
}
```

**OK (validateBody で型安全にバリデーション):**

```typescript
import { validateBody } from '@/lib/validation'
import { createProductSchema } from '@/features/products/core/schema'
import { created, serverError } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  // バリデーション
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response  // 400 Bad Request
  }

  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, validation.data)
    return created(product)
  } catch (error) {
    return serverError()
  }
}
```

## validateBody の実装

```typescript
// src/lib/validation.ts
import { z, ZodError, ZodSchema } from 'zod'
import { badRequest } from './api-response'

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response }

export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return {
        success: false,
        response: badRequest('Validation failed', 'VALIDATION_ERROR', details),
      }
    }
    return {
      success: false,
      response: badRequest('Invalid JSON'),
    }
  }
}
```

## エラーレスポンス形式

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "name", "message": "商品名は必須です" },
      { "field": "price", "message": "価格は0以上で入力してください" }
    ]
  }
}
```

## PATCH での使用

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const validation = await validateBody(request, updateProductSchema)
  if (!validation.success) {
    return validation.response
  }

  // validation.data は UpdateProductInput 型
  // ...
}
```
