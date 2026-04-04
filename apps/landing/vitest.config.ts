import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['components/**/*.spec.{js,ts}', 'e2e/**/*.spec.{js,ts}'],
  },
  resolve: {
    alias: {
      '~': resolve(__dirname),
      '@': resolve(__dirname),
    },
  },
})
