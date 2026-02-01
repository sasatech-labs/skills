---
id: validation-params
title: URL パラメータのバリデーション
category: バリデーション
impact: MEDIUM
tags: [validation, zod, handler, api]
---

## ルール

動的ルートのパラメータはZodスキーマでバリデーションする。

## NG例

```typescript
// src/app/api/products/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // NG: バリデーションなしで直接使用
  const supabase = await createClient()
  const product = await getProductById(supabase, params.id)

  return NextResponse.json(product)
}
```

## OK例

```typescript
// src/app/api/products/[id]/route.ts
import { validateParams } from '@/lib/validation'
import { productIdSchema } from '@/features/products/core/schema'
import { ok, notFound } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // OK: validateParamsでUUID形式を検証
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

```typescript
// src/features/products/core/schema.ts
// OK: IDスキーマを定義
export const productIdSchema = z.object({
  id: z.string().uuid('無効なIDです'),
})
```

## 理由

パラメータ未検証は不正値でのクエリ実行を招き、コードの品質と一貫性を低下させる。バリデーションにより以下を実現する：

- 型安全性の向上
- 不正なデータベースクエリの防止
- 一貫したエラーハンドリング
- 明確なAPIコントラクト

## 参考実装

### validateParamsの実装

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

### ボディとパラメータ両方のバリデーション

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

### クエリパラメータのバリデーション

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  // クエリパラメータの検証
  const validation = validateParams(params, productSearchSchema)
  if (!validation.success) {
    return validation.response
  }

  // validation.dataはProductSearchParams型
  // ...
}
```
