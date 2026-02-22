import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { AppResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<Record<string, string>> }
type HandlerFn = (
  request: NextRequest,
  context: RouteContext
) => Promise<NextResponse>

/**
 * Handler関数のエラーハンドリングを統一するラッパー
 *
 * - AppError → 対応するHTTPレスポンスに変換
 * - 未知のエラー → 500 Internal Server Error
 */
function _withHTTPError(handler: HandlerFn): HandlerFn {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: { error_code: error.code, message: error.message } },
          { status: error.statusCode }
        )
      }
      return AppResponse.serverError()
    }
  }
}

export const withHTTPError = _withHTTPError
