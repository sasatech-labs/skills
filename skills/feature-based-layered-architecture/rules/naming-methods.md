---
id: naming-methods
title: Repository/Service メソッド命名規則
category: 命名規則
impact: LOW
tags: [naming, methods, repository, service]
---

## ルール

RepositoryとServiceのメソッド名は、用途に応じた動詞で統一する。Repositoryは`find*`/`create`/`update`/`delete`パターンを使用し、Serviceは`get*`/`create*`/`update*`/`delete*`パターンを使用する。

## 理由

メソッド命名の統一により、以下の利点がある：

1. **一貫性の向上**: レイヤーごとに明確な命名パターンを持つことで、コードの可読性が向上する
2. **レイヤーの識別**: メソッド名からどのレイヤーの処理か即座に判断できる（Repositoryは`find*`、Serviceは`get*`）
3. **パターンの学習容易性**: 新規参加者が命名パターンを理解しやすくなる
4. **ページネーションの強制**: `findAll`/`getAll`を禁止することで、大量データの取得時に必ずページネーションを考慮させる

## OK例

```typescript
// OK: Repository の標準パターン
export const productRepository = {
  async findMany(supabase, options): Promise<Product[]> { /* ... */ }, // ページネーション付き複数件取得
  async findById(supabase, id): Promise<Product | null> { /* ... */ }, // ID指定の1件取得
  async findOne(supabase, where): Promise<Product | null> { /* ... */ }, // 条件指定の1件取得
  async search(supabase, params): Promise<PaginatedResult<Product>> { /* ... */ }, // 検索条件付き取得
  async count(supabase, where): Promise<number> { /* ... */ }, // 件数のみ取得
  async create(supabase, data): Promise<Product> { /* ... */ }, // 作成
  async update(supabase, id, data): Promise<Product> { /* ... */ }, // 更新
  async delete(supabase, id): Promise<void> { /* ... */ }, // 削除
}

// OK: Service の標準パターン
export async function getProducts(supabase, options) { /* ... */ } // データ取得
export async function getProductById(supabase, id) { /* ... */ } // ID指定取得
export async function createProduct(supabase, input) { /* ... */ } // 作成
export async function updateProduct(supabase, id, input) { /* ... */ } // 更新
export async function deleteProduct(supabase, id) { /* ... */ } // 削除

// OK: Service のアクションパターン
export async function publishProduct(supabase, id) { /* ... */ } // 動詞 + 名詞
export async function archiveProduct(supabase, id) { /* ... */ } // 動詞 + 名詞

// OK: Hook の標準パターン
export function useProducts(page, limit) { /* ... */ } // データ取得
export function useProduct(id) { /* ... */ } // 単一データ取得
export function useCreateProduct() { /* ... */ } // 作成ミューテーション
export function useUpdateProduct() { /* ... */ } // 更新ミューテーション
export function useDeleteProduct() { /* ... */ } // 削除ミューテーション
```

## NG例

```typescript
// NG: Repository で get プレフィックスを使用
export const productRepository = {
  async getAll(supabase): Promise<Product[]> { /* ... */ }, // findMany を使用すべき
  async getById(supabase, id): Promise<Product | null> { /* ... */ }, // findById を使用すべき
}

// NG: Service で find プレフィックスを使用
export async function findProducts(supabase, options) { /* ... */ } // getProducts を使用すべき
export async function findProductById(supabase, id) { /* ... */ } // getProductById を使用すべき

// NG: ページネーションなしの全件取得
export const productRepository = {
  async findAll(supabase): Promise<Product[]> { /* ... */ }, // 使用禁止
  async getAll(supabase): Promise<Product[]> { /* ... */ }, // 使用禁止
}

// NG: Hook で get プレフィックスを使用
export function getProducts(page, limit) { /* ... */ } // useProducts を使用すべき
export function getProduct(id) { /* ... */ } // useProduct を使用すべき
```

## 参考: 命名パターン一覧

### Repository メソッド

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

### Service メソッド

| パターン | 用途 | 例 |
|---------|------|-----|
| `get*` | データ取得 | `getProducts`, `getProductById` |
| `create*` | 作成 | `createProduct` |
| `update*` | 更新 | `updateProduct` |
| `delete*` | 削除 | `deleteProduct` |
| 動詞 + 名詞 | アクション | `publishPost`, `activateUser` |

### Handler との対応

| HTTP メソッド | Service メソッド |
|--------------|-----------------|
| `GET /products` | `getProducts()` |
| `GET /products/[id]` | `getProductById()` |
| `POST /products` | `createProduct()` |
| `PATCH /products/[id]` | `updateProduct()` |
| `DELETE /products/[id]` | `deleteProduct()` |
| `POST /products/[id]/publish` | `publishProduct()` |

### Hook 名

| パターン | 用途 | 例 |
|---------|------|-----|
| `use*` | データ取得 | `useProducts`, `useProduct` |
| `useCreate*` | 作成ミューテーション | `useCreateProduct` |
| `useUpdate*` | 更新ミューテーション | `useUpdateProduct` |
| `useDelete*` | 削除ミューテーション | `useDeleteProduct` |
