import { InvalidMovementValueError, requireNonEmpty } from './errors.js';
import type { RunId } from './run-id.js';
import type { Source } from './source.js';
import { requireObservedAt, requireSource } from './validation.js';

/** How far a Run was behind its schedule at an instant, in seconds (negative = ahead). */
export interface Delay {
  readonly runId: RunId;
  readonly source: Source;
  readonly observedAt: Date;
  readonly seconds: number;
  readonly atStationCode?: string;
}

export function createDelay(input: Delay): Delay {
  if (!Number.isInteger(input.seconds)) {
    throw new InvalidMovementValueError(`Delay seconds must be an integer, got ${input.seconds}`);
  }
  return {
    runId: input.runId,
    source: requireSource(input.source),
    observedAt: requireObservedAt(input.observedAt),
    seconds: input.seconds,
    ...(input.atStationCode !== undefined && {
      atStationCode: requireNonEmpty('Station code', input.atStationCode),
    }),
  };
}
