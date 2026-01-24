# ログ戦略ガイド

pino を使用した構造化ログの実装ガイド。

## セットアップ

```bash
npm install pino pino-pretty
```

## ロガー設定

```typescript
// src/lib/logger.ts
import 'server-only'

import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'
const logLevel = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug')

export const logger = pino({
  level: logLevel,
  // 本番: JSON、開発: pretty
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
})

// リクエストごとの子ロガー作成用
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    userId,
  })
}
```

## 環境変数

```bash
# .env.local
LOG_LEVEL=debug

# 本番環境
LOG_LEVEL=info
```

## 使用例

### Handler 層

```typescript
// src/app/api/products/route.ts
import 'server-only'

import { NextRequest } from 'next/server'
import { logger, createRequestLogger } from '@/lib/logger'
import { getProducts, createProduct } from '@/features/products'
import { createClient, getUser } from '@/lib/supabase/server'
import { ok, created, serverError } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { createProductSchema } from '@/features/products/core/schema'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const supabase = await createClient()
  const user = await getUser(supabase)
  const log = createRequestLogger(requestId, user?.id)

  log.info({ layer: 'handler', route: '/api/products', method: 'GET' }, 'Request started')

  try {
    const products = await getProducts(supabase)
    log.info({ layer: 'handler', count: products.length }, 'Request completed')
    return ok(products)
  } catch (error) {
    log.error({ layer: 'handler', error }, 'Request failed')
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const supabase = await createClient()
  const user = await getUser(supabase)
  const log = createRequestLogger(requestId, user?.id)

  log.info({ layer: 'handler', route: '/api/products', method: 'POST' }, 'Request started')

  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    log.warn({ layer: 'handler', errors: validation.errors }, 'Validation failed')
    return validation.response
  }

  try {
    const product = await createProduct(supabase, validation.data, { log })
    log.info({ layer: 'handler', productId: product.id }, 'Product created')
    return created(product)
  } catch (error) {
    log.error({ layer: 'handler', error }, 'Failed to create product')
    return serverError()
  }
}
```

### Service 層

```typescript
// src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from 'pino'
import type { CreateProductInput } from './schema'
import { productRepository } from './repository'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

type ServiceOptions = {
  log?: Logger
}

export async function createProduct(
  supabase: SupabaseClient,
  input: CreateProductInput,
  options: ServiceOptions = {}
) {
  const log = options.log ?? logger

  log.info(
    { layer: 'service', operation: 'createProduct', name: input.name },
    'Creating product'
  )

  // ビジネスロジックのバリデーション
  if (input.price < 0) {
    log.warn(
      { layer: 'service', operation: 'createProduct', price: input.price },
      'Invalid price'
    )
    throw AppError.badRequest('Price must be positive')
  }

  const product = await productRepository.create(supabase, {
    name: input.name.trim(),
    price: input.price,
    description: input.description ?? '',
  })

  log.info(
    { layer: 'service', operation: 'createProduct', productId: product.id },
    'Product created successfully'
  )

  return product
}
```

### Repository 層

```typescript
// src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

const MAX_LIMIT = 100

export const productRepository = {
  async findMany(
    supabase: SupabaseClient,
    options: { limit?: number; offset?: number } = {}
  ) {
    const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
    const offset = options.offset ?? 0

    logger.debug(
      { layer: 'repository', table: 'products', operation: 'findMany', limit, offset },
      'Executing query'
    )

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logger.error(
        { layer: 'repository', table: 'products', operation: 'findMany', error },
        'Query failed'
      )
      throw new AppError(error.message, 500)
    }

    return data
  },
}
```

### Adapter 層

```typescript
// src/lib/adapters/stripe/index.ts
import 'server-only'

import Stripe from 'stripe'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const stripeAdapter = {
  async createPaymentIntent(amount: number, currency = 'jpy') {
    const startTime = Date.now()

    logger.info(
      { layer: 'adapter', service: 'stripe', operation: 'createPaymentIntent', amount, currency },
      'Calling Stripe API'
    )

    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency,
      })

      const duration = Date.now() - startTime
      logger.info(
        { layer: 'adapter', service: 'stripe', operation: 'createPaymentIntent', duration, intentId: intent.id },
        'Stripe API success'
      )

      return {
        id: intent.id,
        clientSecret: intent.client_secret!,
        amount: intent.amount,
        status: intent.status,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(
        { layer: 'adapter', service: 'stripe', operation: 'createPaymentIntent', duration, error },
        'Stripe API failed'
      )

      if (error instanceof Stripe.errors.StripeError) {
        throw new AppError(error.message, 400, 'STRIPE_ERROR')
      }
      throw error
    }
  },
}
```

## ミドルウェアでのログ

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const response = NextResponse.next()

  // レスポンスヘッダーに requestId を追加（デバッグ用）
  response.headers.set('x-request-id', requestId)

  return response
}
```

## ログの構造

### 成功時

```json
{
  "level": 30,
  "time": 1704067200000,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_123",
  "layer": "service",
  "operation": "createProduct",
  "productId": "prod_456",
  "msg": "Product created successfully"
}
```

### エラー時

```json
{
  "level": 50,
  "time": 1704067200000,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_123",
  "layer": "repository",
  "table": "products",
  "operation": "create",
  "error": {
    "message": "duplicate key value violates unique constraint",
    "code": "23505"
  },
  "msg": "Query failed"
}
```

## ログレベル設定

| 環境 | LOG_LEVEL | 出力されるレベル |
|------|-----------|-----------------|
| 開発 | `debug` | debug, info, warn, error, fatal |
| ステージング | `info` | info, warn, error, fatal |
| 本番 | `info` | info, warn, error, fatal |
| デバッグ時 | `trace` | すべて |

## 機密情報のフィルタリング

```typescript
// src/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'email',
      'phone',
    ],
    censor: '[REDACTED]',
  },
})
```

## テスト時のログ抑制

```typescript
// vitest.setup.ts
import { vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))
```

## Vercel でのログ

Vercel では pino の JSON 出力がそのまま使用可能:

```typescript
// 本番環境では transport を指定しない
const isProduction = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // 本番: JSON 出力（Vercel Log Drain 対応）
  // 開発: pino-pretty
  ...(isProduction ? {} : { transport: { target: 'pino-pretty' } }),
})
```

## 関連ルール

- [logging-strategy](../rules/logging-strategy.md) - ログ戦略ルール
- [error-apperror](../rules/error-apperror.md) - エラーハンドリング
