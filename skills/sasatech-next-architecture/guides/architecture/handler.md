# Handler層の実装

## 概要

Handler層は、`features/[feature]/core/handler.ts`で実装される、リクエスト/レスポンスの境界を担当するレイヤーである。API Routeから呼び出され、入力検証、楽観的認証、エラーハンドリングを行い、ビジネスロジックはService層に委譲する。

**対象範囲**: リクエスト処理、バリデーション、楽観的認証、Service層との連携、レスポンス返却

**主要な責務**:
- リクエスト受信とパース
- 入力バリデーション
- 楽観的認証（セッション存在チェック）
- Service層の呼び出し
- エラーハンドリングとレスポンス返却

**禁止事項**:
- ビジネスロジックの実装（Service層の責務）
- データベース直接アクセス（Repository層の責務）
- 外部API直接呼び出し（Adapter層の責務）
- 複雑なデータ変換処理（Service層の責務）

## API RouteとHandler層の関係

アーキテクチャでは、API RouteとHandler層を明確に分離する：

- **API Route** (`app/api/`): 薄いエントリーポイント。Handler関数を呼び出すだけ
- **Handler層** (`features/*/core/handler.ts`): リクエスト/レスポンスの境界。入力検証と楽観的認証を担当

```
app/api/products/route.ts (API Route)
        ↓
features/products/core/handler.ts (Handler層)
        ↓
features/products/core/service.ts (Service層)
```

## 設計思想

Handler層をアーキテクチャの最上位レイヤーとして配置する理由は、以下の通りである。

### アプリケーションの入口を守る

Handler層は、外部からの不正なリクエストや攻撃を早期に排除する。入力検証と楽観的認証チェックを最初に行うことで、不正なデータや未認証のアクセスがアプリケーション内部に到達することを防ぐ。

### 関心事の分離

リクエスト/レスポンスの処理とビジネスロジックを明確に分離する。Handler層はHTTPプロトコルの詳細（ステータスコード、ヘッダー等）を担当し、Service層はビジネスルールに集中する。この分離により、各レイヤーが単一の責務を持ち、保守性が向上する。

### テスト容易性の向上

Handler層を薄く保つことで、ビジネスロジックをService層で独立してテストできる。Handler層自体のテストも、モックされたService層を使用することで簡潔になる。

## 実装パターン

### API Routeの実装

API Routeは薄いエントリーポイントとして、Handler関数を呼び出すだけにする。

```typescript
// src/app/api/products/route.ts
import { handleGetProducts, handleCreateProduct } from '@/features/products'

export const GET = handleGetProducts
export const POST = handleCreateProduct
```

```typescript
// src/app/api/products/[id]/route.ts
import {
  handleGetProduct,
  handleUpdateProduct,
  handleDeleteProduct
} from '@/features/products'

export const GET = handleGetProduct
export const PATCH = handleUpdateProduct
export const DELETE = handleDeleteProduct
```

### Handler層の実装

Handler層は`features/[feature]/core/handler.ts`で実装する。すべてのHandler関数は`withHTTPError`でラップし、エラーハンドリングを統一する。

#### 基本的なGETハンドラー

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts } from './service'

export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return ok(products)
})
```

#### POSTハンドラー（バリデーション付き）

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createProductSchema } from './schema'
import { createProduct } from './service'

export const handleCreateProduct = withHTTPError(async (request) => {
  // 1. バリデーション
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  // 2. ビジネスロジック実行
  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return created(product)
})
```

#### パラメータ付きハンドラー（GET/PATCH/DELETE）

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok, noContent } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { updateProductSchema } from './schema'
import { getProduct, updateProduct, deleteProduct } from './service'

export const handleGetProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()
  const product = await getProduct(supabase, id)
  return ok(product)
})

export const handleUpdateProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const validation = await validateBody(request, updateProductSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const product = await updateProduct(supabase, id, validation.data)
  return ok(product)
})

export const handleDeleteProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()
  await deleteProduct(supabase, id)
  return noContent()
})
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
// src/features/products/core/handler.ts
import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ok, badRequest } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProduct } from './service'

const paramsSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
})

export const handleGetProduct = withHTTPError(async (request, context) => {
  const params = await context.params

  // パラメータを検証
  const result = paramsSchema.safeParse(params)
  if (!result.success) {
    return badRequest(result.error.format())
  }

  const supabase = await createClient()
  const product = await getProduct(supabase, result.data.id)
  return ok(product)
})
```

### 複雑なバリデーション例

```typescript
// src/features/orders/core/schema.ts
import { z } from 'zod'

// カスタムバリデーションロジック
export const createOrderSchema = z.object({
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
```

```typescript
// src/features/orders/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createOrderSchema } from './schema'
import { createOrder } from './service'

export const handleCreateOrder = withHTTPError(async (request) => {
  const validation = await validateBody(request, createOrderSchema)
  if (!validation.success) {
    return validation.response
  }

  // バリデーション済みのデータを使用
  const supabase = await createClient()
  const order = await createOrder(supabase, validation.data)
  return created(order)
})
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
      const message = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return {
        success: false,
        response: badRequest(message)
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
      const message = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return {
        success: false,
        response: badRequest(message)
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
// src/features/products/core/handler.ts
import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { validateSearchParams } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts } from './service'

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  categoryId: z.string().uuid().optional(),
})

export const handleGetProducts = withHTTPError(async (request) => {
  // クエリパラメータのバリデーション
  const validation = validateSearchParams(request, querySchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const products = await getProducts(supabase, validation.data)
  return ok(products)
})
```

## 楽観的認証チェック

Handler層は楽観的認証を担当する。`supabase.auth.getSession()`でセッションの存在を確認し、未認証リクエストを早期に排除する。ロールや所有権などの認可判断はService層で行う。

詳細は[認証・認可ガイド](../authentication.md)を参照。

### 基本的な認証チェック

```typescript
// src/features/users/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { getMyProfile } from './service'

export const handleGetMyProfile = withHTTPError(async (request) => {
  const supabase = await createClient()

  // 楽観的認証: セッション存在チェック
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  // Service層に認証済みユーザーIDを渡す
  const profile = await getMyProfile(supabase, session.user.id)
  return ok(profile)
})
```

### バリデーション + 認証

```typescript
// src/features/posts/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { updatePostSchema } from './schema'
import { updatePost } from './service'

export const handleUpdatePost = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const validation = await validateBody(request, updatePostSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()

  // 楽観的認証
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  // Service層に認証済みユーザーIDを渡す（所有権チェックはService層で行う）
  const post = await updatePost(supabase, session.user.id, id, validation.data)
  return ok(post)
})
```

### 認可はService層で行う

ロール/権限ベースの認可や所有権チェックはService層の責務である。Handler層はセッション存在チェックのみを行い、認証済みユーザーIDをService層に渡す。

```typescript
// src/features/admin/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { getAdminDashboard } from './service'

// Handler層: セッション確認のみ
// ロールチェックはService層（getAdminDashboard内）で行う
export const handleGetAdminDashboard = withHTTPError(async (request) => {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  const dashboard = await getAdminDashboard(supabase, session.user.id)
  return ok(dashboard)
})
```

## エラーハンドリング

適切なエラーハンドリングは、ユーザーエクスペリエンスとデバッグの両方にとって重要である。Handler層では、様々なエラーを適切なHTTPレスポンスに変換する。

### API Responseヘルパーの実装

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

### withHTTPErrorによるエラーハンドリング統一

`withHTTPError`がAppErrorのstatusCodeとcodeをHTTPレスポンスに自動変換する。Handler関数内でtry-catchやAppError判定を記述する必要がない。

```typescript
// src/lib/with-http-error.ts
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { serverError } from '@/lib/api-response'

type RouteContext = { params: Promise<Record<string, string>> }
type HandlerFn = (
  request: NextRequest,
  context: RouteContext
) => Promise<NextResponse>

export function withHTTPError(handler: HandlerFn): HandlerFn {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: { error_code: error.code, message: error.message } },
          { status: error.statusCode }
        )
      }
      return serverError()
    }
  }
}
```

Handler関数はwithHTTPErrorでラップし、正常系のみを記述する。

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createProductSchema } from './schema'
import { createProduct } from './service'

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

```typescript
// src/app/api/products/route.ts
import { handleCreateProduct } from '@/features/products'

export const POST = handleCreateProduct
```

Service層がスローする`AppError(400)`, `AppError(401)`, `AppError(404)`等はすべてwithHTTPErrorが自動的に対応するHTTPレスポンスに変換する。予期しないエラーは500 Internal Server Errorとなる。

## ネストしたルートの例

Next.jsのファイルベースルーティングを活用して、RESTful APIを構築する。

### 親子関係のリソース

```typescript
// src/features/products/reviews/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok, created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createReviewSchema } from './schema'
import { getReviews, createReview } from './service'

// GET /api/products/[id]/reviews - レビュー一覧
export const handleGetReviews = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()
  const reviews = await getReviews(supabase, id)
  return ok(reviews)
})

// POST /api/products/[id]/reviews - レビュー作成
export const handleCreateReview = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const validation = await validateBody(request, createReviewSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const review = await createReview(supabase, {
    productId: id,
    ...validation.data,
  })
  return created(review)
})
```

```typescript
// src/app/api/products/[id]/reviews/route.ts
import { handleGetReviews, handleCreateReview } from '@/features/products/reviews'

export const GET = handleGetReviews
export const POST = handleCreateReview
```

### 個別リソースへのアクセス

```typescript
// src/features/products/reviews/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok, noContent } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { updateReviewSchema } from './schema'
import { getReview, updateReview, deleteReview } from './service'

// GET /api/products/[id]/reviews/[reviewId]
export const handleGetReview = withHTTPError(async (request, context) => {
  const { reviewId } = await context.params
  const supabase = await createClient()
  const review = await getReview(supabase, reviewId)
  return ok(review)
})

// PATCH /api/products/[id]/reviews/[reviewId]
// 認証・所有権チェックはService層で行う
export const handleUpdateReview = withHTTPError(async (request, context) => {
  const { reviewId } = await context.params
  const validation = await validateBody(request, updateReviewSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const updated = await updateReview(supabase, reviewId, validation.data)
  return ok(updated)
})

// DELETE /api/products/[id]/reviews/[reviewId]
export const handleDeleteReview = withHTTPError(async (request, context) => {
  const { reviewId } = await context.params
  const supabase = await createClient()
  await deleteReview(supabase, reviewId)
  return noContent()
})
```

```typescript
// src/app/api/products/[id]/reviews/[reviewId]/route.ts
import {
  handleGetReview,
  handleUpdateReview,
  handleDeleteReview
} from '@/features/products/reviews'

export const GET = handleGetReview
export const PATCH = handleUpdateReview
export const DELETE = handleDeleteReview
```

### 複雑なネストルート

```typescript
// src/features/orders/items/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok, created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { addOrderItemSchema } from './schema'
import { getOrderItems, addOrderItem } from './service'

// GET /api/users/[userId]/orders/[orderId]/items
// 認証・所有権チェックはService層で行う
export const handleGetOrderItems = withHTTPError(async (request, context) => {
  const { userId, orderId } = await context.params
  const supabase = await createClient()
  const items = await getOrderItems(supabase, userId, orderId)
  return ok(items)
})

// POST /api/users/[userId]/orders/[orderId]/items
export const handleAddOrderItem = withHTTPError(async (request, context) => {
  const { userId, orderId } = await context.params
  const validation = await validateBody(request, addOrderItemSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const item = await addOrderItem(supabase, userId, {
    ...validation.data,
    orderId,
  })
  return created(item)
})
```

```typescript
// src/app/api/users/[userId]/orders/[orderId]/items/route.ts
import { handleGetOrderItems, handleAddOrderItem } from '@/features/orders/items'

export const GET = handleGetOrderItems
export const POST = handleAddOrderItem
```

## ベストプラクティス

### 1. server-only を必ず使用

```typescript
// すべてのHandler層ファイルの先頭に記述
import 'server-only'

import { NextRequest } from 'next/server'
// ...
```

サーバー専用コードがクライアントバンドルに含まれないことを保証します。セキュリティとバンドルサイズの観点から必須の設定です。

### 2. 標準化されたレスポンス形式

```typescript
// 成功レスポンス
{
  "data": {
    "id": "123",
    "name": "Product Name",
    "price": 1000
  }
}

// エラーレスポンス
{
  "error": {
    "error_code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

一貫性のあるレスポンス形式により、フロントエンドでの処理が簡素化されます。

### 3. 早期リターンパターン

```typescript
// src/features/[feature]/core/handler.ts
export const handleCreateResource = withHTTPError(async (request) => {
  // 1. バリデーション失敗 → 早期リターン
  const validation = await validateBody(request, schema)
  if (!validation.success) {
    return validation.response
  }

  // 2. 正常系の処理(認証・ビジネスロジックはService層)
  const supabase = await createClient()
  const result = await createResource(supabase, validation.data)
  return created(result)
})
```

### 4. 適切なHTTPメソッドとステータスコード

| メソッド | 用途 | 成功時のステータス |
|---------|------|-------------------|
| GET | リソース取得 | 200 OK |
| POST | リソース作成 | 201 Created |
| PUT | リソース完全更新 | 200 OK |
| PATCH | リソース部分更新 | 200 OK |
| DELETE | リソース削除 | 204 No Content |

### 5. 認証が必要なハンドラーの明示

認証が必要なHandlerでは、`getSession()`で楽観的認証を行い、認証済みユーザーIDをService層に渡す。

```typescript
// src/features/[feature]/core/handler.ts

// 認証不要: getSessionチェックなし
export const handleGetPublicData = withHTTPError(async (request) => {
  const supabase = await createClient()
  const data = await getPublicData(supabase)
  return ok(data)
})

// 認証必須: getSessionでセッション存在を確認
export const handleCreatePrivateData = withHTTPError(async (request) => {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  const data = await createPrivateData(supabase, session.user.id)
  return created(data)
})
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

withHTTPErrorがエラーをキャッチするため、個別のHandler関数でエラーログを出力する必要はない。ログ出力が必要な場合はService層で行う。

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
// src/features/products/core/handler.ts
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await withTimeout(
    getProducts(supabase),
    5000  // 5秒でタイムアウト
  )
  return ok(products)
})
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

Handler層はテストしやすいように薄く保つ。ビジネスロジックはService層で実装し、そちらをテストする。

```typescript
// ✅ 良い例
// src/features/products/core/handler.ts
export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  const supabase = await createClient()
  const result = await createProduct(supabase, validation.data)  // Service層
  return created(result)
})

// ❌ 悪い例（Handler層にビジネスロジックが含まれている）
export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

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
})
```

## 使用例

Handler層の実装例を以下に示す。

### 例1: 商品一覧取得ハンドラー

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts } from './service'

export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return ok(products)
})
```

```typescript
// src/app/api/products/route.ts
import { handleGetProducts } from '@/features/products'

export const GET = handleGetProducts
```

**ポイント**:
- Handler層は`features/`ディレクトリ内に実装
- API Routeは薄いエントリーポイントとして、Handler関数を呼び出すだけ
- `server-only`を記述し、サーバー専用であることを保証
- Service層（`getProducts`）を呼び出すだけ
- エラーハンドリングは統一されたヘルパー関数を使用

### 例2: 商品作成ハンドラー（バリデーション付き）

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { created } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createProductSchema } from './schema'
import { createProduct } from './service'

export const handleCreateProduct = withHTTPError(async (request) => {
  // 1. バリデーション
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  // 2. ビジネスロジック実行
  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return created(product)
})
```

```typescript
// src/app/api/products/route.ts
import { handleCreateProduct } from '@/features/products'

export const POST = handleCreateProduct
```

**ポイント**:
- 入力バリデーションを最初に実行
- バリデーション失敗時は早期リターン
- 成功時は201 Createdステータスコードを返却

### 例3: 認証が必要なハンドラー

```typescript
// src/features/users/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { getMyProfile } from './service'

export const handleGetMyProfile = withHTTPError(async (request) => {
  const supabase = await createClient()

  // 楽観的認証: セッション存在チェック
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  const profile = await getMyProfile(supabase, session.user.id)
  return ok(profile)
})
```

```typescript
// src/app/api/profile/route.ts
import { handleGetMyProfile } from '@/features/users'

export const GET = handleGetMyProfile
```

**ポイント**:
- Handler層で`getSession()`による楽観的認証を行う
- 未認証の場合は`AppError.unauthorized()`で401を返す
- 認証済みユーザーIDをService層に明示的に渡す

### 例4: パラメータバリデーション付きハンドラー

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ok, badRequest } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProduct } from './service'

const paramsSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
})

export const handleGetProduct = withHTTPError(async (request, context) => {
  const params = await context.params

  // パラメータを検証
  const result = paramsSchema.safeParse(params)
  if (!result.success) {
    return badRequest(result.error.format())
  }

  const supabase = await createClient()
  const product = await getProduct(supabase, result.data.id)
  return ok(product)
})
```

```typescript
// src/app/api/products/[id]/route.ts
import { handleGetProduct } from '@/features/products'

export const GET = handleGetProduct
```

**ポイント**:
- URLパラメータもZodでバリデーション
- バリデーション失敗時は400 Bad Request
- リソースが見つからない場合は404 Not Found

## ベストプラクティス

Handler層の実装において推奨するパターンと避けるべきパターンを示す。

### API RouteとHandler層の分離

API Routeは薄いエントリーポイントとして、Handler関数を呼び出すだけにする。

```typescript
// ✅ 推奨
// src/app/api/products/route.ts
import { handleGetProducts, handleCreateProduct } from '@/features/products'

export const GET = handleGetProducts
export const POST = handleCreateProduct

// ❌ 避けるべき（API Route内に直接ロジックを記述）
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*')
  return Response.json(data)
}
```

### server-onlyの必須化

すべてのHandler層ファイルの先頭に`import 'server-only'`を記述する。

```typescript
// ✅ 推奨
// src/features/products/core/handler.ts
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
// src/features/[feature]/core/handler.ts
export const handleCreateResource = withHTTPError(async (request) => {
  const validation = await validateBody(request, schema)
  if (!validation.success) {
    return validation.response // 早期リターン
  }

  const supabase = await createClient()
  const result = await createResource(supabase, validation.data)
  return created(result)
})

// ❌ 避けるべき（ネストが深い、手動try-catch）
export async function handleCreateResource(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (validation.success) {
    try {
      const supabase = await createClient()
      const result = await createResource(supabase, validation.data)
      return created(result)
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
// src/features/products/core/handler.ts
export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  const supabase = await createClient()
  const result = await createProduct(supabase, validation.data) // Service層
  return created(result)
})

// ❌ 避けるべき（Handler層にビジネスロジックが含まれている）
export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

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
})
```

## アンチパターン

Handler層でよく見られる問題のあるパターンを示す。

### API Route内に直接ロジックを記述

```typescript
// ❌ 避けるべき
// src/app/api/products/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// ✅ 推奨
// src/features/products/core/handler.ts
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase) // Service層経由
  return ok(products)
})

// src/app/api/products/route.ts
import { handleGetProducts } from '@/features/products'

export const GET = handleGetProducts
```

### データベースへの直接アクセス

```typescript
// ❌ 避けるべき
// src/features/products/core/handler.ts
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error) throw new AppError(error.message, 500)
  return ok(data)
})

// ✅ 推奨
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase) // Service層経由
  return ok(products)
})
```

### 外部APIの直接呼び出し

```typescript
// ❌ 避けるべき
import { stripe } from '@/lib/adapters/stripe/client'

export const handleCreatePayment = withHTTPError(async (request) => {
  const body = await request.json()
  const paymentIntent = await stripe.paymentIntents.create({
    amount: body.amount,
  })
  return ok(paymentIntent)
})

// ✅ 推奨
export const handleCreateOrder = withHTTPError(async (request) => {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  const supabase = await createClient()
  const order = await createOrder(supabase, validation.data) // Service層経由
  return created(order)
})
```
