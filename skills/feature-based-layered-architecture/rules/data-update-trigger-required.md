---
id: data-update-trigger-required
title: updated_at/update_userトリガーの適用必須
category: データ
impact: MEDIUM
tags: [database, trigger, supabase, audit]
---

## ルール

すべてのテーブルに`update_updated_at_and_user`トリガーを適用する。このトリガーは、レコード更新時に`updated_at`と`update_user`を自動的に更新する。

## NG例

```sql
-- supabase/migrations/20240101000000_create_products.sql
-- NG: トリガーが適用されていない
-- updated_atとupdate_userが自動更新されず、古い値のままになる
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  create_user uuid not null references auth.users(id) default auth.uid(),
  update_user uuid not null references auth.users(id) default auth.uid()
);

-- トリガーの適用を忘れている
```

## OK例

```sql
-- supabase/migrations/20240101000000_create_products.sql
-- OK: テーブル作成後にトリガーを適用している
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  create_user uuid not null references auth.users(id) default auth.uid(),
  update_user uuid not null references auth.users(id) default auth.uid()
);

-- OK: トリガーを適用して、updated_atとupdate_userを自動更新する
create trigger trigger_update_updated_at_and_user
  before update on products
  for each row
  execute function update_updated_at_and_user();
```

## 理由

トリガーによる監査カラムの自動更新が必要な理由は以下の通りである：

1. **監査証跡の自動化**: トリガーにより、レコードの最終更新日時と更新者が自動的に記録される。アプリケーション側で手動設定する必要がなく、記録漏れを防止する
2. **データの信頼性**: トリガーがない場合、`updated_at`がレコード作成時のまま更新されない。更新日時によるソートやキャッシュ判定が誤動作する
3. **一貫性の保証**: すべてのテーブルで同じトリガー関数を使用することで、監査カラムの更新方法が統一される。テーブルごとに異なる実装を防ぐ

トリガーが未適用のテーブルは、`updated_at`が初期値のまま変わらず、更新の追跡が不可能になる。

## 参照

- [データベース設計ガイド](../guides/database.md)
- [data-rls-required](data-rls-required.md)
