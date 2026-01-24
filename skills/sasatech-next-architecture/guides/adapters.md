# Adapter ガイド

外部サービス（決済、メール、AI など）との連携をカプセル化するレイヤー。

## アーキテクチャ上の位置づけ

```
┌─────────────────────────────────────────────────────────┐
│  app/api/          Handler層 (API Route)               │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│  features/*/       Service層                            │
│                    - ビジネスロジック                   │
│                    - Repository / Adapter を使用       │
└───────────┬─────────────────────────┬───────────────────┘
            │                         │
┌───────────▼───────────┐  ┌──────────▼──────────────────┐
│  features/*/          │  │  lib/adapters/              │
│  Repository層         │  │  Adapter層                  │
│  - Supabaseクエリ     │  │  - 外部API連携              │
└───────────────────────┘  └─────────────────────────────┘
```

**重要**: Adapter は Service 層から呼び出す。Handler から直接呼び出さない。

## 対応サービス例

| カテゴリ | サービス | Adapter 名 |
|---------|---------|------------|
| 決済 | Stripe | `stripeAdapter` |
| メール | Resend | `resendAdapter` |
| AI | OpenAI | `openaiAdapter` |
| ストレージ | Cloudflare R2 | `r2Adapter` |
| 認証 | Auth0 | `auth0Adapter` |

## 基本構成

### ディレクトリ構造

```
src/lib/adapters/
├── index.ts              # 公開API（再エクスポート）
├── stripe/
│   ├── index.ts          # stripeAdapter オブジェクト
│   ├── client.ts         # Stripe クライアント初期化
│   ├── types.ts          # アプリケーション型定義
│   └── errors.ts         # Stripe エラー → AppError 変換
├── resend/
│   ├── index.ts
│   ├── client.ts
│   └── types.ts
└── openai/
    ├── index.ts
    ├── client.ts
    └── types.ts
```

### クライアント初期化

```typescript
// src/lib/adapters/stripe/client.ts
import 'server-only'
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})
```

### 型定義

外部 API の型をそのまま使わず、アプリケーション型を定義:

```typescript
// src/lib/adapters/stripe/types.ts

// 入力型
export interface CreatePaymentIntentInput {
  amount: number
  currency?: string
  customerId?: string
  metadata?: Record<string, string>
}

export interface CreateCustomerInput {
  email: string
  name?: string
  metadata?: Record<string, string>
}

// 出力型（Stripe 型から必要なフィールドのみ）
export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  clientSecret: string
}

export interface Customer {
  id: string
  email: string
  name: string | null
}
```

### Adapter 実装

```typescript
// src/lib/adapters/stripe/index.ts
import 'server-only'
import { stripe } from './client'
import { handleStripeError } from './errors'
import type {
  CreatePaymentIntentInput,
  CreateCustomerInput,
  PaymentIntent,
  Customer,
} from './types'

export const stripeAdapter = {
  // 決済インテント作成
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency ?? 'jpy',
        customer: input.customerId,
        metadata: input.metadata,
      })

      return {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        clientSecret: intent.client_secret!,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  // 顧客作成
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    try {
      const customer = await stripe.customers.create({
        email: input.email,
        name: input.name,
        metadata: input.metadata,
      })

      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  // 顧客取得
  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (customer.deleted) return null

      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },
}
```

### エラーハンドリング

外部 API のエラーを `AppError` に変換:

```typescript
// src/lib/adapters/stripe/errors.ts
import 'server-only'
import Stripe from 'stripe'
import { AppError } from '@/lib/errors'

export function handleStripeError(error: unknown): AppError {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case 'StripeCardError':
        return new AppError(error.message, 400, 'CARD_ERROR')
      case 'StripeRateLimitError':
        return new AppError('決済サービスが混雑しています', 503, 'RATE_LIMIT')
      case 'StripeInvalidRequestError':
        return new AppError('決済リクエストが不正です', 400, 'INVALID_REQUEST')
      case 'StripeAuthenticationError':
        return new AppError('決済認証に失敗しました', 500, 'AUTH_ERROR')
      default:
        return new AppError('決済処理に失敗しました', 500, 'STRIPE_ERROR')
    }
  }

  return new AppError('予期しないエラーが発生しました', 500)
}
```

## メール送信 (Resend)

```typescript
// src/lib/adapters/resend/client.ts
import 'server-only'
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined')
}

export const resend = new Resend(process.env.RESEND_API_KEY)
```

```typescript
// src/lib/adapters/resend/types.ts
export interface SendEmailInput {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  react?: React.ReactNode
  from?: string
}

export interface EmailResult {
  id: string
}
```

```typescript
// src/lib/adapters/resend/index.ts
import 'server-only'
import { resend } from './client'
import { AppError } from '@/lib/errors'
import type { SendEmailInput, EmailResult } from './types'

const DEFAULT_FROM = 'noreply@example.com'

export const resendAdapter = {
  async sendEmail(input: SendEmailInput): Promise<EmailResult> {
    const { data, error } = await resend.emails.send({
      from: input.from ?? DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      react: input.react,
    })

    if (error) {
      throw new AppError(`メール送信に失敗しました: ${error.message}`, 500, 'EMAIL_ERROR')
    }

    return { id: data!.id }
  },
}
```

## Service での使用例

```typescript
// src/features/orders/core/service.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { orderRepository } from './repository'
import type { CreateOrderInput } from './schema'

export async function createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput
) {
  // 1. 決済インテント作成（Stripe Adapter）
  const paymentIntent = await stripeAdapter.createPaymentIntent({
    amount: input.totalAmount,
    metadata: { orderId: input.orderId },
  })

  // 2. 注文レコード作成（Repository）
  const order = await orderRepository.create(supabase, {
    ...input,
    paymentIntentId: paymentIntent.id,
    status: 'pending',
  })

  // 3. 確認メール送信（Resend Adapter）
  await resendAdapter.sendEmail({
    to: input.customerEmail,
    subject: 'ご注文を受け付けました',
    html: `<p>注文番号: ${order.id}</p>`,
  })

  return {
    order,
    clientSecret: paymentIntent.clientSecret,
  }
}
```

## Webhook 処理

外部サービスからの Webhook も Adapter で処理:

```typescript
// src/lib/adapters/stripe/index.ts
export const stripeAdapter = {
  // ... 他のメソッド

  // Webhook 署名検証
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (error) {
      throw new AppError('Webhook 署名が無効です', 400, 'INVALID_SIGNATURE')
    }
  },
}
```

```typescript
// src/app/api/webhooks/stripe/route.ts
import 'server-only'
import { NextRequest } from 'next/server'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { handlePaymentSuccess } from '@/features/payments'
import { ok, badRequest } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')!

  try {
    const event = stripeAdapter.constructWebhookEvent(payload, signature)

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object)
        break
      // ... 他のイベント
    }

    return ok({ received: true })
  } catch (error) {
    return badRequest('Webhook処理に失敗しました')
  }
}
```

## テスト

### Adapter 単体テスト

```typescript
// src/lib/adapters/stripe/__tests__/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { stripeAdapter } from '../index'

// Stripe SDK をモック
vi.mock('../client', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
    },
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
}))

import { stripe } from '../client'

describe('stripeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPaymentIntent', () => {
    it('決済インテントを作成できる', async () => {
      vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
        id: 'pi_test',
        amount: 1000,
        currency: 'jpy',
        status: 'requires_payment_method',
        client_secret: 'secret_test',
      } as any)

      const result = await stripeAdapter.createPaymentIntent({ amount: 1000 })

      expect(result).toEqual({
        id: 'pi_test',
        amount: 1000,
        currency: 'jpy',
        status: 'requires_payment_method',
        clientSecret: 'secret_test',
      })
    })
  })
})
```

### Service テスト（Adapter モック）

```typescript
// src/features/orders/core/__tests__/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Adapter をモック
vi.mock('@/lib/adapters/stripe', () => ({
  stripeAdapter: {
    createPaymentIntent: vi.fn(),
  },
}))

vi.mock('@/lib/adapters/resend', () => ({
  resendAdapter: {
    sendEmail: vi.fn(),
  },
}))

import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { createOrder } from '../service'

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(stripeAdapter.createPaymentIntent).mockResolvedValue({
      id: 'pi_test',
      amount: 1000,
      currency: 'jpy',
      status: 'requires_payment_method',
      clientSecret: 'secret_test',
    })

    vi.mocked(resendAdapter.sendEmail).mockResolvedValue({ id: 'email_test' })
  })

  it('注文を作成し、決済インテントとメールを処理する', async () => {
    // ... テスト実装
  })
})
```

## ベストプラクティス

1. **型変換を必ず行う** - 外部 API の型をそのまま返さない
2. **エラーは AppError に変換** - 一貫したエラーハンドリング
3. **環境変数チェック** - クライアント初期化時に必須チェック
4. **server-only 必須** - すべての Adapter ファイルに記述
5. **リトライは必要に応じて** - 冪等な操作のみリトライ
