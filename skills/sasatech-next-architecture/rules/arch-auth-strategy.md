---
id: arch-auth-strategy
title: 二段階認証・認可戦略
category: アーキテクチャ
impact: HIGH
tags: [architecture, authentication, authorization, handler, service]
---

## ルール

認証・認可は二段階で実装する。Handler層は`getSession()`でセッション存在を確認する楽観的認証を担当し、Service層はビジネスルールに基づく厳密な認可（所有権、ロール）を担当する。共有ヘルパー関数（`requireAuth`、`requireAdmin`等）は作成しない。

## NG例

```typescript
// src/features/posts/core/handler.ts
// NG: Handler層でロール/所有権チェックを行っている
export const handleUpdatePost = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw AppError.unauthorized()

  // 問題: Handler層で所有権チェックを行っている（Service層の責務）
  const post = await postRepository.findById(supabase, id)
  if (post.userId !== session.user.id) {
    throw AppError.forbidden()
  }

  const validation = await validateBody(request, updatePostSchema)
  if (!validation.success) return validation.response

  const updated = await updatePost(supabase, id, validation.data)
  return AppResponse.ok(updated)
})
```

```typescript
// src/features/users/core/service.ts
// NG: Service層でgetSessionを呼び出している
export async function getMyProfile(supabase: SupabaseClient) {
  // 問題: Service層でセッション取得を行っている（Handler層の責務）
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  return userRepository.findById(supabase, session.user.id)
}
```

```typescript
// src/lib/auth/helpers.ts
// NG: 共有認証ヘルパー関数を作成している
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

## OK例

```typescript
// src/features/posts/core/handler.ts
// OK: Handler層は楽観的認証のみ、認可はService層に委譲
export const handleUpdatePost = withHTTPError(async (request, context) => {
  const { id } = await context.params
  const validation = await validateBody(request, updatePostSchema)
  if (!validation.success) {
    return validation.response
  }

  const supabase = await createClient()

  // 楽観的認証: セッション存在チェックのみ
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw AppError.unauthorized()
  }

  // 認証済みユーザーIDをService層に渡す
  const post = await updatePost(supabase, session.user.id, id, validation.data)
  return AppResponse.ok(post)
})
```

```typescript
// src/features/posts/core/service.ts
// OK: Service層でインライン認可（所有権チェック）
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

## 理由

認証と認可を二段階に分離する理由は以下の通りである：

1. **早期排除**: Handler層で未認証リクエストを排除し、不要なビジネスロジック実行を防ぐ
2. **責務分離**: 認証（誰であるか）はHandler層、認可（何ができるか）はService層に集約し、変更影響を局所化する
3. **保守性**: 認可ロジックをビジネスルールと同じ場所に記述することで、ロジックの散在を防ぐ
4. **テスタビリティ**: Service層のテストで認可ロジックを直接検証できる

違反すると、認証・認可ロジックがレイヤーをまたいで散在し、責務分離が崩壊する。

## 参照

- [認証・認可ガイド](../guides/authentication.md)
- [Handler層の実装](../guides/architecture/handler.md)
- [Service層の実装](../guides/architecture/service.md)
