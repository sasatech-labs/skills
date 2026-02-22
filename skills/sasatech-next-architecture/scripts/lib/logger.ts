import 'server-only'

import pino, { Logger } from 'pino'

const isProduction = process.env.NODE_ENV === 'production'
const logLevel = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug')

/**
 * アプリケーションロガー
 *
 * 使用例:
 * ```typescript
 * import { logger } from '@/lib/logger'
 *
 * logger.info({ userId: '123' }, 'User logged in')
 * logger.error({ error }, 'Failed to process request')
 * ```
 */
const _logger: Logger = pino({
  level: logLevel,
  // 機密情報をマスク
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
    ],
    censor: '[REDACTED]',
  },
  // 本番: JSON、開発: pretty
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
})

/**
 * リクエストごとの子ロガーを作成
 *
 * 使用例:
 * ```typescript
 * const requestId = crypto.randomUUID()
 * const log = createRequestLogger(requestId, user?.id)
 *
 * log.info({ operation: 'createProduct' }, 'Creating product')
 * ```
 */
function _createRequestLogger(requestId: string, userId?: string): Logger {
  return _logger.child({
    requestId,
    ...(userId && { userId }),
  })
}

/**
 * レイヤー別のログヘルパー
 */
const _logLayers = {
  handler: (log: Logger, route: string, method: string) =>
    log.child({ layer: 'handler', route, method }),

  service: (log: Logger, operation: string) =>
    log.child({ layer: 'service', operation }),

  repository: (log: Logger, table: string, operation: string) =>
    log.child({ layer: 'repository', table, operation }),

  adapter: (log: Logger, service: string, operation: string) =>
    log.child({ layer: 'adapter', service, operation }),
}

export const logger = _logger
export const createRequestLogger = _createRequestLogger
export const logLayers = _logLayers
