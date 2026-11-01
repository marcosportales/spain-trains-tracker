import { describe, expect, it } from 'vitest';
import { InvalidMovementValueError } from './errors.js';
import { createRunId } from './run-id.js';
import { createRunStopEstimate } from './run-stop-estimate.js';

const runId = createRunId('13073', '2026-10-31');
const input = {
  runId,
  sequence: 3,
  stationCode: '51103',
  scheduledArrival: new Date('2026-10-31T21:12:00Z'),
  scheduledDeparture: new Date('2026-10-31T21:13:00Z'),
  estimatedArrival: new Date('2026-10-31T21:19:00Z'),
  estimatedDeparture: new Date('2026-10-31T21:20:00Z'),
};

describe('createRunStopEstimate', () => {
  it('builds an estimate of when a Run reaches and leaves a Station', () => {
    expect(createRunStopEstimate(input)).toEqual(input);
  });

  it('rejects a blank Station code, a bad sequence or an invalid time', () => {
    expect(() => createRunStopEstimate({ ...input, stationCode: ' ' })).toThrow(
      InvalidMovementValueError,
    );
    expect(() => createRunStopEstimate({ ...input, sequence: -1 })).toThrow(
      InvalidMovementValueError,
    );
    expect(() => createRunStopEstimate({ ...input, estimatedArrival: new Date('x') })).toThrow(
      InvalidMovementValueError,
    );
  });
});
