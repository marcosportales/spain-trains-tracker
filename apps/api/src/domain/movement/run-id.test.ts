import { describe, expect, it } from 'vitest';
import { InvalidMovementValueError } from './errors.js';
import { createRunId, runIdEquals, runIdKey } from './run-id.js';

describe('createRunId', () => {
  it('normalizes the Train number to 5 digits', () => {
    expect(createRunId('3063', '2026-10-31')).toEqual({
      trainNumber: '03063',
      serviceDate: '2026-10-31',
    });
  });

  it.each(['03063', ' 03063 ', '3063', '003063', ' 3063\t'])(
    'treats Train number %j as the same Run',
    (trainNumber) => {
      expect(
        runIdEquals(createRunId(trainNumber, '2026-10-31'), createRunId('03063', '2026-10-31')),
      ).toBe(true);
    },
  );

  it('ignores whitespace around the Service date', () => {
    expect(
      runIdEquals(createRunId('3063', ' 2026-10-31 '), createRunId('3063', '2026-10-31')),
    ).toBe(true);
  });

  it('tells Runs apart by Train number and by Service date', () => {
    const run = createRunId('3063', '2026-10-31');
    expect(runIdEquals(run, createRunId('3064', '2026-10-31'))).toBe(false);
    expect(runIdEquals(run, createRunId('3063', '2026-11-01'))).toBe(false);
  });

  it('has a stable string key that agrees with equality', () => {
    expect(runIdKey(createRunId(' 3063', '2026-10-31'))).toBe('03063@2026-10-31');
  });

  it.each(['', '   ', 'AVE1', '12.5', '-3', '0', '00000', '123456', '1 2'])(
    'rejects Train number %j',
    (trainNumber) => {
      expect(() => createRunId(trainNumber, '2026-10-31')).toThrow(InvalidMovementValueError);
    },
  );

  it.each(['', '2026-13-01', '2026-02-30', '31-10-2026', '2026-1-1', 'today'])(
    'rejects Service date %j',
    (serviceDate) => {
      expect(() => createRunId('3063', serviceDate)).toThrow(InvalidMovementValueError);
    },
  );

  it('accepts 29 February in a leap year', () => {
    expect(createRunId('3063', '2028-02-29').serviceDate).toBe('2028-02-29');
  });
});
