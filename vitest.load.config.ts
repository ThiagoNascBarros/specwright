import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/perf/**/*.test.ts', 'tests/load/**/*.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 120_000,
    // One heavy scenario at a time, so the numbers are not skewed by each other.
    fileParallelism: false,
  },
});
