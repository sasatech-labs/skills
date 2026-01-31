---
id: schema-single-source
title: schema.ts に型定義を一元化
category: スキーマ・型定義
impact: HIGH
tags: [schema, types, zod, feature-structure]
---

## ルール

Feature内の型定義は`schema.ts`に集約する。`types.ts`は作成しない。

## NG例

型定義が分散し、同期が困難になる。

```plaintext
src/features/products/
├── schema.ts         # Zodスキーマのみ
├── types.ts          # 別ファイルに型定義
├── service.ts
└── repository.ts
```

```typescript
// schema.ts
export const createProductSchema = z.object({
  name: z.string(),
  price: z.number(),
})

// types.ts - 重複した型定義（NG: schema.tsと手動で同期が必要）
export type Product = {
  id: string
  name: string
  price: number
}

// NG: Zodスキーマと重複した型定義
export type CreateProductInput = {
  name: string
  price: number
}
```

## OK例

schema.tsに一元化し、Zodから型を導出する。

```plaintext
src/features/products/
├── schema.ts         # Zodスキーマ + 型定義
├── service.ts
└── repository.ts
```

```typescript
// src/features/products/core/schema.ts
import { z } from 'zod'
import type { ProductRow } from '@/types'  // Supabase生成型

// OK: Entity型はSupabase生成型から派生
export type Product = ProductRow

// OK: Zodスキーマを定義
export const createProductSchema = z.object({
  name: z.string().min(1, '商品名は必須です').max(100),
  price: z.number().min(0, '価格は0以上で入力してください'),
  description: z.string().max(1000).optional(),
})

export const updateProductSchema = createProductSchema.partial()

export const productIdSchema = z.object({
  id: z.string().uuid('無効なIDです'),
})

// OK: Input型はz.inferで自動導出
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

## 理由

型定義の分散は以下の問題を引き起こす。

1. **不整合のリスク**: `schema.ts`と`types.ts`を手動で同期する必要があり、更新漏れが発生する
2. **保守性の低下**: 型を変更する際に複数ファイルを修正する必要がある
3. **Single Source of Truthの違反**: 同じデータ構造が複数箇所で定義される

`schema.ts`に一元化し、`z.infer`で型を自動導出することで、整合性を保証し、保守性を向上させる。

## 補足

### Entity型とInput型の定義ルール

1. **Entity型**: Supabase生成型（`@/types`）からエイリアスまたは派生する
2. **Input型**: `z.infer<typeof schema>`でZodスキーマから導出する
3. **types.tsは作成しない**: すべての型定義を`schema.ts`に集約する

### server-onlyを付けない

`schema.ts`はフロントエンド（フォームバリデーション）でも使用するため、`server-only`を付けない。

```typescript
// src/features/products/core/schema.ts
// import 'server-only'  ← 付けない（フロントエンドで使用するため）

import { z } from 'zod'
```

```typescript
// src/features/products/components/create-product-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
// OK: schema.tsをフロントエンドで使用可能
import { createProductSchema, CreateProductInput } from '../core/schema'

export function CreateProductForm() {
  const { register, handleSubmit } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
  })
  // ...
}
```
