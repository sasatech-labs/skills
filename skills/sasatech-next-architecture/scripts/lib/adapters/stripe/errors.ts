import 'server-only'
import Stripe from 'stripe'
import { AppError } from '@/lib/errors'

/**
 * Stripe エラーを AppError に変換
 */
export function handleStripeError(error: unknown): AppError {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case 'StripeCardError':
        // カード関連エラー（残高不足、有効期限切れなど）
        return new AppError(
          getCardErrorMessage(error.code),
          400,
          'CARD_ERROR'
        )

      case 'StripeRateLimitError':
        return new AppError(
          '決済サービスが混雑しています。しばらくしてから再度お試しください',
          503,
          'RATE_LIMIT'
        )

      case 'StripeInvalidRequestError':
        return new AppError(
          '決済リクエストが不正です',
          400,
          'INVALID_REQUEST'
        )

      case 'StripeAuthenticationError':
        // API キーの問題（運用エラー）
        console.error('Stripe authentication failed:', error.message)
        return new AppError(
          '決済システムに問題が発生しました',
          500,
          'STRIPE_AUTH_ERROR'
        )

      case 'StripeAPIError':
        // Stripe 側の問題
        console.error('Stripe API error:', error.message)
        return new AppError(
          '決済サービスで問題が発生しました',
          503,
          'STRIPE_API_ERROR'
        )

      case 'StripeConnectionError':
        return new AppError(
          '決済サービスに接続できません',
          503,
          'STRIPE_CONNECTION_ERROR'
        )

      default:
        console.error('Unknown Stripe error:', error)
        return new AppError(
          '決済処理に失敗しました',
          500,
          'STRIPE_ERROR'
        )
    }
  }

  // Stripe 以外のエラー
  console.error('Unexpected error in Stripe adapter:', error)
  return new AppError('予期しないエラーが発生しました', 500)
}

/**
 * カードエラーコードを日本語メッセージに変換
 */
function getCardErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'card_declined':
      return 'カードが拒否されました'
    case 'insufficient_funds':
      return '残高が不足しています'
    case 'expired_card':
      return 'カードの有効期限が切れています'
    case 'incorrect_cvc':
      return 'セキュリティコードが正しくありません'
    case 'incorrect_number':
      return 'カード番号が正しくありません'
    case 'processing_error':
      return 'カードの処理中にエラーが発生しました'
    default:
      return 'カードの処理に失敗しました'
  }
}
