---
id: schema-zod-infer
title: z.infer で Input 型を導出
category: スキーマ・型定義
impact: MEDIUM
tags: [schema, types, zod, validation]
---

## ルール

Input 型は Zod スキーマから `z.infer` で導出する。手動で型定義しない。

## 理由

手動で型定義を行うと、スキーマと型定義が乖離するリスクがある。スキーマのバリデーションルールを変更した際に、型定義の更新を忘れると、実行時エラーや予期しない動作を引き起こす可能性がある。

`z.infer` を使用することで、スキーマが唯一の情報源（Single Source of Truth）となり、型定義とバリデーションルールが常に同期する。これにより、コードの一貫性と保守性が向上する。

また、`partial()` や `pick()`、`omit()` などのZodのユーティリティメソッドを活用することで、スキーマの重複を避け、DRY原則に従った実装が可能になる。

## OK例

```typescript
// schema.ts
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string().optional(),
})

// OK: z.infer でスキーマから自動導出する
// スキーマの変更が自動的に型に反映される
export type CreateProductInput = z.infer<typeof createProductSchema>
```

```typescript
// OK: partial() を使用して create スキーマを再利用する
// スキーマの変更が自動的に update スキーマにも反映される
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

```typescript
// OK: よく使うパターンの実装例
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

// z.infer で型を導出
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ProductSearchParams = z.infer<typeof productSearchSchema>
```

## NG例

```typescript
// schema.ts
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string().optional(),
})

// NG: 手動で型定義している
// スキーマの変更時に型定義の更新を忘れる可能性がある
export type CreateProductInput = {
  name: string
  price: number
  description?: string
}
```

```typescript
// NG: create と update で同じフィールドを重複定義している
// 変更時に両方を修正する必要があり、保守性が低い
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
})

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
})
```
