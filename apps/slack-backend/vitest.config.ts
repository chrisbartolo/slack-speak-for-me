import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'slack-backend',
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      exclude: [
        'test/**',
        '**/*.test.ts',
        'src/routes/test.ts',
        'dist/**',
        'vitest.config.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
