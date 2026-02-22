---
id: response-helpers
title: API レスポンスヘルパーの使用
category: レスポンス
impact: LOW
tags: [response, api, handler]
---

## ルール

Handler 層では直接 `NextResponse.json()` を使わず、レスポンスヘルパーを使用する。これによりレスポンス形式の統一と保守性を確保する。

## NG例

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts, createProduct } from './service'

// NG: 直接 NextResponse を使用すると形式が不統一になる
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return NextResponse.json(products)
})

// NG: status の指定方法がハンドラごとに異なる可能性がある
export const handleCreateProduct = withHTTPError(async (request) => {
  // ...
  return NextResponse.json(product, { status: 201 })
})
```

## OK例

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok, created } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts, createProduct } from './service'
import { validateBody } from '@/lib/validation'
import { createProductSchema } from './schema'

// OK: レスポンスヘルパーを使用することで形式が統一される
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return ok(products)
})

// OK: 201 Created は created() ヘルパーで明示的に表現
export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return created(product)
})
```

## 理由

レスポンスヘルパーを使用することで以下の利点がある：

1. **形式の統一**: すべてのAPIエンドポイントで同じレスポンス構造を保証する
2. **保守性の向上**: レスポンス形式の変更が一箇所で完結する
3. **可読性の向上**: `ok()`, `created()`, `notFound()` などのヘルパー名が意図を明確にする
4. **ステータスコードの統一**: HTTPステータスコードの指定方法が統一される

違反した場合、レスポンス形式が不統一になり、フロントエンド側でのエラーハンドリングが複雑化する可能性がある。

## レスポンスヘルパー一覧

| ヘルパー | Status | 用途 |
|---------|--------|------|
| `ok(data)` | 200 | GET/PATCH 成功 |
| `created(data)` | 201 | POST 成功 |
| `noContent()` | 204 | DELETE 成功 |
| `badRequest(message?, errorCode?, details?)` | 400 | バリデーションエラー |
| `unauthorized(message?, errorCode?)` | 401 | 未認証 |
| `forbidden(message?, errorCode?)` | 403 | 権限不足 |
| `notFound(message?, errorCode?)` | 404 | リソースなし |
| `conflict(message?, errorCode?)` | 409 | 重複 |
| `serverError(message?, errorCode?)` | 500 | サーバーエラー |

## レスポンス形式

```typescript
// 成功（単一リソース）
{ "data": { "id": "...", "name": "..." } }

// 成功（ページネーション）
{ "data": { "items": [...], "total": 100, "page": 1, "limit": 20 } }

// 成功（204 No Content）— ボディなし

// エラー
{ "error": { "error_code": "NOT_FOUND", "message": "Not found" } }

// エラー（バリデーション）
{ "error": { "error_code": "VALIDATION_ERROR", "message": "Validation failed", "details": [...] } }
```

## 実装例

```typescript
// src/lib/api-response.ts
import 'server-only'

import { NextResponse } from 'next/server'

export function ok<T>(data: T) {
  return NextResponse.json({ data }, { status: 200 })
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function badRequest(
  message: string = 'Bad request',
  errorCode: string = 'BAD_REQUEST',
  details?: Array<{ field: string; message: string }>
) {
  return NextResponse.json(
    { error: { error_code: errorCode, message, ...(details && { details }) } },
    { status: 400 }
  )
}

export function unauthorized(
  message: string = 'Unauthorized',
  errorCode: string = 'UNAUTHORIZED'
) {
  return NextResponse.json(
    { error: { error_code: errorCode, message } },
    { status: 401 }
  )
}

export function forbidden(
  message: string = 'Forbidden',
  errorCode: string = 'FORBIDDEN'
) {
  return NextResponse.json(
    { error: { error_code: errorCode, message } },
    { status: 403 }
  )
}

export function notFound(
  message: string = 'Not found',
  errorCode: string = 'NOT_FOUND'
) {
  return NextResponse.json(
    { error: { error_code: errorCode, message } },
    { status: 404 }
  )
}

export function conflict(
  message: string = 'Conflict',
  errorCode: string = 'CONFLICT'
) {
  return NextResponse.json(
    { error: { error_code: errorCode, message } },
    { status: 409 }
  )
}

export function serverError(
  message: string = 'Internal server error',
  errorCode: string = 'INTERNAL_ERROR'
) {
  return NextResponse.json(
    { error: { error_code: errorCode, message } },
    { status: 500 }
  )
}
```

## 参照

- [response-with-http-error](response-with-http-error.md) - withHTTPError必須ルール
- [response-apperror](response-apperror.md) - AppError使用ルール
- [wrappers.md](../guides/wrappers.md) - ラッパーユーティリティガイド
