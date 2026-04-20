import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./backend/__tests__/setup.js'],
    include: ['backend/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['backend/tools/**/*.js', 'backend/services/**/*.js'],
      exclude: ['backend/__tests__/**', 'backend/server.js'],
      thresholds: { lines: 40, functions: 30, branches: 28 },
    },
    testTimeout: 15000,
    singleFork: true,
  },
});
