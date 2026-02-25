---
id: arch-logging-strategy
title: pino を使用した構造化ログ
category: アーキテクチャ
impact: MEDIUM
tags: [logging, pino, observability, debugging]
---

## ルール

pinoを使用して構造化ログを出力する。`console.log`は使用しない。

## 理由

構造化ログを使用する理由は以下の通りである：

1. **検索性の向上**: JSONフォーマットにより、ログ収集サービスで効率的にフィルタリング・検索できる
2. **一貫性の確保**: 全てのログに`requestId`や`layer`などの共通フィールドを含めることで、リクエスト全体を追跡できる
3. **レベル制御**: 環境変数でログレベルを制御し、開発環境では詳細ログ、本番環境では必要最小限のログを出力できる
4. **監視との連携**: 構造化されたログは、監視ツールやアラートシステムと連携しやすい

`console.log`を使用した場合、これらのメリットが失われ、デバッグや障害調査の効率が大幅に低下する。

## OK例

```typescript
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const log = logger.child({ requestId, layer: 'handler', route: '/api/products' })

  try {
    // OK: 構造化されたログ、リクエストIDとレイヤーを含む
    log.info({ operation: 'createProduct', input }, 'Creating product')

    const product = await createProduct(supabase, input)

    // OK: 操作結果を構造化して記録
    log.info({ operation: 'createProduct', productId: product.id }, 'Product created')
    return AppResponse.created(product)
  } catch (error) {
    // OK: エラーオブジェクトとコンテキストを含む
    log.error({ error, operation: 'createProduct' }, 'Failed to create product')
    return AppResponse.serverError()
  }
}
```

## NG例

```typescript
// Handler
export async function POST(request: NextRequest) {
  try {
    console.log('Creating product')  // NG: 構造化されていない
    const product = await createProduct(supabase, input)
    console.log('Product created:', product.id)  // NG: レベル制御できない
    return AppResponse.created(product)
  } catch (error) {
    console.error('Error:', error)  // NG: コンテキストが不足
    return AppResponse.serverError()
  }
}
```

## ログレベルの使い分け

ログレベルの詳細なガイドラインは[arch-logging-levels](arch-logging-levels.md)を参照。

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
