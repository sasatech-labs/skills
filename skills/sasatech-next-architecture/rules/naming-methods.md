---
title: Repository/Service メソッド命名規則
impact: MEDIUM
impactDescription: 一貫したAPI、コードの予測可能性向上
tags: naming, methods, repository, service
---

## Repository/Service メソッド命名規則

Repository と Service のメソッド名は用途に応じた動詞で統一する。

## Repository メソッド

| メソッド | 用途 | 戻り値 |
|---------|------|--------|
| `findMany` | ページネーション付き複数件取得 | `T[]` |
| `findById` | ID指定の1件取得 | `T \| null` |
| `findOne` | 条件指定の1件取得 | `T \| null` |
| `search` | 検索条件付き取得 | `PaginatedResult<T>` |
| `count` | 件数のみ取得 | `number` |
| `create` | 作成 | `T` |
| `update` | 更新 | `T` |
| `delete` | 削除 | `void` |

**使用禁止:**
- ~~`findAll`~~ / ~~`getAll`~~ - ページネーションなしの全件取得は禁止

```typescript
// src/features/products/repository.ts
export const productRepository = {
  async findMany(supabase, options): Promise<Product[]> { /* ... */ },
  async findById(supabase, id): Promise<Product | null> { /* ... */ },
  async findOne(supabase, where): Promise<Product | null> { /* ... */ },
  async search(supabase, params): Promise<PaginatedResult<Product>> { /* ... */ },
  async count(supabase, where): Promise<number> { /* ... */ },
  async create(supabase, data): Promise<Product> { /* ... */ },
  async update(supabase, id, data): Promise<Product> { /* ... */ },
  async delete(supabase, id): Promise<void> { /* ... */ },
}
```

## Service メソッド

| パターン | 用途 | 例 |
|---------|------|-----|
| `get*` | データ取得 | `getProducts`, `getProductById` |
| `create*` | 作成 | `createProduct` |
| `update*` | 更新 | `updateProduct` |
| `delete*` | 削除 | `deleteProduct` |
| 動詞 + 名詞 | アクション | `publishPost`, `activateUser` |

```typescript
// src/features/products/service.ts
export async function getProducts(supabase, options) { /* ... */ }
export async function getProductById(supabase, id) { /* ... */ }
export async function createProduct(supabase, input) { /* ... */ }
export async function updateProduct(supabase, id, input) { /* ... */ }
export async function deleteProduct(supabase, id) { /* ... */ }

// アクション
export async function publishProduct(supabase, id) { /* ... */ }
export async function archiveProduct(supabase, id) { /* ... */ }
```

## Handler との対応

| HTTP メソッド | Service メソッド |
|--------------|-----------------|
| `GET /products` | `getProducts()` |
| `GET /products/[id]` | `getProductById()` |
| `POST /products` | `createProduct()` |
| `PATCH /products/[id]` | `updateProduct()` |
| `DELETE /products/[id]` | `deleteProduct()` |
| `POST /products/[id]/publish` | `publishProduct()` |

## Hook 名

| パターン | 用途 | 例 |
|---------|------|-----|
| `use*` | データ取得 | `useProducts`, `useProduct` |
| `useCreate*` | 作成ミューテーション | `useCreateProduct` |
| `useUpdate*` | 更新ミューテーション | `useUpdateProduct` |
| `useDelete*` | 削除ミューテーション | `useDeleteProduct` |

```typescript
// src/features/products/hooks.ts
export function useProducts(page, limit) { /* ... */ }
export function useProduct(id) { /* ... */ }
export function useCreateProduct() { /* ... */ }
export function useUpdateProduct() { /* ... */ }
export function useDeleteProduct() { /* ... */ }
```
