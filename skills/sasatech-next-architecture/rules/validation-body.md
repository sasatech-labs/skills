---
id: validation-body
title: リクエストボディのバリデーション
category: バリデーション
impact: MEDIUM
tags: [validation, zod, handler, api]
---

## ルール

POST/PATCH リクエストのボディは必ず Zod スキーマでバリデーションする。

## NG例

```typescript
export async function POST(request: NextRequest) {
  // バリデーションなしで直接使用
  const body = await request.json()

  const supabase = await createClient()
  const product = await createProduct(supabase, body)

  return NextResponse.json(product)
}
```

## OK例

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

## 理由

バリデーションを行わない場合、不正な入力値がそのまま処理される。これにより、以下の問題が発生する：

- **型安全性の欠如**: TypeScript の型推論が機能せず、ランタイムエラーが発生する可能性がある
- **セキュリティリスク**: 不正なデータが DB に保存され、データの整合性が損なわれる
- **エラーハンドリングの複雑化**: バリデーションエラーと実行時エラーの区別が困難になる
- **一貫性の欠如**: API レスポンスのエラー形式が統一されず、フロントエンドでの処理が複雑化する

Zod スキーマによるバリデーションを必須とすることで、型安全性とデータの整合性を保証し、コード品質を維持する。

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
