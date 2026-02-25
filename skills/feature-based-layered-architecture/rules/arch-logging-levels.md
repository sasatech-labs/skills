---
id: arch-logging-levels
title: ログレベルの使い分け
category: アーキテクチャ
impact: MEDIUM
tags: [logging, pino, log-levels, observability]
---

## ルール

ログレベルはレイヤーと状況に応じて使い分ける。ループ内での`info`は禁止、成功時の詳細は`debug`を使用する。

## 理由

ログレベルを適切に使い分けることで、以下の効果がある：

1. **本番環境のノイズ低減**: debugログは本番では出力されないため、重要なログが埋もれない
2. **パフォーマンスの維持**: ループ内のinfoログは大量のI/Oを発生させ、処理速度を低下させる
3. **障害調査の効率化**: レベルが適切であれば、infoログだけで重要な操作の流れを把握でき、debugに切り替えることで詳細を確認できる

## OK例

### レイヤーごとの適切なレベル使用

```typescript
// Handler層: info（リクエスト開始/終了）, warn（認証失敗）, error（予期しないエラー）
log.info({ method: 'POST', path: '/api/products' }, 'Request received')
log.warn({ userId }, 'Unauthorized access attempt')
log.error({ error }, 'Request failed')
```

```typescript
// Service層: info（重要な業務操作）, warn（業務ルール違反）, debug（詳細な処理情報）
log.info({ productId, newStatus: 'published' }, 'Publishing product')
log.warn({ userId, productId }, 'Unauthorized publish attempt')
log.debug({ count: products.length }, 'Products fetched')
```

```typescript
// Repository層: debug（クエリ実行）, error（DBエラー）
logger.debug({ table: 'products', limit, offset }, 'Executing query')
logger.error({ error, query: 'findMany' }, 'Database query failed')
```

```typescript
// Adapter層: info（外部API呼び出し）, error（外部APIエラー）, debug（レスポンス詳細）
logger.info({ service: 'stripe', operation: 'createPaymentIntent', amount }, 'Calling external API')
logger.error({ service: 'stripe', error }, 'External API error')
logger.debug({ service: 'stripe', intentId: intent.id }, 'API response received')
```

### ループ内はdebugまたはまとめてinfo

```typescript
// src/features/orders/core/service.ts
export async function processOrders(supabase: SupabaseClient, orders: Order[]) {
  // OK: ループ開始時にinfoで件数を記録
  logger.info({ count: orders.length }, 'Processing orders')

  for (const order of orders) {
    // OK: ループ内はdebugを使用
    logger.debug({ orderId: order.id }, 'Processing order')
    await processOrder(supabase, order)
  }

  // OK: ループ完了後にinfoで結果を記録
  logger.info({ count: orders.length }, 'All orders processed')
}
```

## NG例

### すべてinfoで出力

```typescript
// src/features/products/core/service.ts
export async function getProducts(supabase: SupabaseClient) {
  // NG: 詳細な処理情報をinfoで出力している
  logger.info({ layer: 'service' }, 'Getting products')

  const products = await productRepository.findMany(supabase)

  // NG: 成功時の詳細はdebugで出力する
  logger.info({ layer: 'service', count: products.length }, 'Products fetched')

  return products
}
```

### ループ内でinfoログ

```typescript
// src/features/orders/core/service.ts
export async function processOrders(supabase: SupabaseClient, orders: Order[]) {
  for (const order of orders) {
    // NG: ループ内でinfoログを出力するとログが大量に生成される
    logger.info({ orderId: order.id }, 'Processing order')
    await processOrder(supabase, order)
    logger.info({ orderId: order.id }, 'Order processed')
  }
}
```

## レベル別ガイドライン

| レベル | 用途 | 本番出力 |
|--------|------|----------|
| `error` | エラー、例外、外部APIエラー | する |
| `warn` | 警告、業務ルール違反、認証失敗 | する |
| `info` | 重要な業務操作（作成、更新、削除、決済） | する |
| `debug` | クエリ実行、キャッシュヒット/ミス、成功時の詳細 | しない |
| `trace` | 関数の入出力、ループ内の処理詳細 | しない |

## 参照

- [logging.md](../guides/logging.md) - ログ戦略ガイド
- [arch-logging-strategy](arch-logging-strategy.md) - 構造化ログルール
