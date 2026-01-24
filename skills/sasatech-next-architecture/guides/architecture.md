# アーキテクチャガイド

Feature-based Clean Architecture の全体設計。

## レイヤー構成

route.ts → Handler → Service → Repository / Adapter のアーキテクチャ。

```
┌─────────────────────────────────────────────────────────┐
│  app/api/          route.ts (Next.js ルーティング)      │
│                    - handler を re-export するだけ      │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│  features/*/       Handler層                            │
│  handler.ts        - リクエスト/レスポンス処理          │
│                    - バリデーション                     │
│                    - 認証チェック                       │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│  features/*/       Service層                            │
│  service.ts        - ビジネスロジック                   │
│                    - Repository / Adapter を使用       │
└───────────┬─────────────────────────┬───────────────────┘
            │                         │
┌───────────▼───────────┐  ┌──────────▼──────────────────┐
│  features/*/          │  │  lib/adapters/              │
│  Repository層         │  │  Adapter層                  │
│  - Supabaseクエリ     │  │  - 外部API連携              │
│  - データアクセス     │  │  - Stripe, Resend等         │
└───────────────────────┘  └─────────────────────────────┘
```

**Repository**: 内部データストア（Supabase）へのアクセス
**Adapter**: 外部サービス（決済、メール、AI等）への連携

## route.ts と handler.ts の違い

- **route.ts** - Next.js App Router のルーティングファイル。handler を re-export するだけ
- **handler.ts** - 実際の Handler 層。features 内に配置

### なぜ分けるのか

1. **テスタビリティ** - handler.ts は通常の関数としてユニットテスト可能
2. **凝集性** - 機能に関するコードが features 内で完結
3. **一貫性** - すべてのサーバーロジックが features 内にある

## route.ts

handler を re-export するだけの薄いレイヤー。

```typescript
// src/app/api/products/route.ts
export { GET, POST } from '@/features/products/core/handler'
```

```typescript
// src/app/api/products/[id]/route.ts
export { GET, PATCH, DELETE } from '@/features/products/core/handler'
```

## Handler

リクエスト/レスポンスの処理。バリデーションと認証を担当。

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getProducts, createProduct } from './service'
import { createProductSchema } from './schema'
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
  if (!validation.success) {
    return validation.response
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

### ネストしたルートの例

```typescript
// src/features/products/reviews/handler.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { getReviews, createReview } from './service'
import { createClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const reviews = await getReviews(supabase, params.id)
  return ok(reviews)
}
```

```typescript
// src/app/api/products/[id]/reviews/route.ts
export { GET, POST } from '@/features/products/reviews/handler'
```

## Service

ビジネスロジックを担当。Repositoryを通じてデータにアクセス。

```typescript
// src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, CreateProductInput } from './schema'
import { productRepository } from './repository'
import { AppError } from '@/lib/errors'

export async function getProducts(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  return productRepository.findMany(supabase, options)
}

export async function createProduct(
  supabase: SupabaseClient,
  input: CreateProductInput
): Promise<Product> {
  if (!input.name?.trim()) {
    throw new AppError('Name is required', 400)
  }

  return productRepository.create(supabase, {
    name: input.name.trim(),
    price: input.price,
    description: input.description ?? '',
  })
}
```

## Repository

データアクセスを抽象化。Supabaseクエリをカプセル化。

```typescript
// src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from './schema'
import { AppError } from '@/lib/errors'

const MAX_LIMIT = 100  // サーバー側の上限

export const productRepository = {
  async findMany(
    supabase: SupabaseClient,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Product[]> {
    // クライアントのリクエストに関わらず上限を強制
    const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
    const offset = options.offset ?? 0

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new AppError(error.message, 500)
    return data
  },

  async findById(
    supabase: SupabaseClient,
    id: string
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },

  async create(
    supabase: SupabaseClient,
    product: Omit<Product, 'id' | 'created_at'>
  ): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single()

    if (error) throw new AppError(error.message, 500)
    return data
  },
}
```

## Feature ディレクトリ構成

### 単一機能

```
src/features/auth/
├── index.ts          # 公開API
├── handler.ts        # Handler層（server-only）
├── schema.ts         # Zodスキーマ + 型定義
├── service.ts        # server-only
├── repository.ts     # server-only
├── fetcher.ts        # クライアント用
├── hooks.ts          # クライアント用
└── components/
    ├── server/       # Server Components
    └── client/       # Client Components
```

### グループ化された機能

```
src/features/products/
├── index.ts          # 公開API（サブ機能を再エクスポート）
├── core/             # コア機能
│   ├── index.ts
│   ├── handler.ts    # Handler層
│   ├── schema.ts
│   ├── service.ts
│   └── repository.ts
├── reviews/          # サブ機能
│   ├── index.ts
│   ├── handler.ts    # Handler層
│   ├── schema.ts
│   ├── service.ts
│   └── repository.ts
├── fetcher.ts
├── hooks.ts
└── components/
```

## 公開インターフェース

### 単一機能

```typescript
// src/features/auth/index.ts
export { signIn, signUp, signOut } from './service'
export type { User, AuthState } from './schema'
```

### グループ化された機能

```typescript
// src/features/products/index.ts
export * from './core'
export * as reviews from './reviews'
export * as inventory from './inventory'
```

```typescript
// src/features/products/core/index.ts
export { getProducts, createProduct } from './service'
export type { Product, CreateProductInput } from './schema'
```

```typescript
// 利用側
import { getProducts, Product } from '@/features/products'
import { reviews } from '@/features/products'

// または直接インポート
import { getReviews } from '@/features/products/reviews'
```

## 段階的スケーリング

薄い間は単一ファイル、厚くなったらディレクトリに分割。

```
# 薄い構成              # 厚い構成
features/auth/          features/users/
├── schema.ts           ├── schemas/
├── service.ts          │   ├── index.ts
└── repository.ts       │   ├── user.ts
                        │   └── profile.ts
                        ├── services/
                        │   ├── index.ts
                        │   ├── user-service.ts
                        │   └── profile-service.ts
                        └── repositories/
```
