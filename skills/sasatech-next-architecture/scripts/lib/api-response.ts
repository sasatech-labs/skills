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

/**
 * 成功レスポンス (200 OK)
 */
function _ok<T>(data: T): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ data })
}

/**
 * 作成成功レスポンス (201 Created)
 */
function _created<T>(data: T): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ data }, { status: 201 })
}

/**
 * コンテンツなしレスポンス (204 No Content)
 */
function _noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * バッドリクエスト (400)
 */
function _badRequest(
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
function _unauthorized(
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
function _forbidden(
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
function _notFound(
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
function _conflict(
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
function _serverError(
  message: string = 'Internal Server Error',
  errorCode: string = 'INTERNAL_ERROR'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: { error_code: errorCode, message } },
    { status: 500 }
  )
}

export type { SuccessResponse, ErrorResponse, ValidationErrorResponse }
export const ok = _ok
export const created = _created
export const noContent = _noContent
export const badRequest = _badRequest
export const unauthorized = _unauthorized
export const forbidden = _forbidden
export const notFound = _notFound
export const conflict = _conflict
export const serverError = _serverError
