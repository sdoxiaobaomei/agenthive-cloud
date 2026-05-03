import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'
import path from 'path'

config({ path: '.env.test' })

export default defineConfig({
  resolve: {
    extensionAlias: {
      '.js': '.ts',
    },
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        'dist/',
      ],
    },
  },
})
