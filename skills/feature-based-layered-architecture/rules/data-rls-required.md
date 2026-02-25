---
id: data-rls-required
title: 全テーブルでRLS有効化必須
category: データ
impact: CRITICAL
tags: [database, security, rls, supabase]
---

## ルール

Supabaseの全テーブルでRLS (Row Level Security) を有効化し、最低1つのポリシーを定義する。RLSが無効なテーブルは、すべてのクライアントから無制限にアクセス可能になる。

## 理由

RLSを全テーブルで有効化する理由は以下の通りである：

1. **セキュリティ境界**: RLSはデータベースレベルのセキュリティ境界である。RLSが無効な場合、クエリの1つのバグで全データが露出する。アプリケーションロジックのみに依存したデータ分離は、バイパスのリスクがある
2. **多層防御**: API Routeによるサーバーサイド保護（[server-supabase-via-api](server-supabase-via-api.md)）とRLSを組み合わせることで、多層防御を実現する。一方の防御が突破されても、もう一方がデータを保護する
3. **Supabaseのデフォルト動作**: SupabaseはRLSが無効なテーブルに対して、すべてのクライアントから無制限のアクセスを許可する。`anon`キーを持つクライアントでもデータの読み書きが可能になる

RLSが無効なテーブルが1つでも存在すると、そのテーブル経由で情報漏洩が発生する。

## OK例

```sql
-- supabase/migrations/20240101000000_create_products.sql
-- OK: テーブル作成後にRLSを有効化し、ポリシーを定義している
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  create_user uuid not null references auth.users(id),
  update_user uuid not null references auth.users(id)
);

-- RLSを有効化する
alter table products enable row level security;

-- 認証済みユーザーは全レコードを読み取れる
create policy "products_select_authenticated"
  on products
  for select
  to authenticated
  using (true);

-- 認証済みユーザーはレコードを作成できる
create policy "products_insert_authenticated"
  on products
  for insert
  to authenticated
  with check (auth.uid() = create_user);

-- 作成者のみレコードを更新できる
create policy "products_update_owner"
  on products
  for update
  to authenticated
  using (auth.uid() = create_user)
  with check (auth.uid() = update_user);

-- 作成者のみレコードを削除できる
create policy "products_delete_owner"
  on products
  for delete
  to authenticated
  using (auth.uid() = create_user);
```

## NG例

```sql
-- supabase/migrations/20240101000000_create_products.sql
-- NG: RLSが有効化されていない
-- NG: ポリシーが定義されていない
-- このテーブルはすべてのクライアントから無制限にアクセスできる
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  create_user uuid not null references auth.users(id),
  update_user uuid not null references auth.users(id)
);
```

## 例外

例外は存在しない。マスタテーブルやルックアップテーブルを含むすべてのテーブルでRLSを有効化する。参照専用のテーブルには、読み取り専用のポリシーを定義する。

```sql
-- マスタテーブルでも読み取り専用ポリシーを定義する
alter table categories enable row level security;

create policy "categories_select_authenticated"
  on categories
  for select
  to authenticated
  using (true);
```

## 参照

- [データベース設計ガイド](../guides/database.md)
- [server-supabase-via-api](server-supabase-via-api.md)
