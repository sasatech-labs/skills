import type { ReactNode } from 'react'

// ========================================
// 入力型
// ========================================

interface _SendEmailInput {
  /** 宛先（単一または複数） */
  to: string | string[]
  /** 件名 */
  subject: string
  /** HTML 本文 */
  html?: string
  /** テキスト本文 */
  text?: string
  /** React コンポーネント（Resend のテンプレート機能） */
  react?: ReactNode
  /** 送信元（省略時はデフォルト） */
  from?: string
  /** 返信先 */
  replyTo?: string
  /** CC */
  cc?: string | string[]
  /** BCC */
  bcc?: string | string[]
}

interface _SendBatchEmailInput {
  emails: _SendEmailInput[]
}

// ========================================
// 出力型
// ========================================

interface _EmailResult {
  id: string
}

interface _BatchEmailResult {
  ids: string[]
}

export type SendEmailInput = _SendEmailInput
export type SendBatchEmailInput = _SendBatchEmailInput
export type EmailResult = _EmailResult
export type BatchEmailResult = _BatchEmailResult
