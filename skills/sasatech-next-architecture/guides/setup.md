# セットアップ

新規プロジェクトのセットアップ手順。

## 1. プロジェクト作成

```bash
npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd my-app
```

## 2. 依存パッケージ

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# バリデーション
npm install zod

# サーバー専用
npm install server-only

# UI
npx shadcn@latest init
npx shadcn@latest add button input label card

# フォーム（必要に応じて）
npm install react-hook-form @hookform/resolvers

# データフェッチ（必要に応じて）
npm install swr
```

## 3. ディレクトリ作成

```bash
mkdir -p src/features
mkdir -p src/components/layout
mkdir -p src/hooks
mkdir -p src/lib/supabase
mkdir -p src/types
```

## 4. 環境変数

```bash
# .env.local
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**重要**: `NEXT_PUBLIC_` プレフィックスは使用しない（サーバー専用）

## 5. 基盤ファイル

以下のファイルを `scripts/` からコピー:

| ファイル | コピー先 |
|---------|---------|
| `AGENTS.md` | `AGENTS.md`（プロジェクトルート） |
| `lib/errors.ts` | `src/lib/errors.ts` |
| `lib/api-response.ts` | `src/lib/api-response.ts` |
| `lib/api-error.ts` | `src/lib/api-error.ts` |
| `lib/fetcher.ts` | `src/lib/fetcher.ts` |
| `lib/validation.ts` | `src/lib/validation.ts` |
| `lib/supabase/server.ts` | `src/lib/supabase/server.ts` |
| `types/index.ts` | `src/types/index.ts` |

## 6. Supabase セットアップ

```bash
# Supabase CLI インストール（未インストールの場合）
npm install -D supabase

# 初期化
npx supabase init

# 起動
npx supabase start

# 型生成
npx supabase gen types typescript --local > src/types/database.ts
```

## 7. package.json スクリプト追加

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > src/types/database.ts",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

## 8. Feature 作成例

```bash
# 新しいfeatureを作成
mkdir -p src/features/products/core
touch src/features/products/core/{index,schema,service,repository}.ts
touch src/features/products/{index,fetcher,hooks}.ts
```

## 確認チェックリスト

- [ ] `npm run dev` でエラーなく起動
- [ ] `npx supabase start` でローカルDB起動
- [ ] `.env.local` に環境変数設定済み
- [ ] `src/types/database.ts` 生成済み
- [ ] `src/lib/` に基盤ファイル配置済み
