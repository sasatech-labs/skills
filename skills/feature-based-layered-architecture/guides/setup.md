# セットアップ

新規プロジェクトのセットアップ手順。

## 1. プロジェクト作成

```bash
npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd my-app
```

> `--eslint` フラグで Next.js 標準の ESLint が入る。アーキテクチャ固有のカスタムルールはステップ3で追加する。

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

# ログ
npm install pino pino-pretty
```

## 3. 静的解析（Biome + ESLint）

Biomeをフォーマッタ + 基本Lintとして使用し、ESLintはアーキテクチャ固有のカスタムルール専用とする。

### 役割分担

| ツール | 役割 | 対象 |
|--------|------|------|
| Biome | フォーマット + 基本Lint | インデント、引用符、import順序、未使用変数など |
| ESLint | アーキテクチャ固有ルール | `console.log`禁止、レイヤー間の依存制約など |

### Biome

```bash
npm install -D --save-exact @biomejs/biome
npx biome init
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "rules": {
      "recommended": true
    }
  }
}
```

### ESLint（アーキテクチャ固有ルール）

`create-next-app --eslint` で導入済みの ESLint に、カスタムルールを追加する。

`eslint.config.mjs`:

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // アーキテクチャ固有ルール
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // console.log禁止（pinoを使用）
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // Handler → Repository 直接呼び出し禁止
  {
    files: ["src/features/**/handler.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/repository", "**/repository.*"],
              message: "HandlerからRepositoryを直接呼び出さない。Service経由で使用する。",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
```

> Biomeが担当する基本Lint（未使用変数、import順序など）はESLint側で無効にし、ルールの競合を避ける。

## 4. ディレクトリ作成

```bash
mkdir -p src/features
mkdir -p src/components/layout
mkdir -p src/hooks
mkdir -p src/lib/supabase
mkdir -p src/types
```

## 5. 環境変数

```bash
# .env.local
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**重要**: `NEXT_PUBLIC_` プレフィックスは使用しない（サーバー専用）

## 6. 基盤ファイル

以下のファイルを `scripts/` からコピー:

| ファイル | コピー先 |
|---------|---------|
| `AGENTS.md` | `AGENTS.md`（プロジェクトルート） |
| `lib/errors.ts` | `src/lib/errors.ts` |
| `lib/api-response.ts` | `src/lib/api-response.ts` |
| `lib/api-error.ts` | `src/lib/api-error.ts` |
| `lib/fetcher.ts` | `src/lib/fetcher.ts` |
| `lib/validation.ts` | `src/lib/validation.ts` |
| `lib/with-http-error.ts` | `src/lib/with-http-error.ts` |
| `lib/logger.ts` | `src/lib/logger.ts` |
| `lib/supabase/server.ts` | `src/lib/supabase/server.ts` |
| `types/index.ts` | `src/types/index.ts` |

## 7. Supabase セットアップ

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

## 8. package.json スクリプト追加

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "format": "biome format --write .",
    "check": "biome check --write .",
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

## 9. Feature 作成例

```bash
# 新しいfeatureを作成
mkdir -p src/features/products/core
touch src/features/products/core/{schema,handler,service,repository,fetcher,hooks}.ts
touch src/features/products/{index.server,index.client}.ts
```

## 確認チェックリスト

- [ ] `npm run dev` でエラーなく起動
- [ ] `npx biome check .` がエラーなく通る
- [ ] `npm run lint` がエラーなく通る
- [ ] `npx supabase start` でローカルDB起動
- [ ] `.env.local` に環境変数設定済み
- [ ] `src/types/database.ts` 生成済み
- [ ] `src/lib/` に基盤ファイル配置済み
