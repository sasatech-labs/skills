# アーキテクチャガイド

## 概要

このガイドでは、`features/`ディレクトリ内のアーキテクチャを説明する。Handler、Service、Repository、Adapterの4層構成で、関心事を分離し、保守性と拡張性を確保する。

## 設計思想

レイヤーを明確に分離することで、以下の利点を得る：

- **関心事の分離**: 各レイヤーが単一の責務を持つ
- **テスト容易性**: 各レイヤーを独立してテストできる
- **保守性**: 変更の影響範囲を限定できる
- **拡張性**: 新機能の追加が容易

## レイヤー構成

```
Handler (handler.ts)   リクエスト/レスポンス、バリデーション、楽観的認証
        ↓
Service               ビジネスロジック、厳密な認可、複数 Repository 連携
        ↓
Repository            データアクセス
Adapter               外部 API 連携（Stripe, Resend 等）
```

### 各レイヤーの責務

- **API Route**: 薄いエントリーポイント。Handler関数を呼び出すだけ
- **Handler**: リクエスト/レスポンスの境界。入力検証と楽観的認証を担当
- **Service**: ビジネスロジックの中核。厳密な認可と、複数のRepositoryやAdapterの組み合わせ
- **Repository**: 内部データストア（Supabase）へのアクセスをカプセル化
- **Adapter**: 外部サービス（決済、メール、AI等）への連携をカプセル化

### 詳細ドキュメント

各レイヤーの実装方法は、以下のドキュメントを参照：

- [Handler層の実装](architecture/handler.md)
- [Service層の実装](architecture/service.md)
- [Repository層の実装](architecture/repository.md)
- [Adapter層の実装](architecture/adapter.md)

## Feature ディレクトリ構成

### 単一機能

```
features/auth/
├── index.server.ts   # サーバー専用の公開API（Service, Handler）
├── index.client.ts   # クライアント利用可の公開API（Fetcher, 型）
└── core/
    ├── schema.ts     # Zodスキーマ + 型定義
    ├── handler.ts    # リクエスト / レスポンス処理 (server-only)
    ├── service.ts    # ビジネスロジック (server-only)
    ├── repository.ts # データアクセス (server-only)
    ├── adapter.ts    # 外部API連携 (server-only)
    ├── fetcher.ts    # API呼び出し
    └── hooks.ts      # SWR Hook等
```

### グループ化された機能

```
features/products/
├── index.server.ts   # サーバー専用の公開API（サブ機能含む）
├── index.client.ts   # クライアント利用可の公開API（サブ機能含む）
├── core/             # コア機能
│   ├── schema.ts
│   ├── handler.ts
│   ├── service.ts
│   ├── repository.ts
│   ├── adapter.ts
│   ├── fetcher.ts
│   └── hooks.ts
├── reviews/          # サブ機能
│   ├── schema.ts
│   ├── handler.ts
│   ├── service.ts
│   ├── repository.ts
│   ├── adapter.ts
│   ├── fetcher.ts
│   └── hooks.ts
└── components/
    ├── server/       # Server Components
    └── client/       # Client Components
```

## 公開インターフェース

### 単一機能

```typescript
// features/auth/index.server.ts
import 'server-only'

export { handleSignIn, handleSignUp, handleSignOut } from './core/handler'
export { signIn, signUp, signOut } from './core/service'
```

```typescript
// features/auth/index.client.ts
export { authFetcher } from './core/fetcher'
export type { User, AuthState } from './core/schema'
```

### グループ化された機能

```typescript
// features/products/index.server.ts
import 'server-only'

export { handleGetProducts, handleCreateProduct } from './core/handler'
export { getProducts, createProduct } from './core/service'
export * as reviews from './reviews/service'
```

```typescript
// features/products/index.client.ts
export { productsFetcher } from './core/fetcher'
export type { Product, CreateProductInput } from './core/schema'
```

```typescript
// 利用側（API Route）
import { handleGetProducts } from '@/features/products/index.server'

// 利用側（CSR hooks / クライアントコンポーネント）
import { productsFetcher } from '@/features/products/index.client'
import type { Product } from '@/features/products/index.client'

// 利用側（他のFeatureのService）
import { getProducts } from '@/features/products/index.server'
```

## 段階的スケーリング

### 基本方針

薄い間は単一ファイル、厚くなったらディレクトリに分割する。過度な抽象化を避け、必要になったタイミングで構造を拡張する。

### 分割の基準

#### 単一ファイルのまま（薄い構成）

以下の条件をすべて満たす場合は、単一ファイルを維持する：

- **ファイルサイズ**: 200行以内
- **関数数**: 5個以下の公開関数
- **単一の責務**: 1つの明確な概念のみを扱う
- **保守性**: ファイル内の検索や編集が容易

#### ディレクトリ分割（厚い構成）

以下のいずれかに該当したら、ディレクトリ分割を検討する：

- **ファイルサイズ**: 300行を超える
- **関数数**: 5個以上の公開関数が存在する
- **責務の増加**: 複数の異なる概念（例: User, Profile, Settings）を扱う
- **保守性の低下**: ファイル内の検索や編集が困難になった
- **チーム開発**: 複数人が同じファイルを頻繁に編集してコンフリクトが発生する

### スケーリングパターン

```
# 薄い構成                  # 厚い構成
features/auth/            features/users/
└── core/                 └── core/
    ├── schema.ts             ├── schemas/
    ├── handler.ts            │   ├── index.ts
    ├── service.ts            │   ├── user.ts
    ├── repository.ts         │   └── profile.ts
    ├── adapter.ts            ├── handlers/
    ├── fetcher.ts            │   ├── index.ts
    └── hooks.ts              │   ├── user-handler.ts
                              │   └── profile-handler.ts
                              ├── services/
                              │   ├── index.ts
                              │   ├── user-service.ts
                              │   └── profile-service.ts
                              ├── repositories/
                              │   ├── index.ts
                              │   ├── user-repository.ts
                              │   └── profile-repository.ts
                              ├── adapters/
                              │   ├── index.ts
                              │   └── email-adapter.ts
                              ├── fetchers/
                              │   ├── index.ts
                              │   ├── user-fetcher.ts
                              │   └── profile-fetcher.ts
                              └── hooks/
                                  ├── index.ts
                                  ├── use-user.ts
                                  └── use-profile.ts
```

### 分割時の注意点

1. **公開APIは維持**: `index.server.ts`/`index.client.ts`で再エクスポートし、利用側のインポートパスは変更しない
2. **段階的に移行**: すべてのファイルを一度に分割せず、必要なレイヤーから順次分割する
3. **命名規則の統一**: 分割後のファイル名は`[entity]-[layer].ts`形式で統一する
4. **テストも同様に分割**: ファイルを分割したら、対応するテストファイルも分割する

## 関連ルール

- [arch-three-layers](../rules/arch-three-layers.md) - Handler → Service → Repository/Adapter の構成ルール
- [arch-feature-structure](../rules/arch-feature-structure.md) - 機能単位のモジュール化ルール
- [arch-public-api](../rules/arch-public-api.md) - Feature の公開APIルール
- [arch-fetch-strategy](../rules/arch-fetch-strategy.md) - SSR/CSRデータ取得戦略ルール
