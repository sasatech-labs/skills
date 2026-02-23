# データベース設計

## 概要

このガイドでは、Supabase（PostgreSQL）を使用したデータベース設計の標準パターンを説明する。すべてのテーブルに対して、コメント、必須カラム、RLS、マイグレーション管理の統一されたルールを適用する。

## 設計思想

### なぜこのパターンを採用するのか

- **可読性**: テーブルとカラムにコメントを付けることで、データベース直接操作時の理解を容易にする
- **監査性**: 作成者・更新者・日時を必須カラムとして記録し、データの履歴を追跡可能にする
- **セキュリティ**: RLSを全テーブルで有効化し、行レベルでのアクセス制御を実現する
- **一貫性**: マイグレーション管理を統一し、環境間でのスキーマ同期を保証する

## コメント（説明）必須

すべてのテーブルとカラムに日本語のコメントを付ける。

### コメントの目的

- **可読性向上**: Supabase Studio やデータベースクライアントでカラムの意図が即座に理解できる
- **チーム開発**: 新メンバーがスキーマを迅速に理解できる
- **ドキュメント統合**: コードとドキュメントの乖離を防ぐ

### 構文

```sql
-- テーブルへのコメント
COMMENT ON TABLE テーブル名 IS '説明文';

-- カラムへのコメント
COMMENT ON COLUMN テーブル名.カラム名 IS '説明文';
```

### 実装例

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

## 実装パターン

### マイグレーション管理

#### ファイル作成

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

#### 適用コマンド

```bash
# ローカルDBにマイグレーション適用
npx supabase db push

# ローカルDBをリセット（全マイグレーション再適用）
npx supabase db reset

# マイグレーション状態確認
npx supabase migration list
```

#### 注意事項

- **手動でファイルを作成しない**（タイムスタンプ形式の統一のため）
- 1つのマイグレーションには1つの論理的な変更のみ含める
- 本番適用前に `db reset` で全マイグレーションが正常に適用されることを確認

### 必須カラム

すべてのテーブルに以下のカラムを必ず含める：

| カラム名 | 型 | 説明 |
|---------|------|------|
| id | uuid | 主キー（デフォルト: `gen_random_uuid()`） |
| created_at | timestamptz | 作成日時（デフォルト: `now()`） |
| updated_at | timestamptz | 更新日時（デフォルト: `now()`、トリガーで自動更新） |
| create_user | uuid | 作成者（デフォルト: `auth.uid()`） |
| update_user | uuid | 更新者（デフォルト: `auth.uid()`、トリガーで自動更新） |

### 初期セットアップ

プロジェクト開始時に以下の関数を作成する（1回のみ実行）：

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

### テーブル作成の基本パターン

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

### 新規テーブル作成時のチェックリスト

1. 必須カラム（id, created_at, updated_at, create_user, update_user）を含める
2. `update_updated_at_and_user` トリガーを適用する
3. **テーブルとすべてのカラムに日本語コメントを追加する**
4. RLS を有効化する
5. RLS ポリシーを設定する

### RLS（Row Level Security）

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

### 命名規則

- テーブル名: スネークケース、複数形（`products`, `order_items`）
- カラム名: スネークケース（`created_at`, `create_user`）
- 外部キー: 参照先テーブルの単数形 + `_id`（`product_id`, `user_id`）
- インデックス: `idx_テーブル名_カラム名`（`idx_products_create_user`）

### インデックス

必要に応じて以下のインデックスを作成：

```sql
-- 作成者での検索用
CREATE INDEX idx_products_create_user ON products(create_user);

-- 作成日時でのソート用
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```

## 使用例

### 例1: 基本的なマスタテーブル

商品マスタの作成例。必須カラム、コメント、トリガー、RLSをすべて含む。

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

-- トリガー適用
CREATE TRIGGER trigger_update_updated_at_and_user
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_and_user();

-- コメント
COMMENT ON TABLE products IS '商品マスタ';
COMMENT ON COLUMN products.id IS '商品ID';
COMMENT ON COLUMN products.name IS '商品名';
COMMENT ON COLUMN products.price IS '価格（税抜、円）';
COMMENT ON COLUMN products.description IS '商品説明';
COMMENT ON COLUMN products.is_published IS '公開フラグ（true: 公開中）';
COMMENT ON COLUMN products.created_at IS '作成日時';
COMMENT ON COLUMN products.updated_at IS '更新日時';
COMMENT ON COLUMN products.create_user IS '作成者のユーザーID';
COMMENT ON COLUMN products.update_user IS '更新者のユーザーID';

-- RLS有効化
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLSポリシー：認証済みユーザーは全件読み取り可能
CREATE POLICY "Authenticated users can read products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

-- RLSポリシー：認証済みユーザーは作成可能
CREATE POLICY "Authenticated users can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = create_user);

-- RLSポリシー：作成者のみ更新可能
CREATE POLICY "Users can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (create_user = auth.uid())
  WITH CHECK (create_user = auth.uid());

-- RLSポリシー：作成者のみ削除可能
CREATE POLICY "Users can delete own products"
  ON products
  FOR DELETE
  TO authenticated
  USING (create_user = auth.uid());
```

### 例2: 外部キーを持つトランザクションテーブル

注文テーブルの作成例。外部キー、インデックス、複合的なRLSポリシーを含む。

```sql
-- テーブル作成
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  total_price integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',

  -- 必須カラム
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  create_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
  update_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL
);

-- トリガー適用
CREATE TRIGGER trigger_update_updated_at_and_user
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_and_user();

-- インデックス（検索性能向上）
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);

-- コメント
COMMENT ON TABLE orders IS '注文テーブル';
COMMENT ON COLUMN orders.id IS '注文ID';
COMMENT ON COLUMN orders.user_id IS '注文を行ったユーザーのID（auth.usersへの参照）';
COMMENT ON COLUMN orders.product_id IS '注文された商品のID（productsへの参照）';
COMMENT ON COLUMN orders.quantity IS '注文数量（1以上）';
COMMENT ON COLUMN orders.total_price IS '合計金額（税抜、円）';
COMMENT ON COLUMN orders.status IS '注文ステータス（pending: 保留中、completed: 完了、cancelled: キャンセル）';
COMMENT ON COLUMN orders.created_at IS '作成日時';
COMMENT ON COLUMN orders.updated_at IS '更新日時';
COMMENT ON COLUMN orders.create_user IS '作成者のユーザーID';
COMMENT ON COLUMN orders.update_user IS '更新者のユーザーID';

-- RLS有効化
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLSポリシー：ユーザーは自分の注文のみ閲覧可能
CREATE POLICY "Users can read own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLSポリシー：認証済みユーザーは注文作成可能
CREATE POLICY "Authenticated users can insert orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth.uid() = create_user);

-- RLSポリシー：ユーザーは自分の注文のみ更新可能（pendingステータスのみ）
CREATE POLICY "Users can update own pending orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

-- RLSポリシー：ユーザーは自分の注文のみ削除可能（pendingステータスのみ）
CREATE POLICY "Users can delete own pending orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');
```

### 例3: 管理者権限を含むRLSポリシー

ユーザープロファイルテーブルの作成例。一般ユーザーと管理者で異なるアクセス権限を設定する。

```sql
-- テーブル作成
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text DEFAULT '',
  is_admin boolean DEFAULT false NOT NULL,

  -- 必須カラム
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  create_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
  update_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL
);

-- トリガー適用
CREATE TRIGGER trigger_update_updated_at_and_user
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_and_user();

-- インデックス
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- コメント
COMMENT ON TABLE user_profiles IS 'ユーザープロファイル';
COMMENT ON COLUMN user_profiles.id IS 'プロファイルID';
COMMENT ON COLUMN user_profiles.user_id IS 'ユーザーID（auth.usersへの参照、1対1関係）';
COMMENT ON COLUMN user_profiles.display_name IS '表示名';
COMMENT ON COLUMN user_profiles.bio IS '自己紹介';
COMMENT ON COLUMN user_profiles.is_admin IS '管理者フラグ（true: 管理者）';
COMMENT ON COLUMN user_profiles.created_at IS '作成日時';
COMMENT ON COLUMN user_profiles.updated_at IS '更新日時';
COMMENT ON COLUMN user_profiles.create_user IS '作成者のユーザーID';
COMMENT ON COLUMN user_profiles.update_user IS '更新者のユーザーID';

-- RLS有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLSポリシー：すべての認証済みユーザーはプロファイルを閲覧可能
CREATE POLICY "Authenticated users can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- RLSポリシー：ユーザーは自分のプロファイルのみ作成可能
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth.uid() = create_user);

-- RLSポリシー：ユーザーは自分のプロファイルを更新可能、管理者はすべて更新可能
CREATE POLICY "Users can update own profile, admins can update all"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- RLSポリシー：管理者のみ削除可能
CREATE POLICY "Admins can delete profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );
```

## 関連ルール

- [data-pagination](../rules/data-pagination.md) - ページネーション必須ルール
- [data-comment-required](../rules/data-comment-required.md) - テーブル・カラムコメント必須ルール
