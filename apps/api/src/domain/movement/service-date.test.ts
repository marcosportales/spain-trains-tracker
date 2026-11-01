import { describe, expect, it } from 'vitest';
import { serviceDateFor } from './service-date.js';

const operatesOn = (...dates: string[]) => ({ operatesOn: (d: string) => dates.includes(d) });

describe('serviceDateFor', () => {
  it('is the local calendar date for instants from 04:00 onwards', () => {
    // Winter, UTC+1: 03:00Z = 04:00 in Madrid.
    expect(
      serviceDateFor(new Date('2026-11-02T03:00:00Z'), operatesOn('2026-11-01', '2026-11-02')),
    ).toBe('2026-11-02');
    expect(serviceDateFor(new Date('2026-11-02T12:00:00Z'))).toBe('2026-11-02');
  });

  it('is the previous date before 04:00 when the schedule says the Run operates then', () => {
    // 00:30 local on Nov 2 (UTC+1) → a Run that started on Nov 1.
    const at = new Date('2026-11-01T23:30:00Z');
    expect(serviceDateFor(at, operatesOn('2026-11-01'))).toBe('2026-11-01');
    // 03:59 local is still before the cut-off.
    expect(serviceDateFor(new Date('2026-11-02T02:59:00Z'), operatesOn('2026-11-01'))).toBe(
      '2026-11-01',
    );
  });

  it('stays on the calendar date before 04:00 when the schedule does not cover the previous date', () => {
    const at = new Date('2026-11-01T23:30:00Z'); // 00:30 local on Nov 2
    expect(serviceDateFor(at, operatesOn('2026-11-02'))).toBe('2026-11-02');
    expect(serviceDateFor(at, operatesOn())).toBe('2026-11-02');
  });

  it('stays on the calendar date before 04:00 when no schedule is given', () => {
    expect(serviceDateFor(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
  });

  it('uses Madrid time, including summer time (UTC+2)', () => {
    // 22:30Z on Jun 30 = 00:30 on Jul 1 in Madrid.
    const at = new Date('2026-06-30T22:30:00Z');
    expect(serviceDateFor(at, operatesOn('2026-06-30'))).toBe('2026-06-30');
    // 02:00Z on Jul 1 = 04:00 in Madrid: the new Service date begins.
    expect(serviceDateFor(new Date('2026-07-01T02:00:00Z'), operatesOn('2026-06-30'))).toBe(
      '2026-07-01',
    );
  });

  it('crosses month and year boundaries', () => {
    expect(serviceDateFor(new Date('2026-12-31T23:30:00Z'), operatesOn('2026-12-31'))).toBe(
      '2026-12-31',
    );
    expect(serviceDateFor(new Date('2028-02-29T23:30:00Z'), operatesOn('2028-02-29'))).toBe(
      '2028-02-29',
    );
    expect(serviceDateFor(new Date('2028-02-29T00:30:00Z'), operatesOn('2028-02-28'))).toBe(
      '2028-02-28',
    );
  });

  it('rejects an invalid instant', () => {
    expect(() => serviceDateFor(new Date('nope'))).toThrow();
  });
});
