---
title: types.ts ファイル作成禁止
impact: MEDIUM
impactDescription: types.tsの存在は型定義の重複を招き、コードの品質・一貫性を低下させる
tags: schema, types, feature-structure
---

## types.ts ファイル作成禁止

Feature ディレクトリ内に `types.ts` を作成しない。型定義は `schema.ts` に集約する。

**NG (types.ts を作成、型が重複):**

```
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

**OK (schema.ts のみ、Single Source of Truth):**

```
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

## src/types/ の役割

`src/types/` ディレクトリは **Supabase 自動生成型専用**:

```
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

手動で型を追加しない。型が必要な場合は:
- Feature の `schema.ts` に追加
- または Supabase のマイグレーションでテーブルを変更し、型を再生成

## 理由

1. **Single Source of Truth**: 型定義の重複を防止
2. **Zod との連携**: Input 型は `z.infer` で自動導出
3. **同期の保証**: スキーマと型が常に一致
4. **保守性**: 変更箇所が1箇所で済む
