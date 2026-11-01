import { InvalidMovementValueError, requireNonEmpty } from './errors.js';
import type { RunId } from './run-id.js';
import type { Source } from './source.js';
import { requireObservedAt, requireSource } from './validation.js';

export const SIGHTING_STATUSES = ['STOPPED_AT', 'INCOMING_AT', 'IN_TRANSIT_TO'] as const;
export type SightingStatus = (typeof SIGHTING_STATUSES)[number];

/** One reported position and status of a Run at an instant, from one Source. */
export interface Sighting {
  readonly runId: RunId;
  readonly source: Source;
  readonly observedAt: Date;
  readonly lat?: number;
  readonly lon?: number;
  readonly status: SightingStatus;
  /** The Station the status refers to (stopped at / approaching / heading to). */
  readonly stationCode?: string;
  readonly platform?: string;
  /** True when the position is the Station's, not a GPS fix. */
  readonly positionIsSnapped: boolean;
}

export type SightingInput = Omit<Sighting, 'positionIsSnapped'> & {
  readonly positionIsSnapped?: boolean;
};

/**
 * Builds a Sighting. Cercanías GTFS-RT only gives real GPS for IN_TRANSIT_TO; STOPPED_AT and
 * INCOMING_AT are snapped to the Station, so those are always marked snapped. Other Sources are
 * trusted unless the caller says otherwise.
 */
export function createSighting(input: SightingInput): Sighting {
  if (!(SIGHTING_STATUSES as readonly string[]).includes(input.status)) {
    throw new InvalidMovementValueError(`Unknown Sighting status "${String(input.status)}"`);
  }
  const source = requireSource(input.source);
  const hasPosition = input.lat !== undefined || input.lon !== undefined;
  if (hasPosition) {
    if (input.lat === undefined || input.lon === undefined) {
      throw new InvalidMovementValueError('A position needs both lat and lon');
    }
    assertCoordinate('latitude', input.lat, 90);
    assertCoordinate('longitude', input.lon, 180);
  }
  const snappedBySource = source === 'gtfsrt_cercanias' && input.status !== 'IN_TRANSIT_TO';

  return {
    runId: input.runId,
    source,
    observedAt: requireObservedAt(input.observedAt),
    ...(hasPosition && { lat: input.lat, lon: input.lon }),
    status: input.status,
    ...(input.stationCode !== undefined && {
      stationCode: requireNonEmpty('Station code', input.stationCode),
    }),
    ...(input.platform !== undefined && { platform: requireNonEmpty('Platform', input.platform) }),
    positionIsSnapped: snappedBySource || input.positionIsSnapped === true,
  };
}

function assertCoordinate(label: string, value: number, limit: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new InvalidMovementValueError(`Invalid ${label} ${value}: must be within ±${limit}`);
  }
}
