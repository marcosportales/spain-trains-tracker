'use client';

import { useSyncExternalStore } from 'react';

/** Tailwind's `md` breakpoint: the side panel starts here. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * Whether the viewport is desktop-sized. The server snapshot is `true`, so server render and the
 * first client render agree (the desktop layout); React then switches if the viewport is narrow.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
