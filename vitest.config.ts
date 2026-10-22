import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Timing-sensitive suites run serially on their own (npm run test:load), not next to the default suite.
    exclude: ['node_modules/**', 'dist/**', 'tests/load/**', 'tests/perf/**'],
  },
});
