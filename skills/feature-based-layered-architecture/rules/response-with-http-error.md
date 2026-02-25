---
id: response-with-http-error
title: withHTTPError による Handler エラーハンドリング統一
category: レスポンス
impact: HIGH
tags: [handler, error, response, wrapper]
---

## ルール

Handler関数は`withHTTPError`でラップする。手動のtry-catch、`handleApiError`、inline AppError switchは使用しない。

## 理由

1. **ボイラープレート排除**: 全Handler関数で繰り返されるtry-catch + エラー判定パターンを一箇所に集約する
2. **一貫性の保証**: エラーレスポンスの形式が統一され、AppErrorのstatusCodeとcodeが確実にHTTPレスポンス(error_codeキー)に反映される
3. **保守性の向上**: エラーハンドリングのロジック変更が1ファイルで完結する

## OK例

```typescript
import { withHTTPError } from '@/lib/with-http-error'

// OK: withHTTPErrorでラップ
export const handleGetProducts = withHTTPError(async (request) => {
  const supabase = await createClient()
  const products = await getProducts(supabase)
  return AppResponse.ok(products)
})

// OK: バリデーション付き
export const handleCreateProduct = withHTTPError(async (request) => {
  const validation = await validateBody(request, createProductSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  const product = await createProduct(supabase, validation.data)
  return AppResponse.created(product)
})

// OK: パラメータ付き
export const handleGetProduct = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()
  const product = await getProduct(supabase, id)
  return AppResponse.ok(product)
})
```

## NG例

### 手動try-catch

```typescript
// NG: try-catch + AppResponse.serverError()の手動パターン
export async function handleGetProducts(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    return AppResponse.ok(products)
  } catch (error) {
    return AppResponse.serverError()
  }
}
```

### handleApiError

```typescript
// NG: handleApiError関数の使用
import { handleApiError } from '@/lib/api-response/error-handler'

export async function handleGetProducts(request: NextRequest) {
  try {
    const supabase = await createClient()
    const products = await getProducts(supabase)
    return AppResponse.ok(products)
  } catch (error) {
    return handleApiError(error)
  }
}
```

### inline AppError switch

```typescript
// NG: AppErrorのstatusCodeを手動でswitch
export async function handleCreateProduct(request: NextRequest) {
  try {
    const supabase = await createClient()
    const product = await createProduct(supabase, data)
    return AppResponse.created(product)
  } catch (error) {
    if (error instanceof AppError) {
      switch (error.statusCode) {
        case 400: return AppResponse.badRequest(error.message)
        case 404: return AppResponse.notFound(error.message)
        default: return AppResponse.serverError()
      }
    }
    return AppResponse.serverError()
  }
}
```

## 例外

- validateBody/validateSearchParamsの結果による早期リターンは、withHTTPErrorの内側で行う（バリデーション失敗はエラーではなくレスポンスとして返却するため）

## 参照

- [wrappers.md](../guides/wrappers.md) - withHTTPErrorの実装ガイド
- [response-apperror](response-apperror.md) - AppErrorクラスの使用ルール
- [architecture/handler.md](../guides/architecture/handler.md) - Handler層の実装
