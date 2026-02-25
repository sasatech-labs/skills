---
id: naming-exports
title: Export戦略 — 内部実装と公開APIの分離
category: 命名規則
impact: MEDIUM
tags: [naming, exports, module, convention]
---

## ルール

すべてのexport対象（関数、定数、クラス、型）は `_` prefixの内部実装として定義し、ファイル末尾でまとめてexportする。バレルファイル（re-exportのみのファイル）は対象外とする。

## 理由

### exportの一覧性

ファイル末尾にexportを集約することで、そのモジュールの公開APIが一目で把握できる。コードレビューやリファクタリング時に、何がexportされているかをファイル末尾だけで確認できる。

### 内部実装と公開APIの分離

`_` prefixにより、内部実装と公開APIの境界が明確になる。これにより以下の利点がある：

1. **意図の明示**: `_` が付いている要素は内部実装、付いていない要素は公開API
2. **リファクタリングの安全性**: 内部実装の変更が公開APIに影響しないことを構造的に保証する
3. **命名の一貫性**: ファイル全体で統一されたパターンにより、認知負荷を軽減する

### 違反時の影響

- exportがファイル全体に散在し、公開APIの把握が困難になる
- 内部実装と公開APIの境界が曖昧になる

## OK例

### 関数

```typescript
function _ok<T>(data: T): NextResponse<T> {
  return NextResponse.json(data)
}

function _created<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 })
}

export const ok = _ok
export const created = _created
```

### 定数

```typescript
const _logger: Logger = pino({ /* ... */ })

export const logger = _logger
```

### クラス

クラスは値と型の両方をexportする。

```typescript
class _AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
  }
}

export type AppError = _AppError
export const AppError = _AppError
```

### 型・interface

```typescript
interface _PaymentIntent {
  id: string
  amount: number
}

type _ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response }

export type PaymentIntent = _PaymentIntent
export type ValidationResult<T> = _ValidationResult<T>
```

### 内部参照

同一ファイル内では `_` prefix名で参照する。

```typescript
const _logger: Logger = pino({ /* ... */ })

// 内部では _logger を使用する
function _createRequestLogger(requestId: string): Logger {
  return _logger.child({ requestId })
}

export const logger = _logger
export const createRequestLogger = _createRequestLogger
```

### 非exportのプライベート要素

exportしない要素は `_` prefixを付けない。

```typescript
// プライベート型 — exportしないため _ 不要
type ErrorDetail = {
  field: string
  message: string
}

// プライベート関数 — exportしないため _ 不要
function getCardErrorMessage(code: string | undefined): string {
  // ...
}

// export対象 — _ prefix
function _handleStripeError(error: unknown): AppError {
  // getCardErrorMessage を内部で使用
}

export const handleStripeError = _handleStripeError
```

## NG例

### インラインexport

宣言と同時にexportする。

```typescript
// NG: export が宣言に散在している
export function ok<T>(data: T): NextResponse<T> {
  return NextResponse.json(data)
}

export function created<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 })
}

export const logger: Logger = pino({ /* ... */ })

export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number = 500) {
    super(message)
  }
}

export interface PaymentIntent {
  id: string
  amount: number
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response }
```

## 例外

### バレルファイル

re-exportのみのファイル（`index.server.ts`、`index.client.ts`等）は、このルールの対象外とする。

```typescript
// adapters/index.ts — バレルファイルはそのまま
export { stripeAdapter } from './stripe'
export type { PaymentIntent, Customer } from './stripe'
export { resendAdapter } from './resend'
export type { SendEmailInput, EmailResult } from './resend'
```

### 混合ファイルのtype re-export

実装コードとtype re-exportが共存するファイルでは、type re-exportはバレルと同等に扱い、ファイル末尾にまとめる。

```typescript
import type { PaymentIntent, Customer } from './types'

const _stripeAdapter = { /* ... */ }

// ファイル末尾にまとめる
export type { PaymentIntent, Customer }
export const stripeAdapter = _stripeAdapter
```

## 参照

- [naming-files](naming-files.md) — ファイル・ディレクトリ命名規則
- [naming-methods](naming-methods.md) — メソッド命名規則
