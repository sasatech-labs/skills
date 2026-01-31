---
title: pino を使用した構造化ログ
impact: MEDIUM
impactDescription: ログの非構造化はデバッグ・監視の品質と一貫性を低下させる
tags: logging, pino, observability, debugging
---

## pino を使用した構造化ログ

pino を使用して構造化ログを出力する。console.log は使用しない。

**NG (console.log を使用、情報が不足):**

```typescript
// Handler
export async function POST(request: NextRequest) {
  try {
    console.log('Creating product')  // 構造化されていない
    const product = await createProduct(supabase, input)
    console.log('Product created:', product.id)
    return created(product)
  } catch (error) {
    console.error('Error:', error)  // コンテキストが不足
    return serverError()
  }
}
```

**OK (pino で構造化ログ):**

```typescript
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const log = logger.child({ requestId, layer: 'handler', route: '/api/products' })

  try {
    log.info({ operation: 'createProduct', input }, 'Creating product')

    const product = await createProduct(supabase, input)

    log.info({ operation: 'createProduct', productId: product.id }, 'Product created')
    return created(product)
  } catch (error) {
    log.error({ error, operation: 'createProduct' }, 'Failed to create product')
    return serverError()
  }
}
```

## ログレベルの使い分け

| レベル | 用途 | 例 |
|--------|------|-----|
| `fatal` | アプリ停止レベル | DB 接続不可、必須サービス停止 |
| `error` | エラー、例外 | DB エラー、外部 API エラー |
| `warn` | 警告、想定外の状態 | レート制限接近、非推奨 API 使用 |
| `info` | 重要な操作 | ユーザー作成、注文確定、決済完了 |
| `debug` | デバッグ情報 | クエリ実行、キャッシュヒット/ミス |
| `trace` | 詳細なトレース | 関数の入出力、ループ内処理 |

## 各レイヤーでのログ

### Handler 層

```typescript
// リクエスト開始/終了、認証情報、エラー
log.info({ method: 'POST', path: '/api/products', userId }, 'Request received')
log.error({ error, statusCode: 500 }, 'Request failed')
```

### Service 層

```typescript
// ビジネスロジックの重要な操作
log.info({ productId, newStatus: 'published' }, 'Publishing product')
log.warn({ userId, attemptedProductId }, 'Unauthorized publish attempt')
```

### Repository 層

```typescript
// DB エラーのみ（成功時は debug）
log.debug({ table: 'products', limit, offset }, 'Executing query')
log.error({ error, query: 'findMany' }, 'Database query failed')
```

### Adapter 層

```typescript
// 外部 API 呼び出しと結果
log.info({ service: 'stripe', operation: 'createPaymentIntent', amount }, 'Calling Stripe')
log.error({ service: 'stripe', error }, 'Stripe API error')
```

## 構造化ログの必須フィールド

```typescript
// 必須フィールド
{
  requestId: string    // リクエスト追跡用
  layer: string        // 'handler' | 'service' | 'repository' | 'adapter'
  operation: string    // 操作名（createProduct, findById 等）
}

// 推奨フィールド
{
  userId?: string      // 認証済みユーザー
  duration?: number    // 処理時間 (ms)
  error?: unknown      // エラーオブジェクト
}
```

## 本番環境と開発環境

```typescript
// 開発: pino-pretty で見やすく
// 本番: JSON 形式でログ収集サービスへ

// 環境変数でレベル制御
LOG_LEVEL=debug  // 開発
LOG_LEVEL=info   // 本番
```

## 禁止事項

1. **機密情報をログに出力しない**
   - パスワード、API キー、トークン
   - 個人情報（メールアドレス、電話番号）は必要最小限

2. **console.log/error を使用しない**
   - 構造化されない、レベル制御できない

3. **過剰なログを出力しない**
   - ループ内での info ログ
   - 成功時の詳細ログ（debug にする）

## 関連ファイル

- `src/lib/logger.ts` - ロガー設定
- [guides/logging.md](../guides/logging.md) - 詳細ガイド
