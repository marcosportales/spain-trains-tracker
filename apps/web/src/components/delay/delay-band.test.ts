import { describe, expect, it } from 'vitest';
import { delayBandFor, delayMinutes } from './delay-band';

describe('delayBandFor', () => {
  it.each([
    [undefined, 'unknown'],
    [-120, 'on_time'],
    [0, 'on_time'],
    [299, 'on_time'],
    [300, 'late'],
    [899, 'late'],
    [900, 'severely_late'],
    [3600, 'severely_late'],
  ] as const)('%s s is %s', (seconds, expected) => {
    expect(delayBandFor(seconds)).toBe(expected);
  });

  it('is cancelled whatever the Delay', () => {
    for (const seconds of [undefined, -60, 0, 400, 1200])
      expect(delayBandFor(seconds, 'cancelled')).toBe('cancelled');
  });

  it('ignores a scheduled Service status', () => {
    expect(delayBandFor(400, 'scheduled')).toBe('late');
  });
});

describe('delayMinutes', () => {
  it('rounds to whole minutes, negative when early', () => {
    expect(delayMinutes(330)).toBe(6);
    expect(delayMinutes(-120)).toBe(-2);
  });
});
