import { vi } from 'vitest'

// =============================================================================
// server-only のモック
// =============================================================================
// Service/Repository で使用している server-only パッケージを無効化
// これがないとテスト実行時にエラーになる
vi.mock('server-only', () => ({}))

// =============================================================================
// Supabase クライアントのモック
// =============================================================================
// 個別のテストで上書き可能なデフォルトモック
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

// =============================================================================
// 環境変数のモック（必要に応じて）
// =============================================================================
// process.env.SUPABASE_URL = 'http://localhost:54321'
// process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// =============================================================================
// グローバルなテストヘルパー（オプション）
// =============================================================================

/**
 * Supabase クライアントのモックを作成するヘルパー
 *
 * @example
 * const mockSupabase = createMockSupabaseClient({
 *   from: {
 *     products: {
 *       select: { data: [...], error: null }
 *     }
 *   }
 * })
 */
export function createMockSupabaseClient(responses: Record<string, any> = {}) {
  const defaultResponse = { data: [], error: null }

  return {
    from: vi.fn((table: string) => {
      const tableResponses = responses[table] || {}

      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue(
              tableResponses.select || defaultResponse
            ),
            limit: vi.fn().mockResolvedValue(
              tableResponses.select || defaultResponse
            ),
          }),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              tableResponses.selectSingle || defaultResponse
            ),
            maybeSingle: vi.fn().mockResolvedValue(
              tableResponses.selectSingle || defaultResponse
            ),
          }),
          single: vi.fn().mockResolvedValue(
            tableResponses.selectSingle || defaultResponse
          ),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              tableResponses.insert || defaultResponse
            ),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                tableResponses.update || defaultResponse
              ),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(
            tableResponses.delete || defaultResponse
          ),
        }),
      }
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }
}

// =============================================================================
// カスタムマッチャー（オプション）
// =============================================================================
// expect.extend({
//   toBeValidProduct(received) {
//     const pass = received.id && received.name && typeof received.price === 'number'
//     return {
//       pass,
//       message: () => `expected ${JSON.stringify(received)} to be a valid product`,
//     }
//   },
// })
