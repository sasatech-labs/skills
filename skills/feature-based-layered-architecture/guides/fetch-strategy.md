# データ取得戦略(SSR/CSR)

## 概要

このガイドでは、SSR(Server Components)とCSR(SWR)のデータ取得戦略の選択基準を定義する。
**原則**: SSRをデフォルトとする。サービス利用者が動的にデータを取得する必要がある場合のみCSRを使用する。

## 設計思想

SSR/CSR問わず、データ取得はfetcher.ts経由でAPI Routeを呼び出す。Server ComponentからService層を直接呼び出さない。

### データフロー

SSRとCSRで共通のデータ経路を使用する。

```
SSR: page.tsx → fetcher.ts → route.ts → handler.ts → service.ts → repository.ts / adapter.ts
CSR: page.tsx → hooks.ts → fetcher.ts → route.ts → handler.ts → service.ts → repository.ts / adapter.ts
```

CSRではhooks.ts(SWR)がクライアントキャッシュを管理する点のみが異なる。

データ取得経路を統一する理由:

- **経路の一貫性**: SSR/CSR共通でfetcher → API Route → Handler → Serviceの経路を使用する。データフローが一貫し、理解しやすい
- **Handler層の一元化**: バリデーション、楽観的認証、エラーハンドリングがHandler層に集約される
- **監視の一元化**: すべてのデータアクセスがAPI Routeを通るため、ログや監視が容易になる

不要なCSRは以下の問題を招く:

- ローディング状態の管理が増加する
- クライアントバンドルサイズが増大する
- データ取得のネットワーク遅延が発生する

SSRをデフォルトとし、動的なデータ取得が必要な場合のみCSRを採用することで、シンプルなデータフローを維持する。

## レイヤーごとの責務

SSR/CSR両パスにおける各レイヤーの責務を以下に整理する。

| レイヤー | SSR | CSR |
|----------|-----|-----|
| page.tsx | Fetcher呼び出し | Client Component描画 |
| hooks.ts | - | SWRでクライアントキャッシュ管理 |
| fetcher.ts | API Route呼び出し | API Route呼び出し |
| route.ts | 薄いエントリーポイント | 同左 |
| handler.ts | HTTPパース、エラー→レスポンス変換 | 同左 |
| service.ts | ビジネスロジック | 同左 |
| repository.ts | データアクセス | 同左 |

**fetcher.tsはSSR/CSR共通のHTTP通信レイヤー**である。相対URL(`/api/...`)はServer Componentからも動作する。

## 認証・バリデーション

Handler層でバリデーションと楽観的認証を行う。SSRでもCSRでも同じHandler関数を経由するため、検証ロジックが一箇所に集約される。

### 入力バリデーション

Handler関数が入力をZodで検証する。

```typescript
// src/features/products/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { createProductSchema } from './schema'
import { createProduct } from './service'

export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return AppResponse.created(product)
})
```

### 楽観的認証

Handler関数が`getSession()`でセッション存在を確認し、認証済みユーザーIDをService層に渡す。

```typescript
// src/features/users/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { getMyProfile } from './service'

export const handleGetMyProfile = withHTTPError(async (request) => {
  const supabase = await createClient()

  // 楽観的認証: セッション存在チェック
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  const profile = await getMyProfile(supabase, session.user.id)
  return AppResponse.ok(profile)
})
```

### SSR/CSR共通の呼び出し

SSRでもCSRでも同じfetcher → API Route → Handler → Serviceの経路を使用する。

```typescript
// SSR: Server ComponentからFetcher経由でAPI Routeを呼び出す
// app/(auth)/profile/page.tsx
import { usersFetcher } from '@/features/users'

export default async function ProfilePage() {
  const profile = await usersFetcher.getMyProfile()
  return <ProfileView profile={profile} />
}
```

```typescript
// CSR: Hook経由で同じFetcher → API Routeを呼び出す
// features/users/core/hooks.ts
'use client'

import useSWR from 'swr'
import { usersFetcher } from './fetcher'

export function useMyProfile() {
  return useSWR(['my-profile'], () => usersFetcher.getMyProfile())
}
```

## 判定基準

| 条件 | 戦略 | 実装方法 |
|------|------|----------|
| ページ表示時点でデータが確定する | SSR | Server Componentでfetcher経由でAPI Routeを呼び出す |
| ユーザー操作に応じてデータが変化する | CSR | `hooks.ts`(SWR) → `fetcher.ts`経由でAPI Routeを呼び出す |

### SSRを選択するケース

- 記事・商品の詳細表示
- ダッシュボードの初期表示
- 設定画面の初期値
- ユーザープロフィール表示

### CSRを選択するケース

- 検索・フィルタリング
- 無限スクロール・ページネーション操作
- リアルタイム更新が必要なデータ
- ユーザー操作後のデータ再取得(mutation後)

## 実装パターン

### SSR: Server Componentでのデータ取得

Server Componentからfetcher経由でAPI Routeを呼び出す。

```typescript
// src/features/products/core/fetcher.ts
import { fetchData } from '@/lib/fetcher'
import type { Product } from './schema'

export const productsFetcher = {
  getById(id: string): Promise<Product> {
    return fetchData<Product>(`/api/products/${id}`)
  },
  getAll(params?: { keyword?: string; page?: number }): Promise<Product[]> {
    const query = new URLSearchParams()
    if (params?.keyword) query.set('keyword', params.keyword)
    if (params?.page) query.set('page', String(params.page))
    return fetchData<Product[]>(`/api/products?${query}`)
  },
}
```

```typescript
// app/(auth)/products/[id]/page.tsx
import { productsFetcher } from '@/features/products'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await productsFetcher.getById(params.id)

  return <ProductDetail product={product} />
}
```

### CSR: SWR Hookでのデータ取得

ユーザー操作に応じた動的なデータ取得にはSWR Hookを使用する。

```typescript
// features/products/ui/product-search.tsx
'use client'

import { useProducts } from '@/features/products'

export function ProductSearch() {
  const [keyword, setKeyword] = useState('')
  const { data, isLoading } = useProducts({ keyword })

  return (
    <>
      <SearchInput value={keyword} onChange={setKeyword} />
      <ProductList products={data} isLoading={isLoading} />
    </>
  )
}
```

### SSR + CSRの組み合わせ

初期表示はSSR、ユーザー操作後の更新はCSRで行うパターン。

```typescript
// app/(auth)/products/page.tsx
import { productsFetcher } from '@/features/products'
import { ProductPage } from '@/features/products/ui/product-page'

export default async function Page() {
  // 初期データはSSRでfetcher経由で取得
  const initialData = await productsFetcher.getAll({ page: 1 })

  // 検索・ページネーションはCSRで処理
  return <ProductPage initialData={initialData} />
}
```

```typescript
// features/products/ui/product-page.tsx
'use client'

import { useProducts } from '@/features/products'
import type { PaginatedResult, Product } from '@/features/products'

type Props = {
  initialData: PaginatedResult<Product>
}

export function ProductPage({ initialData }: Props) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  // initialDataでSSRデータをSWRのfallbackとして使用
  const { data } = useProducts({ keyword, page }, { fallbackData: initialData })

  return (
    <>
      <SearchInput value={keyword} onChange={setKeyword} />
      <ProductList products={data.items} />
      <Pagination total={data.total} page={data.page} limit={data.limit} onPageChange={setPage} />
    </>
  )
}
```

## アンチパターン

### 静的データをCSRで取得する

```typescript
// NG: SSRで十分なデータをCSRで取得している
'use client'

import { useProduct } from '@/features/products'

export default function ProductPage({ params }: { params: { id: string } }) {
  const { data, isLoading } = useProduct(params.id)

  if (isLoading) return <Loading />
  return <ProductDetail product={data} />
}
```

### Server ComponentからService直接呼び出し

```typescript
// NG: Server ComponentからService層を直接呼び出している
import { getProduct } from '@/features/products'
import { createClient } from '@/lib/supabase/server'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const product = await getProduct(supabase, params.id)

  return <ProductDetail product={product} />
}
```

fetcher経由でAPI Routeを呼び出す。Service直接呼び出しはデータフローの一貫性を損なう。

### SSRでHandler層を経由する

```typescript
// NG: Server ComponentからHandler関数を呼び出している
import { handleGetProduct } from '@/features/products'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const response = await handleGetProduct(params.id)
  const product = await response.json()

  return <ProductDetail product={product} />
}
```

## 関連ルール

- [arch-fetch-strategy](../rules/arch-fetch-strategy.md) - SSR/CSRデータ取得戦略ルール
- [frontend-data-fetching](../rules/frontend-data-fetching.md) - CSRでのfetcher/hooks実装ルール

## 参照

- [architecture/service.md](architecture/service.md) - Service層の実装
