import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['dist/**', 'dist-build/**', 'node_modules/**', 'shared/dist/**', 'server/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**/*.ts', 'src/i18n/**/*.ts'],
      exclude: ['src/services/__tests__/**', 'src/i18n/__tests__/**'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 80,
        lines: 85,
      },
    },
  },
})
