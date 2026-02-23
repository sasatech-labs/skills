---
id: test-file-location
title: テストファイルは __tests__ ディレクトリに配置
category: テスト
impact: LOW
tags: [testing, structure, organization]
---

## ルール

テストファイルはソースファイルと同階層の `__tests__` ディレクトリに配置する。ソースファイルとテストファイルを混在させない。

## NG例

```plaintext
src/features/products/
├── service.ts
├── service.test.ts     # NG: ソースと混在
├── repository.ts
└── repository.test.ts  # NG: ソースと混在
```

問題点:
- ソースファイルとテストファイルが混在し、ディレクトリが散らかる
- テストファイルの一覧性が低い

## OK例

```plaintext
src/features/products/
├── __tests__/
│   ├── service.test.ts      # OK: テスト専用ディレクトリに配置
│   └── repository.test.ts   # OK: テストがまとまっている
├── core/
│   ├── service.ts
│   └── repository.ts
├── index.server.ts
└── index.client.ts
```

推奨理由:
- ソースファイルとテストファイルが分離され、ディレクトリがすっきりする
- テストファイルの一覧性が高い
- テストの追加・削除が容易

## 理由

テストファイルを `__tests__` ディレクトリに分離することで、以下の利点がある：

1. **可読性の向上**: ソースファイルとテストファイルが混在しないため、ディレクトリ構造が整理される
2. **保守性の向上**: テストファイルの一覧性が高まり、テストの追加・削除が容易になる
3. **開発体験の改善**: ソースファイルを探す際に、テストファイルがノイズにならない

違反時の影響は限定的だが、プロジェクト全体で統一することで開発体験が向上する。

## テストの種類と配置

| 種類 | 配置先 | 説明 |
|------|--------|------|
| 統合テスト | `src/__tests__/integration/` | API Routeのテスト |
| ユニットテスト | `src/features/*/__tests__/` | Service/Repositoryのテスト |
| E2Eテスト | `e2e/` (プロジェクトルート) | Playwright等 |

## 命名規則

テストファイルは `*.test.ts` で統一する。`*.spec.ts` は使用しない。

## 参照

- 関連ルール: `test-naming.md`
