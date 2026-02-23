import { ApiError } from './api-error'

type FetcherOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: HeadersInit
}

/**
 * API フェッチャー
 *
 * @example
 * // GET
 * const products = await fetcher<Product[]>('/api/products')
 *
 * // POST
 * const product = await fetcher<Product>('/api/products', {
 *   method: 'POST',
 *   body: { name: 'New Product', price: 100 }
 * })
 */
async function _fetcher<T>(
  url: string,
  options: FetcherOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers } = options

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  const json = await response.json()

  if (!response.ok) {
    throw new ApiError(
      json.error?.message || 'An error occurred',
      response.status,
      json.error?.error_code || 'UNKNOWN_ERROR',
      json.error?.details
    )
  }

  return json.data as T
}

export const fetcher = _fetcher
