import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  // Mirrors the `@/*` path in tsconfig.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // tsconfig keeps `jsx: preserve` for Next, so tell the test transformer to compile JSX.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
    // next-intl's navigation imports `next/navigation` without an extension; let Vite resolve it.
    server: { deps: { inline: ['next-intl'] } },
  },
});
