/**
 * Thresholds tuned to the API's 15 s heartbeat: two missed heartbeats = reconnecting, and
 * eight = offline.
 */
export const RECONNECTING_AFTER_MS = 30_000;
export const OFFLINE_AFTER_MS = 120_000;

export type LiveIndicatorState = 'connecting' | 'live' | 'reconnecting' | 'offline';

/**
 * How fresh the live stream is. Any `snapshot`, `diff` or `heartbeat` event counts. With no event
 * yet, time is measured from `openedAt` and the first 30 s read as `connecting`.
 */
export function liveIndicator({
  now,
  lastEventAt,
  openedAt,
}: {
  now: number;
  lastEventAt: number | undefined;
  openedAt: number;
}): { state: LiveIndicatorState; ageSeconds?: number } {
  const age = Math.max(0, now - (lastEventAt ?? openedAt));
  const ageSeconds = Math.floor(age / 1000);
  if (age >= OFFLINE_AFTER_MS) return { state: 'offline', ageSeconds };
  if (age >= RECONNECTING_AFTER_MS) return { state: 'reconnecting', ageSeconds };
  return lastEventAt === undefined ? { state: 'connecting' } : { state: 'live', ageSeconds };
}
