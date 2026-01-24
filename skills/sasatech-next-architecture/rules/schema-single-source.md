---
title: schema.ts に型定義を一元化
impact: HIGH
impactDescription: 型の重複と不整合を防止、保守性向上
tags: schema, types, zod, feature-structure
---

## schema.ts に型定義を一元化

Feature 内の型定義は `schema.ts` に集約する。`types.ts` は作成しない。

**NG (型定義が分散、同期が困難):**

```
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

// types.ts - 重複した型定義
export type Product = {
  id: string
  name: string
  price: number
}

export type CreateProductInput = {
  name: string
  price: number
}
```

**OK (schema.ts に一元化、Zod から型導出):**

```
src/features/products/
├── schema.ts         # Zodスキーマ + 型定義
├── service.ts
└── repository.ts
```

```typescript
// src/features/products/core/schema.ts
import { z } from 'zod'
import type { ProductRow } from '@/types'  // Supabase生成型

// Entity Type（Supabase型から派生）
export type Product = ProductRow

// Input Schemas
export const createProductSchema = z.object({
  name: z.string().min(1, '商品名は必須です').max(100),
  price: z.number().min(0, '価格は0以上で入力してください'),
  description: z.string().max(1000).optional(),
})

export const updateProductSchema = createProductSchema.partial()

export const productIdSchema = z.object({
  id: z.string().uuid('無効なIDです'),
})

// Input Types（スキーマから自動導出）
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

## ルール

1. **Entity 型**: Supabase 生成型（`@/types`）からエイリアスまたは派生
2. **Input 型**: `z.infer<typeof schema>` で Zod スキーマから導出
3. **types.ts は作成しない**: すべて schema.ts に集約

## server-only を付けない

`schema.ts` はフロントエンド（フォームバリデーション）でも使用するため、`server-only` を付けない:

```typescript
// src/features/products/core/schema.ts
// import 'server-only'  ← 付けない

import { z } from 'zod'
```

```typescript
// src/features/products/components/create-product-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProductSchema, CreateProductInput } from '../core/schema'  // 使用可能

export function CreateProductForm() {
  const { register, handleSubmit } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
  })
  // ...
}
```
