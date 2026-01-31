---
name: sasatech-next-architecture
description: Next.js App Router architecture with Feature-based Layer Architecture pattern. Use when creating API routes, services, repositories, or components with Supabase and TypeScript. Covers Handler/Service/Repository, Adapter layers, Zod validation, and feature module structure.
---

# SasaTech Architecture

## アーキテクチャ概要

Feature-based Layer Architecture for Next.js (App Router + Supabase)

### レイヤー構成

```
Handler (handler.ts)   リクエスト/レスポンス、バリデーション、認証
        ↓
Service               ビジネスロジック、複数 Repository 連携
        ↓
Repository            データアクセス
Adapter               外部 API 連携（Stripe, Resend 等）
```

### ディレクトリ構成

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
│       └── core/
│           ├── schema.ts     # Zodスキーマ + 型定義
│           ├── handler.ts    # リクエスト / レスポンス処理 (server-only)
│           ├── service.ts    # ビジネスロジック (server-only)
│           ├── repository.ts # データアクセス (server-only)
│           ├── adapter.ts    # 外部API連携 (server-only)
│           ├── fetcher.ts    # API呼び出し
│           └── hooks.ts      # SWR Hook等
│
├── components/               # 共通UIコンポーネント
├── hooks/                    # 共通Hooks
├── lib/                      # ユーティリティ
│   └── adapters/             # 外部サービス連携
└── types/                    # 共通型定義、Supabase生成型
```

---

## ガイドとルールの違い

このスキルは **ガイド** と **ルール** の2種類のドキュメントで構成されています。

| 項目 | ガイド | ルール |
|------|--------|--------|
| **目的** | アーキテクチャや実装パターンの理解を深める | 守るべき制約を明確に定義する |
| **内容** | HOW / WHY — 設計思想、セットアップ手順、コード例 | DO / DON'T — NG例とOK例による判定基準 |
| **形式** | チュートリアル形式 | メタデータ（impact, tags）付きの短いルール形式 |
| **読むタイミング** | プロジェクト参加時の学習、設計判断の参考 | コード実装時の準拠確認、コードレビュー |

---

## ガイド

| ガイド | 説明 |
|--------|------|
| [architecture.md](guides/architecture.md) | Feature-based Layer Architecture の全体設計。レイヤー構成、責務分離、ディレクトリ構成 |
| [adapters.md](guides/adapters.md) | 外部サービス（決済、メール、AI 等）との連携をカプセル化する Adapter レイヤーの実装 |
| [testing.md](guides/testing.md) | レイヤーごとのテスト戦略。Unit / Integration テストの範囲とモック方針 |
| [database.md](guides/database.md) | データベース設計。コメント規約、マイグレーション、Supabase との連携 |
| [logging.md](guides/logging.md) | pino を使用した構造化ログの実装。レイヤーごとのログ出力方針 |
| [setup.md](guides/setup.md) | 新規プロジェクトのセットアップ手順。依存パッケージ、基盤ファイルの配置 |

---

## ルール

### カテゴリ

| カテゴリ | Prefix |
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

### インパクト

Impact は、違反時にアーキテクチャへ与える影響の深刻度で定義します。

| Impact | 基準 |
|--------|------|
| CRITICAL | アーキテクチャの根幹が壊れる。違反するとこの設計パターン自体が成立しない |
| HIGH | アーキテクチャの整合性や保守性を大きく損なう |
| MEDIUM | コードの品質や一貫性を低下させる |
| LOW | 開発体験やパターンの統一に関する推奨事項 |

---

### アーキテクチャ (`arch-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [arch-three-layers](rules/arch-three-layers.md) | CRITICAL | Handler → Service → Repository, Adapter の構成を必ず経由 |
| [arch-feature-structure](rules/arch-feature-structure.md) | CRITICAL | 機能単位で `features/` にモジュール化 |
| [arch-external-services](rules/arch-external-services.md) | HIGH | Stripe, Resend 等の外部サービスは Adapter 経由 |
| [arch-logging-strategy](rules/arch-logging-strategy.md) | MEDIUM | pino で構造化ログ、console.log 禁止 |

### データ (`data-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [data-no-getall](rules/data-no-getall.md) | HIGH | 全件取得禁止、MAX_LIMIT でサーバー側上限を強制 |
| [data-pagination](rules/data-pagination.md) | HIGH | リスト取得は必ずページネーション付きで総件数を返却 |
| [data-comment-required](rules/data-comment-required.md) | LOW | テーブル・カラムに日本語コメント必須 |

### サーバーサイド保護 (`server-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [server-supabase-via-api](rules/server-supabase-via-api.md) | CRITICAL | クライアントから Supabase 直接使用禁止、API Route 経由必須 |
| [server-only-directive](rules/server-only-directive.md) | HIGH | Service/Repository に `import 'server-only'` を必須で記述 |
| [server-no-public-env](rules/server-no-public-env.md) | HIGH | 機密情報（Supabase, API キー）に `NEXT_PUBLIC_` 禁止 |

### スキーマ・型定義 (`schema-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [schema-single-source](rules/schema-single-source.md) | HIGH | 型定義は `schema.ts` に一元化、分散禁止 |
| [schema-no-types-file](rules/schema-no-types-file.md) | MEDIUM | Feature 内に `types.ts` 作成禁止 |
| [schema-zod-infer](rules/schema-zod-infer.md) | MEDIUM | Input 型は手書きせず `z.infer<typeof schema>` で導出 |

### レスポンス (`response-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [response-apperror](rules/response-apperror.md) | MEDIUM | エラーは `AppError` クラスでスロー、生の Error 禁止 |
| [response-helpers](rules/response-helpers.md) | LOW | `ok()`, `created()`, `notFound()` 等のヘルパーを使用 |

### テスト (`test-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [test-layer-mocking](rules/test-layer-mocking.md) | HIGH | 各レイヤーは直下の依存のみをモック |
| [test-server-only](rules/test-server-only.md) | MEDIUM | `server-only` はテスト環境でモック必須 |
| [test-file-location](rules/test-file-location.md) | LOW | テストファイルは `__tests__` に配置 |
| [test-naming](rules/test-naming.md) | LOW | テストは日本語で意図を明確に |

### バリデーション (`validation-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [validation-body](rules/validation-body.md) | MEDIUM | POST/PATCH のリクエストボディは Zod でバリデーション |
| [validation-params](rules/validation-params.md) | MEDIUM | URL パラメータ（ID 等）も Zod でバリデーション |

### 命名規則 (`naming-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [naming-files](rules/naming-files.md) | LOW | ファイル名は kebab-case（`user-profile.tsx`） |
| [naming-methods](rules/naming-methods.md) | LOW | Repository: `findMany`/`findById`、Service: `get*`/`create*` |

### フロントエンド (`frontend-`)

| ルール | Impact | 説明 |
|--------|--------|------|
| [frontend-fetcher](rules/frontend-fetcher.md) | LOW | Feature ごとに `fetcher.ts` を作成して API 呼び出しを集約 |
| [frontend-hooks](rules/frontend-hooks.md) | LOW | SWR を使用した Hook パターンでデータ取得 |
