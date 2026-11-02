/**
 * How a Run's punctuality is shown: on time, late, severely late, cancelled or unknown.
 * See **Delay band** in `GLOSSARY.md`.
 */
export type DelayBand = 'on_time' | 'late' | 'severely_late' | 'cancelled' | 'unknown';

/**
 * A Delay under this many seconds (early included) is **On time**; see `GLOSSARY.md`.
 * The only place this threshold lives in the web app.
 */
export const ON_TIME_BELOW_S = 300;

/** A Delay from this many seconds is in the severely late **Delay band**; see `GLOSSARY.md`. */
export const SEVERELY_LATE_FROM_S = 900;

/** The Delay band of a Run: cancelled wins, then unknown (no Delay), then the thresholds. */
export function delayBandFor(
  seconds: number | undefined,
  serviceStatus?: 'scheduled' | 'cancelled',
): DelayBand {
  if (serviceStatus === 'cancelled') return 'cancelled';
  if (seconds === undefined) return 'unknown';
  if (seconds < ON_TIME_BELOW_S) return 'on_time';
  return seconds < SEVERELY_LATE_FROM_S ? 'late' : 'severely_late';
}

export const delayMinutes = (seconds: number): number => Math.round(seconds / 60);
