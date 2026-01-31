# Handler層の実装

## 概要

Handler層は、Next.js App RouterのAPI Route（`app/api/`）で実装される、リクエスト/レスポンスの境界を担当するレイヤーである。クライアントとサーバーサイドロジックの境界として、入力検証、認証チェック、エラーハンドリングを行い、ビジネスロジックはService層に委譲する。

**対象範囲**: API Route内でのリクエスト処理、バリデーション、認証チェック、Service層との連携、レスポンス返却

**主要な責務**:
- リクエスト受信とパース
- 入力バリデーション
- 認証・認可チェック
- Service層の呼び出し
- エラーハンドリングとレスポンス返却

**禁止事項**:
- ビジネスロジックの実装（Service層の責務）
- データベース直接アクセス（Repository層の責務）
- 外部API直接呼び出し（Adapter層の責務）
- 複雑なデータ変換処理（Service層の責務）

## 設計思想

Handler層をアーキテクチャの最上位レイヤーとして配置する理由は、以下の通りである。

### アプリケーションの入口を守る

Handler層は、外部からの不正なリクエストや攻撃を早期に排除する。入力検証と認証チェックを最初に行うことで、不正なデータや未認証のアクセスがアプリケーション内部に到達することを防ぐ。

### 関心事の分離

リクエスト/レスポンスの処理とビジネスロジックを明確に分離する。Handler層はHTTPプロトコルの詳細（ステータスコード、ヘッダー等）を担当し、Service層はビジネスルールに集中する。この分離により、各レイヤーが単一の責務を持ち、保守性が向上する。

### テスト容易性の向上

Handler層を薄く保つことで、ビジネスロジックをService層で独立してテストできる。Handler層自体のテストも、モックされたService層を使用することで簡潔になる。

## 実装パターン

Handler層の実装は、以下のパターンに従う。

### 基本的なGETエンドポイント

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProducts } from '@/features/products'
import { createClient } from '@/lib/supabase/server'
import { ok, serverError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    return ok(products)
  } catch (error) {
    return serverError()
  }
}
```

### POSTエンドポイント（バリデーション付き）

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProducts, createProduct } from '@/features/products'
import { createProductSchema } from '@/features/products/core/schema'
import { createClient } from '@/lib/supabase/server'
import { ok, created, serverError } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    return ok(products)
  } catch (error) {
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  // 1. バリデーション
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  // 2. ビジネスロジック実行
  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, validation.data)
    return created(product)
  } catch (error) {
    return serverError()
  }
}
```

### PUT/PATCH/DELETEエンドポイント

```typescript
// src/app/api/products/[id]/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProduct, updateProduct, deleteProduct } from '@/features/products'
import { updateProductSchema } from '@/features/products/core/schema'
import { createClient } from '@/lib/supabase/server'
import { ok, noContent, notFound, serverError } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const product = await getProduct(supabase, params.id)

    if (!product) {
      return notFound('Product not found')
    }

    return ok(product)
  } catch (error) {
    return serverError()
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const validation = await validateBody(request, updateProductSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const product = await updateProduct(supabase, params.id, validation.data)
    return ok(product)
  } catch (error) {
    return serverError()
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    await deleteProduct(supabase, params.id)
    return noContent()
  } catch (error) {
    return serverError()
  }
}
```

## バリデーション

入力バリデーションはHandler層の重要な責務です。Zodを使用して型安全なバリデーションを実装します。

### Zodスキーマの定義

```typescript
// src/features/products/core/schema.ts
import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  price: z.number().int().positive('Price must be positive'),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
})

export const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price: z.number().int().positive().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

### パスパラメータのバリデーション

```typescript
// src/app/api/products/[id]/route.ts
import { z } from 'zod'
import { badRequest, notFound } from '@/lib/api-response'

const paramsSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // パラメータを検証
  const result = paramsSchema.safeParse(params)
  if (!result.success) {
    return badRequest(result.error.format())
  }

  try {
    const supabase = await createClient()
    const product = await getProduct(supabase, result.data.id)

    if (!product) {
      return notFound('Product not found')
    }

    return ok(product)
  } catch (error) {
    console.error('Failed to fetch product:', error)
    return serverError()
  }
}
```

### 複雑なバリデーション例

```typescript
import { z } from 'zod'

// カスタムバリデーションロジック
const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().min(1).max(999),
    })
  ).min(1, 'At least one item is required'),

  shippingAddress: z.object({
    zipCode: z.string().regex(/^\d{3}-\d{4}$/, 'Invalid zip code format'),
    prefecture: z.string().min(1),
    city: z.string().min(1),
    address: z.string().min(1),
    building: z.string().optional(),
  }),

  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'cash_on_delivery']),

  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    // カスタムバリデーション：銀行振込の場合は注文金額に制限
    if (data.paymentMethod === 'bank_transfer') {
      const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0)
      return totalItems <= 100
    }
    return true
  },
  { message: 'Bank transfer is limited to 100 items' }
)

export async function POST(request: NextRequest) {
  const validation = await validateBody(request, createOrderSchema)
  if (!validation.success) {
    return validation.response
  }

  // バリデーション済みのデータを使用
  const orderData = validation.data
  // ...
}
```

### バリデーションヘルパーの実装

```typescript
// src/lib/validation.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { badRequest } from './api-response'

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response }

export async function validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      return {
        success: false,
        response: badRequest(messages.join(', '))
      }
    }
    return {
      success: false,
      response: badRequest('Invalid request body')
    }
  }
}

export function validateSearchParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      return {
        success: false,
        response: badRequest(messages.join(', '))
      }
    }
    return {
      success: false,
      response: badRequest('Invalid query parameters')
    }
  }
}
```

### クエリパラメータのバリデーション

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getProducts } from '@/features/products'
import { createClient } from '@/lib/supabase/server'
import { ok, serverError } from '@/lib/api-response'
import { validateSearchParams } from '@/lib/validation'

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  categoryId: z.string().uuid().optional(),
})

export async function GET(request: NextRequest) {
  // クエリパラメータのバリデーション
  const validation = validateSearchParams(request, querySchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const products = await getProducts(supabase, validation.data)
    return ok(products)
  } catch (error) {
    return serverError()
  }
}
```

## 認証チェック

認証・認可はHandler層の重要な責務です。リクエストの早い段階で認証状態を確認し、不正なアクセスを防ぎます。

### 基本的な認証チェック

```typescript
// src/app/api/profile/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProfile, updateProfile } from '@/features/users'
import { updateProfileSchema } from '@/features/users/schema'
import { createClient } from '@/lib/supabase/server'
import { ok, unauthorized, serverError } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized('Authentication required')
    }

    const profile = await getProfile(supabase, user.id)
    return ok(profile)
  } catch (error) {
    return serverError()
  }
}

export async function PATCH(request: NextRequest) {
  const validation = await validateBody(request, updateProfileSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized('Authentication required')
    }

    const profile = await updateProfile(supabase, user.id, validation.data)
    return ok(profile)
  } catch (error) {
    return serverError()
  }
}
```

### ロール/権限ベースの認可

```typescript
import { createClient } from '@/lib/supabase/server'
import { unauthorized, forbidden } from '@/lib/api-response'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 認証確認
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return unauthorized('Authentication required')
  }

  // ユーザーのロールを取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 権限確認
  if (profile?.role !== 'admin') {
    return forbidden('Admin access required')
  }

  try {
    await deleteProduct(supabase, params.id)
    return noContent()
  } catch (error) {
    console.error('Failed to delete product:', error)
    return serverError()
  }
}
```

### リソースの所有権チェック

```typescript
// src/app/api/posts/[id]/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getPost, updatePost, deletePost } from '@/features/posts'
import { updatePostSchema } from '@/features/posts/schema'
import { createClient } from '@/lib/supabase/server'
import { ok, unauthorized, forbidden, notFound, serverError } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const validation = await validateBody(request, updatePostSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized('Authentication required')
    }

    // リソースの存在確認
    const post = await getPost(supabase, params.id)
    if (!post) {
      return notFound('Post not found')
    }

    // 所有権チェック
    if (post.userId !== user.id) {
      return forbidden('You do not have permission to update this post')
    }

    const updatedPost = await updatePost(supabase, params.id, validation.data)
    return ok(updatedPost)
  } catch (error) {
    return serverError()
  }
}
```

### 認証ヘルパーの実装

```typescript
// src/lib/auth/helpers.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export async function requireAuth(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Authentication required')
  }

  return user
}

export async function requireAdmin(supabase: SupabaseClient) {
  const user = await requireAuth(supabase)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return { user, profile }
}

export async function requireOwnership(
  supabase: SupabaseClient,
  resourceUserId: string
) {
  const user = await requireAuth(supabase)

  if (user.id !== resourceUserId) {
    throw new Error('You can only access your own resources')
  }

  return user
}
```

```typescript
// src/app/api/profile/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProfile } from '@/features/users'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { ok, unauthorized, serverError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const profile = await getProfile(supabase, user.id)
    return ok(profile)
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorized(error.message)
    }
    return serverError()
  }
}
```

## エラーハンドリング

適切なエラーハンドリングは、ユーザーエクスペリエンスとデバッグの両方にとって重要です。Handler層では、様々なエラーを適切なHTTPレスポンスに変換します。

### API Responseヘルパーの実装

```typescript
// src/lib/api-response.ts
import 'server-only'

import { NextResponse } from 'next/server'

export function ok<T>(data: T) {
  return NextResponse.json(data, { status: 200 })
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function badRequest(message: string = 'Bad request') {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  )
}

export function unauthorized(message: string = 'Unauthorized') {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  )
}

export function forbidden(message: string = 'Forbidden') {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  )
}

export function notFound(message: string = 'Not found') {
  return NextResponse.json(
    { error: message },
    { status: 404 }
  )
}

export function conflict(message: string = 'Conflict') {
  return NextResponse.json(
    { error: message },
    { status: 409 }
  )
}

export function serverError(message: string = 'Internal server error') {
  return NextResponse.json(
    { error: message },
    { status: 500 }
  )
}
```

### AppErrorの活用

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
}
```

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { createProduct } from '@/features/products'
import { createProductSchema } from '@/features/products/core/schema'
import { createClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, validation.data)
    return created(product)
  } catch (error) {
    // AppErrorの場合は適切なステータスコードを返す
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    // 予期しないエラー
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### エラーハンドリングの統一化

```typescript
// src/lib/api-response/error-handler.ts
import 'server-only'

import { AppError } from '@/lib/errors'
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError
} from './index'

export function handleApiError(error: unknown) {
  console.error('API Error:', error)

  if (error instanceof AppError) {
    const statusCode = error.statusCode
    const message = error.message

    if (statusCode === 400) return badRequest(message)
    if (statusCode === 401) return unauthorized(message)
    if (statusCode === 403) return forbidden(message)
    if (statusCode === 404) return notFound(message)
    if (statusCode === 409) return conflict(message)

    return serverError(message)
  }

  // 未知のエラー
  return serverError('An unexpected error occurred')
}
```

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { createProduct } from '@/features/products'
import { createProductSchema } from '@/features/products/core/schema'
import { createClient } from '@/lib/supabase/server'
import { created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { handleApiError } from '@/lib/api-response/error-handler'

export async function POST(request: NextRequest) {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, validation.data)
    return created(product)
  } catch (error) {
    return handleApiError(error)
  }
}
```

### 詳細なエラー処理

```typescript
import { AppError } from '@/lib/errors'
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError
} from '@/lib/api-response'

export async function POST(request: NextRequest) {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const product = await createProduct(supabase, {
      ...validation.data,
      userId: user.id,
    })

    return created(product)
  } catch (error) {
    console.error('Failed to create product:', error)

    if (error instanceof AppError) {
      switch (error.statusCode) {
        case 400:
          return badRequest(error.message)
        case 401:
          return unauthorized(error.message)
        case 403:
          return forbidden(error.message)
        case 404:
          return notFound(error.message)
        case 409:
          return conflict(error.message)
        default:
          return serverError(error.message)
      }
    }

    return serverError('An unexpected error occurred')
  }
}
```

## ネストしたルートの例

Next.jsのファイルベースルーティングを活用して、RESTful APIを構築します。

### 親子関係のリソース

```typescript
// src/app/api/products/[id]/reviews/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getReviews, createReview } from '@/features/products/reviews'
import { createReviewSchema } from '@/features/products/reviews/schema'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { ok, created, unauthorized } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { handleApiError } from '@/lib/api-response/error-handler'

// GET /api/products/[id]/reviews - レビュー一覧
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const reviews = await getReviews(supabase, params.id)
    return ok(reviews)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/products/[id]/reviews - レビュー作成
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const validation = await validateBody(request, createReviewSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const review = await createReview(supabase, {
      productId: params.id,
      userId: user.id,
      ...validation.data,
    })
    return created(review)
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorized(error.message)
    }
    return handleApiError(error)
  }
}
```

### 個別リソースへのアクセス

```typescript
// src/app/api/products/[id]/reviews/[reviewId]/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import {
  getReview,
  updateReview,
  deleteReview
} from '@/features/products/reviews'
import { updateReviewSchema } from '@/features/products/reviews/schema'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { ok, noContent, unauthorized, forbidden, notFound } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { handleApiError } from '@/lib/api-response/error-handler'

type RouteParams = {
  params: {
    id: string          // productId
    reviewId: string
  }
}

// GET /api/products/[id]/reviews/[reviewId]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const review = await getReview(supabase, params.reviewId)

    if (!review) {
      return notFound('Review not found')
    }

    return ok(review)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/products/[id]/reviews/[reviewId]
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const validation = await validateBody(request, updateReviewSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // 所有権確認
    const review = await getReview(supabase, params.reviewId)
    if (!review) {
      return notFound('Review not found')
    }

    if (review.userId !== user.id) {
      return forbidden('You can only edit your own reviews')
    }

    const updated = await updateReview(
      supabase,
      params.reviewId,
      validation.data
    )

    return ok(updated)
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorized(error.message)
    }
    return handleApiError(error)
  }
}

// DELETE /api/products/[id]/reviews/[reviewId]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const review = await getReview(supabase, params.reviewId)
    if (!review) {
      return notFound('Review not found')
    }

    if (review.userId !== user.id) {
      return forbidden('You can only delete your own reviews')
    }

    await deleteReview(supabase, params.reviewId)
    return noContent()
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorized(error.message)
    }
    return handleApiError(error)
  }
}
```

### 複雑なネストルート

```typescript
// src/app/api/users/[userId]/orders/[orderId]/items/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getOrderItems, addOrderItem } from '@/features/orders/items'
import { addOrderItemSchema } from '@/features/orders/items/schema'
import { createClient } from '@/lib/supabase/server'
import { ok, created, forbidden } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { requireAuth } from '@/lib/auth/helpers'
import { handleApiError } from '@/lib/api-response/error-handler'

type RouteParams = {
  params: {
    userId: string
    orderId: string
  }
}

// GET /api/users/[userId]/orders/[orderId]/items
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // ユーザーが自分の注文のみアクセス可能
    if (user.id !== params.userId) {
      return forbidden('You can only access your own orders')
    }

    const items = await getOrderItems(supabase, params.orderId)
    return ok(items)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/users/[userId]/orders/[orderId]/items
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const validation = await validateBody(request, addOrderItemSchema)
  if (!validation.success) {
    return validation.response
  }

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    if (user.id !== params.userId) {
      return forbidden('You can only modify your own orders')
    }

    const item = await addOrderItem(supabase, {
      ...validation.data,
      orderId: params.orderId,
    })

    return created(item)
  } catch (error) {
    return handleApiError(error)
  }
}
```

## ベストプラクティス

### 1. server-only を必ず使用

```typescript
// すべてのAPI Routeファイルの先頭に記述
import 'server-only'

import { NextRequest } from 'next/server'
// ...
```

サーバー専用コードがクライアントバンドルに含まれないことを保証します。セキュリティとバンドルサイズの観点から必須の設定です。

### 2. 標準化されたレスポンス形式

```typescript
// 成功レスポンス
{
  "id": "123",
  "name": "Product Name",
  "price": 1000
}

// エラーレスポンス
{
  "error": "Error message",
  "code": "ERROR_CODE"  // オプション
}
```

一貫性のあるレスポンス形式により、フロントエンドでの処理が簡素化されます。

### 3. 早期リターンパターン

```typescript
export async function POST(request: NextRequest) {
  // 1. バリデーション失敗 → 早期リターン
  const validation = await validateBody(request, schema)
  if (!validation.success) {
    return validation.response
  }

  // 2. 認証チェック → 失敗時は早期リターン
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // 3. 正常系の処理
    const result = await createResource(supabase, validation.data)
    return created(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorized(error.message)
    }
    return handleError(error)
  }
}
```

### 4. 適切なHTTPメソッドとステータスコード

| メソッド | 用途 | 成功時のステータス |
|---------|------|-------------------|
| GET | リソース取得 | 200 OK |
| POST | リソース作成 | 201 Created |
| PUT | リソース完全更新 | 200 OK |
| PATCH | リソース部分更新 | 200 OK |
| DELETE | リソース削除 | 204 No Content |

### 5. 認証が必要なエンドポイントの明示

```typescript
// 認証不要
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  // 公開データの取得
}

// 認証必須
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuth()
  // ユーザー固有の処理
}
```

### 6. バリデーションは可能な限り厳格に

```typescript
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  age: z.number().int().min(0).max(150).optional(),
  role: z.enum(['user', 'admin']).default('user'),
})
```

- 型チェックだけでなく、ビジネスルールも含める
- エラーメッセージは具体的に
- 必須/オプションを明確に

### 7. エラーログの適切な出力

```typescript
export async function POST(request: NextRequest) {
  try {
    const result = await processData()
    return ok(result)
  } catch (error) {
    // 開発環境では詳細ログ
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      })
    } else {
      // 本番環境ではログサービスに送信
      // await logService.error(error)
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    }

    return handleError(error)
  }
}
```

### 8. リクエストのタイムアウト対策

```typescript
// src/lib/timeout.ts
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  })

  return Promise.race([promise, timeout])
}
```

```typescript
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await withTimeout(
      getProducts(supabase),
      5000  // 5秒でタイムアウト
    )
    return ok(products)
  } catch (error) {
    return handleError(error)
  }
}
```

### 9. CORS設定（必要な場合）

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Preflight リクエストの処理
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24時間
      },
    })
  }

  // API ルートのみCORS設定
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()

    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

### 10. テスト可能な構造

```typescript
// Handler層はテストしやすいように薄く保つ
// ビジネスロジックはService層で実装し、そちらをテストする

// ✅ 良い例
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  try {
    const supabase = await createClient()
    const result = await createProduct(supabase, validation.data)  // Service層
    return created(result)
  } catch (error) {
    return handleError(error)
  }
}

// ❌ 悪い例（Handler層にビジネスロジックが含まれている）
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  try {
    const supabase = await createClient()

    // ビジネスロジックをHandler層に書いてはいけない
    if (!validation.data.name?.trim()) {
      throw new Error('Name is required')
    }

    const { data, error } = await supabase
      .from('products')
      .insert({ ...validation.data })
      .select()
      .single()

    if (error) throw error
    return created(data)
  } catch (error) {
    return handleError(error)
  }
}
```

## 使用例

Handler層の実装例を以下に示す。

### 例1: 商品一覧取得API

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProducts } from '@/features/products'
import { createClient } from '@/lib/supabase/server'
import { ok, serverError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    return ok(products)
  } catch (error) {
    return serverError()
  }
}
```

**ポイント**:
- `server-only`を記述し、サーバー専用であることを保証
- Supabaseクライアントを初期化してService層に渡す
- Service層（`getProducts`）を呼び出すだけ
- エラーハンドリングは統一されたヘルパー関数を使用

### 例2: 商品作成API（バリデーション付き）

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { createProduct, createProductSchema } from '@/features/products'
import { createClient } from '@/lib/supabase/server'
import { created, serverError } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  // 1. バリデーション
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  // 2. ビジネスロジック実行
  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, validation.data)
    return created(product)
  } catch (error) {
    return serverError()
  }
}
```

**ポイント**:
- 入力バリデーションを最初に実行
- バリデーション失敗時は早期リターン
- 成功時は201 Createdステータスコードを返却

### 例3: 認証が必要なAPI

```typescript
// src/app/api/profile/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProfile } from '@/features/users'
import { createClient } from '@/lib/supabase/server'
import { ok, unauthorized, serverError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized('Authentication required')
    }

    const profile = await getProfile(supabase, user.id)
    return ok(profile)
  } catch (error) {
    return serverError()
  }
}
```

**ポイント**:
- 認証チェックをビジネスロジック実行前に行う
- 未認証の場合は401ステータスコードで早期リターン
- 認証済みの場合のみService層を呼び出す

### 例4: パラメータバリデーション付きAPI

```typescript
// src/app/api/products/[id]/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getProduct } from '@/features/products'
import { createClient } from '@/lib/supabase/server'
import { ok, badRequest, notFound, serverError } from '@/lib/api-response'

const paramsSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // パラメータを検証
  const result = paramsSchema.safeParse(params)
  if (!result.success) {
    return badRequest(result.error.format())
  }

  try {
    const supabase = await createClient()
    const product = await getProduct(supabase, result.data.id)

    if (!product) {
      return notFound('Product not found')
    }

    return ok(product)
  } catch (error) {
    return serverError()
  }
}
```

**ポイント**:
- URLパラメータもZodでバリデーション
- バリデーション失敗時は400 Bad Request
- リソースが見つからない場合は404 Not Found

## ベストプラクティス

Handler層の実装において推奨するパターンと避けるべきパターンを示す。

### server-onlyの必須化

すべてのAPI Routeファイルの先頭に`import 'server-only'`を記述する。

```typescript
// ✅ 推奨
import 'server-only'

import { NextRequest } from 'next/server'
// ...

// ❌ 避けるべき
import { NextRequest } from 'next/server'
// server-onlyがない
```

### 早期リターンパターン

バリデーションや認証チェックの失敗時は早期リターンする。

```typescript
// ✅ 推奨
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (!validation.success) {
    return validation.response // 早期リターン
  }

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const result = await createResource(supabase, validation.data)
    return created(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorized(error.message)
    }
    return serverError()
  }
}

// ❌ 避けるべき（ネストが深い）
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (validation.success) {
    try {
      const supabase = await createClient()
      const user = await requireAuth(supabase)
      if (user) {
        const result = await createResource(supabase, validation.data)
        return created(result)
      } else {
        return unauthorized()
      }
    } catch (error) {
      return serverError()
    }
  } else {
    return validation.response
  }
}
```

### Handler層は薄く保つ

ビジネスロジックはService層に委譲し、Handler層には記述しない。

```typescript
// ✅ 推奨
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  try {
    const supabase = await createClient()
    const result = await createProduct(supabase, validation.data) // Service層
    return created(result)
  } catch (error) {
    return serverError()
  }
}

// ❌ 避けるべき（Handler層にビジネスロジックが含まれている）
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  try {
    const supabase = await createClient()

    // ビジネスロジックをHandler層に書いてはいけない
    if (!validation.data.name?.trim()) {
      throw new Error('Name is required')
    }

    const { data, error } = await supabase
      .from('products')
      .insert({ ...validation.data })
      .select()
      .single()

    if (error) throw error
    return created(data)
  } catch (error) {
    return serverError()
  }
}
```

## アンチパターン

Handler層でよく見られる問題のあるパターンを示す。

### データベースへの直接アクセス

```typescript
// ❌ 避けるべき
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error) return serverError()
  return ok(data)
}

// ✅ 推奨
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase) // Service層経由
    return ok(products)
  } catch (error) {
    return serverError()
  }
}
```

### 外部APIの直接呼び出し

```typescript
// ❌ 避けるべき
import { stripe } from '@/lib/adapters/stripe/client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const paymentIntent = await stripe.paymentIntents.create({
    amount: body.amount,
  })
  return ok(paymentIntent)
}

// ✅ 推奨
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  try {
    const supabase = await createClient()
    const order = await createOrder(supabase, validation.data) // Service層経由
    return created(order)
  } catch (error) {
    return serverError()
  }
}
```
