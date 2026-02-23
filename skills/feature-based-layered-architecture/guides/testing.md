# テストガイド

## 概要

このガイドでは、Feature-based Layer Architectureにおけるテスト戦略を説明する。各レイヤーに応じた適切なテスト方法とモック戦略を示し、テスト容易性の高いコードベースを構築する方法を提供する。

## 設計思想

レイヤーごとに独立したテストを実装することで、以下の利点を得る。

**テスト容易性**: 各レイヤーは単一の責務を持つため、依存関係をモック化して独立したテストが可能である。Handler層はServiceをモックし、Service層はRepositoryをモックする。これにより、テスト対象を明確に分離できる。

**保守性**: レイヤーの境界が明確であるため、変更の影響範囲を限定できる。データベースのクエリ変更はRepositoryテストのみ、ビジネスロジックの変更はServiceテストのみに影響する。

**品質保証**: レイヤーごとに異なる観点でテストを実施する。Handlerはリクエスト/レスポンスの整合性、Serviceはビジネスロジックの正確性、Repositoryはクエリの動作を検証する。この多層的なテスト戦略により、システム全体の品質を保証できる。

## テストの種類と範囲

```
┌─────────────────────────────────────────────────────────────┐
│  Integration Tests (Handler)                                │
│  - API Route のエンドツーエンド動作確認                    │
│  - Service をモック                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Unit Tests (Service)                                       │
│  - ビジネスロジックの検証                                  │
│  - Repository をモック                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Unit Tests (Repository)                                    │
│  - クエリロジックの検証                                    │
│  - Supabase クライアントをモック                           │
└─────────────────────────────────────────────────────────────┘
```

## レイヤー別テスト戦略

### Handler (API Route) テスト

Service をモックして、リクエスト/レスポンス処理を検証。

```typescript
// src/__tests__/integration/api/products.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/products/route'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProducts, createProduct } from '@/features/products/index.server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/features/products/index.server', () => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
}))

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('200と商品一覧を返す', async () => {
    const products = [
      { id: '1', name: 'Product A', price: 1000 },
      { id: '2', name: 'Product B', price: 2000 },
    ]

    vi.mocked(createClient).mockResolvedValue({} as any)
    vi.mocked(getProducts).mockResolvedValue(products)

    const request = new NextRequest('http://localhost/api/products')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual(products)
  })

  it('サービスエラー時は500を返す', async () => {
    vi.mocked(createClient).mockResolvedValue({} as any)
    vi.mocked(getProducts).mockRejectedValue(new Error('Service error'))

    const request = new NextRequest('http://localhost/api/products')
    const response = await GET(request)

    expect(response.status).toBe(500)
  })
})

describe('POST /api/products', () => {
  it('バリデーションエラー時は400を返す', async () => {
    const request = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: '' }), // 空文字は無効
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('201と作成された商品を返す', async () => {
    const newProduct = { id: '1', name: 'New Product', price: 1500 }

    vi.mocked(createClient).mockResolvedValue({} as any)
    vi.mocked(createProduct).mockResolvedValue(newProduct)

    const request = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Product', price: 1500 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.data).toEqual(newProduct)
  })
})
```

### Service テスト

Repository をモックして、ビジネスロジックを検証。

```typescript
// src/features/products/__tests__/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProducts, createProduct } from '../core/service'
import { productRepository } from '../core/repository'
import { AppError } from '@/lib/errors'

vi.mock('../core/repository', () => ({
  productRepository: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}))

describe('getProducts', () => {
  const mockSupabase = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('商品一覧を返す', async () => {
    const products = [{ id: '1', name: 'Product A' }]
    vi.mocked(productRepository.findMany).mockResolvedValue(products)

    const result = await getProducts(mockSupabase)

    expect(result).toEqual(products)
    expect(productRepository.findMany).toHaveBeenCalledWith(mockSupabase, {})
  })

  it('オプションをRepositoryに渡す', async () => {
    vi.mocked(productRepository.findMany).mockResolvedValue([])

    await getProducts(mockSupabase, { limit: 10, offset: 20 })

    expect(productRepository.findMany).toHaveBeenCalledWith(
      mockSupabase,
      { limit: 10, offset: 20 }
    )
  })
})

describe('createProduct', () => {
  const mockSupabase = {} as any

  it('名前が空の場合はエラーをスロー', async () => {
    await expect(
      createProduct(mockSupabase, { name: '', price: 1000 })
    ).rejects.toThrow(AppError)
  })

  it('名前をトリムして保存', async () => {
    const created = { id: '1', name: 'Product', price: 1000 }
    vi.mocked(productRepository.create).mockResolvedValue(created)

    await createProduct(mockSupabase, { name: '  Product  ', price: 1000 })

    expect(productRepository.create).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ name: 'Product' })
    )
  })
})
```

### Repository テスト

Supabase クライアントをモックして、クエリロジックを検証。

```typescript
// src/features/products/__tests__/repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productRepository } from '../core/repository'
import { AppError } from '@/lib/errors'

describe('productRepository', () => {
  const createMockSupabase = (response: { data: any; error: any }) => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue(response),
        }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(response),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(response),
        }),
      }),
    }),
  })

  describe('findMany', () => {
    it('商品一覧を返す', async () => {
      const products = [{ id: '1', name: 'Product A' }]
      const mockSupabase = createMockSupabase({ data: products, error: null })

      const result = await productRepository.findMany(mockSupabase as any)

      expect(result).toEqual(products)
    })

    it('上限を超えるlimitは制限される', async () => {
      const mockSupabase = createMockSupabase({ data: [], error: null })

      await productRepository.findMany(mockSupabase as any, { limit: 1000 })

      // MAX_LIMIT (100) で制限されていることを確認
      const fromMock = mockSupabase.from as any
      const rangeMock = fromMock().select().order().range
      expect(rangeMock).toHaveBeenCalledWith(0, 99) // 0-99 = 100件
    })

    it('エラー時はAppErrorをスロー', async () => {
      const mockSupabase = createMockSupabase({
        data: null,
        error: { message: 'Database error' },
      })

      await expect(
        productRepository.findMany(mockSupabase as any)
      ).rejects.toThrow(AppError)
    })
  })

  describe('findById', () => {
    it('商品が見つからない場合はnullを返す', async () => {
      const mockSupabase = createMockSupabase({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      })

      const result = await productRepository.findById(mockSupabase as any, '1')

      expect(result).toBeNull()
    })
  })
})
```

## server-only のモック

`server-only` パッケージはテスト環境では無効化が必要。

```typescript
// vitest.setup.ts
import { vi } from 'vitest'

// server-only のモック（テスト環境では無効化）
vi.mock('server-only', () => ({}))

// Supabase クライアントのグローバルモック（必要に応じて）
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
```

## テストファイルの配置

```
src/
├── __tests__/                    # 統合テスト
│   └── integration/
│       └── api/
│           ├── products.test.ts
│           └── users.test.ts
│
└── features/
    └── products/
        ├── __tests__/            # Feature のユニットテスト
        │   ├── service.test.ts
        │   └── repository.test.ts
        └── core/
            ├── service.ts
            └── repository.ts
```

## テストの命名規則

### ファイル名

```
*.test.ts     # テストファイル
*.spec.ts     # 使用しない（.test.ts に統一）
```

### describe / it の記述

```typescript
// 日本語で記述（チームの慣習に合わせる）
describe('getProducts', () => {
  it('商品一覧を返す', async () => {})
  it('オプションをRepositoryに渡す', async () => {})
  it('エラー時は例外をスロー', async () => {})
})

// または英語
describe('getProducts', () => {
  it('returns product list', async () => {})
  it('passes options to repository', async () => {})
  it('throws on error', async () => {})
})
```

### エラーケースのテスト

```typescript
describe('createProduct', () => {
  // 正常系を先に
  it('商品を作成して返す', async () => {})

  // 異常系は後に
  it('名前が空の場合はエラー', async () => {})
  it('価格が負の場合はエラー', async () => {})
})
```

## モックのベストプラクティス

### 1. モジュール全体をモック

```typescript
// Good: モジュール全体をモック
vi.mock('@/features/products', () => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
}))
```

### 2. 各テストでモックの戻り値を設定

```typescript
// Good: テストごとに戻り値を設定
it('商品一覧を返す', async () => {
  vi.mocked(getProducts).mockResolvedValue([{ id: '1' }])
  // ...
})
```

### 3. beforeEach でモックをクリア

```typescript
// Good: 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks()
})
```

### 4. 型安全なモック

```typescript
// Good: vi.mocked で型安全に
vi.mocked(getProducts).mockResolvedValue(products)

// Bad: 型情報が失われる
(getProducts as jest.Mock).mockResolvedValue(products)
```

## Vitest 設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

## テストカバレッジの方針

| レイヤー | 推奨カバレッジ | 重点 |
|---------|---------------|------|
| Repository | 高 | クエリの正確性、エラーハンドリング |
| Service | 高 | ビジネスロジック、バリデーション |
| Handler | 中 | リクエスト/レスポンス処理 |
| Hooks | 低 | UI統合はE2Eで検証 |

### 優先的にテストすべき箇所

1. **ビジネスロジック** - Service 層の条件分岐、計算処理
2. **バリデーション** - 入力値の検証ロジック
3. **エラーハンドリング** - 異常系の挙動
4. **境界値** - 上限/下限、空配列、null など

## 関連ルール

- [test-layer-mocking](../rules/test-layer-mocking.md) - 各レイヤーは直下の依存のみをモック
- [test-server-only](../rules/test-server-only.md) - server-onlyのテスト環境モック
- [test-file-location](../rules/test-file-location.md) - テストファイルの配置ルール
- [test-naming](../rules/test-naming.md) - テストの命名ルール
