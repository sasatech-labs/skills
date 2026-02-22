# 認証・認可の実装

## 概要

認証・認可は、Handler層とService層にまたがる二段階の戦略で実装する。Handler層が楽観的認証（セッション存在チェック）を、Service層が厳密な認可（所有権・ロール判定）を担当する。

**対象範囲**: セッション認証、所有権チェック、ロールベース認可、Supabase RLSとの補完関係

**主要な責務**:
- Handler層: セッション存在チェック（楽観的認証）
- Service層: ビジネスルールに基づく認可チェック（所有権、ロール）
- 認証済みユーザーIDのService層への受け渡し

**禁止事項**:
- 共有ヘルパー関数（`requireAuth`、`requireAdmin`等）の作成（インラインで記述する）
- `getUser()`の使用（`getSession()`を使用する）
- 生の`Error`のスロー（`AppError`を使用する）
- Handler層での認可判断（Service層の責務）

## 設計思想

二段階認証・認可戦略を採用する理由は、以下の通りである。

### 早期排除による効率化

Handler層で未認証リクエストを早期に排除することで、不要なビジネスロジックの実行を防ぐ。`getSession()`はサーバーサイドのCookieから高速にセッションを取得でき、データベースアクセスを伴わないため、軽量なチェックとして適している。

### 責務分離による保守性向上

認証（誰であるかの確認）と認可（何ができるかの判断）を明確に分離する。Handler層はHTTPの境界として「ログインしているか」だけを判断し、「このリソースにアクセスできるか」の判断はビジネスルールを理解するService層に委ねる。この分離により、認可ロジックの変更がHandler層に波及しない。

### Supabase RLSとの補完関係

Supabase RLS（Row Level Security）はデータベースレベルでアクセス制御を行う。アプリケーション層の認証・認可はRLSを補完し、より細かいビジネスルールの適用と、明確なエラーメッセージの提供を実現する。

## 実装パターン

### 楽観的認証（Handler層）

Handler層では`supabase.auth.getSession()`でセッションの存在を確認する。未認証の場合は`AppError.unauthorized()`をスローし、認証済みの場合はユーザーIDをService層に渡す。

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

  // Service層に認証済みユーザーIDを渡す
  const profile = await getMyProfile(supabase, session.user.id)
  return AppResponse.ok(profile)
})
```

**ポイント**:
- `getSession()`はCookieからセッションを取得するため、データベースアクセスを伴わない
- 未認証の場合は`AppError.unauthorized()`で401レスポンスを返す
- `session.user.id`をService層に渡し、以降の認可判断に使用する

### インライン認可（Service層）

Service層では、Handler層から受け取ったユーザーIDを使用し、ビジネスルールに基づいてアクセス権限を検証する。認可ロジックは共有ヘルパーを作成せず、各Service関数内にインラインで記述する。

```typescript
// src/features/posts/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Post, UpdatePostInput } from './schema'
import { AppError } from '@/lib/errors'
import { postRepository } from './repository'

export async function updatePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  input: UpdatePostInput
): Promise<Post> {
  const post = await postRepository.findById(supabase, postId)

  // 厳密な認可: 所有権チェック
  if (post.userId !== userId) {
    throw AppError.forbidden('You can only edit your own posts')
  }

  return postRepository.update(supabase, postId, input)
}
```

**ポイント**:
- 認可ロジックはService関数内にインラインで記述する
- 所有権違反は`AppError.forbidden()`で403レスポンスを返す
- 共有ヘルパー（`requireOwnership`等）は作成しない

## 使用例

### 例1: プロフィール取得（楽観的認証のみ）

自分のプロフィールを取得する。認可チェックは不要で、楽観的認証のみで十分なケース。

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

  // 楽観的認証
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  const profile = await getMyProfile(supabase, session.user.id)
  return AppResponse.ok(profile)
})
```

```typescript
// src/features/users/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from './schema'
import { AppError } from '@/lib/errors'
import { userRepository } from './repository'

export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile> {
  const profile = await userRepository.findById(supabase, userId)
  if (!profile) {
    throw AppError.notFound('Profile not found')
  }
  return profile
}
```

### 例2: 投稿更新（所有権チェック）

自分の投稿のみ更新可能。Handler層で楽観的認証を行い、Service層で所有権を検証する。

```typescript
// src/features/posts/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { validateBody } from '@/lib/validation'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { updatePostSchema } from './schema'
import { updatePost } from './service'

export const handleUpdatePost = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const validation = await validateBody(request, updatePostSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()

  // 楽観的認証
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  // Service層で所有権チェックを行う
  const post = await updatePost(supabase, session.user.id, id, validation.data)
  return AppResponse.ok(post)
})
```

```typescript
// src/features/posts/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Post, UpdatePostInput } from './schema'
import { AppError } from '@/lib/errors'
import { postRepository } from './repository'

export async function updatePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  input: UpdatePostInput
): Promise<Post> {
  const post = await postRepository.findById(supabase, postId)

  // 厳密な認可: 所有権チェック
  if (post.userId !== userId) {
    throw AppError.forbidden('You can only edit your own posts')
  }

  return postRepository.update(supabase, postId, input)
}
```

### 例3: 管理者操作（ロールチェック）

管理者ダッシュボードへのアクセス。Handler層で楽観的認証を行い、Service層でロールを検証する。

```typescript
// src/features/admin/core/handler.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AppResponse } from '@/lib/api-response'
import { withHTTPError } from '@/lib/with-http-error'
import { AppError } from '@/lib/errors'
import { getAdminDashboard } from './service'

export const handleGetAdminDashboard = withHTTPError(async (request) => {
  const supabase = await createClient()

  // 楽観的認証
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  // ロールチェックはService層で行う
  const dashboard = await getAdminDashboard(supabase, session.user.id)
  return AppResponse.ok(dashboard)
})
```

```typescript
// src/features/admin/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import { getUserById } from '@/features/users'
import { analyticsRepository } from './repository'

export async function getAdminDashboard(
  supabase: SupabaseClient,
  userId: string
) {
  // 厳密な認可: ロールチェック
  // 他FeatureのデータはService関数経由で取得する
  const user = await getUserById(supabase, userId)
  if (user.role !== 'admin') {
    throw AppError.forbidden('Admin access required')
  }

  return analyticsRepository.getDashboard(supabase)
}
```

### 例4: 複合認可（所有者またはadmin）

投稿の削除。所有者と管理者の両方に権限がある場合のパターン。

```typescript
// src/features/posts/core/service.ts
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors'
import { getUserById } from '@/features/users'
import { postRepository } from './repository'

export async function deletePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<void> {
  const post = await postRepository.findById(supabase, postId)
  // 他FeatureのデータはService関数経由で取得する
  const user = await getUserById(supabase, userId)

  // 複合認可: 所有者またはadmin
  if (post.userId !== userId && user.role !== 'admin') {
    throw AppError.forbidden('Only the author or admin can delete this post')
  }

  await postRepository.delete(supabase, postId)
}
```

## アンチパターン

### 共有ヘルパー関数の作成

```typescript
// 避けるべき: 共有ヘルパー
export async function requireAuth(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication required')
  return user
}

export async function requireAdmin(supabase: SupabaseClient) {
  const user = await requireAuth(supabase)
  // ...
}
```

```typescript
// 推奨: 各Handler/Service関数内にインラインで記述
export const handleGetMyProfile = withHTTPError(async (request) => {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  const profile = await getMyProfile(supabase, session.user.id)
  return AppResponse.ok(profile)
})
```

### Handler層での認可判断

```typescript
// 避けるべき: Handler層でロールチェック
export const handleDeleteUser = withHTTPError(async (request, context) => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw AppError.unauthorized()

  // Handler層でロールを取得して判断している
  const user = await userRepository.findById(supabase, session.user.id)
  if (user.role !== 'admin') throw AppError.forbidden()

  const { id } = await context.params
  await deleteUser(supabase, id)
  return AppResponse.noContent()
})
```

```typescript
// 推奨: 認可はService層で行う
export const handleDeleteUser = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  // Service層に委譲（ロールチェックはService層内で行う）
  await deleteUser(supabase, session.user.id, id)
  return AppResponse.noContent()
})
```

## 参考資料

- [Handler層の実装](architecture/handler.md) - 楽観的認証チェックの詳細
- [Service層の実装](architecture/service.md) - 厳密な認可チェックの詳細
- [エラーハンドリング](error-handling.md) - AppErrorによるエラー処理
- [response-apperror](../rules/response-apperror.md) - AppError使用ルール
