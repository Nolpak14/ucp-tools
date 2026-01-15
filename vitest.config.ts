import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'api/**/*.ts'],
      exclude: ['**/*.d.ts', '**/types/**'],
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  // Use CommonJS mode for @ucp-js/sdk due to ESM extensionless import bug
  ssr: {
    noExternal: ['@ucp-js/sdk'],
  },
});
