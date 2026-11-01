import { InvalidMovementValueError, requireNonEmpty } from './errors.js';
import type { RunId } from './run-id.js';
import { requireObservedAt } from './validation.js';

/** When a Run is expected to reach and leave one Station of its journey: the timetable plus its Delay. */
export interface RunStopEstimate {
  readonly runId: RunId;
  /** Position of the Station in the Run's journey, from 0. */
  readonly sequence: number;
  readonly stationCode: string;
  readonly scheduledArrival: Date;
  readonly scheduledDeparture: Date;
  readonly estimatedArrival: Date;
  readonly estimatedDeparture: Date;
}

export function createRunStopEstimate(input: RunStopEstimate): RunStopEstimate {
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new InvalidMovementValueError(
      `Stop sequence must be an integer ≥ 0, got ${input.sequence}`,
    );
  }
  return {
    runId: input.runId,
    sequence: input.sequence,
    stationCode: requireNonEmpty('Station code', input.stationCode),
    scheduledArrival: requireObservedAt(input.scheduledArrival),
    scheduledDeparture: requireObservedAt(input.scheduledDeparture),
    estimatedArrival: requireObservedAt(input.estimatedArrival),
    estimatedDeparture: requireObservedAt(input.estimatedDeparture),
  };
}
