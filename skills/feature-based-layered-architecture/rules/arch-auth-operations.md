---
id: arch-auth-operations
title: 認証操作はService層に実装する
category: アーキテクチャ
impact: HIGH
tags: [architecture, authentication, handler, service]
---

## ルール

SignOut、SignInWithOTPなどの認証操作は、Service層に実装する。Handler層は`supabase.auth.signOut()`や`supabase.auth.signInWithOtp()`を直接呼び出さない。

## 理由

認証操作をService層に配置する理由は以下の通りである：

1. **責務分離**: 認証操作はビジネスロジックの一部である。Handler層の責務はリクエスト/レスポンスの境界処理に限定する
2. **一貫性**: 他のビジネスロジック（CRUD操作、決済処理など）と同様に、認証操作もService層経由で実行することで、レイヤー構成の一貫性を保つ
3. **テスタビリティ**: Service層に分離することで、認証操作のテストをHTTPリクエストから独立して実行できる

違反すると、Handler層にビジネスロジックが混入し、レイヤー間の責務境界が曖昧になる。

## OK例

```typescript
// src/features/auth/core/handler.ts
// OK: Handler層はリクエスト処理のみ、認証操作はService層に委譲
const _handleSignOut = withHTTPError(async (request) => {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  // Service層に委譲
  await signOut(supabase)
  return AppResponse.noContent()
})

const _handleSignInWithOTP = withHTTPError(async (request) => {
  const validation = await validateBody(request, signInWithOTPSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()
  // Service層に委譲
  const result = await signInWithOTP(supabase, validation.data)
  return AppResponse.ok(result)
})

export const handleSignOut = _handleSignOut
export const handleSignInWithOTP = _handleSignInWithOTP
```

```typescript
// src/features/auth/core/service.ts
// OK: 認証操作をService層に実装
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignInWithOTPInput } from './schema'
import { AppError } from '@/lib/errors'

async function _signOut(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new AppError(error.message, 500, 'SIGN_OUT_FAILED')
  }
}

async function _signInWithOTP(
  supabase: SupabaseClient,
  input: SignInWithOTPInput
): Promise<{ message: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
  })

  if (error) {
    throw new AppError(error.message, 500, 'OTP_SEND_FAILED')
  }

  return { message: 'OTP sent successfully' }
}

export const signOut = _signOut
export const signInWithOTP = _signInWithOTP
```

## NG例

```typescript
// src/features/auth/core/handler.ts
// NG: Handler層で認証操作を直接実行している
export const handleSignOut = withHTTPError(async (request) => {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw AppError.unauthorized()

  // 問題: Handler層でsupabase.auth.signOut()を直接呼び出している
  const { error } = await supabase.auth.signOut()
  if (error) throw new AppError(error.message, 500)

  return AppResponse.noContent()
})
```

```typescript
// src/features/auth/core/handler.ts
// NG: Handler層でOTPサインインを直接実行している
export const handleSignInWithOTP = withHTTPError(async (request) => {
  const validation = await validateBody(request, signInWithOTPSchema)
  if (!validation.success) return validation.response

  const supabase = await createClient()

  // 問題: Handler層でsupabase.auth.signInWithOtp()を直接呼び出している
  const { error } = await supabase.auth.signInWithOtp({
    email: validation.data.email,
  })
  if (error) throw new AppError(error.message, 500)

  return AppResponse.ok({ message: 'OTP sent successfully' })
})
```

## 参照

- [認証・認可ガイド](../guides/authentication.md)
- [二段階認証・認可戦略](arch-auth-strategy.md)
- [Handler層の実装](../guides/architecture/handler.md)
- [Service層の実装](../guides/architecture/service.md)
