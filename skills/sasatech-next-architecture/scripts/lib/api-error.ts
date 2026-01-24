/**
 * クライアントサイド用 API エラークラス
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Array<{ field: string; message: string }>
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /**
   * バリデーションエラーかどうか
   */
  isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR'
  }

  /**
   * 認証エラーかどうか
   */
  isUnauthorized(): boolean {
    return this.status === 401
  }

  /**
   * 権限エラーかどうか
   */
  isForbidden(): boolean {
    return this.status === 403
  }

  /**
   * 未検出エラーかどうか
   */
  isNotFound(): boolean {
    return this.status === 404
  }
}
