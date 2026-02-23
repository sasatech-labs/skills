import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Node.js 環境で実行（API Route テスト向け）
    environment: 'node',

    // describe, it, expect をグローバルで使用可能に
    globals: true,

    // セットアップファイル
    setupFiles: ['./vitest.setup.ts'],

    // テストファイルのパターン
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],

    // 除外パターン
    exclude: ['node_modules', 'dist', '.next'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/**/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts', // 再エクスポートのみのファイル
      ],
      // カバレッジの閾値（必要に応じて調整）
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 80,
      //   statements: 80,
      // },
    },

    // タイムアウト設定（ミリ秒）
    testTimeout: 10000,

    // 並列実行
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
