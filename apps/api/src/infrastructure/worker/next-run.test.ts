import { describe, expect, it } from 'vitest';
import { nextMadridTime } from './next-run.js';

describe('nextMadridTime', () => {
  it('picks 03:30 later today when it is still ahead (winter, UTC+1)', () => {
    expect(nextMadridTime(new Date('2026-12-01T01:00:00Z'), 3, 30).toISOString()).toBe(
      '2026-12-01T02:30:00.000Z',
    );
  });

  it('picks tomorrow once 03:30 has passed (summer, UTC+2)', () => {
    expect(nextMadridTime(new Date('2026-07-01T05:00:00Z'), 3, 30).toISOString()).toBe(
      '2026-07-02T01:30:00.000Z',
    );
  });

  it('is strictly after the given instant', () => {
    expect(nextMadridTime(new Date('2026-12-01T02:30:00Z'), 3, 30).toISOString()).toBe(
      '2026-12-02T02:30:00.000Z',
    );
  });

  it('follows the clock change at the end of October', () => {
    // 2026-10-25 03:00 CEST → 02:00 CET. 03:30 on the 26th is UTC+1.
    expect(nextMadridTime(new Date('2026-10-25T12:00:00Z'), 3, 30).toISOString()).toBe(
      '2026-10-26T02:30:00.000Z',
    );
  });
});
