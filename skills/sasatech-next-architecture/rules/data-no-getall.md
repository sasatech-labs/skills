---
title: 全件取得（getAll/findAll）の禁止
impact: CRITICAL
impactDescription: メモリ枯渇、レスポンス遅延、DoS脆弱性を防止
tags: data-access, pagination, security, repository
---

## 全件取得（getAll/findAll）の禁止

Repository層で上限なしの全件取得を行わない。必ずサーバー側で上限を強制する。

**Incorrect (上限なし、データ量増加でメモリ枯渇):**

```typescript
// 上限なし - データ量増加でメモリ枯渇
async findAll(supabase: SupabaseClient): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*')
  return data
}

// クライアントの limit をそのまま使用
async findMany(supabase: SupabaseClient, limit: number) {
  // limit=10000 が来たらそのまま10000件取得してしまう
  return supabase.from('products').select('*').limit(limit)
}
```

**Correct (MAX_LIMIT でサーバー側上限を強制):**

```typescript
const MAX_LIMIT = 100

async findMany(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  // クライアントのリクエストに関わらず上限を強制
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  const offset = options.offset ?? 0

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new AppError(error.message, 500)
  return data
}
```

## 例外: マスタデータの全件取得

以下の条件を**すべて**満たす場合のみ許可:

1. 件数が明確に制限されている（例: 都道府県47件）
2. 増加しない、または増加が極めて緩やか
3. UI上で全件表示が必要（ドロップダウン等）

```typescript
// OK: 明確に件数が制限されたマスタデータ（上限付き）
async findAll(supabase: SupabaseClient): Promise<Prefecture[]> {
  const { data, error } = await supabase
    .from('prefectures')
    .select('*')
    .order('code', { ascending: true })
    .limit(100)  // 安全のため上限を設定

  if (error) throw new AppError(error.message, 500)
  return data
}
```

## 命名規則

| パターン | 用途 |
|---------|------|
| `findMany` | ページネーション付きの複数件取得 |
| `findById` | ID指定の1件取得 |
| `search` | 検索条件付きの取得 |
| `count` | 件数のみ取得 |
| ~~`findAll`~~ | **使用禁止**（マスタデータ以外） |
| ~~`getAll`~~ | **使用禁止** |
