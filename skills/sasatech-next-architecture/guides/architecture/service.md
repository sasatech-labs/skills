# Service層の実装

## 概要

Service層は、Feature-based Layer Architectureにおけるビジネスロジックの中核を担うレイヤーである。Repository層やAdapter層を組み合わせて、アプリケーションの主要な処理を実装する。

**対象範囲**: ビジネスロジックの実装、複数のRepositoryやAdapterの連携、ドメインルールの検証、トランザクション管理

**主要な責務**:
- ビジネスロジックの実装
- 複数のRepositoryやAdapterの組み合わせ
- データの加工・変換
- ドメインルールの検証
- エラーハンドリングとビジネス例外のスロー

**禁止事項**:
- リクエスト/レスポンスの処理（Handler層の責務）
- HTTPステータスコードの決定（Handler層の責務）
- データベースクエリの直接実行（Repository層の責務）
- 外部API呼び出しの詳細（Adapter層の責務）

## 設計思想

Service層をビジネスロジックの中核として配置する理由は、以下の通りである。

### ビジネスルールの集約

アプリケーションのビジネスルールは、Service層に集約する。データアクセスや外部API連携の詳細を隠蔽し、「何をするか」に集中する。これにより、ビジネスルールの変更がRepository層やAdapter層に影響しない。

### 再利用性の向上

Service層の関数は、複数のHandlerや他のServiceから再利用できる。同じビジネスロジックを複数の場所で実装する必要がなく、保守性が向上する。

### テスト容易性の確保

Service層は、RepositoryとAdapterに依存するが、これらをモックすることで単体テストが容易になる。ビジネスロジックのテストをデータベースや外部APIから分離できる。

## 実装パターン

### ディレクトリ構成

Service層は`features`ディレクトリ配下に配置します。

```
src/features/products/
├── index.ts          # 公開API
├── core/             # コア機能
│   ├── index.ts
│   ├── schema.ts     # Zodスキーマ + 型定義
│   ├── service.ts    # Service層（server-only）
│   └── repository.ts # Repository層（server-only）
```

### 基本的なServiceファイル構成

```typescript
// src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, CreateProductInput, UpdateProductInput } from './schema'
import { productRepository } from './repository'
import { AppError } from '@/lib/errors'

// 取得系
export async function getProducts(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  return productRepository.findMany(supabase, options)
}

export async function getProduct(
  supabase: SupabaseClient,
  id: string
): Promise<Product> {
  const product = await productRepository.findById(supabase, id)
  if (!product) {
    throw new AppError('Product not found', 404)
  }
  return product
}

// 作成系
export async function createProduct(
  supabase: SupabaseClient,
  input: CreateProductInput
): Promise<Product> {
  // ビジネスルール検証
  if (!input.name?.trim()) {
    throw new AppError('Name is required', 400)
  }

  if (input.price < 0) {
    throw new AppError('Price must be positive', 400)
  }

  // データ加工
  return productRepository.create(supabase, {
    name: input.name.trim(),
    price: input.price,
    description: input.description ?? '',
  })
}

// 更新系
export async function updateProduct(
  supabase: SupabaseClient,
  id: string,
  input: UpdateProductInput
): Promise<Product> {
  // 存在確認
  await getProduct(supabase, id)

  // ビジネスルール検証
  if (input.price !== undefined && input.price < 0) {
    throw new AppError('Price must be positive', 400)
  }

  return productRepository.update(supabase, id, input)
}

// 削除系
export async function deleteProduct(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // 存在確認
  await getProduct(supabase, id)

  await productRepository.delete(supabase, id)
}
```

### 公開APIの定義

```typescript
// src/features/products/core/index.ts
export {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from './service'

export type {
  Product,
  CreateProductInput,
  UpdateProductInput,
} from './schema'
```

```typescript
// src/features/products/index.ts
export * from './core'
export * as reviews from './reviews'
```

## ビジネスロジックの実装方法

### 単純なビジネスロジック

単一のRepositoryを使用する場合。

```typescript
// src/features/auth/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { authRepository } from './repository'
import { AppError } from '@/lib/errors'
import bcrypt from 'bcrypt'

export async function signIn(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  // 1. ユーザー取得
  const user = await authRepository.findByEmail(supabase, email)
  if (!user) {
    throw new AppError('Invalid credentials', 401)
  }

  // 2. パスワード検証
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new AppError('Invalid credentials', 401)
  }

  // 3. セッション情報を返す
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}
```

### 複雑なビジネスロジック

複数のRepositoryやAdapterを組み合わせる場合。

```typescript
// src/features/orders/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreateOrderInput, Order } from './schema'
import { orderRepository } from './repository'
import { productRepository } from '@/features/products/core/repository'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { AppError } from '@/lib/errors'

export async function createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput
): Promise<{ order: Order; clientSecret: string }> {
  // 1. 商品の在庫確認
  const product = await productRepository.findById(supabase, input.productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  if (product.stock < input.quantity) {
    throw new AppError('Insufficient stock', 400)
  }

  // 2. 金額計算
  const totalAmount = product.price * input.quantity

  // 3. 決済インテント作成（Stripe Adapter）
  const paymentIntent = await stripeAdapter.createPaymentIntent({
    amount: totalAmount,
    currency: 'jpy',
    metadata: {
      productId: product.id,
      quantity: String(input.quantity),
    },
  })

  // 4. 注文レコード作成（Repository）
  const order = await orderRepository.create(supabase, {
    productId: product.id,
    quantity: input.quantity,
    totalAmount,
    paymentIntentId: paymentIntent.id,
    customerEmail: input.customerEmail,
    status: 'pending',
  })

  // 5. 確認メール送信（Resend Adapter）
  await resendAdapter.sendEmail({
    to: input.customerEmail,
    subject: 'ご注文を受け付けました',
    html: `
      <h1>ご注文ありがとうございます</h1>
      <p>注文番号: ${order.id}</p>
      <p>商品: ${product.name}</p>
      <p>数量: ${input.quantity}</p>
      <p>合計金額: ¥${totalAmount.toLocaleString()}</p>
    `,
  })

  return {
    order,
    clientSecret: paymentIntent.clientSecret,
  }
}
```

### 条件分岐を含むビジネスロジック

```typescript
// src/features/subscriptions/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreateSubscriptionInput } from './schema'
import { subscriptionRepository } from './repository'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { AppError } from '@/lib/errors'

export async function createSubscription(
  supabase: SupabaseClient,
  userId: string,
  input: CreateSubscriptionInput
) {
  // 1. 既存のサブスクリプション確認
  const existing = await subscriptionRepository.findActiveByUserId(
    supabase,
    userId
  )

  if (existing) {
    // アップグレード or ダウングレード
    if (input.planId === existing.planId) {
      throw new AppError('Already subscribed to this plan', 400)
    }

    return await upgradeSubscription(supabase, userId, existing, input.planId)
  }

  // 2. 新規サブスクリプション作成
  const subscription = await stripeAdapter.createSubscription({
    customerId: input.stripeCustomerId,
    priceId: input.planId,
  })

  return subscriptionRepository.create(supabase, {
    userId,
    planId: input.planId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  })
}

async function upgradeSubscription(
  supabase: SupabaseClient,
  userId: string,
  existing: Subscription,
  newPlanId: string
) {
  // プラン変更処理
  const updated = await stripeAdapter.updateSubscription(
    existing.stripeSubscriptionId,
    { priceId: newPlanId }
  )

  return subscriptionRepository.update(supabase, existing.id, {
    planId: newPlanId,
    status: updated.status,
  })
}
```

### データ集計・変換ロジック

```typescript
// src/features/analytics/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyticsSummary } from './schema'
import { orderRepository } from '@/features/orders/core/repository'
import { userRepository } from '@/features/users/repository'

export async function getAnalyticsSummary(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsSummary> {
  // 1. 期間内の注文取得
  const orders = await orderRepository.findByDateRange(
    supabase,
    startDate,
    endDate
  )

  // 2. 集計処理
  const totalRevenue = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  )

  const ordersByStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 3. ユーザー数取得
  const totalUsers = await userRepository.count(supabase)

  // 4. データ変換
  return {
    period: { start: startDate, end: endDate },
    revenue: {
      total: totalRevenue,
      average: orders.length > 0 ? totalRevenue / orders.length : 0,
    },
    orders: {
      total: orders.length,
      byStatus: ordersByStatus,
    },
    users: {
      total: totalUsers,
    },
  }
}
```

## Repository/Adapterの使用方法

### Repositoryの使用

Repositoryは内部データストア（Supabase）へのアクセスをカプセル化します。

```typescript
// src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'
import { categoryRepository } from '@/features/categories/repository'
import { AppError } from '@/lib/errors'

export async function getProductsWithCategory(
  supabase: SupabaseClient,
  categoryId: string
) {
  // 1. カテゴリの存在確認
  const category = await categoryRepository.findById(supabase, categoryId)
  if (!category) {
    throw new AppError('Category not found', 404)
  }

  // 2. カテゴリに紐づく商品を取得
  const products = await productRepository.findByCategoryId(
    supabase,
    categoryId
  )

  return {
    category,
    products,
  }
}

export async function moveProductToCategory(
  supabase: SupabaseClient,
  productId: string,
  newCategoryId: string
) {
  // 1. 商品の存在確認
  const product = await productRepository.findById(supabase, productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  // 2. カテゴリの存在確認
  const category = await categoryRepository.findById(supabase, newCategoryId)
  if (!category) {
    throw new AppError('Category not found', 404)
  }

  // 3. 商品のカテゴリを更新
  return productRepository.update(supabase, productId, {
    categoryId: newCategoryId,
  })
}
```

### Adapterの使用

Adapterは外部サービス（決済、メール、AI等）との連携をカプセル化します。

```typescript
// src/features/payments/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { paymentRepository } from './repository'
import { orderRepository } from '@/features/orders/core/repository'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { AppError } from '@/lib/errors'

export async function processPayment(
  supabase: SupabaseClient,
  orderId: string,
  paymentMethodId: string
) {
  // 1. 注文情報取得
  const order = await orderRepository.findById(supabase, orderId)
  if (!order) {
    throw new AppError('Order not found', 404)
  }

  if (order.status !== 'pending') {
    throw new AppError('Order already processed', 400)
  }

  try {
    // 2. 決済処理（Stripe Adapter）
    const paymentIntent = await stripeAdapter.confirmPayment({
      paymentIntentId: order.paymentIntentId,
      paymentMethodId,
    })

    // 3. 決済レコード作成
    const payment = await paymentRepository.create(supabase, {
      orderId: order.id,
      amount: order.totalAmount,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    })

    // 4. 注文ステータス更新
    await orderRepository.update(supabase, orderId, {
      status: 'paid',
      paidAt: new Date(),
    })

    // 5. 完了メール送信（Resend Adapter）
    await resendAdapter.sendEmail({
      to: order.customerEmail,
      subject: 'お支払いが完了しました',
      html: `
        <h1>お支払いありがとうございます</h1>
        <p>注文番号: ${order.id}</p>
        <p>お支払い金額: ¥${order.totalAmount.toLocaleString()}</p>
      `,
    })

    return { payment, order }
  } catch (error) {
    // 決済失敗時の処理
    await orderRepository.update(supabase, orderId, {
      status: 'failed',
    })

    throw error
  }
}
```

### 複数Adapterの組み合わせ

```typescript
// src/features/invoices/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { invoiceRepository } from './repository'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { r2Adapter } from '@/lib/adapters/r2'
import { generateInvoicePDF } from './pdf-generator'

export async function createAndSendInvoice(
  supabase: SupabaseClient,
  orderId: string
) {
  // 1. 請求書レコード作成
  const invoice = await invoiceRepository.create(supabase, {
    orderId,
    invoiceNumber: generateInvoiceNumber(),
    issuedAt: new Date(),
  })

  // 2. PDF生成
  const pdfBuffer = await generateInvoicePDF(invoice)

  // 3. PDFをストレージにアップロード（R2 Adapter）
  const { url } = await r2Adapter.uploadFile({
    key: `invoices/${invoice.id}.pdf`,
    body: pdfBuffer,
    contentType: 'application/pdf',
  })

  // 4. 請求書URLを更新
  await invoiceRepository.update(supabase, invoice.id, {
    pdfUrl: url,
  })

  // 5. メール送信（Resend Adapter）
  await resendAdapter.sendEmail({
    to: invoice.customerEmail,
    subject: `請求書 #${invoice.invoiceNumber}`,
    html: `
      <h1>請求書を発行しました</h1>
      <p>請求書番号: ${invoice.invoiceNumber}</p>
      <p><a href="${url}">PDFをダウンロード</a></p>
    `,
  })

  return invoice
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `INV-${year}${month}-${random}`
}
```

## エラーハンドリング

### AppErrorの使用

Service層では、ビジネスロジックに関するエラーを`AppError`として投げます。

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

```typescript
// src/features/products/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { productRepository } from './repository'
import { AppError } from '@/lib/errors'

export async function getProduct(
  supabase: SupabaseClient,
  id: string
) {
  const product = await productRepository.findById(supabase, id)

  if (!product) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND')
  }

  return product
}

export async function createProduct(
  supabase: SupabaseClient,
  input: CreateProductInput
) {
  // バリデーション
  if (!input.name?.trim()) {
    throw new AppError('Name is required', 400, 'VALIDATION_ERROR')
  }

  if (input.price < 0) {
    throw new AppError('Price must be positive', 400, 'VALIDATION_ERROR')
  }

  if (input.stock !== undefined && input.stock < 0) {
    throw new AppError('Stock must be non-negative', 400, 'VALIDATION_ERROR')
  }

  // 重複チェック
  const existing = await productRepository.findByName(supabase, input.name)
  if (existing) {
    throw new AppError('Product name already exists', 409, 'DUPLICATE_NAME')
  }

  return productRepository.create(supabase, input)
}
```

### Adapterエラーの処理

Adapterから投げられたエラーは、すでに`AppError`に変換されているため、そのまま伝播させるか、必要に応じてラップします。

```typescript
// src/features/payments/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { AppError } from '@/lib/errors'

export async function createPaymentIntent(
  supabase: SupabaseClient,
  amount: number
) {
  try {
    // Adapterは内部でAppErrorに変換済み
    const paymentIntent = await stripeAdapter.createPaymentIntent({
      amount,
      currency: 'jpy',
    })

    return paymentIntent
  } catch (error) {
    if (error instanceof AppError) {
      // Adapterからのエラーをそのまま伝播
      throw error
    }

    // 予期しないエラー
    throw new AppError('Payment creation failed', 500)
  }
}
```

### 複数操作のエラーハンドリング

```typescript
// src/features/orders/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { orderRepository } from './repository'
import { productRepository } from '@/features/products/core/repository'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { AppError } from '@/lib/errors'

export async function createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput
) {
  let paymentIntentId: string | undefined

  try {
    // 1. 商品確認
    const product = await productRepository.findById(supabase, input.productId)
    if (!product) {
      throw new AppError('Product not found', 404)
    }

    // 2. 決済インテント作成
    const paymentIntent = await stripeAdapter.createPaymentIntent({
      amount: product.price * input.quantity,
      currency: 'jpy',
    })
    paymentIntentId = paymentIntent.id

    // 3. 注文作成
    const order = await orderRepository.create(supabase, {
      ...input,
      paymentIntentId: paymentIntent.id,
      status: 'pending',
    })

    // 4. メール送信（失敗しても注文は成立）
    try {
      await resendAdapter.sendEmail({
        to: input.customerEmail,
        subject: 'ご注文を受け付けました',
        html: `<p>注文番号: ${order.id}</p>`,
      })
    } catch (emailError) {
      // メール送信失敗はログに記録するが、エラーは投げない
      console.error('Failed to send order confirmation email:', emailError)
    }

    return {
      order,
      clientSecret: paymentIntent.clientSecret,
    }
  } catch (error) {
    // 決済インテントが作成された場合はキャンセル
    if (paymentIntentId) {
      try {
        await stripeAdapter.cancelPaymentIntent(paymentIntentId)
      } catch (cancelError) {
        console.error('Failed to cancel payment intent:', cancelError)
      }
    }

    throw error
  }
}
```

## トランザクション処理

Supabaseでトランザクション処理を実装する方法。

### 基本的なトランザクション

```typescript
// src/features/transfers/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { accountRepository } from '@/features/accounts/repository'
import { transactionRepository } from './repository'
import { AppError } from '@/lib/errors'

export async function transferMoney(
  supabase: SupabaseClient,
  fromAccountId: string,
  toAccountId: string,
  amount: number
) {
  if (amount <= 0) {
    throw new AppError('Amount must be positive', 400)
  }

  if (fromAccountId === toAccountId) {
    throw new AppError('Cannot transfer to same account', 400)
  }

  // Supabaseのトランザクション処理（RPC関数を使用）
  const { data, error } = await supabase.rpc('transfer_money', {
    p_from_account_id: fromAccountId,
    p_to_account_id: toAccountId,
    p_amount: amount,
  })

  if (error) {
    throw new AppError(error.message, 500)
  }

  return data
}
```

### トランザクション用のRPC関数（SQL）

```sql
-- Supabase Database で作成する関数
CREATE OR REPLACE FUNCTION transfer_money(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_balance DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- 送金元の残高確認
  SELECT balance INTO v_from_balance
  FROM accounts
  WHERE id = p_from_account_id
  FOR UPDATE;

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'From account not found';
  END IF;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- 送金元から引く
  UPDATE accounts
  SET balance = balance - p_amount
  WHERE id = p_from_account_id;

  -- 送金先に加える
  UPDATE accounts
  SET balance = balance + p_amount
  WHERE id = p_to_account_id;

  -- トランザクション記録作成
  INSERT INTO transactions (from_account_id, to_account_id, amount, status)
  VALUES (p_from_account_id, p_to_account_id, p_amount, 'completed')
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'transaction_id', v_transaction_id,
    'from_account_id', p_from_account_id,
    'to_account_id', p_to_account_id,
    'amount', p_amount
  );
END;
$$;
```

### アプリケーションレベルでのトランザクション的な処理

複数のリソースを扱う場合、補償トランザクションパターンを使用します。

```typescript
// src/features/reservations/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { reservationRepository } from './repository'
import { roomRepository } from '@/features/rooms/repository'
import { paymentRepository } from '@/features/payments/repository'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { AppError } from '@/lib/errors'

export async function createReservation(
  supabase: SupabaseClient,
  input: CreateReservationInput
) {
  let reservationId: string | undefined
  let paymentIntentId: string | undefined

  try {
    // 1. 部屋の空き確認
    const available = await roomRepository.checkAvailability(
      supabase,
      input.roomId,
      input.checkIn,
      input.checkOut
    )

    if (!available) {
      throw new AppError('Room not available', 409)
    }

    // 2. 予約作成
    const reservation = await reservationRepository.create(supabase, {
      ...input,
      status: 'pending',
    })
    reservationId = reservation.id

    // 3. 決済インテント作成
    const paymentIntent = await stripeAdapter.createPaymentIntent({
      amount: input.totalAmount,
      metadata: { reservationId: reservation.id },
    })
    paymentIntentId = paymentIntent.id

    // 4. 予約に決済情報を紐付け
    await reservationRepository.update(supabase, reservation.id, {
      paymentIntentId: paymentIntent.id,
    })

    return {
      reservation,
      clientSecret: paymentIntent.clientSecret,
    }
  } catch (error) {
    // ロールバック処理
    if (reservationId) {
      try {
        await reservationRepository.delete(supabase, reservationId)
      } catch (rollbackError) {
        console.error('Failed to rollback reservation:', rollbackError)
      }
    }

    if (paymentIntentId) {
      try {
        await stripeAdapter.cancelPaymentIntent(paymentIntentId)
      } catch (rollbackError) {
        console.error('Failed to cancel payment intent:', rollbackError)
      }
    }

    throw error
  }
}
```

## ベストプラクティス

### 1. server-only を必ず記述

```typescript
// src/features/products/core/service.ts
import 'server-only'  // ← 必須

import type { SupabaseClient } from '@supabase/supabase-js'
// ...
```

### 2. 型安全性を確保

```typescript
// BAD: any を使用
export async function getProduct(supabase: any, id: any): Promise<any> {
  return productRepository.findById(supabase, id)
}

// GOOD: 明示的な型定義
export async function getProduct(
  supabase: SupabaseClient,
  id: string
): Promise<Product> {
  const product = await productRepository.findById(supabase, id)
  if (!product) {
    throw new AppError('Product not found', 404)
  }
  return product
}
```

### 3. 単一責任の原則

Service関数は1つの明確な責務を持つべきです。

```typescript
// BAD: 複数の責務が混在
export async function handleOrder(supabase: SupabaseClient, input: any) {
  // 注文作成
  const order = await orderRepository.create(supabase, input)

  // 在庫更新
  await productRepository.update(supabase, input.productId, {
    stock: input.stock - input.quantity
  })

  // メール送信
  await resendAdapter.sendEmail({ ... })

  // 分析データ更新
  await analyticsRepository.increment(supabase, 'orders')

  return order
}

// GOOD: 責務を分割
export async function createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput
): Promise<Order> {
  return orderRepository.create(supabase, input)
}

export async function processOrderCreated(
  supabase: SupabaseClient,
  order: Order
): Promise<void> {
  // 在庫更新
  await updateProductStock(supabase, order.productId, -order.quantity)

  // 通知送信
  await sendOrderConfirmation(order)

  // 分析データ更新
  await recordOrderAnalytics(supabase, order)
}
```

### 4. 入力の検証

```typescript
// GOOD: ビジネスルールを検証
export async function createProduct(
  supabase: SupabaseClient,
  input: CreateProductInput
): Promise<Product> {
  // 必須項目チェック
  if (!input.name?.trim()) {
    throw new AppError('Name is required', 400)
  }

  // 値の範囲チェック
  if (input.price < 0) {
    throw new AppError('Price must be positive', 400)
  }

  // ビジネスルールチェック
  if (input.discountPrice && input.discountPrice >= input.price) {
    throw new AppError('Discount price must be less than regular price', 400)
  }

  return productRepository.create(supabase, {
    name: input.name.trim(),
    price: input.price,
    discountPrice: input.discountPrice,
  })
}
```

### 5. 適切なエラーハンドリング

```typescript
// GOOD: エラーを適切に分類
export async function deleteProduct(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // 存在確認
  const product = await productRepository.findById(supabase, id)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  // ビジネスルールチェック
  const hasOrders = await orderRepository.existsByProductId(supabase, id)
  if (hasOrders) {
    throw new AppError('Cannot delete product with existing orders', 409)
  }

  await productRepository.delete(supabase, id)
}
```

### 6. Repository/Adapterの直接exportは避ける

```typescript
// BAD: Repositoryを直接export
export { productRepository } from './repository'

// GOOD: Service関数を通じて公開
export async function getProducts(
  supabase: SupabaseClient,
  options?: GetProductsOptions
): Promise<Product[]> {
  return productRepository.findMany(supabase, options)
}
```

### 7. オプション引数にはデフォルト値を提供

```typescript
// GOOD: デフォルト値を提供
export async function getProducts(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  const limit = options.limit ?? 20
  const offset = options.offset ?? 0

  return productRepository.findMany(supabase, { limit, offset })
}
```

### 8. テスタビリティを考慮

```typescript
// GOOD: 依存関係を明示的に渡す
export async function createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput,
  // テスト時にモック可能
  deps = {
    orderRepo: orderRepository,
    stripeAdapter,
    resendAdapter,
  }
) {
  const paymentIntent = await deps.stripeAdapter.createPaymentIntent({
    amount: input.totalAmount,
  })

  const order = await deps.orderRepo.create(supabase, {
    ...input,
    paymentIntentId: paymentIntent.id,
  })

  await deps.resendAdapter.sendEmail({
    to: input.customerEmail,
    subject: 'Order confirmation',
    html: `Order #${order.id}`,
  })

  return order
}
```

### 9. ログ出力を適切に行う

```typescript
// GOOD: 重要な処理にログを追加
export async function processPayment(
  supabase: SupabaseClient,
  orderId: string,
  paymentMethodId: string
) {
  console.log(`Processing payment for order ${orderId}`)

  try {
    const paymentIntent = await stripeAdapter.confirmPayment({
      paymentIntentId,
      paymentMethodId,
    })

    console.log(`Payment succeeded for order ${orderId}`, {
      paymentIntentId: paymentIntent.id,
    })

    return paymentIntent
  } catch (error) {
    console.error(`Payment failed for order ${orderId}`, error)
    throw error
  }
}
```

### 10. 段階的なスケーリング

薄い機能は単一ファイル、厚くなったら分割します。

```typescript
// 薄い構成: src/features/auth/service.ts
export async function signIn(...) { }
export async function signUp(...) { }
export async function signOut(...) { }

// 厚い構成: src/features/users/services/
// ├── index.ts
// ├── user-service.ts
// ├── profile-service.ts
// └── settings-service.ts
```

## 使用例

Service層の実装例を以下に示す。

### 例1: 単純なCRUD処理

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
  // ビジネスルール検証
  if (!input.name?.trim()) {
    throw new AppError('Name is required', 400)
  }

  if (input.price < 0) {
    throw new AppError('Price must be positive', 400)
  }

  // データ加工
  return productRepository.create(supabase, {
    name: input.name.trim(),
    price: input.price,
    description: input.description ?? '',
  })
}
```

**ポイント**:
- ビジネスルールの検証をService層で実装
- データ加工（trim、デフォルト値設定）もService層で行う
- Repositoryはデータアクセスのみを担当

### 例2: 複数Repository/Adapterの連携

```typescript
// src/features/orders/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreateOrderInput, Order } from './schema'
import { orderRepository } from './repository'
import { productRepository } from '@/features/products/core/repository'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { AppError } from '@/lib/errors'

export async function createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput
): Promise<{ order: Order; clientSecret: string }> {
  // 1. 商品の在庫確認
  const product = await productRepository.findById(supabase, input.productId)
  if (!product) {
    throw new AppError('Product not found', 404)
  }

  if (product.stock < input.quantity) {
    throw new AppError('Insufficient stock', 400)
  }

  // 2. 金額計算
  const totalAmount = product.price * input.quantity

  // 3. 決済インテント作成（Stripe Adapter）
  const paymentIntent = await stripeAdapter.createPaymentIntent({
    amount: totalAmount,
    currency: 'jpy',
    metadata: {
      productId: product.id,
      quantity: String(input.quantity),
    },
  })

  // 4. 注文レコード作成（Repository）
  const order = await orderRepository.create(supabase, {
    productId: product.id,
    quantity: input.quantity,
    totalAmount,
    paymentIntentId: paymentIntent.id,
    customerEmail: input.customerEmail,
    status: 'pending',
  })

  // 5. 確認メール送信（Resend Adapter）
  await resendAdapter.sendEmail({
    to: input.customerEmail,
    subject: 'ご注文を受け付けました',
    html: `<h1>ご注文ありがとうございます</h1><p>注文番号: ${order.id}</p>`,
  })

  return {
    order,
    clientSecret: paymentIntent.clientSecret,
  }
}
```

**ポイント**:
- 複数のRepositoryとAdapterを組み合わせる
- ビジネスロジック（在庫確認、金額計算）をService層で実装
- 各ステップが明確に分離されている

### 例3: トランザクション処理

```typescript
// src/features/transfers/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { accountRepository } from '@/features/accounts/repository'
import { AppError } from '@/lib/errors'

export async function transferMoney(
  supabase: SupabaseClient,
  fromAccountId: string,
  toAccountId: string,
  amount: number
) {
  if (amount <= 0) {
    throw new AppError('Amount must be positive', 400)
  }

  if (fromAccountId === toAccountId) {
    throw new AppError('Cannot transfer to same account', 400)
  }

  // Supabaseのトランザクション処理（RPC関数を使用）
  const { data, error } = await supabase.rpc('transfer_money', {
    p_from_account_id: fromAccountId,
    p_to_account_id: toAccountId,
    p_amount: amount,
  })

  if (error) {
    throw new AppError(error.message, 500)
  }

  return data
}
```

**ポイント**:
- ビジネスルール（金額の妥当性、口座の一致チェック）を検証
- トランザクションが必要な処理はRPC関数を使用

## アンチパターン

Service層でよく見られる問題のあるパターンを示す。

### Handlerからの直接データベースアクセス

```typescript
// ❌ 避けるべき（Handler層にビジネスロジックとデータアクセス）
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .insert({ ...body })
    .select()
    .single()

  if (error) return serverError()
  return created(data)
}

// ✅ 推奨（Service層を経由）
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
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

### Repositoryの直接エクスポート

```typescript
// ❌ 避けるべき（Repositoryを直接公開）
export { productRepository } from './repository'

// ✅ 推奨（Service関数を通じて公開）
export async function getProducts(
  supabase: SupabaseClient,
  options?: GetProductsOptions
): Promise<Product[]> {
  return productRepository.findMany(supabase, options)
}
```
