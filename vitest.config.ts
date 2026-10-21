import { defineConfig } from 'vitest/config';

// Tests cover the pure rules in src/game, so no RUN SDK plugins here.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
