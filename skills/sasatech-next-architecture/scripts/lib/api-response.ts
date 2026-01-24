import { NextResponse } from 'next/server'

type ErrorDetail = {
  field: string
  message: string
}

type ErrorResponse = {
  error: {
    message: string
    code?: string
    details?: ErrorDetail[]
  }
}

/**
 * 成功レスポンス (200 OK)
 */
export function ok<T>(data: T): NextResponse<T> {
  return NextResponse.json(data)
}

/**
 * 作成成功レスポンス (201 Created)
 */
export function created<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 })
}

/**
 * コンテンツなしレスポンス (204 No Content)
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * バッドリクエスト (400)
 */
export function badRequest(
  message: string,
  code?: string,
  details?: ErrorDetail[]
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: { message, code, details } },
    { status: 400 }
  )
}

/**
 * 認証エラー (401)
 */
export function unauthorized(
  message: string = 'Unauthorized'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: { message, code: 'UNAUTHORIZED' } },
    { status: 401 }
  )
}

/**
 * 権限エラー (403)
 */
export function forbidden(
  message: string = 'Forbidden'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: { message, code: 'FORBIDDEN' } },
    { status: 403 }
  )
}

/**
 * 未検出エラー (404)
 */
export function notFound(
  message: string = 'Not Found'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: { message, code: 'NOT_FOUND' } },
    { status: 404 }
  )
}

/**
 * 競合エラー (409)
 */
export function conflict(
  message: string = 'Conflict'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: { message, code: 'CONFLICT' } },
    { status: 409 }
  )
}

/**
 * サーバーエラー (500)
 */
export function serverError(
  message: string = 'Internal Server Error'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: { message, code: 'INTERNAL_ERROR' } },
    { status: 500 }
  )
}
