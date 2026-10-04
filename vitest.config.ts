import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  define: {
    __LOUPE_FIXTURES__: 'true',
    __LOUPE_DEFAULT_ADAPTER__: JSON.stringify('fixture'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/entrypoints/**', 'src/test/**'],
      // CLAUDE.md: parsers and context detection need ≥ 90% coverage.
      thresholds: {
        'src/netsuite/parsers/**': { lines: 90, statements: 90, functions: 90, branches: 85 },
        'src/netsuite/context/**': { lines: 90, statements: 90, functions: 90, branches: 85 },
      },
    },
  },
});
