---
title: テーブル・カラムに日本語コメント必須
impact: LOW
impactDescription: DBコメントの有無は開発体験・スキーマ理解に関する推奨事項
tags: database, comment, documentation
---

## テーブル・カラムに日本語コメント必須

すべてのテーブルとカラムに日本語のコメント（説明）を付ける。

## 理由

- Supabase Studio でカラムの意図がすぐにわかる
- チームメンバーがスキーマを理解しやすい
- コードとドキュメントの乖離を防ぐ

## 構文

```sql
COMMENT ON TABLE テーブル名 IS '説明文';
COMMENT ON COLUMN テーブル名.カラム名 IS '説明文';
```

## 良い例

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  total_amount integer NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  create_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
  update_user uuid REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL
);

-- テーブルコメント
COMMENT ON TABLE orders IS '注文テーブル';

-- カラムコメント（すべてのカラムに必須）
COMMENT ON COLUMN orders.id IS '注文ID';
COMMENT ON COLUMN orders.user_id IS '注文者のユーザーID';
COMMENT ON COLUMN orders.total_amount IS '合計金額（税込、円）';
COMMENT ON COLUMN orders.status IS '注文ステータス（pending/confirmed/shipped/delivered/cancelled）';
COMMENT ON COLUMN orders.created_at IS '作成日時';
COMMENT ON COLUMN orders.updated_at IS '更新日時';
COMMENT ON COLUMN orders.create_user IS '作成者のユーザーID';
COMMENT ON COLUMN orders.update_user IS '更新者のユーザーID';
```

## 悪い例

```sql
-- コメントなしでテーブルを作成
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  total_amount integer NOT NULL,
  status text DEFAULT 'pending' NOT NULL
);
-- コメントがないため、カラムの意図がわからない
```

## コメント記述のポイント

| ポイント | 良い例 | 悪い例 |
|---------|--------|--------|
| 単位を明記 | `合計金額（税込、円）` | `合計金額` |
| 意味を補足 | `ステータス（pending/confirmed/...）` | `ステータス` |
| 外部キーは参照先を明記 | `注文者のユーザーID` | `ユーザーID` |
| 略語は正式名称を併記 | `SKU（Stock Keeping Unit）` | `SKU` |

## 関連

- [guides/database.md](../guides/database.md)
