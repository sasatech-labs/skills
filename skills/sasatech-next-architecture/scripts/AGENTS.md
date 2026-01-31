# AGENTS.md

このプロジェクトは Feature-based Layer Architecture を採用しています。

## 5つの重要ルール

1. **`getAll` 禁止** - 必ず `MAX_LIMIT` でサーバー側上限を強制
2. **`server-only` 必須** - Service/Repository に必ず記述
3. **`schema.ts` 一元化** - `types.ts` は作らない、`z.infer` で型導出
4. **3層構成** - Handler → Service → Repository を必ず経由
5. **API Route 経由** - クライアントから Supabase 直接使用禁止

## ディレクトリ構成

```
src/
├── app/api/          # Handler層（リクエスト/レスポンス処理）
├── features/         # 機能単位のモジュール
│   └── [feature]/
│       ├── index.ts       # 公開API
│       ├── core/
│       │   ├── schema.ts      # Zodスキーマ + 型定義
│       │   ├── service.ts     # server-only
│       │   └── repository.ts  # server-only
│       ├── fetcher.ts     # クライアント用API呼び出し
│       └── hooks.ts       # React Hooks
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

### route.ts (API Route)

```typescript
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
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) return validation.response

  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, validation.data)
    return created(product)
  } catch (error) {
    return serverError()
  }
}
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
| Fetcher | `src/features/[feature]/fetcher.ts` |
| Hooks | `src/features/[feature]/hooks.ts` |
| Components | `src/features/[feature]/components/` |

## レスポンスヘルパー

```typescript
ok(data)           // 200
created(data)      // 201
noContent()        // 204
badRequest(msg)    // 400
unauthorized()     // 401
forbidden()        // 403
notFound(msg)      // 404
serverError()      // 500
```

## エラーハンドリング

```typescript
throw AppError.badRequest('Invalid input', 'VALIDATION_ERROR')
throw AppError.unauthorized()
throw AppError.forbidden('Cannot edit others posts')
throw AppError.notFound('Product not found')
throw new AppError('Custom error', 400, 'CUSTOM_CODE')
```
