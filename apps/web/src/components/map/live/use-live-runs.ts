'use client';

import type { LiveDiff, LiveSnapshot, ServiceType } from '@stt/contracts';
import { useEffect, useReducer } from 'react';
import { initialLiveRuns, type LiveRuns, liveRunsReducer } from './live-runs';

export type LiveRunFilters = {
  serviceType?: ServiceType | undefined;
  hub?: string | undefined;
  line?: string | undefined;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

export function liveStreamUrl(filters: LiveRunFilters, baseUrl = API_URL): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return `${baseUrl}/live/stream${query ? `?${query}` : ''}`;
}

/** Our own API's payload (shapes in `@stt/contracts`); a malformed event is dropped. */
function parseEvent<T>(event: Event): Partial<T> | undefined {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as Partial<T>;
  } catch {
    return undefined;
  }
}

/**
 * Live Runs from `/live/stream`. The browser reconnects dropped streams by itself, and every
 * reconnect starts with a fresh `snapshot`, so Runs missed meanwhile are replaced. When the
 * browser gives up (e.g. the API answered an error), we reopen with exponential backoff.
 */
export function useLiveRuns(filters: LiveRunFilters = {}): LiveRuns {
  const [runs, dispatch] = useReducer(liveRunsReducer, initialLiveRuns);
  const { serviceType, hub, line } = filters;

  useEffect(() => {
    const url = liveStreamUrl({ serviceType, hub, line });
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = RETRY_MIN_MS;
    dispatch({ type: 'reset' });

    const open = () => {
      source = new EventSource(url);
      source.addEventListener('snapshot', (e) => {
        const data = parseEvent<LiveSnapshot>(e);
        if (!Array.isArray(data?.runs)) return;
        delay = RETRY_MIN_MS;
        dispatch({ type: 'snapshot', runs: data.runs });
      });
      source.addEventListener('diff', (e) => {
        const data = parseEvent<LiveDiff>(e);
        if (!Array.isArray(data?.upserted) || !Array.isArray(data.removed)) return;
        dispatch({ type: 'diff', upserted: data.upserted, removed: data.removed });
      });
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED) return; // browser is reconnecting
        source.close();
        retry = setTimeout(open, delay);
        delay = Math.min(delay * 2, RETRY_MAX_MS);
      };
    };
    open();

    return () => {
      clearTimeout(retry);
      source?.close();
    };
  }, [serviceType, hub, line]);

  return runs;
}
