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
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const products = await getProducts(supabase)

  // NG: 直接 NextResponse を使用すると形式が不統一になる
  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  // ...
  // NG: status の指定方法がハンドラごとに異なる可能性がある
  return NextResponse.json(product, { status: 201 })
}
```

## OK例

```typescript
import { ok, created, notFound, serverError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    // OK: レスポンスヘルパーを使用することで形式が統一される
    return ok(products)
  } catch (error) {
    // OK: エラーレスポンスも統一された形式で返す
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  // ...
  // OK: 201 Created は created() ヘルパーで明示的に表現
  return created(product)
}
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
