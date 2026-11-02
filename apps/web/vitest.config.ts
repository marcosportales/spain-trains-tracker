import { defineProject } from 'vitest/config';

export default defineProject({
  // tsconfig keeps `jsx: preserve` for Next, so tell the test transformer to compile JSX.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
