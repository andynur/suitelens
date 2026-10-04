import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/entrypoints/**'],
      // CLAUDE.md: parsers and context detection need ≥ 90% coverage.
      thresholds: {
        'src/netsuite/parsers/**': { lines: 90, statements: 90, functions: 90, branches: 85 },
        'src/netsuite/context/**': { lines: 90, statements: 90, functions: 90, branches: 85 },
      },
    },
  },
});
