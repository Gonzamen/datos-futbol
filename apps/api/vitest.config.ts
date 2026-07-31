import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const domainSource = fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@datos-futbol/domain': domainSource,
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
