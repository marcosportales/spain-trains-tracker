'use client';

import { THEME_SCRIPT } from './theme-script';

/**
 * Sets `data-theme` before first paint. Rendered on the server only: React warns about a
 * `<script>` rendered on the client (e.g. when the layout re-renders on a locale switch), and it
 * would never run there anyway. `ThemeSync` covers the client side.
 */
export function ThemeScript() {
  if (typeof window !== 'undefined') return null;
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, no user input; it must run before first paint
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  );
}
