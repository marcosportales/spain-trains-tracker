import type { SightingWindow, WindowSighting } from '@stt/contracts';
import { type MapRun, type MapRuns, runKey } from '../map/live/live-runs';

/** Length of the window one replay covers (the API accepts up to 6 hours). */
export const WINDOW_MS = 60 * 60 * 1000;
/** A Run whose last Sighting is older than this is no longer on the map. */
export const STALE_AFTER_MS = 5 * 60 * 1000;
/** Replay speeds, in replayed seconds per real second. */
export const SPEEDS = [30, 60, 300, 600] as const;
export const DEFAULT_SPEED = 60;

/** Sightings grouped by Run (oldest first), ready to look up an instant by binary search. */
export type SightingIndex = ReadonlyMap<string, readonly (WindowSighting & { at: number })[]>;

export function indexSightings(window: SightingWindow): SightingIndex {
  const byRun = new Map<string, (WindowSighting & { at: number })[]>();
  for (const sighting of window.sightings) {
    const key = runKey(sighting);
    const list = byRun.get(key) ?? [];
    list.push({ ...sighting, at: Date.parse(sighting.observedAt) });
    byRun.set(key, list);
  }
  // Oldest first; on a tie the Visor feed sorts first so the Official feed wins as the latest.
  for (const list of byRun.values())
    list.sort((a, b) => a.at - b.at || (a.source === b.source ? 0 : a.source === 'visor' ? -1 : 1));
  return byRun;
}

const toMapRun = (s: WindowSighting): MapRun => ({
  trainNumber: s.trainNumber,
  serviceDate: s.serviceDate,
  lat: s.lat,
  lon: s.lon,
  status: s.status,
  sources: [s.source],
  observedAt: s.observedAt,
  ...(s.stationCode !== undefined && { nextStationCode: s.stationCode }),
});

/** The Runs on the map at `instant` (epoch ms): each one's latest Sighting, unless stale. */
export function replayRuns(index: SightingIndex, instant: number): MapRuns {
  const runs = new Map<string, MapRun>();
  for (const [key, list] of index) {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((list[mid] as { at: number }).at <= instant) lo = mid + 1;
      else hi = mid;
    }
    const latest = list[lo - 1];
    if (latest && instant - latest.at <= STALE_AFTER_MS) runs.set(key, toMapRun(latest));
  }
  return runs;
}

/** Moves the playhead forward by `elapsedMs` of real time at `speed`, stopping at `length`. */
export function advance(input: {
  position: number;
  elapsedMs: number;
  speed: number;
  length: number;
}): { position: number; ended: boolean } {
  const next = input.position + input.elapsedMs * input.speed;
  return next >= input.length
    ? { position: input.length, ended: true }
    : { position: next, ended: false };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function sightingWindowUrl(from: Date, baseUrl = API_URL): string {
  const to = new Date(from.getTime() + WINDOW_MS);
  return `${baseUrl}/sightings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
}

/** The last full hour before `now`. */
export function defaultWindowStart(now = new Date()): Date {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  start.setUTCHours(start.getUTCHours() - 1);
  return start;
}

/** How many past hours the Replay looks back through to find one with data. */
export const LOOKBACK_HOURS = 6;

/** Window starts to try, newest first: the last full hour, then each hour before it. */
export function candidateStarts(now: Date, hours = LOOKBACK_HOURS): Date[] {
  const latest = defaultWindowStart(now).getTime();
  return Array.from({ length: hours }, (_, i) => new Date(latest - i * WINDOW_MS));
}

export type LatestWindowResult =
  | { status: 'found'; from: Date; window: SightingWindow }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'aborted' };

/**
 * Tries each start in order, one request at a time (a window can be large), and stops at the
 * first with Sightings. A failed request is an error, not a reason to try the next hour.
 */
export async function findLatestWindow(
  fetchWindow: (from: Date, signal?: AbortSignal) => Promise<SightingWindow>,
  starts: readonly Date[],
  signal?: AbortSignal,
): Promise<LatestWindowResult> {
  for (const from of starts) {
    if (signal?.aborted) return { status: 'aborted' };
    let window: SightingWindow;
    try {
      window = await fetchWindow(from, signal);
    } catch {
      return signal?.aborted ? { status: 'aborted' } : { status: 'error' };
    }
    if (signal?.aborted) return { status: 'aborted' };
    if (window.sightings.length > 0) return { status: 'found', from, window };
  }
  return { status: 'none' };
}

/** Fetches the Sightings of the hour starting at `from`. */
export async function fetchSightingWindow(
  from: Date,
  signal?: AbortSignal,
): Promise<SightingWindow> {
  const res = await fetch(sightingWindowUrl(from), {
    cache: 'no-store',
    ...(signal && { signal }),
  });
  if (!res.ok) throw new Error(`Sighting window request failed: ${res.status}`);
  return (await res.json()) as SightingWindow;
}
