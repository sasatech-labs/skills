---
id: response-adapter-errors
title: Adapter層のエラー変換
category: レスポンス
impact: HIGH
tags: [adapter, error, apperror, external-api]
---

## ルール

Adapter層は外部APIのエラーをキャッチし、`AppError`に変換してスローする。外部APIのエラーをそのまま上位層に伝搬しない。

## NG例

```typescript
// src/lib/adapters/stripe/index.ts
// NG: 外部APIのエラーをそのままスロー
export const stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    // try-catchなし — Stripe固有のエラーがService層に漏れる
    const intent = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency ?? 'jpy',
    })

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

## OK例

### エラー変換関数を使用する

```typescript
// src/lib/adapters/stripe/errors.ts
import 'server-only'
import Stripe from 'stripe'
import { AppError } from '@/lib/errors'

// 外部APIのエラーをAppErrorに変換する関数
export function handleStripeError(error: unknown): AppError {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case 'StripeCardError':
        return new AppError(`カードエラー: ${error.message}`, 400, 'CARD_ERROR')
      case 'StripeRateLimitError':
        return new AppError('決済サービスが混雑しています', 503, 'RATE_LIMIT')
      case 'StripeInvalidRequestError':
        return new AppError('決済リクエストが不正です', 400, 'INVALID_REQUEST')
      default:
        return new AppError(`決済処理に失敗しました: ${error.message}`, 500, 'STRIPE_ERROR')
    }
  }

  return new AppError('予期しないエラーが発生しました', 500, 'UNEXPECTED_ERROR')
}
```

```typescript
// src/lib/adapters/stripe/index.ts
import 'server-only'
import { stripe } from './client'
import { handleStripeError } from './errors'
import type { CreatePaymentIntentInput, PaymentIntent } from './types'

// OK: try-catchで外部エラーをAppErrorに変換
export const stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency ?? 'jpy',
      })

      return {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        clientSecret: intent.client_secret!,
      }
    } catch (error) {
      // 外部APIのエラーをAppErrorに変換
      throw handleStripeError(error)
    }
  },
}
```

### 既にAppErrorの場合はそのままスロー

```typescript
// src/lib/adapters/resend/index.ts
import 'server-only'
import { resend } from './client'
import { AppError } from '@/lib/errors'
import type { SendEmailInput, EmailResult } from './types'

export const resendAdapter = {
  async sendEmail(input: SendEmailInput): Promise<EmailResult> {
    try {
      const { data, error } = await resend.emails.send({
        from: input.from ?? DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      })

      if (error) {
        throw new AppError(
          `メール送信に失敗しました: ${error.message}`,
          500,
          'EMAIL_ERROR'
        )
      }

      return { id: data!.id }
    } catch (error) {
      // 既にAppErrorの場合はそのままスロー
      if (error instanceof AppError) throw error

      // 予期しないエラーはAppErrorに変換
      throw new AppError(
        'メール送信中に予期しないエラーが発生しました',
        500,
        'EMAIL_UNEXPECTED_ERROR'
      )
    }
  },
}
```

## 理由

外部APIのエラーをそのまま伝搬すると、以下の問題が発生する：

1. **エラー形式の不統一**: 外部サービスごとに異なるエラー形式がService層に漏れ、一貫したエラーハンドリングができない
2. **HTTPステータスの不適切な変換**: 外部APIのエラーコードとアプリケーションのHTTPステータスは1対1対応しない場合がある
3. **外部依存の露出**: 外部サービスのエラー詳細がクライアントに漏れるセキュリティリスクがある

`AppError`に統一することで、Service層は外部サービスのエラー形式を意識する必要がなくなり、`withHTTPError`が一貫したHTTPレスポンスに変換できる。

## 参照

- [architecture/adapter.md](../guides/architecture/adapter.md) - Adapter層の実装ガイド
- [error-handling.md](../guides/error-handling.md) - エラーハンドリングガイド
- [response-apperror](response-apperror.md) - AppError使用ルール
