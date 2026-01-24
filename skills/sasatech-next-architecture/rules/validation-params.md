---
title: URL パラメータのバリデーション
impact: MEDIUM
impactDescription: 不正なパラメータによるエラーを早期検出
tags: validation, zod, handler, api
---

## URL パラメータのバリデーション

動的ルートのパラメータは Zod スキーマでバリデーションする。

**Incorrect (バリデーションなし、不正な ID でクエリ実行):**

```typescript
// src/app/api/products/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // バリデーションなしで直接使用
  const supabase = await createClient()
  const product = await getProductById(supabase, params.id)

  return NextResponse.json(product)
}
```

**Correct (validateParams で UUID 形式を検証):**

```typescript
import { validateParams } from '@/lib/validation'
import { productIdSchema } from '@/features/products/core/schema'
import { ok, notFound } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // パラメータバリデーション
  const validation = validateParams(params, productIdSchema)
  if (!validation.success) {
    return validation.response  // 400 Bad Request
  }

  const supabase = await createClient()
  const product = await getProductById(supabase, validation.data.id)

  if (!product) {
    return notFound('Product not found')
  }

  return ok(product)
}
```

## ID スキーマの定義

```typescript
// src/features/products/core/schema.ts
export const productIdSchema = z.object({
  id: z.string().uuid('無効なIDです'),
})
```

## validateParams の実装

```typescript
// src/lib/validation.ts
export function validateParams<T>(
  params: unknown,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return {
        success: false,
        response: badRequest('Invalid parameters', 'VALIDATION_ERROR', details),
      }
    }
    return {
      success: false,
      response: badRequest('Invalid parameters'),
    }
  }
}
```

## ボディとパラメータ両方のバリデーション

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // パラメータバリデーション
  const paramsValidation = validateParams(params, productIdSchema)
  if (!paramsValidation.success) {
    return paramsValidation.response
  }

  // ボディバリデーション
  const bodyValidation = await validateBody(request, updateProductSchema)
  if (!bodyValidation.success) {
    return bodyValidation.response
  }

  const supabase = await createClient()
  const product = await updateProduct(
    supabase,
    paramsValidation.data.id,
    bodyValidation.data
  )

  return ok(product)
}
```

## クエリパラメータのバリデーション

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  const validation = validateParams(params, productSearchSchema)
  if (!validation.success) {
    return validation.response
  }

  // validation.data は ProductSearchParams 型
  // ...
}
```
