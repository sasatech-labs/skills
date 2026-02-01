---
id: response-apperror
title: AppError クラスの使用
category: レスポンス
impact: MEDIUM
tags: [error, exception, service, repository]
---

## ルール

Service 層と Repository 層では `AppError` クラスでエラーをスローする。生の `Error` は使用しない。

## NG例

```typescript
// Repository
async findById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  // 生の Error - HTTP ステータスコードが伝わらない
  if (error) throw new Error(error.message)
  return data
}

// Service
async publishPost(supabase: SupabaseClient, postId: string, userId: string) {
  const post = await postRepository.findById(supabase, postId)

  // 生の Error
  if (post.userId !== userId) {
    throw new Error('権限がありません')
  }
}
```

## OK例

```typescript
import { AppError } from '@/lib/errors'

// Repository
async findById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw AppError.notFound('Product not found')  // 404
    }
    throw new AppError(error.message, 500)  // 500
  }
  return data
}

// Service
async publishPost(supabase: SupabaseClient, postId: string, userId: string) {
  const post = await postRepository.findById(supabase, postId)

  if (post.userId !== userId) {
    throw AppError.forbidden('You can only publish your own posts')  // 403
  }

  if (post.status === 'published') {
    throw AppError.badRequest('Post is already published', 'ALREADY_PUBLISHED')  // 400
  }
}
```

## 理由

生の `Error` を使用すると、以下の問題が発生する：

1. **HTTP ステータスコードが伝わらない**: Handler 層でエラーの種類（404, 403, 400など）を判別できず、適切なレスポンスを返せない
2. **エラーコードの欠如**: クライアント側でエラーの種類を識別できず、適切なエラーハンドリングができない
3. **一貫性の欠如**: エラー処理の実装が各所で異なり、保守性が低下する

`AppError` を使用することで、Service/Repository 層からの HTTP ステータスコードとエラーコードが Handler 層まで伝播し、一貫したエラーレスポンスを実現できる。

## Handler でのエラーハンドリング

```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const post = await publishPost(supabase, params.id, user.id)
    return ok(post)
  } catch (error) {
    if (error instanceof AppError) {
      // AppError はそのまま HTTP レスポンスに変換
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.statusCode }
      )
    }

    // 予期しないエラー
    console.error('Unexpected error:', error)
    return serverError()
  }
}
```

## AppError クラスの実装

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }

  static badRequest(message: string, code?: string) {
    return new AppError(message, 400, code ?? 'BAD_REQUEST')
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN')
  }

  static notFound(message = 'Not found') {
    return new AppError(message, 404, 'NOT_FOUND')
  }

  static conflict(message: string, code?: string) {
    return new AppError(message, 409, code ?? 'CONFLICT')
  }
}
```

## エラーコード一覧

| コード | HTTP | 用途 |
|--------|------|------|
| `BAD_REQUEST` | 400 | 不正なリクエスト |
| `VALIDATION_ERROR` | 400 | バリデーションエラー |
| `UNAUTHORIZED` | 401 | 未認証 |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソースなし |
| `ALREADY_EXISTS` | 409 | 重複 |
| `INTERNAL_ERROR` | 500 | サーバーエラー |
