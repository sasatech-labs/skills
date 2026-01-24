---
title: z.infer で Input 型を導出
impact: HIGH
impactDescription: スキーマと型の同期を自動化
tags: schema, types, zod, validation
---

## z.infer で Input 型を導出

Input 型は Zod スキーマから `z.infer` で導出する。手動で型定義しない。

**Incorrect (手動で型定義、スキーマと乖離するリスク):**

```typescript
// schema.ts
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string().optional(),
})

// 手動で型定義 - スキーマと乖離するリスク
export type CreateProductInput = {
  name: string
  price: number
  description?: string
}
```

**Correct (z.infer で自動導出、常に同期):**

```typescript
// schema.ts
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string().optional(),
})

// スキーマから自動導出
export type CreateProductInput = z.infer<typeof createProductSchema>
```

## Update スキーマの作成

`partial()` を使用して重複を避ける:

**Incorrect (重複定義、変更時に両方を修正必要):**

```typescript
// create と update で同じフィールドを2回定義
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
})

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
})
```

**Correct (partial() で再利用):**

```typescript
// create スキーマを再利用
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

## よく使うパターン

```typescript
import { z } from 'zod'

// 基本的なスキーマ
export const createProductSchema = z.object({
  name: z.string().min(1, '必須').max(100),
  price: z.number().min(0),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid(),
  tags: z.array(z.string()).default([]),
})

// 更新用（全フィールドオプショナル）
export const updateProductSchema = createProductSchema.partial()

// ID検証用
export const productIdSchema = z.object({
  id: z.string().uuid('無効なIDです'),
})

// 検索用（ページネーション付き）
export const productSearchSchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// 型の導出
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ProductSearchParams = z.infer<typeof productSearchSchema>
```
