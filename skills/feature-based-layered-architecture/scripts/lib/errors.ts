/**
 * アプリケーション共通エラークラス
 */
class _AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR'
  ) {
    super(message)
    this.name = 'AppError'
  }

  static badRequest(message: string, code?: string) {
    return new _AppError(message, 400, code ?? 'BAD_REQUEST')
  }

  static unauthorized(message = 'Unauthorized') {
    return new _AppError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message = 'Forbidden') {
    return new _AppError(message, 403, 'FORBIDDEN')
  }

  static notFound(message = 'Not found') {
    return new _AppError(message, 404, 'NOT_FOUND')
  }

  static conflict(message: string, code?: string) {
    return new _AppError(message, 409, code ?? 'CONFLICT')
  }
}

export type AppError = _AppError
export const AppError = _AppError
