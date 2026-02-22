# エラーハンドリング

## 概要

エラーハンドリングは、`AppError`クラスと`withHTTPError`ラッパーを中心に構成される、レイヤー横断的な仕組みである。Service/Repository層で発生するエラーを`AppError`で表現し、Handler層の`withHTTPError`が自動的にHTTPレスポンスに変換する。

**対象範囲**: AppErrorクラス、withHTTPErrorラッパー、レイヤーごとのエラー処理方針

**主要な責務**:
- エラーにHTTPステータスコードとエラーコードを付与する
- レイヤー間でエラー情報を伝播する
- 統一されたエラーレスポンス形式を保証する

**禁止事項**:
- 生の`Error`をスローする（`AppError`を使用する）
- Handler層で手動のtry-catchを記述する（`withHTTPError`を使用する）
- `console.log`/`console.error`でエラーを出力する（pinoを使用する）

## 設計思想

### エラー情報の構造化

生の`Error`はメッセージのみを持つため、HTTPステータスコードやエラーコードの情報が失われる。`AppError`はエラーに`statusCode`と`code`を付与し、Handler層まで情報を伝播する。これにより、エラーの種類に応じた適切なHTTPレスポンスを自動生成できる。

### エラーハンドリングの統一

各Handler関数でtry-catchを記述すると、エラー処理のパターンが分散する。`withHTTPError`ラッパーでHandler関数をラップすることで、エラーハンドリングを1箇所に集約し、一貫したレスポンス形式を保証する。

### レイヤーごとの責務分離

エラーの**発生**と**変換**を分離する。Service/Repository層はビジネスロジックに基づいてエラーを発生させ、Handler層の`withHTTPError`がHTTPレスポンスへの変換を担当する。

## 実装パターン

### AppErrorクラス

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
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

**ポイント**:
- スタティックメソッドで頻出するエラーを簡潔に生成する
- `statusCode`でHTTPステータスを、`code`でエラーの種類を表現する
- `code`は必須で、フロントエンドでのエラー判別に使用する

### withHTTPErrorラッパー

`withHTTPError`はHandler関数をラップし、`AppError`を対応するHTTPレスポンスに自動変換する。予期しないエラーは500 Internal Server Errorを返す。

withHTTPErrorの実装詳細は[wrappers.md](wrappers.md)を参照。

### エラーレスポンス形式

すべてのエラーレスポンスは統一された形式を使用する。

```json
{
  "error": {
    "error_code": "ERROR_CODE",
    "message": "エラーの説明"
  }
}
```

すべてのエラーレスポンスに`error_code`が含まれる。レスポンスヘルパーもデフォルトの`error_code`を付与する。

## 使用例

### 例1: Repository層でのデータ未検出

Repositoryがデータベースからリソースを取得できない場合、`AppError.notFound`をスローする。

```typescript
// src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'

export const productRepository = {
  async findById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw AppError.notFound('Product not found')
      }
      throw new AppError(error.message, 500, 'INTERNAL_ERROR')
    }
    return data
  },
}
```

### 例2: Service層での認可チェック

Service層でビジネスルールに基づく認可チェックを行い、違反時に`AppError.forbidden`をスローする。認可チェックの詳細は[認証・認可ガイド](authentication.md)を参照。

```typescript
// src/features/posts/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import { postRepository } from './repository'

export async function updatePost(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  input: UpdatePostInput
) {
  const post = await postRepository.findById(supabase, postId)

  // 所有権チェック
  if (post.userId !== userId) {
    throw AppError.forbidden('You can only edit your own posts')
  }

  // ステータスチェック
  if (post.status === 'archived') {
    throw AppError.badRequest('Cannot edit archived posts', 'POST_ARCHIVED')
  }

  return postRepository.update(supabase, postId, input)
}
```

### 例3: Handler層での自動変換

Handler関数は`withHTTPError`でラップするだけで、エラーハンドリングが自動化される。

```typescript
// src/features/posts/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { updatePostSchema } from './schema'
import { updatePost } from './service'

// Service層がAppError(403)やAppError(400)をスローすると、
// withHTTPErrorが自動的に対応するHTTPレスポンスに変換する
export const handleUpdatePost = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const validation = await validateBody(request, updatePostSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const post = await updatePost(supabase, id, validation.data)
  return ok(post)
})
```

### 例4: エラーコードによるフロントエンド判別

フロントエンドでエラーコードを使用して、ユーザーに適切なメッセージを表示する。

```typescript
// src/features/posts/core/fetcher.ts
import { fetcher } from '@/lib/fetcher'

export const postFetcher = {
  async update(id: string, input: UpdatePostInput) {
    const res = await fetcher(`/api/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })

    if (!res.ok) {
      const { error } = await res.json()
      // エラーコードで分岐
      if (error.error_code === 'POST_ARCHIVED') {
        throw new Error('アーカイブ済みの投稿は編集できません')
      }
      throw new Error(error.message)
    }

    return res.json()
  },
}
```

## エラーコード一覧

| コード | HTTP | 用途 |
|--------|------|------|
| `BAD_REQUEST` | 400 | 不正なリクエスト |
| `VALIDATION_ERROR` | 400 | バリデーションエラー |
| `UNAUTHORIZED` | 401 | 未認証 |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソース未検出 |
| `CONFLICT` | 409 | 重複・競合 |
| `INTERNAL_ERROR` | 500 | サーバーエラー |

カスタムコード（`POST_ARCHIVED`等）は、ビジネスロジック固有のエラーに使用する。

## 参考資料

- [response-apperror](../rules/response-apperror.md) - AppError使用ルール
- [response-with-http-error](../rules/response-with-http-error.md) - withHTTPError必須ルール
- [response-helpers](../rules/response-helpers.md) - レスポンスヘルパー使用ルール
