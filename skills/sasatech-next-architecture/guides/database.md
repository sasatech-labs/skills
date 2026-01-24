# データベース設計

## コメント（説明）必須

すべてのテーブルとカラムに日本語のコメントを付ける。

### なぜコメントが必要か

- **可読性向上**: Supabase Studio やデータベースクライアントでカラムの意図がすぐわかる
- **チーム開発**: 新メンバーがスキーマを理解しやすくなる
- **ドキュメント代わり**: コードとドキュメントの乖離を防ぐ

### 構文

```sql
-- テーブルへのコメント
COMMENT ON TABLE テーブル名 IS '説明文';

-- カラムへのコメント
COMMENT ON COLUMN テーブル名.カラム名 IS '説明文';
```

### 例

```sql
-- テーブル作成
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL,
  description text DEFAULT '',
  is_published boolean DEFAULT false NOT NULL,

  -- 必須カラム
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  create_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
  update_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL
);

-- テーブルコメント
COMMENT ON TABLE products IS '商品マスタ';

-- カラムコメント（すべてのカラムに必須）
COMMENT ON COLUMN products.id IS '商品ID';
COMMENT ON COLUMN products.name IS '商品名';
COMMENT ON COLUMN products.price IS '価格（税抜、円）';
COMMENT ON COLUMN products.description IS '商品説明';
COMMENT ON COLUMN products.is_published IS '公開フラグ（true: 公開中）';
COMMENT ON COLUMN products.created_at IS '作成日時';
COMMENT ON COLUMN products.updated_at IS '更新日時';
COMMENT ON COLUMN products.create_user IS '作成者のユーザーID';
COMMENT ON COLUMN products.update_user IS '更新者のユーザーID';
```

### コメント記述のポイント

| ポイント | 良い例 | 悪い例 |
|---------|--------|--------|
| 単位を明記 | `価格（税抜、円）` | `価格` |
| 意味を補足 | `公開フラグ（true: 公開中）` | `公開フラグ` |
| 外部キーは参照先を明記 | `注文を行ったユーザーのID` | `ユーザーID` |
| 略語は正式名称を併記 | `SKU（Stock Keeping Unit）` | `SKU` |

---

## マイグレーション

### ファイル作成

フォーマット統一のため、マイグレーションファイルは必ず Supabase CLI で作成する。

```bash
# マイグレーションファイル作成
npx supabase migration new <migration_name>
```

これにより `supabase/migrations/` に タイムスタンプ付きファイルが生成される：

```
supabase/migrations/
└── 20240124123456_create_products.sql
```

### 命名規則

マイグレーション名は以下の形式を使用：

| 操作 | 命名例 |
|------|--------|
| テーブル作成 | `create_products` |
| カラム追加 | `add_status_to_products` |
| カラム削除 | `remove_old_column_from_products` |
| インデックス追加 | `add_index_to_products_name` |
| RLSポリシー追加 | `add_rls_policies_to_products` |

### 適用コマンド

```bash
# ローカルDBにマイグレーション適用
npx supabase db push

# ローカルDBをリセット（全マイグレーション再適用）
npx supabase db reset

# マイグレーション状態確認
npx supabase migration list
```

### 注意事項

- **手動でファイルを作成しない**（タイムスタンプ形式の統一のため）
- 1つのマイグレーションには1つの論理的な変更のみ含める
- 本番適用前に `db reset` で全マイグレーションが正常に適用されることを確認

## 必須カラム

すべてのテーブルに以下のカラムを必ず含める：

| カラム名 | 型 | 説明 |
|---------|------|------|
| id | uuid | 主キー（デフォルト: `gen_random_uuid()`） |
| created_at | timestamptz | 作成日時（デフォルト: `now()`） |
| updated_at | timestamptz | 更新日時（デフォルト: `now()`、トリガーで自動更新） |
| create_user | uuid | 作成者（デフォルト: `auth.uid()`） |
| update_user | uuid | 更新者（デフォルト: `auth.uid()`、トリガーで自動更新） |

## 初期セットアップ（1回のみ）

プロジェクト開始時に以下の関数を作成する：

```sql
-- 全テーブル共通: updated_at, update_user 自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_and_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.update_user = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## テーブル作成例

```sql
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL,
  description text DEFAULT '',

  -- 必須カラム
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  create_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
  update_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL
);

-- トリガー適用（全テーブルで必須）
CREATE TRIGGER trigger_update_updated_at_and_user
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_and_user();

-- コメント（すべてのテーブル・カラムに必須）
COMMENT ON TABLE products IS '商品マスタ';
COMMENT ON COLUMN products.id IS '商品ID';
COMMENT ON COLUMN products.name IS '商品名';
COMMENT ON COLUMN products.price IS '価格（税抜、円）';
COMMENT ON COLUMN products.description IS '商品説明';
COMMENT ON COLUMN products.created_at IS '作成日時';
COMMENT ON COLUMN products.updated_at IS '更新日時';
COMMENT ON COLUMN products.create_user IS '作成者のユーザーID';
COMMENT ON COLUMN products.update_user IS '更新者のユーザーID';
```

## 新規テーブル作成時のチェックリスト

1. 必須カラム（id, created_at, updated_at, create_user, update_user）を含める
2. `update_updated_at_and_user` トリガーを適用する
3. **テーブルとすべてのカラムに日本語コメントを追加する**
4. RLS を有効化する
5. RLS ポリシーを設定する

## RLS（Row Level Security）

すべてのテーブルで RLS を有効にする。

```sql
-- RLS 有効化（必須）
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ポリシー例：認証済みユーザーのみ読み取り可能
CREATE POLICY "Authenticated users can read products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

-- ポリシー例：作成者のみ更新可能
CREATE POLICY "Users can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (create_user = auth.uid())
  WITH CHECK (create_user = auth.uid());

-- ポリシー例：作成者のみ削除可能
CREATE POLICY "Users can delete own products"
  ON products
  FOR DELETE
  TO authenticated
  USING (create_user = auth.uid());

-- ポリシー例：認証済みユーザーは作成可能
CREATE POLICY "Authenticated users can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = create_user);
```

## 命名規則

- テーブル名: スネークケース、複数形（`products`, `order_items`）
- カラム名: スネークケース（`created_at`, `create_user`）
- 外部キー: 参照先テーブルの単数形 + `_id`（`product_id`, `user_id`）
- インデックス: `idx_テーブル名_カラム名`（`idx_products_create_user`）

## インデックス

必要に応じて以下のインデックスを作成：

```sql
-- 作成者での検索用
CREATE INDEX idx_products_create_user ON products(create_user);

-- 作成日時でのソート用
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```
