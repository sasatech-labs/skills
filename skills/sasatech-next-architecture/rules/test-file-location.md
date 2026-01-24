---
title: テストファイルは __tests__ ディレクトリに配置
impact: MEDIUM
impactDescription: テストファイルの一貫した配置による整理
tags: testing, structure, organization
---

## テストファイルは __tests__ ディレクトリに配置

テストファイルはソースファイルと同階層の `__tests__` ディレクトリに配置。

**Incorrect (ソースと混在、ディレクトリが散らかる):**

```
src/features/products/
├── service.ts
├── service.test.ts     # ソースと混在
├── repository.ts
└── repository.test.ts  # ソースと混在
```

**Correct (__tests__ に分離、ソースがすっきり):**

```
src/features/products/
├── __tests__/
│   ├── service.test.ts   # テスト専用ディレクトリ
│   └── repository.test.ts
├── core/
│   ├── service.ts
│   └── repository.ts
└── index.ts
```

## ディレクトリ構成

```
src/
├── __tests__/                    # 統合テスト（API Route）
│   └── integration/
│       └── api/
│           ├── products.test.ts
│           ├── users.test.ts
│           └── auth.test.ts
│
└── features/
    ├── products/
    │   ├── __tests__/            # Feature のユニットテスト
    │   │   ├── service.test.ts
    │   │   └── repository.test.ts
    │   └── core/
    │       ├── service.ts
    │       └── repository.ts
    │
    └── users/
        ├── __tests__/
        │   ├── service.test.ts
        │   └── repository.test.ts
        └── core/
```

## テストの種類と配置

| 種類 | 配置先 | 説明 |
|------|--------|------|
| 統合テスト | `src/__tests__/integration/` | API Route のテスト |
| ユニットテスト | `src/features/*/__tests__/` | Service/Repository のテスト |
| E2E テスト | `e2e/` (プロジェクトルート) | Playwright 等 |

## 命名規則

```
*.test.ts     # 統一
*.spec.ts     # 使用しない
```

## インポートパス

```typescript
// テストファイルからのインポート
// src/features/products/__tests__/service.test.ts
import { getProducts } from '../core/service'
import { productRepository } from '../core/repository'
```
