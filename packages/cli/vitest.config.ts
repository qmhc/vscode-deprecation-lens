import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'cli',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'test-fixtures'],
  },
})
