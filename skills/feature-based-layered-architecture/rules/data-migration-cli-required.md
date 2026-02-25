---
id: data-migration-cli-required
title: マイグレーションファイルはCLIで生成
category: データ
impact: MEDIUM
tags: [database, migration, supabase, cli]
---

## ルール

マイグレーションファイルは必ずSupabase CLIで作成する。手動でファイルを作成しない。

## 理由

マイグレーションファイルをCLIで生成すべき理由は以下の3つである：

1. **タイムスタンプ形式の統一**: CLIはマイクロ秒精度のタイムスタンプを自動付与する。手動作成ではフォーマットの不一致やタイムスタンプの衝突が発生する
2. **実行順序の保証**: マイグレーションはタイムスタンプ順に適用される。不正なフォーマットは実行順序の誤りを引き起こし、スキーマ不整合の原因になる
3. **チーム間の一貫性**: CLIを統一ツールとすることで、開発者間でファイル形式の差異が発生しない

違反すると、マイグレーションの適用順序が不正になり、環境間でスキーマの差異が発生する。

## OK例

```bash
# OK: Supabase CLIでマイグレーションファイルを生成する
npx supabase migration new create_products
```

```
# CLIが正しいタイムスタンプ形式でファイルを生成する
supabase/migrations/
└── 20240124123456_create_products.sql
```

```bash
# OK: 操作内容が分かる命名
npx supabase migration new create_products
npx supabase migration new add_status_to_products
npx supabase migration new add_rls_policies_to_products
npx supabase migration new add_index_to_products_name
```

## NG例

```bash
# NG: 手動でファイルを作成している
touch supabase/migrations/20240101_create_products.sql
```

```bash
# NG: タイムスタンプ形式が不正
# 手動作成したためフォーマットが統一されていない
supabase/migrations/
├── 20240101_create_products.sql        # NG: タイムスタンプが短い
├── 2024-01-24_create_orders.sql        # NG: ハイフン区切り
└── 20240124123456_create_users.sql     # OK: CLI生成
```

## 参照

- [データベース設計ガイド](../guides/database.md)
