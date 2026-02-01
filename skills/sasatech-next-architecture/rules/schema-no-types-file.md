---
id: schema-no-types-file
title: types.ts ファイル作成禁止
category: スキーマ・型定義
impact: MEDIUM
tags: [schema, types, feature-structure]
---

## ルール

Feature ディレクトリ内に `types.ts` を作成しない。型定義は `schema.ts` に集約する。

## NG例

types.ts を作成すると、型定義が重複する。

```text
src/features/products/
├── types.ts          # 禁止
├── schema.ts
├── service.ts
└── repository.ts
```

```typescript
// types.ts - 禁止
export type Product = {
  id: string
  name: string
  price: number
  createdAt: string
}

export type CreateProductInput = {
  name: string
  price: number
}
```

## OK例

schema.ts のみを使用し、Single Source of Truth を実現する。

```text
src/features/products/
├── schema.ts         # 型定義もここに含める
├── service.ts
└── repository.ts
```

```typescript
// schema.ts
import { z } from 'zod'
import type { ProductRow } from '@/types'

// Entity型
export type Product = ProductRow

// Zodスキーマ
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
})

// Input型（スキーマから導出）
export type CreateProductInput = z.infer<typeof createProductSchema>
```

### src/types/ の役割

`src/types/` ディレクトリは Supabase 自動生成型専用である。

```text
src/types/
├── database.ts       # npx supabase gen types で自動生成
└── index.ts          # エイリアスのエクスポート
```

```typescript
// src/types/index.ts
import type { Database } from './database'

// テーブル行型のエイリアス
export type ProductRow = Database['public']['Tables']['products']['Row']
export type UserRow = Database['public']['Tables']['users']['Row']
```

手動で型を追加しない。型が必要な場合は以下のいずれかを行う：

- Feature の `schema.ts` に追加
- Supabase のマイグレーションでテーブルを変更し、型を再生成

## 理由

このルールにより以下を実現する：

1. **Single Source of Truth**: 型定義の重複を防止する
2. **Zod との連携**: Input 型は `z.infer` で自動導出する
3. **同期の保証**: スキーマと型が常に一致する
4. **保守性**: 変更箇所が1箇所で済む
