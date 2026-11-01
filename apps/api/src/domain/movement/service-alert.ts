import { InvalidMovementValueError, requireNonEmpty } from './errors.js';
import type { Source } from './source.js';
import { requireObservedAt, requireSource } from './validation.js';

/** When a Service alert applies. `end` is open when Renfe has not announced one. */
export interface ActivePeriod {
  readonly start?: Date;
  readonly end?: Date;
}

/** An official notice from Renfe about a disruption that affects one or more Lines. */
export interface ServiceAlert {
  readonly id: string;
  readonly header: string;
  readonly description: string;
  readonly url?: string;
  readonly activePeriods: readonly ActivePeriod[];
  readonly lineCodes: readonly string[];
  readonly stationCodes: readonly string[];
  readonly source: Source;
  /** Set once the alert is no longer in its feed. */
  readonly endedAt?: Date;
}

export function createServiceAlert(input: ServiceAlert): ServiceAlert {
  for (const period of input.activePeriods) {
    if (period.start) requireObservedAt(period.start);
    if (period.end) requireObservedAt(period.end);
    if (period.start && period.end && period.end < period.start) {
      throw new InvalidMovementValueError('An active period must not end before it starts');
    }
  }
  return {
    id: requireNonEmpty('Service alert id', input.id),
    header: requireNonEmpty('Service alert header', input.header),
    description: requireNonEmpty('Service alert description', input.description),
    ...(input.url !== undefined && input.url.trim() !== '' && { url: input.url.trim() }),
    activePeriods: input.activePeriods.map((p) => ({
      ...(p.start && { start: p.start }),
      ...(p.end && { end: p.end }),
    })),
    lineCodes: [...new Set(input.lineCodes)],
    stationCodes: [...new Set(input.stationCodes)],
    source: requireSource(input.source),
    ...(input.endedAt && { endedAt: requireObservedAt(input.endedAt) }),
  };
}

/**
 * Merges the alerts of the latest feed into the stored ones, for one Source.
 * Alerts in the feed replace their stored version (and are active again); stored alerts of that
 * Source that are absent from the feed get `endedAt = now`, unless they already ended.
 * Alerts of other Sources are left as they are.
 */
export function reconcileServiceAlerts(
  stored: readonly ServiceAlert[],
  latest: readonly ServiceAlert[],
  source: Source,
  now: Date,
): ServiceAlert[] {
  const latestIds = new Set(latest.map((alert) => alert.id));
  const ended = stored
    .filter((alert) => alert.source === source && !latestIds.has(alert.id))
    .map((alert) => (alert.endedAt ? alert : { ...alert, endedAt: now }));
  const untouched = stored.filter((alert) => alert.source !== source);
  return [...untouched, ...ended, ...latest.map(({ endedAt: _ended, ...alert }) => alert)];
}
