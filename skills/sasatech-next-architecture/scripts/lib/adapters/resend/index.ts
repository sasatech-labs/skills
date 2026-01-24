import 'server-only'
import { resend } from './client'
import { AppError } from '@/lib/errors'
import type {
  SendEmailInput,
  SendBatchEmailInput,
  EmailResult,
  BatchEmailResult,
} from './types'

export type { SendEmailInput, SendBatchEmailInput, EmailResult, BatchEmailResult }

/**
 * デフォルトの送信元アドレス
 * 本番環境では環境変数から取得することを推奨
 */
const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'noreply@example.com'

export const resendAdapter = {
  /**
   * メールを送信
   */
  async sendEmail(input: SendEmailInput): Promise<EmailResult> {
    const { data, error } = await resend.emails.send({
      from: input.from ?? DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      react: input.react,
      replyTo: input.replyTo,
      cc: input.cc,
      bcc: input.bcc,
    })

    if (error) {
      console.error('Resend error:', error)
      throw new AppError(
        `メール送信に失敗しました: ${error.message}`,
        500,
        'EMAIL_SEND_ERROR'
      )
    }

    return { id: data!.id }
  },

  /**
   * メールを一括送信
   * 最大100件まで
   */
  async sendBatchEmail(input: SendBatchEmailInput): Promise<BatchEmailResult> {
    if (input.emails.length > 100) {
      throw new AppError(
        '一括送信は100件までです',
        400,
        'EMAIL_BATCH_LIMIT_EXCEEDED'
      )
    }

    const { data, error } = await resend.batch.send(
      input.emails.map((email) => ({
        from: email.from ?? DEFAULT_FROM,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        react: email.react,
        replyTo: email.replyTo,
        cc: email.cc,
        bcc: email.bcc,
      }))
    )

    if (error) {
      console.error('Resend batch error:', error)
      throw new AppError(
        `メール一括送信に失敗しました: ${error.message}`,
        500,
        'EMAIL_BATCH_SEND_ERROR'
      )
    }

    return { ids: data!.data.map((d) => d.id) }
  },
}
