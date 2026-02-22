import { ZodError, ZodSchema } from 'zod'
import { badRequest } from './api-response'

type _ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response }

/**
 * リクエストボディのバリデーション
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const validation = await validateBody(request, createProductSchema)
 *   if (!validation.success) {
 *     return validation.response
 *   }
 *   // validation.data は型安全
 * }
 */
async function _validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<_ValidationResult<T>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return {
        success: false,
        response: badRequest('Validation failed', 'VALIDATION_ERROR', details),
      }
    }
    return {
      success: false,
      response: badRequest('Invalid JSON'),
    }
  }
}

/**
 * パスパラメータのバリデーション
 *
 * @example
 * export async function GET(
 *   request: NextRequest,
 *   { params }: { params: Promise<{ id: string }> }
 * ) {
 *   const { id } = await params
 *   const validation = validateParams({ id }, productIdSchema)
 *   if (!validation.success) {
 *     return validation.response
 *   }
 * }
 */
function _validateParams<T>(
  params: unknown,
  schema: ZodSchema<T>
): _ValidationResult<T> {
  try {
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return {
        success: false,
        response: badRequest('Invalid parameters', 'VALIDATION_ERROR', details),
      }
    }
    return {
      success: false,
      response: badRequest('Invalid parameters'),
    }
  }
}

/**
 * クエリパラメータのバリデーション
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const { searchParams } = new URL(request.url)
 *   const params = Object.fromEntries(searchParams.entries())
 *
 *   const validation = validateQuery(params, searchSchema)
 *   if (!validation.success) {
 *     return validation.response
 *   }
 * }
 */
function _validateQuery<T>(
  query: unknown,
  schema: ZodSchema<T>
): _ValidationResult<T> {
  try {
    const data = schema.parse(query)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return {
        success: false,
        response: badRequest('Invalid query parameters', 'VALIDATION_ERROR', details),
      }
    }
    return {
      success: false,
      response: badRequest('Invalid query parameters'),
    }
  }
}

export type ValidationResult<T> = _ValidationResult<T>
export const validateBody = _validateBody
export const validateParams = _validateParams
export const validateQuery = _validateQuery
