# Repository層の実装

## 概要

Repository層は、データアクセスを抽象化し、Supabaseクエリをカプセル化することで、Service層からデータベースの詳細を隠蔽する責務を持つ。

**対象範囲**: データベースへのCRUD操作、クエリの構築と実行、データベースエラーの変換

**主要な責務**:
- データアクセスの抽象化
- CRUD操作の実装
- リレーションを含む複雑なクエリ
- データベースエラーを`AppError`に変換

**禁止事項**:
- ビジネスロジックの実装（Service層の責務）
- 入力バリデーション（Handler層とService層の責務）
- 認証・認可チェック（Handler層の責務）
- 外部API呼び出し（Adapter層の責務）

## 設計思想

Repository層をデータアクセスの抽象化レイヤーとして配置する理由は、以下の通りである。

### データベースの詳細を隠蔽

Service層は「何を取得するか」に集中し、「どのように取得するか」はRepository層が担当する。これにより、データベーススキーマの変更やクエリの最適化がService層に影響しない。

### 一貫したインターフェース

Repository層は、データアクセスに一貫したインターフェース（`findById`、`findMany`、`create`等）を提供する。これにより、Service層は統一された方法でデータにアクセスできる。

### テスト容易性の向上

Repository層をモックすることで、Service層のテストをデータベースから分離できる。データベースのセットアップなしにビジネスロジックをテストできる。

## 実装パターン

### ファイル配置

```
src/features/products/
├── core/
│   ├── schema.ts      # Zodスキーマと型定義
│   ├── service.ts     # ビジネスロジック
│   └── repository.ts  # データアクセス層（このファイル）
```

### 基本的なRepository実装

```typescript
// src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, CreateProductInput, UpdateProductInput } from './schema'
import { AppError } from '@/lib/errors'

const TABLE_NAME = 'products'
const MAX_LIMIT = 100  // サーバー側の上限

export const productRepository = {
  /**
   * 複数の商品を取得
   */
  async findMany(
    supabase: SupabaseClient,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Product[]> {
    // クライアントのリクエストに関わらず上限を強制
    const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
    const offset = options.offset ?? 0

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new AppError(error.message, 500)
    return data
  },

  /**
   * IDで単一の商品を取得
   */
  async findById(
    supabase: SupabaseClient,
    id: string
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      // PGRST116: 行が見つからない場合
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },

  /**
   * 新しい商品を作成
   */
  async create(
    supabase: SupabaseClient,
    input: CreateProductInput
  ): Promise<Product> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(input)
      .select()
      .single()

    if (error) {
      // 一意制約違反
      if (error.code === '23505') {
        throw new AppError('商品名が既に存在します', 409, 'DUPLICATE_NAME')
      }
      throw new AppError(error.message, 500)
    }
    return data
  },

  /**
   * 商品を更新
   */
  async update(
    supabase: SupabaseClient,
    id: string,
    updates: UpdateProductInput
  ): Promise<Product> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('商品が見つかりません', 404, 'NOT_FOUND')
      }
      throw new AppError(error.message, 500)
    }
    return data
  },

  /**
   * 商品を削除
   */
  async delete(
    supabase: SupabaseClient,
    id: string
  ): Promise<void> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id)

    if (error) throw new AppError(error.message, 500)
  },

  /**
   * 商品の存在チェック
   */
  async exists(
    supabase: SupabaseClient,
    id: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new AppError(error.message, 500)
    return data !== null
  },
}
```

### 型定義例

```typescript
// src/features/products/core/schema.ts
import { z } from 'zod'

// Zodスキーマ
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  price: z.number().int().positive(),
  stock: z.number().int().min(0),
  category_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const createProductSchema = productSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export const updateProductSchema = createProductSchema.partial()

// TypeScript型
export type Product = z.infer<typeof productSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

## CRUD操作の実装

### Create（作成）

```typescript
// 基本的な作成
async create(
  supabase: SupabaseClient,
  input: CreateProductInput
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(input)
    .select()
    .single()

  if (error) throw new AppError(error.message, 500)
  return data
}

// 複数レコードの一括作成
async createMany(
  supabase: SupabaseClient,
  inputs: CreateProductInput[]
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .insert(inputs)
    .select()

  if (error) throw new AppError(error.message, 500)
  return data
}

// デフォルト値を含む作成
async createWithDefaults(
  supabase: SupabaseClient,
  input: Partial<CreateProductInput>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name ?? '新商品',
      description: input.description ?? '',
      price: input.price ?? 0,
      stock: input.stock ?? 0,
      category_id: input.category_id,
    })
    .select()
    .single()

  if (error) throw new AppError(error.message, 500)
  return data
}
```

### Read（読み取り）

```typescript
// 単一レコード取得（IDベース）
async findById(
  supabase: SupabaseClient,
  id: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new AppError(error.message, 500)
  }
  return data
}

// 複数レコード取得
async findMany(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
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

// 条件付き検索
async findByCategory(
  supabase: SupabaseClient,
  categoryId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  const offset = options.offset ?? 0

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new AppError(error.message, 500)
  return data
}

// 複数条件での検索
async search(
  supabase: SupabaseClient,
  filters: {
    name?: string
    minPrice?: number
    maxPrice?: number
    categoryId?: string
    inStock?: boolean
  },
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  const offset = options.offset ?? 0

  let query = supabase
    .from('products')
    .select('*')

  // フィルター条件を動的に追加
  if (filters.name) {
    query = query.ilike('name', `%${filters.name}%`)
  }
  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice)
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice)
  }
  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }
  if (filters.inStock) {
    query = query.gt('stock', 0)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) throw new AppError(error.message, 500)
  return data
}

// 全文検索（PostgreSQL の全文検索を使用）
async fullTextSearch(
  supabase: SupabaseClient,
  searchTerm: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Product[]> {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  const offset = options.offset ?? 0

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .textSearch('name', searchTerm, {
      type: 'websearch',
      config: 'english',
    })
    .range(offset, offset + limit - 1)

  if (error) throw new AppError(error.message, 500)
  return data
}
```

### Update（更新）

```typescript
// 基本的な更新
async update(
  supabase: SupabaseClient,
  id: string,
  updates: UpdateProductInput
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError('商品が見つかりません', 404, 'NOT_FOUND')
    }
    throw new AppError(error.message, 500)
  }
  return data
}

// 部分更新
async patch(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<UpdateProductInput>
): Promise<Product> {
  // 空のupdatesを拒否
  if (Object.keys(updates).length === 0) {
    throw new AppError('更新するフィールドを指定してください', 400)
  }

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError('商品が見つかりません', 404, 'NOT_FOUND')
    }
    throw new AppError(error.message, 500)
  }
  return data
}

// 条件付き一括更新
async updateMany(
  supabase: SupabaseClient,
  filter: { category_id: string },
  updates: UpdateProductInput
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('category_id', filter.category_id)
    .select()

  if (error) throw new AppError(error.message, 500)
  return data
}

// インクリメント/デクリメント
async incrementStock(
  supabase: SupabaseClient,
  id: string,
  amount: number
): Promise<Product> {
  // RPC（Remote Procedure Call）を使用
  const { data, error } = await supabase.rpc('increment_product_stock', {
    product_id: id,
    amount,
  })

  if (error) throw new AppError(error.message, 500)
  return data
}
```

### Delete（削除）

```typescript
// 基本的な削除
async delete(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw new AppError(error.message, 500)
}

// 削除前に存在確認
async deleteWithCheck(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError('商品が見つかりません', 404, 'NOT_FOUND')
    }
    throw new AppError(error.message, 500)
  }
}

// ソフトデリート
async softDelete(
  supabase: SupabaseClient,
  id: string
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null) // 既に削除済みでないことを確認
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError('商品が見つかりません', 404, 'NOT_FOUND')
    }
    throw new AppError(error.message, 500)
  }
  return data
}

// 条件付き一括削除
async deleteByCategory(
  supabase: SupabaseClient,
  categoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('category_id', categoryId)

  if (error) throw new AppError(error.message, 500)
}
```

## リレーションを含むクエリ

### 1対多のリレーション

```typescript
// 商品とそのレビューを取得
export const productRepository = {
  async findWithReviews(
    supabase: SupabaseClient,
    productId: string
  ): Promise<ProductWithReviews | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        reviews (
          id,
          rating,
          comment,
          user_id,
          created_at
        )
      `)
      .eq('id', productId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },

  // レビューをソートして取得
  async findWithReviewsSorted(
    supabase: SupabaseClient,
    productId: string
  ): Promise<ProductWithReviews | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        reviews!inner (
          id,
          rating,
          comment,
          user_id,
          created_at
        )
      `)
      .eq('id', productId)
      .order('created_at', {
        ascending: false,
        foreignTable: 'reviews'
      })
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },
}
```

### 多対1のリレーション

```typescript
// 注文と顧客情報を取得
export const orderRepository = {
  async findWithCustomer(
    supabase: SupabaseClient,
    orderId: string
  ): Promise<OrderWithCustomer | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers (
          id,
          name,
          email
        )
      `)
      .eq('id', orderId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },
}
```

### 多対多のリレーション

```typescript
// 注文とその商品アイテムを取得
export const orderRepository = {
  async findWithItems(
    supabase: SupabaseClient,
    orderId: string
  ): Promise<OrderWithItems | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items (
          id,
          quantity,
          price,
          product:products (
            id,
            name,
            description,
            image_url
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },

  // 注文、商品、カテゴリの3層リレーション
  async findWithItemsAndCategories(
    supabase: SupabaseClient,
    orderId: string
  ): Promise<OrderWithFullDetails | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers (
          id,
          name,
          email
        ),
        items:order_items (
          id,
          quantity,
          price,
          product:products (
            id,
            name,
            description,
            category:categories (
              id,
              name
            )
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },
}
```

### 集計を含むクエリ

```typescript
// 商品とレビューの平均評価を取得
export const productRepository = {
  async findWithStats(
    supabase: SupabaseClient,
    productId: string
  ): Promise<ProductWithStats | null> {
    // 1. 商品情報を取得
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError) {
      if (productError.code === 'PGRST116') return null
      throw new AppError(productError.message, 500)
    }

    // 2. 集計情報を取得（RPCを使用）
    const { data: stats, error: statsError } = await supabase
      .rpc('get_product_stats', { product_id: productId })

    if (statsError) {
      throw new AppError(statsError.message, 500)
    }

    return {
      ...product,
      averageRating: stats.avg_rating,
      reviewCount: stats.review_count,
      totalSales: stats.total_sales,
    }
  },
}

// SQL関数の例（Supabase上で定義）
/*
CREATE OR REPLACE FUNCTION get_product_stats(product_id UUID)
RETURNS TABLE (
  avg_rating DECIMAL,
  review_count INTEGER,
  total_sales INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(r.rating), 0) as avg_rating,
    CAST(COUNT(r.id) AS INTEGER) as review_count,
    COALESCE(SUM(oi.quantity), 0) as total_sales
  FROM products p
  LEFT JOIN reviews r ON r.product_id = p.id
  LEFT JOIN order_items oi ON oi.product_id = p.id
  WHERE p.id = product_id
  GROUP BY p.id;
END;
$$ LANGUAGE plpgsql;
*/
```

## ページネーション

### オフセットベースのページネーション

```typescript
export interface PaginationOptions {
  page?: number      // ページ番号（1始まり）
  perPage?: number   // 1ページあたりのアイテム数
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export const productRepository = {
  async findManyPaginated(
    supabase: SupabaseClient,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Product>> {
    const page = Math.max(options.page ?? 1, 1)
    const perPage = Math.min(options.perPage ?? 20, MAX_LIMIT)
    const offset = (page - 1) * perPage

    // 1. 総数を取得
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (countError) throw new AppError(countError.message, 500)

    // 2. データを取得
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (error) throw new AppError(error.message, 500)

    const totalPages = Math.ceil((count ?? 0) / perPage)

    return {
      data,
      pagination: {
        page,
        perPage,
        total: count ?? 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  },
}
```

### カーソルベースのページネーション

```typescript
export interface CursorPaginationOptions {
  cursor?: string    // 次のページの開始位置
  limit?: number     // 取得件数
}

export interface CursorPaginatedResult<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export const productRepository = {
  async findManyCursor(
    supabase: SupabaseClient,
    options: CursorPaginationOptions = {}
  ): Promise<CursorPaginatedResult<Product>> {
    const limit = Math.min(options.limit ?? 20, MAX_LIMIT)

    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit + 1) // 次のページがあるか確認するため+1

    // カーソルがあれば、そこから取得
    if (options.cursor) {
      const cursorDate = new Date(options.cursor).toISOString()
      query = query.lt('created_at', cursorDate)
    }

    const { data, error } = await query

    if (error) throw new AppError(error.message, 500)

    const hasMore = data.length > limit
    const items = hasMore ? data.slice(0, limit) : data
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].created_at
      : null

    return {
      data: items,
      nextCursor,
      hasMore,
    }
  },
}
```

### 無限スクロール用のページネーション

```typescript
export interface InfiniteScrollOptions {
  lastId?: string    // 最後に取得したアイテムのID
  limit?: number     // 取得件数
}

export const productRepository = {
  async findManyInfinite(
    supabase: SupabaseClient,
    options: InfiniteScrollOptions = {}
  ): Promise<CursorPaginatedResult<Product>> {
    const limit = Math.min(options.limit ?? 20, MAX_LIMIT)

    let query = supabase
      .from('products')
      .select('*')
      .order('id', { ascending: false })
      .limit(limit + 1)

    if (options.lastId) {
      query = query.lt('id', options.lastId)
    }

    const { data, error } = await query

    if (error) throw new AppError(error.message, 500)

    const hasMore = data.length > limit
    const items = hasMore ? data.slice(0, limit) : data
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].id
      : null

    return {
      data: items,
      nextCursor,
      hasMore,
    }
  },
}
```

## エラーハンドリング

### AppErrorクラス

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

### データベースエラーの変換

```typescript
export const productRepository = {
  async create(
    supabase: SupabaseClient,
    input: CreateProductInput
  ): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(input)
      .select()
      .single()

    if (error) {
      // PostgreSQLエラーコードに基づいてハンドリング
      switch (error.code) {
        case '23505': // unique_violation
          throw new AppError(
            '商品名が既に存在します',
            409,
            'DUPLICATE_NAME'
          )
        case '23503': // foreign_key_violation
          throw new AppError(
            'カテゴリが存在しません',
            400,
            'INVALID_CATEGORY'
          )
        case '23502': // not_null_violation
          throw new AppError(
            '必須フィールドが不足しています',
            400,
            'MISSING_REQUIRED_FIELD'
          )
        case '23514': // check_violation
          throw new AppError(
            '入力値が制約に違反しています',
            400,
            'CHECK_CONSTRAINT_VIOLATION'
          )
        default:
          throw new AppError(error.message, 500, 'DATABASE_ERROR')
      }
    }

    return data
  },
}
```

### Supabase特有のエラーコード

```typescript
// Supabaseエラーコードのハンドリング
export function handleSupabaseError(error: any): AppError {
  // PostgREST エラーコード
  switch (error.code) {
    case 'PGRST116': // 行が見つからない
      return new AppError('リソースが見つかりません', 404, 'NOT_FOUND')
    case 'PGRST301': // 範囲外
      return new AppError('ページが範囲外です', 400, 'OUT_OF_RANGE')
    case '42501': // insufficient_privilege
      return new AppError('権限がありません', 403, 'FORBIDDEN')
    default:
      return new AppError(
        error.message ?? '予期しないエラーが発生しました',
        500,
        'DATABASE_ERROR'
      )
  }
}

export const productRepository = {
  async findById(
    supabase: SupabaseClient,
    id: string
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw handleSupabaseError(error)
    }
    return data
  },
}
```

### トランザクション処理

```typescript
// Supabaseではトランザクションを直接サポートしていないため、
// RPCを使用してPostgreSQL関数内でトランザクションを実行

export const orderRepository = {
  async createWithItems(
    supabase: SupabaseClient,
    orderInput: CreateOrderInput,
    itemInputs: CreateOrderItemInput[]
  ): Promise<OrderWithItems> {
    // RPCを使用してトランザクション内で実行
    const { data, error } = await supabase.rpc('create_order_with_items', {
      order_data: orderInput,
      items_data: itemInputs,
    })

    if (error) {
      // カスタムエラーメッセージの処理
      if (error.message.includes('insufficient_stock')) {
        throw new AppError('在庫が不足しています', 400, 'INSUFFICIENT_STOCK')
      }
      throw new AppError(error.message, 500)
    }

    return data
  },
}

// SQL関数の例（Supabase上で定義）
/*
CREATE OR REPLACE FUNCTION create_order_with_items(
  order_data JSONB,
  items_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
  result JSONB;
BEGIN
  -- 注文を作成
  INSERT INTO orders (customer_id, total_amount, status)
  VALUES (
    (order_data->>'customer_id')::UUID,
    (order_data->>'total_amount')::INTEGER,
    order_data->>'status'
  )
  RETURNING id INTO new_order_id;

  -- 注文アイテムを作成
  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    -- 在庫チェック
    IF (SELECT stock FROM products WHERE id = (item->>'product_id')::UUID) < (item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'insufficient_stock';
    END IF;

    -- アイテムを挿入
    INSERT INTO order_items (order_id, product_id, quantity, price)
    VALUES (
      new_order_id,
      (item->>'product_id')::UUID,
      (item->>'quantity')::INTEGER,
      (item->>'price')::INTEGER
    );

    -- 在庫を減らす
    UPDATE products
    SET stock = stock - (item->>'quantity')::INTEGER
    WHERE id = (item->>'product_id')::UUID;
  END LOOP;

  -- 結果を返す
  SELECT row_to_json(o.*) INTO result
  FROM orders o
  WHERE o.id = new_order_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
*/
```

## テスト方法

### ユニットテスト（モック使用）

```typescript
// src/features/products/core/__tests__/repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productRepository } from '../repository'
import { AppError } from '@/lib/errors'

// Supabaseクライアントをモック
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  range: vi.fn(() => mockSupabase),
  single: vi.fn(),
}

describe('productRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findById', () => {
    it('IDで商品を取得できる', async () => {
      const mockProduct = {
        id: '123',
        name: 'Test Product',
        price: 1000,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockSupabase.single.mockResolvedValue({
        data: mockProduct,
        error: null,
      })

      const result = await productRepository.findById(
        mockSupabase as any,
        '123'
      )

      expect(result).toEqual(mockProduct)
      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123')
    })

    it('商品が見つからない場合はnullを返す', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      })

      const result = await productRepository.findById(
        mockSupabase as any,
        'nonexistent'
      )

      expect(result).toBeNull()
    })

    it('データベースエラーの場合はAppErrorをスローする', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'Table not found' },
      })

      await expect(
        productRepository.findById(mockSupabase as any, '123')
      ).rejects.toThrow(AppError)
    })
  })

  describe('create', () => {
    it('新しい商品を作成できる', async () => {
      const input = {
        name: 'New Product',
        price: 2000,
        description: 'Test description',
      }

      const mockCreated = {
        id: '456',
        ...input,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockSupabase.single.mockResolvedValue({
        data: mockCreated,
        error: null,
      })

      const result = await productRepository.create(
        mockSupabase as any,
        input
      )

      expect(result).toEqual(mockCreated)
      expect(mockSupabase.insert).toHaveBeenCalledWith(input)
    })

    it('一意制約違反の場合は409エラーをスローする', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Duplicate key' },
      })

      await expect(
        productRepository.create(mockSupabase as any, {
          name: 'Duplicate',
          price: 1000,
        })
      ).rejects.toThrow(AppError)
    })
  })
})
```

### 統合テスト（実際のデータベース使用）

```typescript
// src/features/products/core/__tests__/repository.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { productRepository } from '../repository'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('productRepository (integration)', () => {
  let testCategoryId: string

  beforeAll(async () => {
    // テスト用カテゴリを作成
    const { data } = await supabase
      .from('categories')
      .insert({ name: 'Test Category' })
      .select()
      .single()
    testCategoryId = data.id
  })

  afterAll(async () => {
    // テストデータをクリーンアップ
    await supabase.from('products').delete().eq('category_id', testCategoryId)
    await supabase.from('categories').delete().eq('id', testCategoryId)
  })

  beforeEach(async () => {
    // 各テスト前にクリーンアップ
    await supabase.from('products').delete().eq('category_id', testCategoryId)
  })

  describe('CRUD operations', () => {
    it('商品のCRUDが正常に動作する', async () => {
      // Create
      const created = await productRepository.create(supabase, {
        name: 'Integration Test Product',
        price: 3000,
        description: 'Test',
        category_id: testCategoryId,
        stock: 10,
      })

      expect(created.id).toBeDefined()
      expect(created.name).toBe('Integration Test Product')

      // Read
      const found = await productRepository.findById(supabase, created.id)
      expect(found).toEqual(created)

      // Update
      const updated = await productRepository.update(supabase, created.id, {
        price: 3500,
      })
      expect(updated.price).toBe(3500)

      // Delete
      await productRepository.delete(supabase, created.id)
      const deleted = await productRepository.findById(supabase, created.id)
      expect(deleted).toBeNull()
    })

    it('ページネーションが正常に動作する', async () => {
      // テストデータを作成
      await Promise.all([
        productRepository.create(supabase, {
          name: 'Product 1',
          price: 1000,
          category_id: testCategoryId,
          stock: 5,
        }),
        productRepository.create(supabase, {
          name: 'Product 2',
          price: 2000,
          category_id: testCategoryId,
          stock: 5,
        }),
        productRepository.create(supabase, {
          name: 'Product 3',
          price: 3000,
          category_id: testCategoryId,
          stock: 5,
        }),
      ])

      // ページネーションテスト
      const page1 = await productRepository.findManyPaginated(supabase, {
        page: 1,
        perPage: 2,
      })

      expect(page1.data).toHaveLength(2)
      expect(page1.pagination.total).toBe(3)
      expect(page1.pagination.hasNext).toBe(true)

      const page2 = await productRepository.findManyPaginated(supabase, {
        page: 2,
        perPage: 2,
      })

      expect(page2.data).toHaveLength(1)
      expect(page2.pagination.hasNext).toBe(false)
    })
  })
})
```

### テストヘルパー

```typescript
// src/features/products/core/__tests__/helpers.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, CreateProductInput } from '../schema'

/**
 * テスト用の商品を作成
 */
export async function createTestProduct(
  supabase: SupabaseClient,
  overrides: Partial<CreateProductInput> = {}
): Promise<Product> {
  const defaultProduct: CreateProductInput = {
    name: `Test Product ${Date.now()}`,
    description: 'Test description',
    price: 1000,
    stock: 10,
    category_id: 'test-category-id',
    ...overrides,
  }

  const { data, error } = await supabase
    .from('products')
    .insert(defaultProduct)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * テスト用の商品を複数作成
 */
export async function createTestProducts(
  supabase: SupabaseClient,
  count: number,
  overrides: Partial<CreateProductInput> = {}
): Promise<Product[]> {
  const products = Array.from({ length: count }, (_, i) => ({
    name: `Test Product ${i + 1}`,
    description: `Test description ${i + 1}`,
    price: (i + 1) * 1000,
    stock: 10,
    category_id: 'test-category-id',
    ...overrides,
  }))

  const { data, error } = await supabase
    .from('products')
    .insert(products)
    .select()

  if (error) throw error
  return data
}

/**
 * テスト用データのクリーンアップ
 */
export async function cleanupTestProducts(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<void> {
  await supabase.from('products').delete().in('id', productIds)
}
```

## ベストプラクティス

### 1. server-only の必須化

すべてのRepositoryファイルの先頭に`import 'server-only'`を記述し、クライアント側で実行されないことを保証します。

```typescript
// src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
// ... 以下のコード
```

### 2. 一貫したエラーハンドリング

すべてのデータベースエラーを`AppError`に変換し、適切なHTTPステータスコードとエラーコードを設定します。

```typescript
// 良い例
if (error) {
  if (error.code === 'PGRST116') return null
  throw new AppError(error.message, 500, 'DATABASE_ERROR')
}

// 悪い例
if (error) {
  throw error // 生のエラーをスローしない
}
```

### 3. 上限値の強制

クライアントからのリクエストに関わらず、サーバー側で必ず上限を設定します。

```typescript
const MAX_LIMIT = 100

async findMany(
  supabase: SupabaseClient,
  options: { limit?: number } = {}
): Promise<Product[]> {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  // ...
}
```

### 4. null vs エラーの使い分け

- データが見つからない場合: `null`を返す
- システムエラー: `AppError`をスロー

```typescript
async findById(
  supabase: SupabaseClient,
  id: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // 見つからない場合はnull
    if (error.code === 'PGRST116') return null
    // システムエラーは例外
    throw new AppError(error.message, 500)
  }
  return data
}
```

### 5. 型の明示的な定義

Repositoryメソッドの引数と戻り値の型を明示的に定義します。

```typescript
// 良い例
async findById(
  supabase: SupabaseClient,
  id: string
): Promise<Product | null> {
  // ...
}

// 悪い例
async findById(supabase, id) {
  // 型が推論されない
}
```

### 6. テーブル名の定数化

テーブル名をハードコードせず、定数として定義します。

```typescript
const TABLE_NAME = 'products'

export const productRepository = {
  async findById(
    supabase: SupabaseClient,
    id: string
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)  // ハードコードしない
      .select('*')
      // ...
  },
}
```

### 7. オプショナルパラメータのデフォルト値

オプショナルパラメータには適切なデフォルト値を設定します。

```typescript
async findMany(
  supabase: SupabaseClient,
  options: { limit?: number; offset?: number } = {}  // デフォルト値
): Promise<Product[]> {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  const offset = options.offset ?? 0
  // ...
}
```

### 8. クエリビルダーの段階的構築

複雑なクエリは段階的に構築し、可読性を高めます。

```typescript
async search(
  supabase: SupabaseClient,
  filters: ProductFilters
): Promise<Product[]> {
  let query = supabase.from('products').select('*')

  if (filters.name) {
    query = query.ilike('name', `%${filters.name}%`)
  }
  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice)
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw new AppError(error.message, 500)
  return data
}
```

### 9. リレーションの明確な型定義

リレーションを含む型は明確に定義します。

```typescript
// スキーマファイルで定義
export interface ProductWithReviews extends Product {
  reviews: Review[]
}

export interface OrderWithItems extends Order {
  items: Array<OrderItem & { product: Product }>
}
```

### 10. ドキュメントコメントの追加

各メソッドにJSDocコメントを追加し、使用方法を明確にします。

```typescript
export const productRepository = {
  /**
   * IDで商品を取得
   * @param supabase - Supabaseクライアント
   * @param id - 商品ID
   * @returns 商品データまたはnull（見つからない場合）
   * @throws {AppError} データベースエラーが発生した場合
   */
  async findById(
    supabase: SupabaseClient,
    id: string
  ): Promise<Product | null> {
    // ...
  },
}
```

### 11. 再利用可能なユーティリティ関数

共通のロジックはユーティリティ関数として抽出します。

```typescript
// src/lib/repository-utils.ts
export function handleSupabaseError(error: any): never {
  if (error.code === 'PGRST116') {
    throw new AppError('リソースが見つかりません', 404, 'NOT_FOUND')
  }
  throw new AppError(error.message, 500, 'DATABASE_ERROR')
}

export function buildPaginationQuery<T>(
  query: any,
  options: PaginationOptions
) {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)
  const offset = (options.page - 1) * limit
  return query.range(offset, offset + limit - 1)
}
```

### 12. パフォーマンスの考慮

不要なデータを取得せず、必要なカラムのみをselectします。

```typescript
// 良い例: 必要なカラムのみ取得
async findIdAndName(
  supabase: SupabaseClient
): Promise<Array<Pick<Product, 'id' | 'name'>>> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name')  // 必要なカラムのみ
    .order('name')

  if (error) throw new AppError(error.message, 500)
  return data
}

// 悪い例: すべてのカラムを取得
async findIdAndName(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('products')
    .select('*')  // 不要なデータも取得
  // ...
}
```

## 使用例

Repository層の実装例を以下に示す。

### 例1: 基本的なCRUD操作

```typescript
// src/features/products/core/repository.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, CreateProductInput } from './schema'
import { AppError } from '@/lib/errors'

const TABLE_NAME = 'products'
const MAX_LIMIT = 100

export const productRepository = {
  async findById(
    supabase: SupabaseClient,
    id: string
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },

  async create(
    supabase: SupabaseClient,
    input: CreateProductInput
  ): Promise<Product> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(input)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new AppError('商品名が既に存在します', 409, 'DUPLICATE_NAME')
      }
      throw new AppError(error.message, 500)
    }
    return data
  },
}
```

**ポイント**:
- テーブル名を定数化
- データベースエラーを`AppError`に変換
- 見つからない場合は`null`を返す

### 例2: ページネーション

```typescript
export const productRepository = {
  async findManyPaginated(
    supabase: SupabaseClient,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Product>> {
    const page = Math.max(options.page ?? 1, 1)
    const perPage = Math.min(options.perPage ?? 20, MAX_LIMIT)
    const offset = (page - 1) * perPage

    // 1. 総数を取得
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (countError) throw new AppError(countError.message, 500)

    // 2. データを取得
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (error) throw new AppError(error.message, 500)

    const totalPages = Math.ceil((count ?? 0) / perPage)

    return {
      data,
      pagination: {
        page,
        perPage,
        total: count ?? 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  },
}
```

**ポイント**:
- サーバー側で上限値を強制（`MAX_LIMIT`）
- 総件数とデータを両方返却
- ページネーション情報を含む

### 例3: リレーションを含むクエリ

```typescript
export const productRepository = {
  async findWithReviews(
    supabase: SupabaseClient,
    productId: string
  ): Promise<ProductWithReviews | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        reviews (
          id,
          rating,
          comment,
          user_id,
          created_at
        )
      `)
      .eq('id', productId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new AppError(error.message, 500)
    }
    return data
  },
}
```

**ポイント**:
- Supabaseの`select`でリレーションを取得
- 必要なカラムのみを指定

## アンチパターン

Repository層でよく見られる問題のあるパターンを示す。

### ビジネスロジックの混入

```typescript
// ❌ 避けるべき（Repository層にビジネスロジック）
export const productRepository = {
  async create(
    supabase: SupabaseClient,
    input: CreateProductInput
  ): Promise<Product> {
    // ビジネスルール検証はService層で行う
    if (input.price < 0) {
      throw new AppError('Price must be positive', 400)
    }

    const { data, error } = await supabase
      .from('products')
      .insert(input)
      .select()
      .single()

    if (error) throw new AppError(error.message, 500)
    return data
  },
}

// ✅ 推奨（Repository層はデータアクセスのみ）
export const productRepository = {
  async create(
    supabase: SupabaseClient,
    input: CreateProductInput
  ): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(input)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new AppError('商品名が既に存在します', 409)
      }
      throw new AppError(error.message, 500)
    }
    return data
  },
}
```

### 上限値の欠如

```typescript
// ❌ 避けるべき（クライアントの指定値をそのまま使用）
async findMany(
  supabase: SupabaseClient,
  options: { limit?: number } = {}
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(options.limit ?? 20) // 上限チェックなし

  if (error) throw new AppError(error.message, 500)
  return data
}

// ✅ 推奨（サーバー側で上限を強制）
const MAX_LIMIT = 100

async findMany(
  supabase: SupabaseClient,
  options: { limit?: number } = {}
): Promise<Product[]> {
  const limit = Math.min(options.limit ?? 20, MAX_LIMIT)

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(limit)

  if (error) throw new AppError(error.message, 500)
  return data
}
```
