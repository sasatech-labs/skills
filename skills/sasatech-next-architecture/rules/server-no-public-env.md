---
title: 機密情報の NEXT_PUBLIC_ 環境変数禁止
impact: CRITICAL
impactDescription: 機密情報のクライアント露出を防止
tags: server, security, environment, supabase
---

## 機密情報の NEXT_PUBLIC_ 環境変数禁止

Supabase の接続情報や API キーなど、機密性のある環境変数には `NEXT_PUBLIC_` プレフィックスを使用しない。

## 禁止する環境変数（機密情報）

以下の環境変数は**絶対に** `NEXT_PUBLIC_` を付けてはいけない:

| 変数名 | 理由 |
|--------|------|
| `SUPABASE_URL` | DB 接続先の露出 |
| `SUPABASE_ANON_KEY` | API キー |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理者権限キー |
| `DATABASE_URL` | DB 接続文字列 |
| `*_SECRET_KEY` | 秘密鍵全般 |
| `*_API_KEY`（サーバー用） | サーバーサイド API キー |
| `STRIPE_SECRET_KEY` | Stripe 秘密鍵 |
| `RESEND_API_KEY` | メール送信 API キー |
| `OPENAI_API_KEY` | OpenAI API キー |

## 許可する環境変数（公開情報）

以下はクライアントで必要なため `NEXT_PUBLIC_` を使用して良い:

| 変数名 | 用途 |
|--------|------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 測定 ID |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager ID |
| `NEXT_PUBLIC_SITE_URL` | サイトの公開 URL |
| `NEXT_PUBLIC_APP_NAME` | アプリ名 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開鍵 |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN（公開可） |

**Incorrect (機密情報がクライアントバンドルに含まれる):**

```bash
# .env.local - NG
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_xxx  # 絶対NG
```

```typescript
// クライアントから直接アクセス可能になってしまう
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Correct (機密情報はサーバー専用、公開情報のみ NEXT_PUBLIC_):**

```bash
# .env.local
# サーバー専用（NEXT_PUBLIC_ なし）
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_live_xxx

# クライアント公開可（NEXT_PUBLIC_ あり）
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_SITE_URL=https://example.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

```typescript
// src/lib/supabase/server.ts
import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

## 判断基準

`NEXT_PUBLIC_` を付けるかどうかの判断:

1. **その値が漏れても問題ないか？** → 問題あれば `NEXT_PUBLIC_` 禁止
2. **ブラウザの DevTools で見られても良いか？** → ダメなら `NEXT_PUBLIC_` 禁止
3. **公開鍵か秘密鍵か？** → 秘密鍵は `NEXT_PUBLIC_` 禁止

## 理由

- `NEXT_PUBLIC_` 付きの環境変数はクライアントバンドルに含まれる
- ブラウザの DevTools で誰でも確認可能
- API キーが露出すると、RLS をバイパスした攻撃が可能になる

## 代替アプローチ

クライアントからデータベースにアクセスする場合は、API Route を経由する:

```
クライアント → API Route → Service → Repository → Supabase
```

直接アクセスではなく、必ずサーバーサイドを経由する。
