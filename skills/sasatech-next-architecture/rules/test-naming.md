---
id: test-naming
title: テストは日本語で意図を明確に記述
category: テスト
impact: LOW
tags: [testing, naming, readability]
---

## ルール

describe/itの記述は日本語で記述し、テストの意図を明確にする。実装詳細ではなく振る舞いを記述する。

## NG例

```typescript
// 何をテストしているか分からない
describe('getProducts', () => {
  it('works', async () => {})
  it('test1', async () => {})
  it('should return', async () => {})
})
```

```typescript
// 実装詳細を記述
describe('getProducts', () => {
  it('calls productRepository.findMany with supabase', async () => {})
})
```

## OK例

```typescript
// 振る舞いを日本語で記述
describe('getProducts', () => {
  it('商品一覧を返す', async () => {})
  it('指定された件数で制限される', async () => {})
  it('DBエラー時は例外をスロー', async () => {})
})
```

```typescript
// 英語の場合も振る舞いを記述
describe('getProducts', () => {
  it('returns product list', async () => {})
  it('limits results by specified count', async () => {})
  it('throws on database error', async () => {})
})
```

## 理由

テストの記述が曖昧だと、テストの意図や期待される振る舞いが不明確になる。実装詳細を記述すると、リファクタリング時にテストも変更が必要になり保守性が低下する。日本語で振る舞いを明確に記述することで、テストコードの可読性が向上し、チーム全体でのテスト理解が容易になる。違反した場合、テストの意図が伝わらず、テストの保守コストが増加する。

## describe の構造

```typescript
// 関数名やメソッド名
describe('getProducts', () => {})
describe('createProduct', () => {})

// ネストで条件を表現
describe('createProduct', () => {
  describe('名前が空の場合', () => {
    it('エラーをスロー', async () => {})
  })

  describe('正常な入力の場合', () => {
    it('商品を作成して返す', async () => {})
  })
})
```

## it の記述パターン

| パターン | 例 |
|---------|-----|
| 戻り値 | `商品一覧を返す`, `nullを返す` |
| 副作用 | `DBに保存する`, `イベントを発火する` |
| 例外 | `エラーをスロー`, `AppErrorをスロー` |
| 条件 | `空配列の場合は0を返す` |

## 順序

```typescript
describe('createProduct', () => {
  // 1. 正常系を先に
  it('商品を作成して返す', async () => {})
  it('名前をトリムして保存', async () => {})

  // 2. 異常系を後に
  it('名前が空の場合はエラー', async () => {})
  it('価格が負の場合はエラー', async () => {})
  it('DBエラー時は例外をスロー', async () => {})
})
```

## Arrange-Act-Assert パターン

```typescript
it('商品一覧を返す', async () => {
  // Arrange: 準備
  const products = [{ id: '1', name: 'Product A' }]
  vi.mocked(productRepository.findMany).mockResolvedValue(products)

  // Act: 実行
  const result = await getProducts(mockSupabase)

  // Assert: 検証
  expect(result).toEqual(products)
})
```
