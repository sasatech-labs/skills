---
id: arch-handler-route-separation
title: API Routeは薄いエントリーポイントに限定
category: アーキテクチャ
impact: HIGH
tags: [architecture, handler, api-route, layers]
---

## ルール

API Route（`app/api/`）はHandler関数を呼び出すだけの薄いエントリーポイントとする。API Route内にバリデーション、認証チェック、データベースアクセス、ビジネスロジックを記述しない。

## 理由

API RouteとHandler層を分離する理由は以下の通りである：

1. **責務の分離**: API Routeはルーティングの定義のみを担当する。ロジックをHandler層に委譲することで、HTTP層とビジネス層の関心事が分離される
2. **テスタビリティ**: Handler関数を独立した関数として定義することで、API Routeを経由せずにテストできる。API Routeに直接ロジックを記述すると、テストにHTTPリクエストのモックが必要になる
3. **一貫性**: 全API RouteがHandler関数の呼び出しのみという統一パターンにより、コードベースの見通しが向上する

違反すると、ロジックがAPI RouteとHandler層に分散し、テストと保守が困難になる。

## OK例

```typescript
// src/app/api/products/route.ts
// OK: Handler関数を呼び出すだけ
import { handleGetProducts, handleCreateProduct } from '@/features/products/index.server'

export const GET = handleGetProducts
export const POST = handleCreateProduct
```

```typescript
// src/features/products/core/handler.ts
// OK: バリデーション、認証、Service呼び出しはHandler層で行う
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { getProducts } from './service'

export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})
```

## NG例

```typescript
// src/app/api/products/route.ts
// NG: API Route内にバリデーション、認証、DBアクセスを直接記述している
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // NG: API Route内でクエリパラメータのパース
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? '20')

  // NG: API Route内で直接データベースアクセス
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(limit)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
```

## 参照

- [Handler層ガイド](../guides/architecture/handler.md)
- [arch-three-layers](arch-three-layers.md)
