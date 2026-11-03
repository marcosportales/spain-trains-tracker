'use client';

import type { SightingWindow } from '@stt/contracts';
import { useEffect, useState } from 'react';
import { fetchSightingWindow } from './replay-view';

export type SightingWindowState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; window: SightingWindow };

/**
 * Sightings of the hour starting at `from` (idle while null), refetched when it changes. `initial`, when it is the
 * window for the same `from`, is used as is instead of fetching it again.
 */
export function useSightingWindow(
  from: Date | null,
  initial?: { from: Date; window: SightingWindow },
): SightingWindowState {
  const key = from?.getTime() ?? null;
  const seeded = initial && initial.from.getTime() === key ? initial.window : undefined;
  const [state, setState] = useState<SightingWindowState>(
    seeded ? { status: 'ready', window: seeded } : { status: 'loading' },
  );

  useEffect(() => {
    if (key === null) {
      setState({ status: 'loading' });
      return;
    }
    if (seeded) {
      setState({ status: 'ready', window: seeded });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchSightingWindow(new Date(key), controller.signal)
      .then((window) => setState({ status: 'ready', window }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [key, seeded]);

  return state;
}
