# Adapter層の実装

## 概要

Adapter層は、外部サービス（決済、メール、AI等）やデータソースとの連携をカプセル化するレイヤーである。Service層から呼び出し、Handler層から直接呼び出してはいけない。

**対象範囲**: 外部サービスSDKのラッパー、型変換、エラーハンドリング、認証情報の管理

**主要な責務**:
- 外部サービスAPIの抽象化
- 外部APIの型をアプリケーション型に変換
- 外部APIのエラーを`AppError`に統一
- APIキー、シークレットの初期化と検証

**禁止事項**:
- Handler層から直接呼び出す（Service層経由が必須）
- 外部APIの型をそのまま返す（必ずアプリケーション型に変換）

## 設計思想

Adapter層を外部サービス連携の抽象化レイヤーとして配置する理由は、以下の通りである。

### 外部依存の隠蔽

アプリケーションが外部ライブラリに直接依存しないようにする。外部APIの変更やサービスの切り替えが、Service層に影響しない。

### 型の統一

外部APIの型はそれぞれ異なるが、Adapter層でアプリケーション固有の型に変換することで、Service層は統一されたインターフェースでアクセスできる。

### エラーハンドリングの一元化

外部サービスごとに異なるエラー形式を、`AppError`に統一して変換する。Service層は外部サービスのエラー形式を意識する必要がない。

## 2つのAdapterパターン

Adapter層には設置場所により、2つのパターンが存在する。

### 1. 共通処理のAdapter（`src/lib/adapters/`）

**目的**: 純粋な技術的抽象化

- 外部サービスSDK（Stripe、Resend、OpenAI等）の薄いラッパー
- ビジネスロジックを含まない
- 複数のFeatureから再利用される
- 型変換とエラーハンドリングのみを担当

**例**: `stripeAdapter`, `resendAdapter`, `openaiAdapter`

### 2. Features内のAdapter（`src/features/{feature-name}/core/adapter.ts`）

**目的**: Feature固有のビジネスロジックを含むデータソース抽象化

- 特定のFeatureでしか使わない外部API連携
- Feature固有のビジネスルールや計算を含む
- ドメイン知識を必要とする変換処理
- 他のFeatureからは利用しない

**例**: 在庫管理Feature専用の倉庫管理システムAdapter、商品カタログFeature専用のPIM（Product Information Management）システムAdapter

## 使い分け基準

どちらのパターンを使うべきか判断するためのフローチャート：

```
外部サービス/データソースと連携が必要？
  ↓ YES
複数のFeatureから使用される？
  ↓ YES → 共通処理のAdapter（src/lib/adapters/）
  ↓ NO
Feature固有のビジネスロジックや計算を含む？
  ↓ YES → Features内のAdapter（src/features/{feature-name}/core/adapters/）
  ↓ NO → 共通処理のAdapter（src/lib/adapters/）
```

### 判断基準の詳細

| 基準 | 共通処理のAdapter | Features内のAdapter |
|------|------------------|---------------------|
| **再利用性** | 複数のFeatureから利用 | 特定のFeatureのみ |
| **ビジネスロジック** | 含まない（純粋な技術的ラッパー） | 含む（ドメイン知識が必要） |
| **依存関係** | 外部SDKのみに依存 | Feature固有の型やルールに依存 |
| **変更頻度** | 低い（外部APIの変更時のみ） | 高い（ビジネス要件の変更時） |
| **テスト** | 外部API仕様のテスト | ビジネスロジックのテスト |

### 具体例での判断

#### 共通処理のAdapterの例

- **Stripe決済**: 決済自体は汎用的。注文、サブスク、寄付など様々なFeatureで利用
- **Resendメール送信**: メール送信は技術的な処理。各Featureが内容を決める
- **OpenAI API**: AI補完は汎用的。チャット、要約、翻訳など様々な用途で利用

#### Features内のAdapterの例

- **倉庫管理システムAdapter**: 在庫Featureのビジネスルール（入出庫ロジック、在庫引当）を含む
- **PIMシステムAdapter**: 商品カタログFeatureの商品属性マッピングやバリデーションを含む
- **会計システムAdapter**: 経理Featureの勘定科目マッピングや仕訳ルールを含む

## Adapter層の役割と責務

### 主な責務

1. **外部サービスAPIの抽象化**
   - 外部SDKの詳細をアプリケーションから隠蔽
   - 一貫したインターフェースを提供

2. **型変換**
   - 外部APIの型をアプリケーション型に変換する
   - アプリケーションが外部ライブラリに依存しないようにする

3. **エラーハンドリング**
   - 外部APIのエラーを`AppError`に統一
   - 適切なステータスコードとエラーメッセージを設定する

4. **認証情報の管理**
   - APIキー、シークレットの初期化と検証を行う
   - 環境変数の必須チェックを行う

### レイヤー間の関係

```
Handler層
  ↓（直接呼び出し禁止）
Service層
  ↓（ここから呼び出す）
Adapter層 → 外部API（Stripe、Resend、OpenAI等）
```

**重要**: Adapter層はService層からのみ呼び出し、Handler層から直接呼び出すことは出来ません。

## 対応サービス例

### 共通処理のAdapter（`src/lib/adapters/`）

汎用的な外部サービスの例：

| カテゴリ | サービス | Adapter 名 | 用途 |
|---------|---------|------------|------|
| 決済 | Stripe | `stripeAdapter` | クレジットカード決済、サブスクリプション |
| メール | Resend | `resendAdapter` | トランザクションメール送信 |
| AI | OpenAI | `openaiAdapter` | チャット補完、埋め込み生成 |
| ストレージ | Cloudflare R2 | `r2Adapter` | オブジェクトストレージ |
| 認証 | Auth0 | `auth0Adapter` | 外部認証プロバイダー連携 |
| 画像処理 | Cloudinary | `cloudinaryAdapter` | 画像変換、最適化 |
| SMS | Twilio | `twilioAdapter` | SMS送信、電話認証 |

### Features内のAdapter（`src/features/{feature-name}/core/adapters/`）

Feature固有のビジネスロジックを含む外部連携の例：

| Feature | サービス | Adapter 名 | 用途 | ビジネスロジック例 |
|---------|---------|------------|------|--------------------|
| inventory（在庫） | 倉庫管理システム | `warehouseAdapter` | 在庫引当、倉庫間移動 | FEFO方式の引当ロジック、優先度計算 |
| catalog（商品カタログ） | PIMシステム | `pimAdapter` | 商品情報同期 | 属性マッピング、カテゴリ階層変換 |
| accounting（経理） | 会計システム | `accountingAdapter` | 仕訳データ連携 | 勘定科目マッピング、仕訳ルール適用 |
| shipping（配送） | 配送業者API | `shippingAdapter` | 配送手配、追跡 | 配送ルート最適化、料金計算 |
| crm（顧客管理） | 外部CRMシステム | `crmAdapter` | 顧客データ同期 | セグメント計算、スコアリングロジック |

## 実装パターン

### 共通処理のAdapter構造

複数のFeatureから利用される汎用的な外部サービスのAdapterは `src/lib/adapters/` に配置します。

```
src/lib/adapters/
├── index.ts              # 公開API（再エクスポート）
├── stripe/
│   ├── index.ts          # stripeAdapter オブジェクト
│   ├── client.ts         # Stripe クライアント初期化
│   ├── types.ts          # アプリケーション型定義
│   └── errors.ts         # Stripe エラー → AppError 変換
├── resend/
│   ├── index.ts          # resendAdapter オブジェクト
│   ├── client.ts         # Resend クライアント初期化
│   └── types.ts          # アプリケーション型定義
└── openai/
    ├── index.ts          # openaiAdapter オブジェクト
    ├── client.ts         # OpenAI クライアント初期化
    └── types.ts          # アプリケーション型定義
```

### Features内のAdapter構造

特定のFeatureでしか使わない、またはビジネスロジックを含むAdapterは `src/features/{feature-name}/core/adapters/` に配置します。

```
src/features/inventory/     # 在庫管理Feature
└── core/
    ├── adapters/
    │   ├── warehouse/      # 倉庫管理システムAdapter
    │   │   ├── index.ts    # warehouseAdapter オブジェクト
    │   │   ├── client.ts   # クライアント初期化
    │   │   ├── types.ts    # 在庫Feature固有の型
    │   │   └── mapper.ts   # ビジネスロジックを含むマッパー
    │   └── index.ts        # Feature内Adapterの再エクスポート
    ├── repository.ts
    ├── service.ts
    └── schema.ts

src/features/catalog/       # 商品カタログFeature
└── core/
    ├── adapters/
    │   ├── pim/            # PIMシステムAdapter
    │   │   ├── index.ts    # pimAdapter オブジェクト
    │   │   ├── client.ts   # クライアント初期化
    │   │   ├── types.ts    # カタログFeature固有の型
    │   │   └── validator.ts # 商品属性バリデーション
    │   └── index.ts
    ├── repository.ts
    ├── service.ts
    └── schema.ts
```

**重要な違い**:
- 共通処理のAdapterは `src/lib/adapters/index.ts` で一元的に再エクスポート
- Features内のAdapterはFeature外からは利用しない（再エクスポート不要）
- Features内のAdapterはビジネスロジック（mapper、validator等）を含むことができる

### 共通処理Adapterの公開API（index.ts）

```typescript
// src/lib/adapters/index.ts
export { stripeAdapter } from './stripe'
export { resendAdapter } from './resend'
export { openaiAdapter } from './openai'

// 必要に応じて型も再エクスポート
export type {
  CreatePaymentIntentInput,
  PaymentIntent,
} from './stripe/types'

export type {
  SendEmailInput,
  EmailResult,
} from './resend/types'
```

## クライアント初期化

各Adapterは専用のクライアント初期化ファイルを持ちます。

### Stripe クライアント

```typescript
// src/lib/adapters/stripe/client.ts
import 'server-only'
import Stripe from 'stripe'

// 環境変数の必須チェック
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

// Stripe クライアントのシングルトン初期化
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',  // 最新の安定版APIバージョンを指定
  typescript: true,                  // TypeScript型サポートを有効化
})
```

### Resend クライアント

```typescript
// src/lib/adapters/resend/client.ts
import 'server-only'
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined')
}

export const resend = new Resend(process.env.RESEND_API_KEY)
```

### OpenAI クライアント

```typescript
// src/lib/adapters/openai/client.ts
import 'server-only'
import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
```

### クライアント初期化のポイント

1. **`server-only`必須** - すべてのclient.tsファイルの先頭に記述
2. **環境変数の早期チェック** - アプリケーション起動時にエラーを検出
3. **シングルトンパターン** - クライアントインスタンスは1つだけ作成
4. **型安全性** - TypeScriptサポートを有効化

## 型定義

外部APIの型をそのまま使わず、アプリケーション専用の型を定義します。

### Stripe 型定義

```typescript
// src/lib/adapters/stripe/types.ts

// 入力型：外部から受け取るデータ
export interface CreatePaymentIntentInput {
  amount: number                      // 金額（最小単位、例：JPYなら円）
  currency?: string                   // 通貨コード（デフォルト：'jpy'）
  customerId?: string                 // Stripe顧客ID（オプション）
  metadata?: Record<string, string>   // カスタムメタデータ
}

export interface CreateCustomerInput {
  email: string                       // 顧客メールアドレス（必須）
  name?: string                       // 顧客名（オプション）
  metadata?: Record<string, string>   // カスタムメタデータ
}

export interface CreateSubscriptionInput {
  customerId: string                  // Stripe顧客ID
  priceId: string                     // Stripe価格ID
  trialPeriodDays?: number           // トライアル期間（日数）
}

// 出力型：外部APIから必要なフィールドのみ抽出
export interface PaymentIntent {
  id: string                          // 決済インテントID
  amount: number                      // 金額
  currency: string                    // 通貨
  status: string                      // ステータス
  clientSecret: string                // クライアント用シークレット
}

export interface Customer {
  id: string                          // 顧客ID
  email: string                       // メールアドレス
  name: string | null                 // 顧客名
}

export interface Subscription {
  id: string                          // サブスクリプションID
  customerId: string                  // 顧客ID
  status: string                      // ステータス
  currentPeriodEnd: Date             // 現在の期間終了日
}
```

### Resend 型定義

```typescript
// src/lib/adapters/resend/types.ts
import type React from 'react'

// 入力型
export interface SendEmailInput {
  to: string | string[]               // 宛先（単一または複数）
  subject: string                     // 件名
  html?: string                       // HTMLメール本文
  text?: string                       // プレーンテキスト本文
  react?: React.ReactNode            // React コンポーネント
  from?: string                       // 送信元（デフォルト値あり）
  replyTo?: string                   // 返信先
  attachments?: EmailAttachment[]    // 添付ファイル
}

export interface EmailAttachment {
  filename: string                    // ファイル名
  content: Buffer | string           // ファイル内容
  contentType?: string               // MIMEタイプ
}

// 出力型
export interface EmailResult {
  id: string                          // メールID
}
```

### OpenAI 型定義

```typescript
// src/lib/adapters/openai/types.ts

// 入力型
export interface ChatCompletionInput {
  model?: string                      // モデル名（デフォルト：'gpt-4o'）
  messages: ChatMessage[]             // メッセージ履歴
  temperature?: number               // 温度パラメータ（0-2）
  maxTokens?: number                 // 最大トークン数
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CreateEmbeddingInput {
  text: string                        // 埋め込み対象テキスト
  model?: string                      // モデル名（デフォルト：'text-embedding-3-small'）
}

// 出力型
export interface ChatCompletion {
  id: string                          // 補完ID
  content: string                     // 生成されたテキスト
  model: string                       // 使用されたモデル
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface Embedding {
  embedding: number[]                 // 埋め込みベクトル
  model: string                       // 使用されたモデル
}
```

### 型定義のポイント

1. **外部型に依存しない** - Stripe.PaymentIntentなど外部型を直接使わない
2. **必要なフィールドのみ** - アプリケーションで使用するフィールドだけ抽出
3. **明示的なnull** - nullになり得るフィールドは型に明記
4. **デフォルト値の文書化** - コメントでデフォルト値を記載

## Adapter実装例

### 共通処理のAdapter実装例

#### Stripe Adapter

完全な実装例です。

```typescript
// src/lib/adapters/stripe/index.ts
import 'server-only'
import { stripe } from './client'
import { handleStripeError } from './errors'
import type {
  CreatePaymentIntentInput,
  CreateCustomerInput,
  CreateSubscriptionInput,
  PaymentIntent,
  Customer,
  Subscription,
} from './types'

const _stripeAdapter = {
  /**
   * 決済インテント作成
   * クライアント側で決済を完了するためのインテントを生成
   */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency ?? 'jpy',
        customer: input.customerId,
        metadata: input.metadata,
        automatic_payment_methods: {
          enabled: true,  // 利用可能な決済方法を自動有効化
        },
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

  /**
   * 決済インテント取得
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null> {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

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

  /**
   * 顧客作成
   */
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

  /**
   * 顧客取得
   */
  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customer = await stripe.customers.retrieve(customerId)

      // 削除された顧客の場合はnullを返す
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

  /**
   * 顧客の決済方法一覧取得
   */
  async listPaymentMethods(customerId: string) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      })

      return paymentMethods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : null,
      }))
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  /**
   * サブスクリプション作成
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: input.customerId,
        items: [{ price: input.priceId }],
        trial_period_days: input.trialPeriodDays,
      })

      return {
        id: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  /**
   * サブスクリプションキャンセル
   */
  async cancelSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId)

      return {
        id: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },
}

export const stripeAdapter = _stripeAdapter
```

#### Resend Adapter

```typescript
// src/lib/adapters/resend/index.ts
import 'server-only'
import { resend } from './client'
import { AppError } from '@/lib/errors'
import type { SendEmailInput, EmailResult } from './types'

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'

const _resendAdapter = {
  /**
   * メール送信
   * HTMLまたはReactコンポーネントでメールを送信
   */
  async sendEmail(input: SendEmailInput): Promise<EmailResult> {
    try {
      const { data, error } = await resend.emails.send({
        from: input.from ?? DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        react: input.react,
        reply_to: input.replyTo,
        attachments: input.attachments,
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

      // 予期しないエラー
      throw new AppError(
        'メール送信中に予期しないエラーが発生しました',
        500,
        'EMAIL_UNEXPECTED_ERROR'
      )
    }
  },

  /**
   * Reactコンポーネントでメール送信（ヘルパー）
   */
  async sendReactEmail(
    to: string | string[],
    subject: string,
    reactComponent: React.ReactNode,
    options?: {
      from?: string
      replyTo?: string
    }
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      react: reactComponent,
      from: options?.from,
      replyTo: options?.replyTo,
    })
  },
}

export const resendAdapter = _resendAdapter
```

#### OpenAI Adapter

```typescript
// src/lib/adapters/openai/index.ts
import 'server-only'
import { openai } from './client'
import { AppError } from '@/lib/errors'
import type {
  ChatCompletionInput,
  CreateEmbeddingInput,
  ChatCompletion,
  Embedding,
} from './types'

const DEFAULT_CHAT_MODEL = 'gpt-4o'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'

const _openaiAdapter = {
  /**
   * チャット補完
   */
  async createChatCompletion(input: ChatCompletionInput): Promise<ChatCompletion> {
    try {
      const completion = await openai.chat.completions.create({
        model: input.model ?? DEFAULT_CHAT_MODEL,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
      })

      const choice = completion.choices[0]
      if (!choice?.message?.content) {
        throw new AppError('AIからの応答が空です', 500, 'EMPTY_RESPONSE')
      }

      return {
        id: completion.id,
        content: choice.message.content,
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        },
      }
    } catch (error) {
      if (error instanceof AppError) throw error

      throw new AppError(
        'AI補完処理に失敗しました',
        500,
        'OPENAI_ERROR'
      )
    }
  },

  /**
   * 埋め込み生成
   */
  async createEmbedding(input: CreateEmbeddingInput): Promise<Embedding> {
    try {
      const response = await openai.embeddings.create({
        model: input.model ?? DEFAULT_EMBEDDING_MODEL,
        input: input.text,
      })

      return {
        embedding: response.data[0].embedding,
        model: response.model,
      }
    } catch (error) {
      throw new AppError(
        '埋め込み生成に失敗しました',
        500,
        'EMBEDDING_ERROR'
      )
    }
  },
}

export const openaiAdapter = _openaiAdapter
```

### Features内のAdapter実装例

#### 倉庫管理システムAdapter（在庫Feature専用）

Features内のAdapterは、Feature固有のビジネスロジックを含みます。

```typescript
// src/features/inventory/core/adapters/warehouse/types.ts
export interface WarehouseLocation {
  warehouseId: string
  zone: string
  rack: string
  bin: string
}

export interface StockAllocationInput {
  productId: string
  quantity: number
  orderId: string
  priority: 'normal' | 'urgent'  // Feature固有のビジネスルール
}

export interface StockAllocationResult {
  allocationId: string
  allocatedFrom: WarehouseLocation[]
  totalAllocated: number
  partialAllocation: boolean
}

export interface WarehouseTransferInput {
  productId: string
  quantity: number
  fromWarehouse: string
  toWarehouse: string
  reason: string
}
```

```typescript
// src/features/inventory/core/adapters/warehouse/client.ts
import 'server-only'

// 倉庫管理システムのSDK（仮想例）
import { WarehouseManagementClient } from '@example/warehouse-sdk'

if (!process.env.WAREHOUSE_API_KEY) {
  throw new Error('WAREHOUSE_API_KEY is not defined')
}

export const warehouseClient = new WarehouseManagementClient({
  apiKey: process.env.WAREHOUSE_API_KEY,
  endpoint: process.env.WAREHOUSE_API_ENDPOINT,
})
```

```typescript
// src/features/inventory/core/adapters/warehouse/mapper.ts
import 'server-only'
import type { WarehouseLocation } from './types'

/**
 * 倉庫管理システムのロケーション形式をFeature固有の形式に変換
 * ビジネスルール: Zone-Rack-Bin形式でソート優先度を決定
 */
function _mapToWarehouseLocation(externalLocation: any): WarehouseLocation {
  return {
    warehouseId: externalLocation.warehouse_id,
    zone: externalLocation.zone_code,
    rack: externalLocation.rack_number,
    bin: externalLocation.bin_position,
  }
}

/**
 * 在庫引当の優先順位を計算（Feature固有のビジネスロジック）
 * ルール:
 * 1. 出荷口に近いゾーン優先
 * 2. 同一ゾーン内では賞味期限が近いものを優先（FEFO）
 */
function _calculateAllocationPriority(
  locations: WarehouseLocation[],
  expirationDates: Record<string, Date>
): WarehouseLocation[] {
  const zoneOrder = ['A', 'B', 'C', 'D']  // 出荷口からの距離順

  return locations.sort((a, b) => {
    // ゾーン優先度で比較
    const zoneA = zoneOrder.indexOf(a.zone)
    const zoneB = zoneOrder.indexOf(b.zone)
    if (zoneA !== zoneB) return zoneA - zoneB

    // 同一ゾーンの場合は賞味期限で比較
    const locationKeyA = `${a.warehouseId}-${a.zone}-${a.rack}-${a.bin}`
    const locationKeyB = `${b.warehouseId}-${b.zone}-${b.rack}-${b.bin}`
    const expiryA = expirationDates[locationKeyA]?.getTime() || Infinity
    const expiryB = expirationDates[locationKeyB]?.getTime() || Infinity
    return expiryA - expiryB
  })
}

export const mapToWarehouseLocation = _mapToWarehouseLocation
export const calculateAllocationPriority = _calculateAllocationPriority
```

```typescript
// src/features/inventory/core/adapters/warehouse/index.ts
import 'server-only'
import { warehouseClient } from './client'
import { mapToWarehouseLocation, calculateAllocationPriority } from './mapper'
import { AppError } from '@/lib/errors'
import type {
  StockAllocationInput,
  StockAllocationResult,
  WarehouseTransferInput,
  WarehouseLocation,
} from './types'

const _warehouseAdapter = {
  /**
   * 在庫引当（Feature固有のビジネスロジックを含む）
   *
   * ビジネスルール:
   * - urgent優先度の場合、最も近いゾーンから引き当て
   * - normal優先度の場合、FEFO（先入先出+賞味期限）で引き当て
   * - 部分引当を許可（在庫不足時）
   */
  async allocateStock(input: StockAllocationInput): Promise<StockAllocationResult> {
    try {
      // 1. 利用可能な在庫ロケーションを取得
      const availableStock = await warehouseClient.getAvailableStock({
        product_id: input.productId,
        minimum_quantity: input.quantity,
      })

      if (availableStock.total_quantity === 0) {
        throw new AppError(
          '在庫がありません',
          400,
          'OUT_OF_STOCK'
        )
      }

      // 2. ロケーション情報を変換
      const locations = availableStock.locations.map(mapToWarehouseLocation)

      // 3. 優先度に応じた引当ロジック（Feature固有）
      let sortedLocations: WarehouseLocation[]

      if (input.priority === 'urgent') {
        // 緊急の場合：最も近いゾーンから引き当て
        sortedLocations = locations.sort((a, b) =>
          a.zone.localeCompare(b.zone)
        )
      } else {
        // 通常の場合：FEFO方式で引き当て
        const expirationDates = availableStock.locations.reduce((acc, loc) => {
          const key = `${loc.warehouse_id}-${loc.zone_code}-${loc.rack_number}-${loc.bin_position}`
          acc[key] = new Date(loc.expiration_date)
          return acc
        }, {} as Record<string, Date>)

        sortedLocations = calculateAllocationPriority(locations, expirationDates)
      }

      // 4. 引当実行
      const allocationResult = await warehouseClient.allocateStock({
        product_id: input.productId,
        quantity: input.quantity,
        order_id: input.orderId,
        locations: sortedLocations.map(loc => ({
          warehouse_id: loc.warehouseId,
          zone: loc.zone,
          rack: loc.rack,
          bin: loc.bin,
        })),
      })

      return {
        allocationId: allocationResult.allocation_id,
        allocatedFrom: allocationResult.allocated_locations.map(mapToWarehouseLocation),
        totalAllocated: allocationResult.total_quantity,
        partialAllocation: allocationResult.total_quantity < input.quantity,
      }
    } catch (error) {
      if (error instanceof AppError) throw error

      throw new AppError(
        '在庫引当に失敗しました',
        500,
        'ALLOCATION_ERROR'
      )
    }
  },

  /**
   * 倉庫間移動
   */
  async transferStock(input: WarehouseTransferInput): Promise<void> {
    try {
      await warehouseClient.createTransfer({
        product_id: input.productId,
        quantity: input.quantity,
        from_warehouse: input.fromWarehouse,
        to_warehouse: input.toWarehouse,
        reason: input.reason,
      })
    } catch (error) {
      throw new AppError(
        '倉庫間移動に失敗しました',
        500,
        'TRANSFER_ERROR'
      )
    }
  },

  /**
   * 在庫確認
   */
  async checkStock(productId: string, warehouseId: string): Promise<number> {
    try {
      const stock = await warehouseClient.getStock({
        product_id: productId,
        warehouse_id: warehouseId,
      })

      return stock.available_quantity
    } catch (error) {
      throw new AppError(
        '在庫確認に失敗しました',
        500,
        'STOCK_CHECK_ERROR'
      )
    }
  },
}

export const warehouseAdapter = _warehouseAdapter
```

```typescript
// src/features/inventory/core/adapters/index.ts
export { warehouseAdapter } from './warehouse'
export type {
  StockAllocationInput,
  StockAllocationResult,
  WarehouseTransferInput,
} from './warehouse/types'
```

**Features内のAdapterの特徴**:

1. **ビジネスロジックを含む**: `calculateAllocationPriority`のような在庫Feature固有のロジック
2. **Feature固有の型**: 優先度（`'normal' | 'urgent'`）など、ドメイン知識を反映
3. **複雑な変換処理**: 外部システムのデータをFeatureのビジネスルールに基づいて加工
4. **Feature外から利用しない**: 在庫Feature専用、他のFeatureからは呼び出さない

#### Service層での使用例（Features内Adapter）

```typescript
// src/features/inventory/core/service.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { warehouseAdapter } from './adapters'
import { inventoryRepository } from './repository'
import type { CreateOrderAllocationInput } from './schema'

async function _allocateInventoryForOrder(
  supabase: SupabaseClient,
  input: CreateOrderAllocationInput
) {
  // 1. 倉庫システムで在庫引当（Features内Adapter使用）
  const allocation = await warehouseAdapter.allocateStock({
    productId: input.productId,
    quantity: input.quantity,
    orderId: input.orderId,
    priority: input.isUrgent ? 'urgent' : 'normal',
  })

  // 2. 引当結果をDBに記録（Repository使用）
  await inventoryRepository.createAllocation(supabase, {
    allocationId: allocation.allocationId,
    orderId: input.orderId,
    productId: input.productId,
    allocatedQuantity: allocation.totalAllocated,
    isPartial: allocation.partialAllocation,
    locations: allocation.allocatedFrom,
  })

  return allocation
}

export const allocateInventoryForOrder = _allocateInventoryForOrder
```

## エラーハンドリング

外部APIのエラーを`AppError`に統一変換します。

### Stripe エラーハンドリング

```typescript
// src/lib/adapters/stripe/errors.ts
import 'server-only'
import Stripe from 'stripe'
import { AppError } from '@/lib/errors'

/**
 * Stripeエラーをアプリケーション共通のAppErrorに変換
 */
function _handleStripeError(error: unknown): AppError {
  // Stripe固有のエラー
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case 'StripeCardError':
        // カード拒否エラー（顧客側の問題）
        return new AppError(
          `カードエラー: ${error.message}`,
          400,
          'CARD_ERROR',
          { decline_code: error.decline_code }
        )

      case 'StripeRateLimitError':
        // API制限エラー
        return new AppError(
          '決済サービスが混雑しています。しばらく待ってから再試行してください',
          503,
          'RATE_LIMIT'
        )

      case 'StripeInvalidRequestError':
        // 不正なリクエスト（開発者のミス）
        return new AppError(
          '決済リクエストが不正です',
          400,
          'INVALID_REQUEST',
          { param: error.param }
        )

      case 'StripeAPIError':
        // Stripe側のサーバーエラー
        return new AppError(
          '決済サービスでエラーが発生しました',
          502,
          'STRIPE_API_ERROR'
        )

      case 'StripeConnectionError':
        // ネットワークエラー
        return new AppError(
          '決済サービスに接続できませんでした',
          503,
          'CONNECTION_ERROR'
        )

      case 'StripeAuthenticationError':
        // 認証エラー（APIキーの問題）
        return new AppError(
          '決済認証に失敗しました',
          500,
          'AUTH_ERROR'
        )

      default:
        // その他のStripeエラー
        return new AppError(
          `決済処理に失敗しました: ${error.message}`,
          500,
          'STRIPE_ERROR'
        )
    }
  }

  // Stripe以外のエラー（予期しないエラー）
  return new AppError(
    '予期しないエラーが発生しました',
    500,
    'UNEXPECTED_ERROR'
  )
}

export const handleStripeError = _handleStripeError
```

### エラーハンドリングのポイント

1. **エラー型の判定** - `instanceof`で外部APIのエラー型を判定
2. **適切なステータスコード** - 400（クライアントエラー）、500（サーバーエラー）、503（サービス利用不可）を使い分け
3. **エラーコードの付与** - デバッグと監視のために一意なエラーコードを設定
4. **追加情報の保持** - エラーの詳細情報（decline_code、paramなど）を保持
5. **ユーザーフレンドリーなメッセージ** - 技術的な詳細を隠し、わかりやすいメッセージを提供

## Webhook処理

外部サービスからのWebhookもAdapterで処理します。

### Stripe Webhook

```typescript
// src/lib/adapters/stripe/index.ts に追加
export const stripeAdapter = {
  // ... 他のメソッド

  /**
   * Webhook 署名検証
   * Stripeからのリクエストが正当かどうか検証
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      throw new AppError(
        'STRIPE_WEBHOOK_SECRET が設定されていません',
        500,
        'WEBHOOK_CONFIG_ERROR'
      )
    }

    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      )
    } catch (error) {
      throw new AppError(
        'Webhook 署名が無効です',
        400,
        'INVALID_SIGNATURE'
      )
    }
  },

  /**
   * PaymentIntent成功イベントからデータ抽出
   */
  extractPaymentIntentSucceeded(event: Stripe.Event): PaymentIntent | null {
    if (event.type !== 'payment_intent.succeeded') {
      return null
    }

    const intent = event.data.object as Stripe.PaymentIntent

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

### Webhook Handler実装

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest } from 'next/server'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { handlePaymentSuccess } from '@/features/payments/index.server'
import { AppResponse } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  // 1. リクエストボディと署名を取得
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return AppResponse.badRequest('署名がありません')
  }

  try {
    // 2. Adapterで署名検証
    const event = stripeAdapter.constructWebhookEvent(payload, signature)

    // 3. イベントタイプごとに処理
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = stripeAdapter.extractPaymentIntentSucceeded(event)
        if (paymentIntent) {
          await handlePaymentSuccess(paymentIntent)
        }
        break
      }

      case 'customer.subscription.created': {
        // サブスクリプション作成処理
        break
      }

      case 'customer.subscription.deleted': {
        // サブスクリプション削除処理
        break
      }

      // ... 他のイベント
    }

    return AppResponse.ok({ received: true })
  } catch (error) {
    console.error('Webhook処理エラー:', error)
    return AppResponse.serverError()
  }
}
```

### Webhook処理のポイント

1. **署名検証は必須** - 不正なリクエストを拒否
2. **冪等性の確保** - 同じイベントが複数回送られても問題ないように実装
3. **非同期処理** - 重い処理はキューに入れてバックグラウンドで実行
4. **ログ記録** - すべてのWebhookイベントをログに記録

## Serviceでの使用

AdapterをServiceレイヤーから呼び出す実装例です。

### 注文作成サービス

```typescript
// src/features/orders/core/service.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { orderRepository } from './repository'
import type { CreateOrderInput, Order } from './schema'
import { AppError } from '@/lib/errors'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'

async function _createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput
): Promise<{ order: Order; clientSecret: string }> {
  // 1. 入力検証
  if (input.items.length === 0) {
    throw new AppError('注文アイテムが空です', 400)
  }

  // 2. 合計金額計算
  const totalAmount = input.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  // 3. Stripe決済インテント作成（Adapter使用）
  const paymentIntent = await stripeAdapter.createPaymentIntent({
    amount: totalAmount,
    currency: 'jpy',
    metadata: {
      customerId: input.customerId,
      customerEmail: input.customerEmail,
    },
  })

  // 4. データベースに注文レコード作成（Repository使用）
  const order = await orderRepository.create(supabase, {
    customerId: input.customerId,
    items: input.items,
    totalAmount,
    paymentIntentId: paymentIntent.id,
    status: 'pending',
  })

  // 5. 確認メール送信（Adapter使用）
  await resendAdapter.sendReactEmail(
    input.customerEmail,
    `ご注文を受け付けました（注文番号: ${order.id}）`,
    OrderConfirmationEmail({ order })
  )

  return {
    order,
    clientSecret: paymentIntent.clientSecret,
  }
}

export const createOrder = _createOrder
```

### AI機能付きサービス

```typescript
// src/features/content/core/service.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { openaiAdapter } from '@/lib/adapters/openai'
import { contentRepository } from './repository'
import type { CreateContentInput } from './schema'

async function _createContentWithAI(
  supabase: SupabaseClient,
  input: CreateContentInput
) {
  // 1. AIで要約生成
  const summary = await openaiAdapter.createChatCompletion({
    messages: [
      {
        role: 'system',
        content: 'あなたは文章の要約を生成するアシスタントです。',
      },
      {
        role: 'user',
        content: `以下の文章を100文字以内で要約してください:\n\n${input.content}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 100,
  })

  // 2. 埋め込みベクトル生成（検索用）
  const embedding = await openaiAdapter.createEmbedding({
    text: input.content,
  })

  // 3. データベースに保存
  return contentRepository.create(supabase, {
    title: input.title,
    content: input.content,
    summary: summary.content,
    embedding: embedding.embedding,
  })
}

export const createContentWithAI = _createContentWithAI
```

## テスト方法

### Adapter単体テスト

```typescript
// src/lib/adapters/stripe/__tests__/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { stripeAdapter } from '../index'
import { AppError } from '@/lib/errors'

// Stripe SDK をモック
vi.mock('../client', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
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
    it('決済インテントを正常に作成できる', async () => {
      // モックの戻り値を設定
      vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
        id: 'pi_test_123',
        amount: 1000,
        currency: 'jpy',
        status: 'requires_payment_method',
        client_secret: 'secret_test_123',
      } as any)

      const result = await stripeAdapter.createPaymentIntent({
        amount: 1000,
        currency: 'jpy',
      })

      // 正しく変換されたか検証
      expect(result).toEqual({
        id: 'pi_test_123',
        amount: 1000,
        currency: 'jpy',
        status: 'requires_payment_method',
        clientSecret: 'secret_test_123',
      })

      // 正しいパラメータで呼び出されたか検証
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1000,
        currency: 'jpy',
        customer: undefined,
        metadata: undefined,
        automatic_payment_methods: { enabled: true },
      })
    })

    it('Stripeエラーが発生した場合、AppErrorに変換される', async () => {
      // Stripeエラーをモック
      const stripeError = new Error('Card declined')
      ;(stripeError as any).type = 'StripeCardError'
      vi.mocked(stripe.paymentIntents.create).mockRejectedValue(stripeError)

      await expect(
        stripeAdapter.createPaymentIntent({ amount: 1000 })
      ).rejects.toThrow(AppError)
    })
  })

  describe('createCustomer', () => {
    it('顧客を正常に作成できる', async () => {
      vi.mocked(stripe.customers.create).mockResolvedValue({
        id: 'cus_test_123',
        email: 'test@example.com',
        name: 'Test User',
      } as any)

      const result = await stripeAdapter.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
      })

      expect(result).toEqual({
        id: 'cus_test_123',
        email: 'test@example.com',
        name: 'Test User',
      })
    })
  })
})
```

### Serviceテスト（Adapterモック）

```typescript
// src/features/orders/core/__tests__/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Adapter をモック
vi.mock('@/lib/adapters/stripe', () => ({
  stripeAdapter: {
    createPaymentIntent: vi.fn(),
  },
}))

vi.mock('@/lib/adapters/resend', () => ({
  resendAdapter: {
    sendReactEmail: vi.fn(),
  },
}))

// Repository をモック
vi.mock('../repository', () => ({
  orderRepository: {
    create: vi.fn(),
  },
}))

import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { orderRepository } from '../repository'
import { createOrder } from '../service'

describe('createOrder', () => {
  const mockSupabase = createClient('https://test.supabase.co', 'test-key')

  beforeEach(() => {
    vi.clearAllMocks()

    // Adapterのモックレスポンス設定
    vi.mocked(stripeAdapter.createPaymentIntent).mockResolvedValue({
      id: 'pi_test',
      amount: 2000,
      currency: 'jpy',
      status: 'requires_payment_method',
      clientSecret: 'secret_test',
    })

    vi.mocked(resendAdapter.sendReactEmail).mockResolvedValue({
      id: 'email_test',
    })

    vi.mocked(orderRepository.create).mockResolvedValue({
      id: 'order_test',
      customerId: 'user_123',
      items: [{ productId: 'prod_1', quantity: 2, price: 1000 }],
      totalAmount: 2000,
      paymentIntentId: 'pi_test',
      status: 'pending',
      createdAt: new Date(),
    })
  })

  it('注文を作成し、決済インテントとメールを処理する', async () => {
    const result = await createOrder(mockSupabase, {
      customerId: 'user_123',
      customerEmail: 'user@example.com',
      items: [
        { productId: 'prod_1', quantity: 2, price: 1000 },
      ],
    })

    // 決済インテント作成が呼ばれたか
    expect(stripeAdapter.createPaymentIntent).toHaveBeenCalledWith({
      amount: 2000,
      currency: 'jpy',
      metadata: {
        customerId: 'user_123',
        customerEmail: 'user@example.com',
      },
    })

    // 注文レコード作成が呼ばれたか
    expect(orderRepository.create).toHaveBeenCalled()

    // メール送信が呼ばれたか
    expect(resendAdapter.sendReactEmail).toHaveBeenCalled()

    // 戻り値の検証
    expect(result.order.id).toBe('order_test')
    expect(result.clientSecret).toBe('secret_test')
  })

  it('アイテムが空の場合、エラーをスローする', async () => {
    await expect(
      createOrder(mockSupabase, {
        customerId: 'user_123',
        customerEmail: 'user@example.com',
        items: [],
      })
    ).rejects.toThrow('注文アイテムが空です')
  })
})
```

### 統合テスト

```typescript
// src/lib/adapters/stripe/__tests__/integration.test.ts
import { describe, it, expect } from 'vitest'
import { stripeAdapter } from '../index'

// 統合テストはCI環境でスキップ
describe.skipIf(process.env.CI)('stripeAdapter 統合テスト', () => {
  it('実際のStripe APIと通信して決済インテントを作成', async () => {
    // テストモードのAPIキーを使用
    const result = await stripeAdapter.createPaymentIntent({
      amount: 100,  // 最小金額でテスト
      currency: 'jpy',
    })

    expect(result.id).toMatch(/^pi_/)
    expect(result.amount).toBe(100)
    expect(result.clientSecret).toBeTruthy()
  })
})
```

## ベストプラクティス

### 1. server-only を必ず記述

すべてのAdapterファイルの先頭に`'server-only'`を記述します。

```typescript
// ✅ 正しい
import 'server-only'
import Stripe from 'stripe'

// ❌ 間違い（server-onlyがない）
import Stripe from 'stripe'
```

### 2. 型変換を必ず行う

外部APIの型をそのまま返さず、アプリケーション型に変換します。

```typescript
// ❌ 間違い（Stripe型をそのまま返す）
async createPaymentIntent(input: CreatePaymentIntentInput): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.create(input)
}

// ✅ 正しい（アプリケーション型に変換）
async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
  const intent = await stripe.paymentIntents.create(input)

  return {
    id: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    clientSecret: intent.client_secret!,
  }
}
```

### 3. エラーは AppError に統一

外部APIのエラーを必ず`AppError`に変換します。

```typescript
// ❌ 間違い（外部エラーをそのままスロー）
async createPaymentIntent(input: CreatePaymentIntentInput) {
  return await stripe.paymentIntents.create(input)
}

// ✅ 正しい（AppErrorに変換）
async createPaymentIntent(input: CreatePaymentIntentInput) {
  try {
    return await stripe.paymentIntents.create(input)
  } catch (error) {
    throw handleStripeError(error)
  }
}
```

### 4. 環境変数チェック

クライアント初期化時に必須の環境変数をチェックします。

```typescript
// ✅ 正しい（起動時に検証）
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
})
```

### 5. Service層から呼び出す

Adapter層はService層からのみ呼び出します。Handler層から直接呼び出してはいけません。

```typescript
// ❌ 間違い（Handlerから直接呼び出し）
export async function POST(request: NextRequest) {
  const body = await request.json()
  const paymentIntent = await stripeAdapter.createPaymentIntent(body)
  return AppResponse.ok(paymentIntent)
}

// ✅ 正しい（Serviceを経由）
export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = await createClient()
  const order = await createOrder(supabase, body)  // Service層
  return AppResponse.ok(order)
}
```

### 6. デフォルト値を設定

オプショナルなパラメータにはデフォルト値を設定します。

```typescript
// ✅ 正しい
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'

export const resendAdapter = {
  async sendEmail(input: SendEmailInput) {
    return resend.emails.send({
      from: input.from ?? DEFAULT_FROM,  // デフォルト値を使用
      to: input.to,
      subject: input.subject,
      html: input.html,
    })
  },
}
```

### 7. リトライは慎重に

リトライは冪等な操作のみに限定します。

```typescript
// ✅ 正しい（GET操作はリトライ可能）
async getCustomer(customerId: string, retries = 3): Promise<Customer | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      return customer.deleted ? null : this.toCustomer(customer)
    } catch (error) {
      if (i === retries - 1) throw handleStripeError(error)
      await sleep(1000 * (i + 1))  // 指数バックオフ
    }
  }
  return null
}

// ❌ 間違い（決済作成をリトライすると重複決済のリスク）
async createPaymentIntent(input: CreatePaymentIntentInput) {
  // リトライしない（冪等ではない）
}
```

### 8. ログ記録

外部API呼び出しはログに記録します。

```typescript
import { logger } from '@/lib/logger'

export const stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput) {
    logger.info('Creating payment intent', { amount: input.amount })

    try {
      const intent = await stripe.paymentIntents.create(input)
      logger.info('Payment intent created', { id: intent.id })
      return this.toPaymentIntent(intent)
    } catch (error) {
      logger.error('Failed to create payment intent', { error })
      throw handleStripeError(error)
    }
  },
}
```

### 9. 型安全性

TypeScriptの型システムを最大限活用します。

```typescript
// ✅ 正しい（型ガード使用）
export function extractPaymentIntentSucceeded(
  event: Stripe.Event
): PaymentIntent | null {
  if (event.type !== 'payment_intent.succeeded') {
    return null
  }

  const intent = event.data.object as Stripe.PaymentIntent
  return this.toPaymentIntent(intent)
}
```

### 10. テスト可能な設計

モックしやすい構造にします。

```typescript
// ✅ 正しい（依存注入可能）
export function createStripeAdapter(client: Stripe) {
  return {
    async createPaymentIntent(input: CreatePaymentIntentInput) {
      // clientを使用
    },
  }
}

// 本番環境
export const stripeAdapter = createStripeAdapter(stripe)

// テスト環境
const mockStripe = { /* モック */ }
const testAdapter = createStripeAdapter(mockStripe as any)
```

### 11. Features内Adapterのベストプラクティス

Features内のAdapterを実装する際の追加のベストプラクティスです。

#### 配置場所の判断

```typescript
// ❌ 間違い（汎用的な外部APIをFeatures内に配置）
// src/features/orders/core/adapters/stripe/index.ts
// Stripeは複数のFeatureで使うので共通処理に配置すべき

// ✅ 正しい（Feature固有のビジネスロジックを含む）
// src/features/inventory/core/adapters/warehouse/index.ts
// 倉庫システムは在庫Featureのビジネスルールと密結合
```

#### ビジネスロジックの分離

```typescript
// ✅ 正しい（ビジネスロジックを別ファイルに分離）
// src/features/inventory/core/adapters/warehouse/mapper.ts
export function calculateAllocationPriority(
  locations: WarehouseLocation[],
  expirationDates: Record<string, Date>
): WarehouseLocation[] {
  // 在庫引当のビジネスルール
}

// src/features/inventory/core/adapters/warehouse/index.ts
export const warehouseAdapter = {
  async allocateStock(input: StockAllocationInput) {
    const locations = await this.getLocations()
    const sortedLocations = calculateAllocationPriority(locations, dates)
    // ...
  }
}
```

#### Feature間の依存を避ける

```typescript
// ❌ 間違い（他のFeatureのAdapterに依存）
import { warehouseAdapter } from '@/features/inventory/core/adapters'

// ✅ 正しい（共通処理のAdapterのみをインポート）
import { stripeAdapter } from '@/lib/adapters'

// ✅ 正しい（同一Feature内のAdapterは利用可能）
import { warehouseAdapter } from './adapters'
```

#### 型定義の明確化

```typescript
// ✅ 正しい（Feature固有の型を明確に定義）
// src/features/inventory/core/adapters/warehouse/types.ts

// ビジネスルールを型で表現
export type AllocationPriority = 'urgent' | 'normal'

export interface StockAllocationInput {
  productId: string
  quantity: number
  orderId: string
  priority: AllocationPriority  // Feature固有の概念
}

// 外部システムの型は内部で隠蔽
interface ExternalWarehouseLocation {
  warehouse_id: string
  zone_code: string
  // ... 外部システムの詳細
}

// アプリケーション型のみをエクスポート
export interface WarehouseLocation {
  warehouseId: string
  zone: string
  rack: string
  bin: string
}
```

#### テスト戦略

```typescript
// src/features/inventory/core/adapters/warehouse/__tests__/mapper.test.ts
import { describe, it, expect } from 'vitest'
import { calculateAllocationPriority } from '../mapper'

describe('calculateAllocationPriority', () => {
  it('緊急優先度の場合、最も近いゾーンから引き当てる', () => {
    const locations = [
      { warehouseId: 'WH1', zone: 'C', rack: 'R1', bin: 'B1' },
      { warehouseId: 'WH1', zone: 'A', rack: 'R2', bin: 'B2' },
    ]

    const result = calculateAllocationPriority(locations, {})

    expect(result[0].zone).toBe('A')  // ゾーンAが優先
  })

  it('通常優先度の場合、FEFO方式で引き当てる', () => {
    // ビジネスロジックのテスト
  })
})
```

#### ドキュメント化

```typescript
// ✅ 正しい（ビジネスルールをドキュメント化）
export const warehouseAdapter = {
  /**
   * 在庫引当
   *
   * ビジネスルール:
   * 1. urgent優先度: 出荷口に最も近いゾーンから引き当て
   * 2. normal優先度: FEFO（先入先出+賞味期限）で引き当て
   * 3. 在庫不足時は部分引当を許可
   * 4. 引当結果は必ず監査ログに記録
   *
   * @param input - 引当パラメータ
   * @returns 引当結果（部分引当フラグ含む）
   * @throws {AppError} OUT_OF_STOCK - 在庫なし
   * @throws {AppError} ALLOCATION_ERROR - システムエラー
   */
  async allocateStock(input: StockAllocationInput): Promise<StockAllocationResult> {
    // ...
  }
}
```

## 使用例

Adapter層の実装例を以下に示す。

### 例1: 共通処理のAdapter（Stripe）

```typescript
// src/lib/adapters/stripe/index.ts
import 'server-only'
import { stripe } from './client'
import { handleStripeError } from './errors'
import type { CreatePaymentIntentInput, PaymentIntent } from './types'

const _stripeAdapter = {
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency ?? 'jpy',
        customer: input.customerId,
        metadata: input.metadata,
        automatic_payment_methods: {
          enabled: true,
        },
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
}

export const stripeAdapter = _stripeAdapter
```

**ポイント**:
- 外部SDKの型（`Stripe.PaymentIntent`）を使わず、アプリケーション型（`PaymentIntent`）に変換
- エラーは`AppError`に統一変換
- デフォルト値（`currency: 'jpy'`）を設定

### 例2: Features内のAdapter（倉庫管理システム）

```typescript
// src/features/inventory/core/adapters/warehouse/index.ts
import 'server-only'
import { warehouseClient } from './client'
import { mapToWarehouseLocation, calculateAllocationPriority } from './mapper'
import { AppError } from '@/lib/errors'
import type { StockAllocationInput, StockAllocationResult } from './types'

const _warehouseAdapter = {
  async allocateStock(input: StockAllocationInput): Promise<StockAllocationResult> {
    try {
      // 1. 利用可能な在庫ロケーションを取得
      const availableStock = await warehouseClient.getAvailableStock({
        product_id: input.productId,
        minimum_quantity: input.quantity,
      })

      if (availableStock.total_quantity === 0) {
        throw new AppError('在庫がありません', 400, 'OUT_OF_STOCK')
      }

      // 2. ロケーション情報を変換
      const locations = availableStock.locations.map(mapToWarehouseLocation)

      // 3. 優先度に応じた引当ロジック（Feature固有のビジネスロジック）
      const sortedLocations = input.priority === 'urgent'
        ? locations.sort((a, b) => a.zone.localeCompare(b.zone))
        : calculateAllocationPriority(locations, expirationDates)

      // 4. 引当実行
      const allocationResult = await warehouseClient.allocateStock({
        product_id: input.productId,
        quantity: input.quantity,
        order_id: input.orderId,
        locations: sortedLocations.map(loc => ({
          warehouse_id: loc.warehouseId,
          zone: loc.zone,
          rack: loc.rack,
          bin: loc.bin,
        })),
      })

      return {
        allocationId: allocationResult.allocation_id,
        allocatedFrom: allocationResult.allocated_locations.map(mapToWarehouseLocation),
        totalAllocated: allocationResult.total_quantity,
        partialAllocation: allocationResult.total_quantity < input.quantity,
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('在庫引当に失敗しました', 500, 'ALLOCATION_ERROR')
    }
  },
}

export const warehouseAdapter = _warehouseAdapter
```

**ポイント**:
- Feature固有のビジネスロジック（優先度による引当ロジック）を含む
- 外部システムのデータをFeatureのビジネスルールに基づいて加工
- Feature外からは利用しない

### 例3: Service層での使用

```typescript
// src/features/orders/core/service.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripeAdapter } from '@/lib/adapters/stripe'
import { resendAdapter } from '@/lib/adapters/resend'
import { orderRepository } from './repository'
import type { CreateOrderInput, Order } from './schema'

async function _createOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput
): Promise<{ order: Order; clientSecret: string }> {
  const totalAmount = input.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  // Stripe決済インテント作成（Adapter使用）
  const paymentIntent = await stripeAdapter.createPaymentIntent({
    amount: totalAmount,
    currency: 'jpy',
    metadata: {
      customerId: input.customerId,
    },
  })

  // データベースに注文レコード作成（Repository使用）
  const order = await orderRepository.create(supabase, {
    customerId: input.customerId,
    items: input.items,
    totalAmount,
    paymentIntentId: paymentIntent.id,
    status: 'pending',
  })

  // 確認メール送信（Adapter使用）
  await resendAdapter.sendEmail({
    to: input.customerEmail,
    subject: `ご注文を受け付けました（注文番号: ${order.id}）`,
    html: `<h1>ご注文ありがとうございます</h1><p>注文番号: ${order.id}</p>`,
  })

  return {
    order,
    clientSecret: paymentIntent.clientSecret,
  }
}

export const createOrder = _createOrder
```

**ポイント**:
- Service層から複数のAdapterを組み合わせて使用
- ビジネスロジック（金額計算）はService層で実装
- 各Adapterは技術的な詳細を隠蔽

## アンチパターン

Adapter層でよく見られる問題のあるパターンを示す。

### Handler層から直接呼び出し

```typescript
// ❌ 避けるべき（Handlerから直接Adapterを呼び出し）
import { stripeAdapter } from '@/lib/adapters/stripe'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const paymentIntent = await stripeAdapter.createPaymentIntent(body)
  return AppResponse.ok(paymentIntent)
}

// ✅ 推奨（Service層を経由）
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, schema)
  if (!validation.success) return validation.response

  try {
    const supabase = await createClient()
    const order = await createOrder(supabase, validation.data)
    return AppResponse.created(order)
  } catch (error) {
    return AppResponse.serverError()
  }
}
```

### 外部APIの型をそのまま返す

```typescript
// ❌ 避けるべき（Stripe型をそのまま返す）
import Stripe from 'stripe'

async createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.create(input)
}

// ✅ 推奨（アプリケーション型に変換）
async createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<PaymentIntent> {
  const intent = await stripe.paymentIntents.create(input)

  return {
    id: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    clientSecret: intent.client_secret!,
  }
}
```
