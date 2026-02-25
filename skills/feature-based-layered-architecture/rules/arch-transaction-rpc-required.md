---
id: arch-transaction-rpc-required
title: トランザクション処理はRPC関数を使用
category: アーキテクチャ
impact: HIGH
tags: [architecture, transaction, rpc, supabase, database]
---

## ルール

複数のテーブルを更新する処理でデータの整合性が必要な場合、Supabase RPC関数を使用してデータベースレベルのトランザクションを実現する。アプリケーション側で複数のクエリを順次実行して整合性を保証しない。

## 理由

トランザクション処理にRPC関数を使用する理由は以下の通りである：

1. **原子性の保証**: RPC関数はデータベースレベルのトランザクションで実行される。途中で失敗した場合、すべての変更が自動的にロールバックされる。アプリケーション側の順次実行では、途中失敗時にデータが不整合な状態になる
2. **競合状態の防止**: `FOR UPDATE`による行ロックにより、同時アクセス時の競合を防止できる。アプリケーション側の実装では、読み取りと更新の間に他のリクエストが割り込む可能性がある
3. **パフォーマンス**: 複数のクエリをアプリケーションから順次送信する場合、ネットワークラウンドトリップが発生する。RPC関数はデータベース内で完結するため、遅延が最小になる

違反すると、部分的な更新によるデータ不整合や、競合状態による二重処理が発生する。

## OK例

### Service層からRPC関数を呼び出す

```typescript
// src/features/transfers/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'

// OK: RPC関数を使用してデータベースレベルのトランザクションを実行する
export async function transferMoney(
  supabase: SupabaseClient,
  fromAccountId: string,
  toAccountId: string,
  amount: number
) {
  if (amount <= 0) {
    throw new AppError('金額は正の値を指定する', 400)
  }

  const { data, error } = await supabase.rpc('transfer_money', {
    p_from_account_id: fromAccountId,
    p_to_account_id: toAccountId,
    p_amount: amount,
  })

  if (error) {
    throw new AppError(error.message, 500)
  }

  return data
}
```

### RPC関数の定義

```sql
-- supabase/migrations/20240101000000_create_transfer_money.sql
-- OK: データベースレベルでトランザクションを保証する
create or replace function transfer_money(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount decimal
)
returns json
language plpgsql
as $$
declare
  v_from_balance decimal;
  v_transaction_id uuid;
begin
  -- 送金元の残高を確認する（FOR UPDATEで行ロック）
  select balance into v_from_balance
  from accounts
  where id = p_from_account_id
  for update;

  if v_from_balance is null then
    raise exception '送金元アカウントが存在しない';
  end if;

  if v_from_balance < p_amount then
    raise exception '残高が不足している';
  end if;

  -- 送金元から減額する
  update accounts
  set balance = balance - p_amount
  where id = p_from_account_id;

  -- 送金先に加算する
  update accounts
  set balance = balance + p_amount
  where id = p_to_account_id;

  -- トランザクション記録を作成する
  insert into transactions (from_account_id, to_account_id, amount, status)
  values (p_from_account_id, p_to_account_id, p_amount, 'completed')
  returning id into v_transaction_id;

  return json_build_object(
    'transaction_id', v_transaction_id,
    'amount', p_amount
  );
end;
$$;
```

## NG例

```typescript
// src/features/transfers/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { accountRepository } from '@/features/accounts/core/repository'
import { transactionRepository } from './repository'

export async function transferMoney(
  supabase: SupabaseClient,
  fromAccountId: string,
  toAccountId: string,
  amount: number
) {
  // NG: 複数のクエリを順次実行している
  // 途中で失敗すると、データが不整合な状態になる
  await accountRepository.decreaseBalance(supabase, fromAccountId, amount)
  await accountRepository.increaseBalance(supabase, toAccountId, amount)
  await transactionRepository.create(supabase, {
    fromAccountId,
    toAccountId,
    amount,
    status: 'completed',
  })
}
```

## 例外

単一テーブルの更新や、整合性が不要な独立した操作には、RPC関数は不要である。

```typescript
// 例外: 単一テーブルの更新はRepository経由で十分
export async function updateProductName(
  supabase: SupabaseClient,
  id: string,
  name: string
) {
  return productRepository.update(supabase, id, { name })
}
```

## 参照

- [Service層ガイド](../guides/architecture/service.md)
- [arch-three-layers](arch-three-layers.md)
