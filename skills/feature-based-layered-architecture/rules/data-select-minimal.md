---
id: data-select-minimal
title: 必要なカラムのみselect
category: データ
impact: MEDIUM
tags: [database, performance, repository, supabase]
---

## ルール

Repository層のクエリでは`select('*')`を避け、必要なカラムのみを指定する。

## 理由

selectするカラムを明示的に指定することで、以下の利点がある：

1. **パフォーマンス**: 不要なカラムの取得はネットワーク帯域とメモリを消費する。テーブルのカラム数やデータ量が増加するにつれ、影響が大きくなる
2. **APIコントラクトの明示**: selectするカラムを明示することで、Repository関数が返すデータの形状が型レベルで明確になる。`select('*')`はテーブル構造の変更に暗黙的に依存する
3. **セキュリティ**: 機密性の高いカラム（内部フラグ、管理用メモ等）が意図せずレスポンスに含まれることを防止する

違反した場合、不要なデータ転送によるパフォーマンス低下と、意図しないデータ露出のリスクが発生する。

## OK例

```typescript
// src/features/products/core/repository.ts
// OK: 必要なカラムのみを指定している
export const productRepository = {
  async findMany(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, is_published, created_at')  // OK: 必要なカラムのみ
      .order('created_at', { ascending: false })

    if (error) throw new AppError(error.message, 500)
    return data
  },

  // OK: 用途に応じて取得カラムを絞る
  async findNames(
    supabase: SupabaseClient
  ): Promise<Array<Pick<Product, 'id' | 'name'>>> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name')  // OK: 必要最小限のカラム
      .order('name')

    if (error) throw new AppError(error.message, 500)
    return data
  },
}
```

## NG例

```typescript
// src/features/products/core/repository.ts
// NG: すべてのカラムを取得している
export const productRepository = {
  async findMany(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('products')
      .select('*')  // NG: 不要なカラムも取得する

    if (error) throw new AppError(error.message, 500)
    return data
  },

  // NG: 名前一覧の取得にすべてのカラムを含めている
  async findNames(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('products')
      .select('*')  // NG: idとnameだけで十分
      .order('name')

    if (error) throw new AppError(error.message, 500)
    return data
  },
}
```

## 例外

テーブルの全カラムが必要な場合（詳細画面や管理画面など）は、`select('*')`を使用できる。ただし、用途をコメントで明示する。

```typescript
// 例外: 管理画面の詳細表示で全カラムが必要
async findByIdForAdmin(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')  // 管理画面の詳細表示: 全カラムが必要
    .eq('id', id)
    .single()

  if (error) throw new AppError(error.message, 500)
  return data
}
```

## 参照

- [Repository層ガイド](../guides/architecture/repository.md)
