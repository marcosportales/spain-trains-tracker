import { describe, expect, it } from 'vitest';
import { createDelay } from './delay.js';
import { InvalidMovementValueError } from './errors.js';
import { createRunId } from './run-id.js';

const base = {
  runId: createRunId('3063', '2026-10-31'),
  source: 'gtfsrt_ld',
  observedAt: new Date('2026-10-31T10:00:00Z'),
  seconds: 180,
} as const;

describe('createDelay', () => {
  it('keeps seconds, allowing a Run that is ahead of schedule', () => {
    expect(createDelay(base).seconds).toBe(180);
    expect(createDelay({ ...base, seconds: -60 }).seconds).toBe(-60);
    expect(createDelay({ ...base, seconds: 0 }).seconds).toBe(0);
  });

  it('keeps an optional Station code, trimmed', () => {
    expect(createDelay({ ...base, atStationCode: ' 17000 ' }).atStationCode).toBe('17000');
    expect(createDelay(base)).not.toHaveProperty('atStationCode');
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s seconds', (seconds) => {
    expect(() => createDelay({ ...base, seconds })).toThrow(InvalidMovementValueError);
  });

  it('rejects an unknown Source, bad time or blank Station', () => {
    expect(() => createDelay({ ...base, source: 'x' as never })).toThrow(InvalidMovementValueError);
    expect(() => createDelay({ ...base, observedAt: new Date('nope') })).toThrow(
      InvalidMovementValueError,
    );
    expect(() => createDelay({ ...base, atStationCode: ' ' })).toThrow(InvalidMovementValueError);
  });
});
