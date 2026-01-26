import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'database',
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
      exclude: [
        'test/**',
        '**/*.test.ts',
        'dist/**',
        'vitest.config.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
