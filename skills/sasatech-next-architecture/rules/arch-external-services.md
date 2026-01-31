---
title: 外部サービス連携は Adapter 経由
impact: HIGH
impactDescription: 外部API依存の隔離が崩れると整合性・保守性を大きく損なう
tags: architecture, adapter, external-api, stripe, resend
---

## 外部サービス連携は Adapter 経由

外部サービス（Stripe、Resend、OpenAI など）への依存は `lib/adapters/` に配置し、Service 層から利用する。

**NG (Service で直接 SDK を使用、依存が密結合):**

```typescript
// src/features/payments/core/service.ts
import 'server-only'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createPaymentIntent(amount: number) {
  // Service で直接 Stripe を使用
  return stripe.paymentIntents.create({
    amount,
    currency: 'jpy',
  })
}
```

**OK (Adapter で外部依存を隔離、テスト容易):**

```typescript
// src/lib/adapters/stripe/index.ts
import 'server-only'
import Stripe from 'stripe'
import type { CreatePaymentIntentInput, PaymentIntent } from './types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const intent = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency ?? 'jpy',
      metadata: input.metadata,
    })

    // Stripe の型をアプリケーション型に変換
    return {
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      clientSecret: intent.client_secret!,
    }
  },
}
```

```typescript
// src/features/payments/core/service.ts
import 'server-only'
import { stripeAdapter } from '@/lib/adapters/stripe'

export async function createPaymentIntent(amount: number) {
  // Adapter 経由で Stripe を使用
  return stripeAdapter.createPaymentIntent({ amount })
}
```

## Adapter の責務

| 責務 | 説明 |
|-----|------|
| API クライアントの初期化 | SDK インスタンス作成、認証情報の設定 |
| 型変換 | 外部 API 型 → アプリケーション型 |
| エラー変換 | 外部 API エラー → AppError |
| リトライ・サーキットブレーカー | 必要に応じて回復ロジック |

## ディレクトリ構成

```
src/lib/adapters/
├── stripe/
│   ├── index.ts      # 公開API
│   ├── client.ts     # Stripeクライアント初期化
│   ├── types.ts      # アプリケーション型定義
│   └── errors.ts     # Stripe固有エラー処理
├── resend/
│   ├── index.ts
│   ├── client.ts
│   └── types.ts
└── index.ts          # 再エクスポート
```

## テスト時のモック

Adapter は Service テストでモックする:

```typescript
// src/features/payments/core/__tests__/service.test.ts
vi.mock('@/lib/adapters/stripe', () => ({
  stripeAdapter: {
    createPaymentIntent: vi.fn().mockResolvedValue({
      id: 'pi_test',
      amount: 1000,
      currency: 'jpy',
      status: 'requires_payment_method',
      clientSecret: 'secret_test',
    }),
  },
}))
```

## 関連ルール

- [arch-three-layers](./arch-three-layers.md) - Handler → Service → Repository, Adapter の構成
- [server-only-directive](./server-only-directive.md) - Adapter にも `server-only` 必須
