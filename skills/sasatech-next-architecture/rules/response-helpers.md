---
title: API レスポンスヘルパーの使用
impact: LOW
impactDescription: レスポンスヘルパーの不使用はパターンの統一に関する推奨事項
tags: response, api, handler
---

## API レスポンスヘルパーの使用

Handler 層では直接 `NextResponse.json()` を使わず、レスポンスヘルパーを使用する。

**NG (直接 NextResponse、形式が不統一になりやすい):**

```typescript
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const products = await getProducts(supabase)

  // 直接 NextResponse を使用 - 形式が不統一になりやすい
  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  // ...
  // status の指定方法が不統一
  return NextResponse.json(product, { status: 201 })
}
```

**OK (ヘルパーで統一された形式):**

```typescript
import { ok, created, notFound, serverError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    return ok(products)  // 統一された形式
  } catch (error) {
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  // ...
  return created(product)  // 201 Created
}
```

## レスポンスヘルパー一覧

| ヘルパー | Status | 用途 |
|---------|--------|------|
| `ok(data)` | 200 | GET/PATCH 成功 |
| `created(data)` | 201 | POST 成功 |
| `noContent()` | 204 | DELETE 成功 |
| `paginated(data, pagination)` | 200 | ページネーション付きリスト |
| `badRequest(message, code?, details?)` | 400 | バリデーションエラー |
| `unauthorized(message?)` | 401 | 未認証 |
| `forbidden(message?)` | 403 | 権限不足 |
| `notFound(message?)` | 404 | リソースなし |
| `serverError(message?)` | 500 | サーバーエラー |

## レスポンス形式

```typescript
// 成功（単一リソース）
{ "data": { "id": "...", "name": "..." } }

// 成功（リスト）
{ "data": [...] }

// 成功（ページネーション付き）
{
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}

// エラー
{
  "error": {
    "message": "Not found",
    "code": "NOT_FOUND"
  }
}

// バリデーションエラー
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "name", "message": "必須です" }
    ]
  }
}
```

## 実装例

```typescript
// src/lib/api-response.ts
import { NextResponse } from 'next/server'

export function ok<T>(data: T) {
  return NextResponse.json({ data })
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function paginated<T>(data: T[], pagination: Pagination) {
  return NextResponse.json({ data, pagination })
}

export function badRequest(
  message: string,
  code?: string,
  details?: ValidationError[]
) {
  return NextResponse.json(
    { error: { message, code, details } },
    { status: 400 }
  )
}

export function notFound(message = 'Not found') {
  return NextResponse.json(
    { error: { message, code: 'NOT_FOUND' } },
    { status: 404 }
  )
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json(
    { error: { message, code: 'INTERNAL_ERROR' } },
    { status: 500 }
  )
}
```
