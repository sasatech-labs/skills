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
export async function fetcher<T>(
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

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data.error?.message || 'An error occurred',
      response.status,
      data.error?.code,
      data.error?.details
    )
  }

  return data as T
}
