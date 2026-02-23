# AGENTS.md

このプロジェクトは Feature-based Layer Architecture を採用しています。

## ディレクトリ構成

```
src/
├── app/api/          # Handler層（リクエスト/レスポンス処理）
├── features/         # 機能単位のモジュール
│   └── [feature]/
│       ├── index.server.ts   # サーバー専用の公開API（Service, Handler）
│       ├── index.client.ts   # クライアント利用可の公開API（Fetcher, 型）
│       ├── core/
│       │   ├── schema.ts      # Zodスキーマ + 型定義
│       │   ├── service.ts     # server-only
│       │   ├── repository.ts  # server-only
│       │   ├── fetcher.ts     # API呼び出し（SSR/CSR共通）
│       │   └── hooks.ts       # React Hooks
├── components/       # 共通UIコンポーネント
├── lib/              # ユーティリティ
└── types/            # Supabase生成型のみ
```

## ルール

### 型定義

- `types.ts` は作成しない - すべて `schema.ts` に集約
- `src/types/` は Supabase 生成型専用 - 手動で型を追加しない
- Input型は `z.infer<typeof schema>` で導出
- Update スキーマは `createSchema.partial()` で作成

### データ取得

- `getAll` / `findAll` は原則禁止
- 必ずページネーションまたは `MAX_LIMIT` を設ける

```typescript
const MAX_LIMIT = 100
const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
```

### サーバー専用

| ファイル | server-only |
|---------|-------------|
| `service.ts` | 必須 |
| `repository.ts` | 必須 |
| `route.ts` (API) | 必須 |
| `schema.ts` | 付けない |
| `fetcher.ts` | 付けない |
| `hooks.ts` | 付けない |

### 環境変数

- `NEXT_PUBLIC_` プレフィックスは使用しない
- Supabase 接続情報はサーバー専用

### Supabase

- クライアントから直接使用しない
- API Route → Service → Repository 経由でアクセス

## コード生成パターン

### schema.ts

```typescript
// server-only を付けない（フロントエンドでも使用）
import { z } from 'zod'
import type { ProductRow } from '@/types'

export type Product = ProductRow

export const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

### service.ts

```typescript
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, CreateProductInput } from './schema'
import { productRepository } from './repository'

export async function getProducts(supabase: SupabaseClient) {
  return productRepository.findMany(supabase)
}

export async function createProduct(supabase: SupabaseClient, input: CreateProductInput) {
  return productRepository.create(supabase, input)
}
```

### repository.ts

```typescript
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'

const MAX_LIMIT = 100

export const productRepository = {
  async findMany(supabase: SupabaseClient, options = {}) {
    const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
    const offset = options.offset ?? 0

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .range(offset, offset + limit - 1)

    if (error) throw new AppError(error.message, 500)
    return data
  },
}
```

### handler.ts

```typescript
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createProductSchema } from './schema'
import { getProducts, createProduct } from './service'

export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})

export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) return validation.response

  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return AppResponse.created(product)
})
```

### route.ts (API Route)

```typescript
import { handleGetProducts, handleCreateProduct } from '@/features/products/index.server'

export const GET = handleGetProducts
export const POST = handleCreateProduct
```

## 命名規則

| 操作 | Repository | Service | Hook |
|-----|-----------|---------|------|
| 複数取得 | `findMany` | `getProducts` | `useProducts` |
| 1件取得 | `findById` | `getProductById` | `useProduct` |
| 検索 | `search` | `searchProducts` | `useProductSearch` |
| 作成 | `create` | `createProduct` | `useCreateProduct` |
| 更新 | `update` | `updateProduct` | `useUpdateProduct` |
| 削除 | `delete` | `deleteProduct` | `useDeleteProduct` |

## ファイル配置

| ファイル | 配置先 |
|---------|-------|
| API Route | `src/app/api/[feature]/route.ts` |
| Schema | `src/features/[feature]/core/schema.ts` |
| Service | `src/features/[feature]/core/service.ts` |
| Repository | `src/features/[feature]/core/repository.ts` |
| Fetcher | `src/features/[feature]/core/fetcher.ts` |
| Hooks | `src/features/[feature]/core/hooks.ts` |
| Components | `src/features/[feature]/components/` |

## レスポンスヘルパー

```typescript
AppResponse.ok(data)           // 200
AppResponse.created(data)      // 201
AppResponse.noContent()        // 204
AppResponse.badRequest(msg)    // 400
AppResponse.unauthorized()     // 401
AppResponse.forbidden()        // 403
AppResponse.notFound(msg)      // 404
AppResponse.serverError()      // 500
```

## エラーハンドリング

Handler関数は`withHTTPError`でラップする。AppErrorは自動的にHTTPレスポンスに変換される。

```typescript
// Service/Repository層でAppErrorをスロー
throw AppError.badRequest('Invalid input', 'VALIDATION_ERROR')
throw AppError.unauthorized()
throw AppError.forbidden('Cannot edit others posts')
throw AppError.notFound('Product not found')
throw new AppError('Custom error', 400, 'CUSTOM_CODE')
```

