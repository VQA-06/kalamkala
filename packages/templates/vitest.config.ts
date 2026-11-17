import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['contract.test.ts', 'sdk/**/*.test.ts', 'keraton-heritage/**/*.test.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
