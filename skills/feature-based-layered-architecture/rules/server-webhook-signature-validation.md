---
id: server-webhook-signature-validation
title: Webhook署名検証必須
category: サーバーサイド保護
impact: CRITICAL
tags: [server, security, webhook, signature, adapter]
---

## ルール

すべてのWebhookエンドポイントは、外部サービスの署名検証メカニズムを使用してリクエストの署名を検証する。署名検証なしでペイロードを直接パースすることを禁止する。

## NG例

```typescript
// src/app/api/webhooks/stripe/route.ts
// NG: 署名検証なしでペイロードを直接パースしている
import { NextRequest, NextResponse } from 'next/server'
import { orderService } from '@/features/orders/core/service'

export async function POST(request: NextRequest) {
  // NG: 署名ヘッダーを取得していない
  // NG: Adapterの検証メソッドを使用していない
  const payload = await request.text()
  const event = JSON.parse(payload)

  // NG: 未検証のイベントをそのまま処理している
  switch (event.type) {
    case 'checkout.session.completed':
      await orderService.completeOrder(event.data.object)
      break
  }

  return NextResponse.json({ received: true })
}
```

## OK例

```typescript
// src/app/api/webhooks/stripe/route.ts
// OK: 署名検証をビジネスロジックの前に実行している
import { NextRequest, NextResponse } from 'next/server'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { orderService } from '@/features/orders/core/service'

export async function POST(request: NextRequest) {
  // 1. ペイロードと署名ヘッダーを取得する
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: '署名ヘッダーが存在しない' },
      { status: 400 }
    )
  }

  // 2. Adapter経由で署名を検証する
  const event = stripeAdapter.constructWebhookEvent(payload, signature)

  // 3. 検証済みイベントをService層で処理する
  switch (event.type) {
    case 'checkout.session.completed':
      await orderService.completeOrder(event.data.object)
      break
  }

  return NextResponse.json({ received: true })
}
```

```typescript
// src/lib/adapters/stripe/index.ts
// OK: Adapter層で署名検証を責務として持つ
import Stripe from 'stripe'
import { AppError } from '@/lib/errors'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const stripeAdapter = {
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    // Webhookシークレットが未設定の場合はエラーをスローする
    if (!webhookSecret) {
      throw new AppError(
        'STRIPE_WEBHOOK_SECRET が設定されていません',
        500,
        'WEBHOOK_CONFIG_ERROR'
      )
    }

    try {
      // 署名を検証してイベントを構築する
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      )
    } catch {
      // 署名検証失敗時はAppErrorをスローする
      throw new AppError(
        'Webhook署名が無効です',
        400,
        'INVALID_SIGNATURE'
      )
    }
  },
}
```

## 理由

署名検証なしでWebhookイベントを処理すると、アプリケーションの信頼性とセキュリティが損なわれる：

1. **なりすまし防止**: 署名検証がない場合、任意のHTTPクライアントが偽のイベントを送信できる。未払いの注文を支払い済みとして処理するなど、不正なビジネスロジックの実行につながる
2. **データ整合性**: 未検証のイベントはアプリケーションの状態を破壊する可能性がある。署名検証により、イベントが信頼できるサービスから送信されたことを保証する
3. **セキュリティ標準**: Stripe、Resend、GitHubなどの主要な外部サービスはすべてWebhook署名を提供している。署名検証を使用しないことは、セキュリティのベストプラクティスに違反する

署名検証の欠如は、決済処理やデータ同期に関わる重大なインシデントを引き起こす可能性がある。

## 例外

開発・テスト環境でWebhookシークレットが利用できない場合は、外部サービスのテストモードまたはローカルCLI転送ツールを使用する。

```bash
# Stripe CLIでローカル環境にWebhookイベントを転送する
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

本番環境では署名検証を省略しない。

## 参照

- [Adapter層ガイド](../guides/architecture/adapter.md)
- [server-supabase-via-api](server-supabase-via-api.md)
