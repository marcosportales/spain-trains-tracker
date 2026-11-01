'use client';

import type { SightingWindow } from '@stt/contracts';
import { useEffect, useState } from 'react';
import { sightingWindowUrl } from './replay-view';

export type SightingWindowState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; window: SightingWindow };

/** Sightings of the hour starting at `from`, refetched when it changes. */
export function useSightingWindow(from: Date): SightingWindowState {
  const [state, setState] = useState<SightingWindowState>({ status: 'loading' });
  const key = from.getTime();

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch(sightingWindowUrl(new Date(key)), { cache: 'no-store', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Sighting window request failed: ${res.status}`);
        return res.json() as Promise<SightingWindow>;
      })
      .then((window) => setState({ status: 'ready', window }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [key]);

  return state;
}
