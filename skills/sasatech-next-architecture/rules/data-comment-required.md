---
id: data-comment-required
title: テーブル・カラムに日本語コメント必須
category: データ
impact: LOW
tags: [database, comment, documentation]
---

## ルール

すべてのテーブルとカラムに日本語のコメントを付ける。

## NG例

```sql
-- NG: コメントなしでテーブルを作成
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  total_amount integer NOT NULL,
  status text DEFAULT 'pending' NOT NULL
);
-- 問題: コメントがないため、カラムの意図や用途が不明確
-- 問題: Supabase Studioでスキーマを確認する際に説明が表示されない
```

## OK例

```sql
-- OK: テーブルとすべてのカラムにコメントを付ける
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

-- 推奨: 単位や取りうる値、参照先を明記することで理解しやすくなる
```

## 理由

データベースのコメントは以下の理由で重要である：

- Supabase Studioでカラムの意図がすぐに確認できる
- チームメンバーがスキーマを理解しやすくなる
- コードとドキュメントの乖離を防ぐ

違反時の影響：
- カラムの用途や制約が不明確になり、開発効率が低下する
- チーム間のコミュニケーションコストが増加する
- スキーマの理解に時間がかかる

## 構文

```sql
COMMENT ON TABLE テーブル名 IS '説明文';
COMMENT ON COLUMN テーブル名.カラム名 IS '説明文';
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
