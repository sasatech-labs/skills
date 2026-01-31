---
name: sasatech-next-architecture
description: Next.js App Router architecture with Feature-based Layer Architecture pattern. Use when creating API routes, services, repositories, or components with Supabase and TypeScript. Covers Handler/Service/Repository layers, Zod validation, and feature module structure.
---

# SasaTech Architecture

Feature-based Layer Architecture for Next.js(App Router + Supabase)

## ガイド(Guides)とルール(Rules)の違い

このスキルは **ガイド（Guides）** と **ルール（Rules）** の2種類のドキュメントで構築されています。

| 項目 | ガイド（Guides） | ルール（Rules） |
|---|---|---|
| **目的** | アーキテクチャや実装パターンの理解を深める | 守るべき制約を明確に定義する |
| **内容** | HOW / WHY — 設計思想の説明、セットアップ手順、完全なコード例 | DO / DON'T — NG例とOK例による具体的な判定基準 |
| **形式** | 長文のチュートリアル形式 | メタデータ（impact, tags）付きの短いルール形式 |
| **読むタイミング** | プロジェクト参加時の学習、設計判断の参考 | コード実装時の準拠確認、コードレビュー |
| **ファイル命名** | トピック名（`architecture.md`, `testing.md`） | 制約名（`data-no-getall.md`, `server-only-directive.md`） |

- ガイド → 「なぜこの設計にしたのか」「どう実装するのか」を理解するためのドキュメント
- ルール(Rules) → 「何をしてよいか／してはいけないか」を判定するためのドキュメント


## ルールカテゴリ

| Category | Prefix |
|----------|--------|
| アーキテクチャ | `arch-` |
| データ | `data-` |
| サーバーサイド保護 | `server-` |
| スキーマ・型定義 | `schema-` |
| レスポンス | `response-` |
| テスト | `test-` |
| バリデーション | `validation-` |
| 命名規則 | `naming-` |
| フロントエンド | `frontend-` |

---

## Quick Reference

### アーキテクチャ (`arch-`)

- `arch-three-layers` - Handler → Service → Repository, Adapter の3層構成を必ず経由
- `arch-feature-structure` - 機能単位で `features/` にモジュール化
- `arch-external-services` - Stripe, Resend 等の外部サービスは Adapter 経由
- `arch-logging-strategy` - pino で構造化ログ、console.log 禁止、レイヤーごとに適切なログ出力

### データ (`data-`)

- `data-no-getall` - 全件取得禁止、必ず MAX_LIMIT でサーバー側上限を強制
- `data-pagination` - リスト取得は必ずページネーション付きで総件数を返却
- `data-comment-required` - テーブル・カラムに日本語コメント必須

### サーバーサイド保護 (`server-`)

- `server-only-directive` - Service/Repository に `import 'server-only'` を必須で記述
- `server-no-public-env` - 機密情報（Supabase, API キー）に `NEXT_PUBLIC_` 禁止、GA 等は許可
- `server-supabase-via-api` - クライアントから Supabase 直接使用禁止、API Route 経由必須

### スキーマ・型定義 (`schema-`)

- `schema-single-source` - 型定義は `schema.ts` に一元化、分散禁止
- `schema-no-types-file` - Feature 内に `types.ts` 作成禁止
- `schema-zod-infer` - Input 型は手書きせず `z.infer<typeof schema>` で導出

### レスポンス (`response-`)

- `response-helpers` - `ok()`, `created()`, `notFound()` 等のヘルパーを使用
- `response-apperror` - エラーは `AppError` クラスでスロー、生の Error 禁止

### テスト (`test-`)

- `test-server-only` - `server-only` はテスト環境でモック必須
- `test-layer-mocking` - 各レイヤーは直下の依存のみをモック
- `test-file-location` - テストファイルは `__tests__` に配置
- `test-naming` - テストは日本語で意図を明確に

### バリデーション (`validation-`)

- `validation-body` - POST/PATCH のリクエストボディは Zod でバリデーション
- `validation-params` - URL パラメータ（ID 等）も Zod でバリデーション

### 命名規則 (`naming-`)

- `naming-files` - ファイル名は kebab-case（`user-profile.tsx`）
- `naming-methods` - Repository: `findMany`/`findById`、Service: `get*`/`create*`

### フロントエンド (`frontend-`)

- `frontend-fetcher` - Feature ごとに `fetcher.ts` を作成して API 呼び出しを集約
- `frontend-hooks` - SWR を使用した Hook パターンでデータ取得

---

## ルール一覧（表形式）

### アーキテクチャ (`arch-`)

| ルール | 説明 |
|--------|------|
| [arch-three-layers](rules/arch-three-layers.md) | Handler → Service → Repository の3層 |
| [arch-feature-structure](rules/arch-feature-structure.md) | Feature モジュール構成 |
| [arch-external-services](rules/arch-external-services.md) | 外部サービスは Adapter 経由 |
| [arch-logging-strategy](rules/arch-logging-strategy.md) | pino で構造化ログ、console.log 禁止 |

### データ (`data-`)

| ルール | 説明 |
|--------|------|
| [data-no-getall](rules/data-no-getall.md) | 全件取得禁止、MAX_LIMIT で上限強制 |
| [data-pagination](rules/data-pagination.md) | リスト取得はページネーション必須 |
| [data-comment-required](rules/data-comment-required.md) | テーブル・カラムに日本語コメント必須 |

### サーバーサイド保護 (`server-`)

| ルール | 説明 |
|--------|------|
| [server-only-directive](rules/server-only-directive.md) | Service/Repository に `server-only` 必須 |
| [server-no-public-env](rules/server-no-public-env.md) | 機密情報に `NEXT_PUBLIC_` 禁止 |
| [server-supabase-via-api](rules/server-supabase-via-api.md) | クライアントから Supabase 直接禁止 |

### スキーマ・型定義 (`schema-`)

| ルール | 説明 |
|--------|------|
| [schema-single-source](rules/schema-single-source.md) | 型定義は `schema.ts` に一元化 |
| [schema-no-types-file](rules/schema-no-types-file.md) | Feature 内に `types.ts` 禁止 |
| [schema-zod-infer](rules/schema-zod-infer.md) | Input 型は `z.infer` で導出 |

### レスポンス (`response-`)

| ルール | 説明 |
|--------|------|
| [response-helpers](rules/response-helpers.md) | `ok()`, `created()` 等を使用 |
| [response-apperror](rules/response-apperror.md) | `AppError` クラスでスロー |

### テスト (`test-`)

| ルール | 説明 |
|--------|------|
| [test-server-only](rules/test-server-only.md) | `server-only` モック必須 |
| [test-layer-mocking](rules/test-layer-mocking.md) | 直下の依存のみモック |
| [test-file-location](rules/test-file-location.md) | `__tests__` に配置 |
| [test-naming](rules/test-naming.md) | 日本語で意図を明確に |

### バリデーション (`validation-`)

| ルール | 説明 |
|--------|------|
| [validation-body](rules/validation-body.md) | リクエストボディを Zod でバリデーション |
| [validation-params](rules/validation-params.md) | URL パラメータを Zod でバリデーション |

### 命名規則 (`naming-`)

| ルール | 説明 |
|--------|------|
| [naming-files](rules/naming-files.md) | ファイル名は kebab-case |
| [naming-methods](rules/naming-methods.md) | メソッド命名規則を遵守 |

### フロントエンド (`frontend-`)

| ルール | 説明 |
|--------|------|
| [frontend-fetcher](rules/frontend-fetcher.md) | Feature ごとに `fetcher.ts` を作成 |
| [frontend-hooks](rules/frontend-hooks.md) | SWR を使用した Hook パターン |

---

## ディレクトリ構成

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # 認証が必要なルートグループ
│   ├── (public)/             # 公開ルートグループ
│   └── api/                  # API Routes (Handler層)
│
├── features/                 # 機能単位のモジュール
│   └── [feature]/
│       ├── index.ts          # 公開API
│       ├── core/
│       │   ├── schema.ts     # Zodスキーマ + 型定義
│       │   ├── service.ts    # server-only
│       │   └── repository.ts # server-only
│       ├── fetcher.ts
│       └── hooks.ts
│
├── components/               # 共通UIコンポーネント
├── hooks/                    # 共通Hooks
├── lib/                      # ユーティリティ
│   └── adapters/             # 外部サービス連携
└── types/                    # Supabase生成型のみ
```

## レイヤー構成

```
Handler (API Route)    リクエスト/レスポンス、バリデーション、認証
        ↓
Service               ビジネスロジック、複数 Repository 連携
        ↓
Repository            Supabase クエリ
Adapter               外部 API 連携（Stripe, Resend 等）
```

## 5つの重要ルール

1. **全件取得禁止** - `MAX_LIMIT` でサーバー側上限を強制、`getAll` は使わない
2. **`server-only` 必須** - Service/Repository ファイルの先頭に必ず記述
3. **`schema.ts` 一元化** - `types.ts` は作らない、`z.infer` で型を導出
4. **3層構成を遵守** - Handler → Service → Repository を必ず経由
5. **API Route 経由** - クライアントから Supabase への直接アクセス禁止

---

## ガイド

| トピック | ファイル |
|---------|---------|
| アーキテクチャ全体 | [guides/architecture.md](guides/architecture.md) |
| 外部サービス連携 | [guides/adapters.md](guides/adapters.md) |
| ログ戦略 | [guides/logging.md](guides/logging.md) |
| データベース設計 | [guides/database.md](guides/database.md) |
| テスト戦略 | [guides/testing.md](guides/testing.md) |
| セットアップ | [guides/setup.md](guides/setup.md) |

---

## 基盤ファイル

`scripts/` からプロジェクトにコピー:

| ファイル | コピー先 |
|---------|---------|
| `AGENTS.md` | プロジェクトルート |
| `lib/errors.ts` | `src/lib/errors.ts` |
| `lib/api-response.ts` | `src/lib/api-response.ts` |
| `lib/api-error.ts` | `src/lib/api-error.ts` |
| `lib/fetcher.ts` | `src/lib/fetcher.ts` |
| `lib/validation.ts` | `src/lib/validation.ts` |
| `lib/logger.ts` | `src/lib/logger.ts` |
| `lib/supabase/server.ts` | `src/lib/supabase/server.ts` |
| `types/index.ts` | `src/types/index.ts` |
| `lib/adapters/` | `src/lib/adapters/` |
| `vitest.config.ts` | プロジェクトルート |
| `vitest.setup.ts` | プロジェクトルート |
