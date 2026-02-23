import { NextResponse } from 'next/server'

type SuccessResponse<T> = {
  data: T
}

type ErrorResponse = {
  error: {
    error_code: string
    message: string
  }
}

type ValidationErrorResponse = {
  error: {
    error_code: 'VALIDATION_ERROR'
    message: string
    details: Array<{ field: string; message: string }>
  }
}

export class AppResponse {
  /**
   * 成功レスポンス (200 OK)
   */
  static ok<T>(data: T): NextResponse<SuccessResponse<T>> {
    return NextResponse.json({ data })
  }

  /**
   * 作成成功レスポンス (201 Created)
   */
  static created<T>(data: T): NextResponse<SuccessResponse<T>> {
    return NextResponse.json({ data }, { status: 201 })
  }

  /**
   * コンテンツなしレスポンス (204 No Content)
   */
  static noContent(): NextResponse {
    return new NextResponse(null, { status: 204 })
  }

  /**
   * バッドリクエスト (400)
   */
  static badRequest(
    message: string = 'Bad request',
    errorCode: string = 'BAD_REQUEST',
    details?: Array<{ field: string; message: string }>
  ): NextResponse<ErrorResponse | ValidationErrorResponse> {
    return NextResponse.json(
      { error: { error_code: errorCode, message, ...(details && { details }) } },
      { status: 400 }
    )
  }

  /**
   * 認証エラー (401)
   */
  static unauthorized(
    message: string = 'Unauthorized',
    errorCode: string = 'UNAUTHORIZED'
  ): NextResponse<ErrorResponse> {
    return NextResponse.json(
      { error: { error_code: errorCode, message } },
      { status: 401 }
    )
  }

  /**
   * 権限エラー (403)
   */
  static forbidden(
    message: string = 'Forbidden',
    errorCode: string = 'FORBIDDEN'
  ): NextResponse<ErrorResponse> {
    return NextResponse.json(
      { error: { error_code: errorCode, message } },
      { status: 403 }
    )
  }

  /**
   * 未検出エラー (404)
   */
  static notFound(
    message: string = 'Not Found',
    errorCode: string = 'NOT_FOUND'
  ): NextResponse<ErrorResponse> {
    return NextResponse.json(
      { error: { error_code: errorCode, message } },
      { status: 404 }
    )
  }

  /**
   * 競合エラー (409)
   */
  static conflict(
    message: string = 'Conflict',
    errorCode: string = 'CONFLICT'
  ): NextResponse<ErrorResponse> {
    return NextResponse.json(
      { error: { error_code: errorCode, message } },
      { status: 409 }
    )
  }

  /**
   * サーバーエラー (500)
   */
  static serverError(
    message: string = 'Internal Server Error',
    errorCode: string = 'INTERNAL_ERROR'
  ): NextResponse<ErrorResponse> {
    return NextResponse.json(
      { error: { error_code: errorCode, message } },
      { status: 500 }
    )
  }
}

export type { SuccessResponse, ErrorResponse, ValidationErrorResponse }
