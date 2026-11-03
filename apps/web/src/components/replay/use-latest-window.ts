'use client';

import type { SightingWindow } from '@stt/contracts';
import { useEffect, useState } from 'react';
import { candidateStarts, fetchSightingWindow, findLatestWindow } from './replay-view';

export type LatestWindowState =
  | { status: 'searching' }
  | { status: 'found'; from: Date; window: SightingWindow }
  | { status: 'none' }
  | { status: 'error' };

/** Finds the most recent recent hour that has Sightings, keeping its payload to avoid a refetch. */
export function useLatestWindow(attempt = 0): LatestWindowState {
  const [state, setState] = useState<LatestWindowState>({ status: 'searching' });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` restarts the search
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'searching' });
    findLatestWindow(fetchSightingWindow, candidateStarts(new Date()), controller.signal).then(
      (result) => {
        if (result.status !== 'aborted') setState(result);
      },
    );
    return () => controller.abort();
  }, [attempt]);

  return state;
}
